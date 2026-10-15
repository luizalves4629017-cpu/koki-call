import { lerTelaAec } from "./audioStats";

export type ScreenSharePresetId = '1080p_90' | '1080p_60' | '720p_60' | '720p_30';

export interface ScreenSharePreset {
  id: ScreenSharePresetId;
  label: string;
  subLabel: string;
  badge: string;
  width: number;
  height: number;
  frameRate: number;
  maxBitrateBps: number;
}

export const SCREEN_SHARE_PRESETS: Record<ScreenSharePresetId, ScreenSharePreset> = {
  '1080p_90': {
    id: '1080p_90',
    label: '1080p @ 90 FPS',
    subLabel: 'Ultra / Alta Performance Gamer',
    badge: '1080p 90FPS',
    width: 1920,
    height: 1080,
    frameRate: 90,
    maxBitrateBps: 8000000,
  },
  '1080p_60': {
    id: '1080p_60',
    label: '1080p @ 60 FPS',
    subLabel: 'High / Padrão Fluido',
    badge: '1080p 60FPS',
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrateBps: 5000000,
  },
  '720p_60': {
    id: '720p_60',
    label: '720p @ 60 FPS',
    subLabel: 'Equilibrado / HD Fluido',
    badge: '720p 60FPS',
    width: 1280,
    height: 720,
    frameRate: 60,
    maxBitrateBps: 3000000,
  },
  '720p_30': {
    id: '720p_30',
    label: '720p @ 30 FPS',
    subLabel: 'Econômico / Baixo Consumo de Banda',
    badge: '720p 30FPS',
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrateBps: 1500000,
  },
};

// 720p60 por padrão: na malha P2P o upload é dividido entre as pessoas, e 1080p90 com pouca banda
// fazia o encoder descartar quadros (tela "travando"). 720p60 fica liso com ~1,5–3 Mbps.
export const DEFAULT_SCREEN_PRESET_ID: ScreenSharePresetId = '720p_60';

/**
 * O navegador consegue tirar o som do próprio Eco (vozes da call) do áudio do sistema?
 * - Chrome/Edge 141+ no Windows/ChromeOS: sim (restrictOwnAudio).
 * - App Windows (Electron 33 = Chromium 130): não. Detectado pela versão do Chromium.
 * Quando não dá, ligamos o cancelamento de eco SÓ na trilha de áudio da tela: o Chromium usa
 * o som que ele mesmo está tocando (as vozes da call) como referência e tira ele do áudio do PC,
 * então ninguém se ouve de volta. Quando dá, deixamos o áudio da tela limpo (sem nenhum filtro).
 */
export function navegadorExcluiProprioAudio(): boolean {
  try {
    const ua = navigator.userAgent || "";
    const m = ua.match(/Chrom(?:e|ium)\/(\d+)/);
    const versao = m ? parseInt(m[1], 10) : 0;
    const plataformaOk = /Windows|CrOS/i.test(ua);
    return plataformaOk && versao >= 141;
  } catch {
    return false;
  }
}

/**
 * Windows 10 não tem o "process loopback" (precisa do build 20348+ = Windows 11). Sem ele, nem o
 * Chrome (restrictOwnAudio) nem o app (loopbackWithoutChrome) conseguem tirar as vozes da call do
 * áudio do PC: quem transmite manda a voz dos outros de volta pra eles (eco).
 * Detecta pelo userAgentData (platformVersion < 13 = Windows 10). Calculado uma vez ao carregar.
 */
let _semExclusao: boolean | null = null;
(async () => {
  try {
    const uad: any = (navigator as any).userAgentData;
    if (!uad?.getHighEntropyValues) return;
    const v = await uad.getHighEntropyValues(["platform", "platformVersion"]);
    if (String(v.platform) === "Windows") {
      const major = parseInt(String(v.platformVersion || "0").split(".")[0], 10);
      _semExclusao = major > 0 && major < 13;
    } else {
      _semExclusao = false;
    }
    console.log(`[tela] Windows ${_semExclusao ? "10 (sem exclusão do som do Eco → cancelamento de eco no áudio da tela)" : "11/outro"}`);
  } catch { /* ignore */ }
})();
export function semExclusaoDoProprioAudio(): boolean {
  return _semExclusao === true;
}
/** Cancelamento de eco no áudio da tela: escolha do usuário; no Automático, só no Windows 10. */
export function querAecNaTela(): boolean {
  const pref = lerTelaAec();
  if (pref === "on") return true;
  if (pref === "off") return false;
  return semExclusaoDoProprioAudio();
}

