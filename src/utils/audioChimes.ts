// src/utils/audioChimes.ts
// Pure Web Audio API Synthesized Audio Chimes (Zero external audio files, guaranteed reliable)

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (err) {
    console.warn("Web Audio API not supported:", err);
    return null;
  }
}

/**
 * Plays a soft, pleasant Web Audio API synthesized voice channel connection chime.
 * Uses a gentle two-note ascending harmonic chime (D5 -> A5) with a smooth attack and exponential decay.
 * Guaranteed no broken or missing external audio files.
 */
function tocarSinoOriginal(volume: number = 0.25): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master chime gain envelope
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(Math.max(0.01, Math.min(1, volume)), now + 0.02);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    masterGain.connect(ctx.destination);

    // Warm Lowpass Filter to soften high frequencies into a warm bell tone
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.8);
    filter.connect(masterGain);

    // Note 1: First soft bell frequency (D5 / 587.33 Hz)
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.025);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    osc1.connect(gain1);
    gain1.connect(filter);

    // Note 2: Second ascending harmonic bell chime (A5 / 880 Hz) - triggers with a slight 75ms delay
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.075);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.setValueAtTime(0.0001, now + 0.075);
    gain2.gain.linearRampToValueAtTime(0.45, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(filter);

    // Start & stop oscillators
    osc1.start(now);
    osc1.stop(now + 0.7);

    osc2.start(now + 0.075);
    osc2.stop(now + 0.9);
  } catch (e) {
    console.warn("Could not play voice join chime:", e);
  }
}

// ---------------------------------------------------------------------------
// Sons de entrada selecionáveis (Configurações → Som de entrada). Guardado no localStorage.
// ---------------------------------------------------------------------------
export type SomEntradaId = "sino" | "pop" | "discord" | "grave" | "nenhum";
export const SONS_ENTRADA: { id: SomEntradaId; nome: string }[] = [
  { id: "sino", nome: "Sino (original)" },
  { id: "pop", nome: "Pop curto" },
  { id: "discord", nome: "Estilo Discord" },
  { id: "grave", nome: "Sino grave" },
  { id: "nenhum", nome: "Sem som" },
];
const CHAVE_SOM = "eco:somEntrada";
export function getSomEntrada(): SomEntradaId {
  try {
    const v = localStorage.getItem(CHAVE_SOM) as SomEntradaId | null;
    if (v && SONS_ENTRADA.some((s) => s.id === v)) return v;
  } catch { /* ignore */ }
  return "sino";
}
export function setSomEntrada(id: SomEntradaId) {
  try { localStorage.setItem(CHAVE_SOM, id); } catch { /* ignore */ }
}

/** Nota simples com envelope (ataque curto + decaimento exponencial). */
function nota(ctx: AudioContext, destino: AudioNode, freq: number, inicio: number, dur: number, pico: number, tipo: OscillatorType = "sine", freqFim?: number) {
  const osc = ctx.createOscillator();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, inicio);
  if (freqFim) osc.frequency.exponentialRampToValueAtTime(freqFim, inicio + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, inicio);
  g.gain.linearRampToValueAtTime(pico, inicio + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
  osc.connect(g);
  g.connect(destino);
  osc.start(inicio);
  osc.stop(inicio + dur + 0.02);
}

function saida(ctx: AudioContext, volume: number, corte = 4000) {
  const master = ctx.createGain();
  master.gain.value = Math.max(0.01, Math.min(1, volume));
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = corte;
  f.connect(master);
  master.connect(ctx.destination);
  return f;
}

function tocarPop(volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const out = saida(ctx, volume, 3500);
  // "bolha": sobe rápido de tom e some em ~120 ms
  nota(ctx, out, 420, t, 0.12, 0.9, "sine", 980);
  nota(ctx, out, 840, t, 0.06, 0.15, "triangle", 1600);
}

function tocarDiscord(volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const out = saida(ctx, volume, 5000);
  // duas notas curtas e brilhantes subindo (E5 → B5), com leve harmônico
  nota(ctx, out, 659.25, t, 0.16, 0.5, "triangle");
  nota(ctx, out, 1318.5, t, 0.1, 0.08, "sine");
  nota(ctx, out, 987.77, t + 0.09, 0.26, 0.55, "triangle");
  nota(ctx, out, 1975.5, t + 0.09, 0.14, 0.07, "sine");
}

function tocarGrave(volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const out = saida(ctx, volume, 1200);
  // sino grave e quente (A3 + E4), decaimento longo
  nota(ctx, out, 220, t, 1.1, 0.6, "sine");
  nota(ctx, out, 440.5, t, 0.7, 0.18, "sine");
  nota(ctx, out, 329.63, t + 0.11, 1.0, 0.5, "sine");
}

/** Toca um som específico (usado no botão "Testar"). */
export function tocarSomEntrada(id: SomEntradaId, volume: number = 0.25): void {
  try {
    if (id === "nenhum") return;
    if (id === "pop") return tocarPop(volume);
    if (id === "discord") return tocarDiscord(volume);
    if (id === "grave") return tocarGrave(volume);
    return tocarSinoOriginal(volume);
  } catch (e) {
    console.warn("Could not play join sound:", e);
  }
}

/** Som de quando alguém entra: usa o escolhido nas Configurações. */
export function playVoiceJoinChime(volume: number = 0.25): void {
  tocarSomEntrada(getSomEntrada(), volume);
}
