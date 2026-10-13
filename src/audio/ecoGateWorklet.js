// Noise gate do eco (AudioWorklet).
// - Abaixo da sensibilidade o áudio é silenciado.
// - Ataque curto (~5 ms) para não comer o começo das palavras.
// - Release ~250 ms (segura aberto) + fade curto para não cortar o fim das palavras.
// - Modo automático: acompanha o ruído de fundo e põe o limite um pouco acima dele.
// - Manda o nível (dBFS) e o limite atual para o medidor das Configurações (~23x por segundo).

const MIN_DB = -100;

class EcoNoiseGateProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.auto = o.auto !== false;
    this.manualDb = typeof o.thresholdDb === "number" ? o.thresholdDb : -50;

    this.attackSec = 0.005;
    this.holdSec = 0.25;
    this.fadeSec = 0.06;
    this.hysteresisDb = 4;

    this.gain = 0;
    this.holdLeft = 0;
    this.floorDb = -70;
    this.thresholdDb = this.auto ? -55 : this.manualDb;
    this.isOpen = false;

    this.reportEvery = 16; // blocos de 128 amostras (~43 ms a 48 kHz)
    this.blockCount = 0;
    this.peakDb = MIN_DB;

    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (typeof d.auto === "boolean") this.auto = d.auto;
      if (typeof d.thresholdDb === "number") this.manualDb = d.thresholdDb;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const frames = output[0].length;

    if (!input || input.length === 0 || !input[0]) {
      for (let c = 0; c < output.length; c++) output[c].fill(0);
      this.report(MIN_DB);
      return true;
    }

    // RMS do bloco (média dos canais)
    let sum = 0;
    let count = 0;
    for (let c = 0; c < input.length; c++) {
      const ch = input[c];
      for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
      count += ch.length;
    }
    const rms = count > 0 ? Math.sqrt(sum / count) : 0;
    const db = Math.max(MIN_DB, 20 * Math.log10(rms + 1e-10));

    // Ruído de fundo (modo automático): desce rápido, sobe devagar (~3 s)
    const blockSec = frames / sampleRate;
    if (db < this.floorDb) this.floorDb += (db - this.floorDb) * Math.min(1, blockSec / 0.1);
    else this.floorDb += (db - this.floorDb) * Math.min(1, blockSec / 3);

    if (this.auto) {
      const target = Math.min(-28, Math.max(-60, this.floorDb + 15));
      this.thresholdDb += (target - this.thresholdDb) * Math.min(1, blockSec / 0.5);
    } else {
      this.thresholdDb = this.manualDb;
    }

    const openDb = this.thresholdDb;
    const closeDb = this.thresholdDb - this.hysteresisDb;
    if (db >= openDb) {
      this.isOpen = true;
      this.holdLeft = this.holdSec;
    } else if (db < closeDb || !this.isOpen) {
      this.holdLeft -= blockSec;
      if (this.holdLeft <= 0) {
        this.holdLeft = 0;
        this.isOpen = false;
      }
    } else {
      // entre os dois limites: continua como está, mas renova a espera
      this.holdLeft = this.holdSec;
    }

    const target = this.isOpen ? 1 : 0;
    const upStep = 1 / (this.attackSec * sampleRate);
    const downStep = 1 / (this.fadeSec * sampleRate);

    let g = this.gain;
    const nIn = input.length;
    for (let i = 0; i < frames; i++) {
      if (g < target) g = Math.min(target, g + upStep);
      else if (g > target) g = Math.max(target, g - downStep);
      for (let c = 0; c < output.length; c++) {
        const src = input[Math.min(c, nIn - 1)];
        output[c][i] = src ? src[i] * g : 0;
      }
    }
    this.gain = g;

    this.report(db);
    return true;
  }

  report(db) {
    if (db > this.peakDb) this.peakDb = db;
    this.blockCount++;
    if (this.blockCount >= this.reportEvery) {
      this.port.postMessage({ levelDb: this.peakDb, thresholdDb: this.thresholdDb, open: this.isOpen });
      this.blockCount = 0;
      this.peakDb = MIN_DB;
    }
  }
}

registerProcessor("eco-noise-gate", EcoNoiseGateProcessor);