/**
 * Returns DisplayMedia constraints matching the selected preset
 * Default: 1080p @ 90 FPS ({ width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 90, max: 90 } })
 */
export function getDisplayMediaConstraints(presetId: ScreenSharePresetId = DEFAULT_SCREEN_PRESET_ID): DisplayMediaStreamOptions {
  const preset = SCREEN_SHARE_PRESETS[presetId] || SCREEN_SHARE_PRESETS['1080p_90'];
  const excluiProprio = navegadorExcluiProprioAudio();
  // Cancelamento de eco no áudio da tela: automático, ou forçado pelo painel de diagnóstico (Ctrl+Shift+D)
  const aecPref = lerTelaAec();
  // Automático = DESLIGADO em todo lugar. Antes, no app Windows (Electron/Chromium antigo) o automático
  // ligava o cancelamento de eco na trilha da tela, e isso deixava o MICROFONE em silêncio (-88 dB).
  // O app novo (Electron 44) já tira o som do próprio Eco da captura, igual ao Chrome 141+.
  void excluiProprio;
  void aecPref;
  const aecTela = querAecNaTela();
  return {
    video: {
      width: { ideal: preset.width, max: preset.width },
      height: { ideal: preset.height, max: preset.height },
      frameRate: { ideal: preset.frameRate, max: preset.frameRate },
    } as any,
    audio: {
      // Áudio da tela é uma trilha SEPARADA do microfone (slot 3) e nunca passa pela IA/gate/AGC.
      // Cancelamento de eco só quando o navegador não consegue excluir o som do próprio Eco (ver acima).
      echoCancellation: aecTela,
      noiseSuppression: false,
      autoGainControl: false,
      // Quem compartilha continua ouvindo a call e o próprio PC normalmente
      // (true faria o navegador silenciar o som local = parar de ouvir os outros)
      suppressLocalAudioPlayback: false,
      // Chrome 141+: não captura o som que sai desta própria aba/app (o áudio da call)
      restrictOwnAudio: true,
    } as any,
    // Chrome: no compartilhamento da tela inteira, o áudio do sistema vem desmarcado por padrão
    systemAudio: "include",
    windowAudio: "system",
    // Não oferece a própria aba do Eco na lista (evita espelho infinito e o áudio da call)
    selfBrowserSurface: "exclude",
  } as any;
}

/**
 * Dynamically re-applies constraints (track.applyConstraints()) and adjusts sender encodings for WebRTC peers
 */
export async function applyScreenShareQuality(
  stream: MediaStream | null,
  presetId: ScreenSharePresetId,
  peerConnections?: Map<string, RTCPeerConnection>
): Promise<boolean> {
  if (!stream) return false;
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return false;

  const preset = SCREEN_SHARE_PRESETS[presetId] || SCREEN_SHARE_PRESETS['1080p_90'];

  try {
    await videoTrack.applyConstraints({
      width: { ideal: preset.width, max: preset.width },
      height: { ideal: preset.height, max: preset.height },
      frameRate: { ideal: preset.frameRate, max: preset.frameRate },
    });
  } catch (err) {
    console.warn("Could not apply exact screen share constraints:", err);
  }

  // Adjust RTCRtpSender parameters on all peer connections
  if (peerConnections) {
    peerConnections.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && (sender.track.id === videoTrack.id || sender.track.label.toLowerCase().includes("screen"))) {
          try {
            const params = sender.getParameters();
            if (params.encodings && params.encodings.length > 0) {
              params.encodings.forEach((enc) => {
                enc.maxBitrate = preset.maxBitrateBps;
                enc.maxFramerate = preset.frameRate;
              });
              sender.setParameters(params).catch(() => {});
            }
          } catch (e) {
            // ignore
          }
        }
      });
    });
  }

  return true;
}
