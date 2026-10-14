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

    // Ganho automático PRÓPRIO, só para CIMA (0 a +12 dB). Substitui o AGC do navegador, que no
    // Windows mexe no volume do microfone do sistema e, com som do PC/jogo vazando no mic,
    // vai abaixando o microfone aos poucos até quase zero. Este aqui nunca fica abaixo de 0 dB.
    this.agcOn = o.agc !== false;
    this.speechDb = -26;
    this.makeupDb = 0;
    this.picoDb = -20;

    this.reportEvery = 16; // blocos de 128 amostras (~43 ms a 48 kHz)
    this.blockCount = 0;
    this.peakDb = MIN_DB;

    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (typeof d.auto === "boolean") this.auto = d.auto;
      if (typeof d.thresholdDb === "number") this.manualDb = d.thresholdDb;
      if (typeof d.agc === "boolean") this.agcOn = d.agc;
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
    let pico = 0;
    for (let c = 0; c < input.length; c++) {
      const ch = input[c];
      for (let i = 0; i < ch.length; i++) { const a = ch[i] < 0 ? -ch[i] : ch[i]; if (a > pico) pico = a; }
    }
    const picoBlocoDb = 20 * Math.log10(pico + 1e-10);
    const db = Math.max(MIN_DB, 20 * Math.log10(rms + 1e-10));

    // Ruído de fundo (modo automático): desce rápido, sobe devagar (~3 s)
    const blockSec = frames / sampleRate;
    if (db < this.floorDb) this.floorDb += (db - this.floorDb) * Math.min(1, blockSec / 0.1);
    else this.floorDb += (db - this.floorDb) * Math.min(1, blockSec / 3);

    if (this.auto) {
      // Teto do limite automático em -40 dB: antes ia até -28 dB e, com som do PC/jogo vazando
      // no microfone (ex.: ao compartilhar a tela), o limite subia aos poucos e passava a cortar a voz.
      const target = Math.min(-40, Math.max(-60, this.floorDb + 12));
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

    // Nível da fala (só quando o gate está aberto) → ganho de compensação, mudando devagar
    if (this.agcOn) {
      if (this.isOpen && db >= openDb) {
        this.speechDb += (db - this.speechDb) * Math.min(1, blockSec / 1.5);
        // pico: sobe na hora, desce devagar (deixa folga de 4 dB, sem estourar)
        if (picoBlocoDb > this.picoDb) this.picoDb = picoBlocoDb;
        else this.picoDb += (picoBlocoDb - this.picoDb) * Math.min(1, blockSec / 3);
      }
      const alvoDb = Math.max(0, Math.min(12, -22 - this.speechDb, -4 - this.picoDb));
      const passo = (alvoDb > this.makeupDb ? 3 : 12) * blockSec; // sobe 3 dB/s, desce 12 dB/s
      if (alvoDb > this.makeupDb) this.makeupDb = Math.min(alvoDb, this.makeupDb + passo);
      else this.makeupDb = Math.max(alvoDb, this.makeupDb - passo);
    } else if (this.makeupDb > 0) {
      this.makeupDb = Math.max(0, this.makeupDb - 12 * blockSec);
    }
    const makeup = Math.pow(10, this.makeupDb / 20);

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
        let y = src ? src[i] * g * makeup : 0;
        // limitador suave (sem estourar com o ganho extra)
        if (y > 0.9) y = 0.9 + 0.1 * Math.tanh((y - 0.9) / 0.1);
        else if (y < -0.9) y = -0.9 - 0.1 * Math.tanh((-y - 0.9) / 0.1);
        output[c][i] = y;
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
      this.port.postMessage({ levelDb: this.peakDb, thresholdDb: this.thresholdDb, open: this.isOpen, makeupDb: this.makeupDb, gain: this.gain });
      this.blockCount = 0;
      this.peakDb = MIN_DB;
    }
  }
}

registerProcessor("eco-noise-gate", EcoNoiseGateProcessor);
