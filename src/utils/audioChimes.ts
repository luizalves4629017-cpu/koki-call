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
export function playVoiceJoinChime(volume: number = 0.25): void {
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
