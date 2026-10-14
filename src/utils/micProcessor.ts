// Processamento do microfone do eco (estilo Krisp do Discord):
//   microfone → AudioContext (48 kHz) → RNNoise (IA, AudioWorklet + wasm) → noise gate → MediaStreamDestination
// A trilha processada é a que vai para as conexões WebRTC e para o indicador de fala.
// Se algo falhar (navegador antigo, wasm bloqueado...), MicProcessor.create devolve null
// e a call continua com a trilha crua + filtros do navegador. Nunca derruba a call.
import { RnnoiseWorkletNode, loadRnnoise } from "@sapphi-red/web-noise-suppressor";
import rnnoiseWorkletUrl from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import gateWorkletUrl from "../audio/ecoGateWorklet.js?url&no-inline";

export interface MicProcessorOptions {
  aiNoiseSuppression: boolean;
  autoSensitivity: boolean;
  sensitivityDb: number;
}

export interface MicLevelInfo {
  levelDb: number;
  thresholdDb: number;
  open: boolean;
}

export const MIC_DB_MIN = -100;
export const MIC_DB_MAX = 0;

// O wasm do RNNoise é baixado uma vez só (troca de microfone não baixa de novo)
let rnnoiseWasmPromise: Promise<ArrayBuffer> | null = null;
const getRnnoiseWasm = () => {
  if (!rnnoiseWasmPromise) {
    rnnoiseWasmPromise = loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl }).catch((e) => {
      rnnoiseWasmPromise = null;
      throw e;
    });
  }
  return rnnoiseWasmPromise;
};

