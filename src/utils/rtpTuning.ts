// Ajuste fino dos envios WebRTC para o áudio NUNCA ficar sem banda quando a tela é compartilhada.
//
// Por que existe: a call é em malha (cada pessoa manda a tela direto pra cada outra pessoa).
// Antes, a tela saía com até 8 Mbps POR PESSOA. Numa internet de casa isso enche o upload,
// o roteador começa a acumular fila (bufferbloat) e TUDO atrasa nos dois sentidos: os pacotes
// de voz chegam tarde, o receptor "inventa" o áudio que falta (ocultação do NetEq) e o som
// vai sumindo aos poucos até o silêncio. Exatamente o "vai abaixando até sumir" relatado.
//
// O que fazemos:
//  - microfone e áudio da tela com prioridade alta (priority/networkPriority = "high") e banda reservada;
//  - vídeo da tela com prioridade baixa e um orçamento TOTAL de upload dividido entre as pessoas;
//  - controle adaptativo: se a rede mostrar fila (RTT alto / perda), corta o bitrate da tela na hora
//    e só sobe de novo devagar.
import { SCREEN_SHARE_PRESETS, ScreenSharePresetId } from "./screenShareConfig";

export const MIC_MAX_BITRATE = 64_000;
export const TELA_AUDIO_MAX_BITRATE = 128_000;
/** Orçamento total de upload para o vídeo da tela (somando todas as pessoas). */
export const ORCAMENTO_TELA_BPS = 3_000_000;
export const MIN_TELA_BPS = 250_000;

type Slots = {
  audioTransceiver?: RTCRtpTransceiver;
  cameraTransceiver?: RTCRtpTransceiver;
  screenTransceiver?: RTCRtpTransceiver;
  screenAudioTransceiver?: RTCRtpTransceiver;
};

const setarParams = (sender: RTCRtpSender | undefined, mexer: (enc: any, params: any) => boolean) => {
  if (!sender) return;
  try {
    const params: any = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) return; // ainda não negociado
    let mudou = false;
    params.encodings.forEach((enc: any) => {
      if (mexer(enc, params)) mudou = true;
    });
    if (mudou) sender.setParameters(params).catch(() => {});
  } catch {
    /* ignore */
  }
};

/** Prioridade alta + banda reservada para as duas trilhas de áudio. Idempotente. */
export function priorizarAudio(slots: Slots | undefined) {
  if (!slots) return;
  const audio = (enc: any, max: number) => {
    let m = false;
    if (enc.priority !== "high") { enc.priority = "high"; m = true; }
    if (enc.networkPriority !== "high") { enc.networkPriority = "high"; m = true; }
    if (enc.maxBitrate !== max) { enc.maxBitrate = max; m = true; }
    if (enc.active === false) { enc.active = true; m = true; }
    return m;
  };
  setarParams(slots.audioTransceiver?.sender, (enc) => audio(enc, MIC_MAX_BITRATE));
  setarParams(slots.screenAudioTransceiver?.sender, (enc) => audio(enc, TELA_AUDIO_MAX_BITRATE));
  // Câmera também abaixo do áudio
  setarParams(slots.cameraTransceiver?.sender, (enc) => {
    let m = false;
    if (enc.priority !== "low") { enc.priority = "low"; m = true; }
    if (enc.networkPriority !== "low") { enc.networkPriority = "low"; m = true; }
    return m;
  });
}

/** Teto por pessoa para o vídeo da tela: orçamento total dividido, limitado pelo preset. */
export function tetoTelaPorPessoa(presetId: ScreenSharePresetId, pessoas: number, fatorRede = 1): number {
  const preset = SCREEN_SHARE_PRESETS[presetId] || SCREEN_SHARE_PRESETS["1080p_60"];
  const n = Math.max(1, pessoas);
  const porPessoa = Math.min(preset.maxBitrateBps, ORCAMENTO_TELA_BPS / n) * fatorRede;
  return Math.round(Math.max(MIN_TELA_BPS, porPessoa));
}

/** Aplica o teto no vídeo da tela de uma conexão (prioridade baixa, equilíbrio entre fps e resolução). */
export function limitarVideoTela(slots: Slots | undefined, maxBitrate: number, maxFps: number) {
  if (!slots) return;
  setarParams(slots.screenTransceiver?.sender, (enc, params) => {
    let m = false;
    if (enc.maxBitrate !== maxBitrate) { enc.maxBitrate = maxBitrate; m = true; }
    if (enc.maxFramerate !== maxFps) { enc.maxFramerate = maxFps; m = true; }
    if (enc.priority !== "low") { enc.priority = "low"; m = true; }
    if (enc.networkPriority !== "low") { enc.networkPriority = "low"; m = true; }
    // Fluidez primeiro: com pouca banda o navegador baixa a resolução, mas mantém os quadros por segundo
    if (params.degradationPreference !== "maintain-framerate") { params.degradationPreference = "maintain-framerate"; m = true; }
    return m;
  });
}

/**
 * Lê a saúde da conexão (RTT e perda que o outro lado reporta) para o controle adaptativo.
 * Devolve null se ainda não houver números.
 */
export async function saudeConexao(pc: RTCPeerConnection): Promise<{ rttMs: number; perda: number; disponivelBps: number; relay: boolean } | null> {
  try {
    const stats = await pc.getStats();
    let rtt = 0;
    let perda = 0;
    let disp = 0;
    let localId = "";
    let remoteId = "";
    stats.forEach((r: any) => {
      if (r.type === "remote-inbound-rtp" && r.kind === "audio") {
        if (typeof r.roundTripTime === "number") rtt = Math.max(rtt, r.roundTripTime * 1000);
        if (typeof r.fractionLost === "number") perda = Math.max(perda, r.fractionLost);
      }
      if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") {
        if (typeof r.availableOutgoingBitrate === "number") disp = r.availableOutgoingBitrate;
        if (!rtt && typeof r.currentRoundTripTime === "number") rtt = r.currentRoundTripTime * 1000;
        localId = r.localCandidateId || "";
        remoteId = r.remoteCandidateId || "";
      }
    });
    let relay = false;
    stats.forEach((r: any) => {
      if ((r.id === localId || r.id === remoteId) && r.candidateType === "relay") relay = true;
    });
    return { rttMs: rtt, perda, disponivelBps: disp, relay };
  } catch {
    return null;
  }
}

/**
 * Fator de rede (0.1–1) por conexão: cai pela metade quando há fila/perda, sobe 15% a cada
 * verificação boa. Guardado fora do React (Map por peer).
 */
export function proximoFator(atual: number, s: { rttMs: number; perda: number } | null, rttBaseMs = 0): number {
  if (!s) return atual;
  // Compara com o RTT "normal" desta conexão (o menor já visto), não com um número fixo:
  // pelo TURN o RTT base já é alto (200–300 ms) e antes isso derrubava a tela pra 250 kbps / 15 fps
  // mesmo sem congestionamento nenhum — era o principal motivo da tela travando.
  const fila = rttBaseMs > 0 ? s.rttMs - rttBaseMs : s.rttMs - 150;
  if (fila > 200 || s.perda > 0.06) return Math.max(0.25, atual * 0.7);
  if (fila > 100 || s.perda > 0.03) return atual; // segura
  return Math.min(1, atual * 1.2);
}