const supportsWorklet = () =>
  typeof window !== "undefined" &&
  typeof (window as any).AudioContext === "function" &&
  typeof (window as any).AudioWorkletNode === "function" &&
  typeof (window as any).MediaStreamAudioDestinationNode === "function";

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | "timeout"> =>
  Promise.race([p, new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);

export class MicProcessor {
  readonly track: MediaStreamTrack;
  readonly rawTrack: MediaStreamTrack;
  readonly aiAvailable: boolean;

  private ctx: AudioContext;
  private rawStream: MediaStream;
  private source: MediaStreamAudioSourceNode;
  private mono: GainNode;
  private rnnoise: RnnoiseWorkletNode | null;
  private gate: AudioWorkletNode;
  private dest: MediaStreamAudioDestinationNode;
  private aiOn = false;
  private wired = false;
  private closed = false;
  private listeners = new Set<(info: MicLevelInfo) => void>();
  private lastInfo: MicLevelInfo = { levelDb: MIC_DB_MIN, thresholdDb: -55, open: false };
  private resumeOnGesture = () => {
    if (!this.closed && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  };

  private constructor(parts: {
    ctx: AudioContext;
    rawTrack: MediaStreamTrack;
    rawStream: MediaStream;
    source: MediaStreamAudioSourceNode;
    mono: GainNode;
    rnnoise: RnnoiseWorkletNode | null;
    gate: AudioWorkletNode;
    dest: MediaStreamAudioDestinationNode;
  }) {
    this.ctx = parts.ctx;
    this.rawTrack = parts.rawTrack;
    this.rawStream = parts.rawStream;
    this.source = parts.source;
    this.mono = parts.mono;
    this.rnnoise = parts.rnnoise;
    this.gate = parts.gate;
    this.dest = parts.dest;
    this.aiAvailable = !!parts.rnnoise;
    this.track = parts.dest.stream.getAudioTracks()[0];

    this.gate.port.onmessage = (e: MessageEvent) => {
      const d = e.data as MicLevelInfo;
      if (!d || typeof d.levelDb !== "number") return;
      this.lastInfo = d;
      this.listeners.forEach((cb) => cb(d));
    };

    // Se o navegador suspender o áudio (aba em segundo plano, fone trocado...), tenta voltar
    this.ctx.onstatechange = () => {
      if (!this.closed && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", this.resumeOnGesture, true);
    window.addEventListener("keydown", this.resumeOnGesture, true);
  }

  /** Monta o pipeline. Devolve null se o navegador não aguentar (usar a trilha crua). */
  static async create(rawTrack: MediaStreamTrack, opts: MicProcessorOptions): Promise<MicProcessor | null> {
    if (!supportsWorklet()) {
      console.warn("[mic-ia] AudioWorklet não suportado neste navegador; usando microfone com filtros do navegador.");
      return null;
    }

    const rawStream = new MediaStream([rawTrack]);
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let at48k = true;

    try {
      try {
        ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
        source = ctx.createMediaStreamSource(rawStream);
      } catch (e) {
        // Firefox antigo não liga fontes de taxa diferente num contexto de 48 kHz: segue só com o gate
        console.warn("[mic-ia] AudioContext 48 kHz indisponível, IA desligada (só noise gate):", e);
        if (ctx) ctx.close().catch(() => {});
        at48k = false;
        ctx = new AudioContext({ latencyHint: "interactive" });
        source = ctx.createMediaStreamSource(rawStream);
      }
      if (ctx.sampleRate !== 48000) at48k = false;

      // Gate (obrigatório para o pipeline)
      await ctx.audioWorklet.addModule(gateWorkletUrl);

      // RNNoise (opcional: se falhar, continua só com o gate)
      let rnnoise: RnnoiseWorkletNode | null = null;
      if (at48k) {
        try {
          const wasmBinary = await getRnnoiseWasm();
          await ctx.audioWorklet.addModule(rnnoiseWorkletUrl);
          rnnoise = new RnnoiseWorkletNode(ctx, { wasmBinary, maxChannels: 1 });
        } catch (e) {
          console.warn("[mic-ia] RNNoise (wasm) falhou; seguindo só com o noise gate:", e);
          rnnoise = null;
        }
      }

      // Mixa para mono (RNNoise trabalha em 1 canal; voz não precisa de estéreo)
      const mono = ctx.createGain();
      mono.channelCount = 1;
      mono.channelCountMode = "explicit";
      mono.channelInterpretation = "speakers";

      const gate = new AudioWorkletNode(ctx, "eco-noise-gate", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { auto: opts.autoSensitivity, thresholdDb: opts.sensitivityDb },
      });

      const dest = ctx.createMediaStreamDestination();
      dest.channelCount = 1;

      source.connect(mono);
      gate.connect(dest);

      if (ctx.state !== "running") {
        const r = await withTimeout(ctx.resume().then(() => "ok" as const), 1500);
        if (r === "timeout" || (ctx.state as AudioContextState) !== "running") {
          throw new Error(`AudioContext não iniciou (estado: ${ctx.state})`);
        }
      }

      const proc = new MicProcessor({ ctx, rawTrack, rawStream, source, mono, rnnoise, gate, dest });
      proc.setOptions(opts);
      console.info(
        `[mic-ia] microfone processado ativo (${rnnoise ? "RNNoise + " : ""}noise gate, ${ctx.sampleRate} Hz).`
      );
      return proc;
    } catch (e) {
      console.warn("[mic-ia] Falha ao montar o processamento do microfone; usando a trilha crua:", e);
      try { source?.disconnect(); } catch { /* ignore */ }
      if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
      return null;
    }
  }

  /** Atualiza IA / sensibilidade ao vivo, sem renegociar nem pedir o microfone de novo. */
  setOptions(opts: MicProcessorOptions) {
    if (this.closed) return;
    const wantAi = !!opts.aiNoiseSuppression && !!this.rnnoise;
    if (wantAi !== this.aiOn || !this.wired) {
      try { this.mono.disconnect(); } catch { /* ignore */ }
      try { this.rnnoise?.disconnect(); } catch { /* ignore */ }
      if (wantAi && this.rnnoise) {
        this.mono.connect(this.rnnoise);
        this.rnnoise.connect(this.gate);
      } else {
        this.mono.connect(this.gate);
      }
      this.aiOn = wantAi;
      this.wired = true;
    }
    this.gate.port.postMessage({
      auto: !!opts.autoSensitivity,
      thresholdDb: Math.max(MIC_DB_MIN, Math.min(MIC_DB_MAX, Number(opts.sensitivityDb) || -50)),
    });
  }
  /**
   * Proteção (usada principalmente ao iniciar/parar o compartilhamento de tela):
   * - acorda o AudioContext se o navegador suspendeu;
   * - garante a trilha crua ligada (o mute da call é feito na trilha processada, nunca na crua);
   * - religa a corrente microfone → IA → gate se algo desconectou.
   * Devolve false se o pipeline morreu de vez (contexto fechado ou trilha encerrada) e precisa ser refeito.
   */
  ensureAlive(): boolean {
    if (this.closed) return false;
    if (this.ctx.state === "closed") return false;
    if (this.rawTrack.readyState === "ended" || this.track.readyState === "ended") return false;
    if (!this.rawTrack.enabled) this.rawTrack.enabled = true;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return true;
  }

  /** Estado atual do pipeline (para diagnóstico e teste automatizado). */
  diagnostico() {
    return {
      ctxState: this.ctx.state,
      rawState: this.rawTrack.readyState,
      rawEnabled: this.rawTrack.enabled,
      rawMuted: this.rawTrack.muted,
      rawSettings: (() => { try { const s: any = this.rawTrack.getSettings(); return { autoGainControl: s.autoGainControl, echoCancellation: s.echoCancellation, noiseSuppression: s.noiseSuppression, sampleRate: s.sampleRate, deviceId: s.deviceId }; } catch { return null; } })(),
      trackState: this.track.readyState,
      trackEnabled: this.track.enabled,
      aiOn: this.aiOn,
      levelDb: this.lastInfo.levelDb,
      thresholdDb: this.lastInfo.thresholdDb,
      gateOpen: this.lastInfo.open,
      makeupDb: (this.lastInfo as any).makeupDb ?? 0,
      gateGain: (this.lastInfo as any).gain ?? null,
    };
  }

  get aiActive() {
    return this.aiOn;
  }

  get level(): MicLevelInfo {
    return this.lastInfo;
  }

  /** Recebe o nível do microfone (após a IA, antes do gate) e o limite atual. */
  subscribe(cb: (info: MicLevelInfo) => void): () => void {
    this.listeners.add(cb);
    cb(this.lastInfo);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Para tudo: microfone cru, trilha processada e AudioContext. Pode chamar mais de uma vez. */
  close() {
    if (this.closed) return;
    this.closed = true;
    this.listeners.clear();
    window.removeEventListener("pointerdown", this.resumeOnGesture, true);
    window.removeEventListener("keydown", this.resumeOnGesture, true);
    try { this.gate.port.onmessage = null; } catch { /* ignore */ }
    try { this.source.disconnect(); } catch { /* ignore */ }
    try { this.mono.disconnect(); } catch { /* ignore */ }
    try { this.rnnoise?.disconnect(); this.rnnoise?.destroy(); } catch { /* ignore */ }
    try { this.gate.disconnect(); } catch { /* ignore */ }
    try { this.track.stop(); } catch { /* ignore */ }
    this.rawStream.getTracks().forEach((t) => {
      try { t.stop(); } catch { /* ignore */ }
    });
    this.ctx.onstatechange = null;
    if (this.ctx.state !== "closed") this.ctx.close().catch(() => {});
  }
}
