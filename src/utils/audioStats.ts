// Números reais do áudio/vídeo de cada conexão (para o painel de diagnóstico e o teste automatizado).
// Taxas (kbps) são calculadas pela diferença entre duas leituras seguidas.

type Slots = {
  audioTransceiver?: RTCRtpTransceiver;
  cameraTransceiver?: RTCRtpTransceiver;
  screenTransceiver?: RTCRtpTransceiver;
  screenAudioTransceiver?: RTCRtpTransceiver;
};

const anteriores = new Map<string, { t: number; bytes: number }>();
const taxa = (chave: string, bytes: number | undefined, t: number) => {
  if (typeof bytes !== "number") return null;
  const a = anteriores.get(chave);
  anteriores.set(chave, { t, bytes });
  if (!a || t <= a.t) return null;
  return Math.round(((bytes - a.bytes) * 8) / (t - a.t)); // bytes/ms*8 = kbps
};

const dbDe = (nivel?: number) => (typeof nivel === "number" && nivel > 0 ? +(20 * Math.log10(nivel)).toFixed(1) : -100);

export interface StatsPeer {
  peer: string;
  rede: { rttMs: number | null; disponivelKbps: number | null; tipoLocal: string | null; tipoRemoto: string | null };
  micEnviado: { nivelDb: number; energia: number | null; kbps: number | null; prioridade?: string; maxKbps?: number | null };
  telaAudioEnviado: { nivelDb: number; energia: number | null; kbps: number | null } | null;
  telaVideoEnviado: { kbps: number | null; fps: number | null; maxKbps?: number | null; limitacao?: string | null } | null;
  vozRecebida: { nivelDb: number; energia: number | null; kbps: number | null; ocultadoPct: number | null; perdidos: number | null; jitterMs: number | null };
  telaAudioRecebido: { nivelDb: number; energia: number | null; kbps: number | null } | null;
}

export async function coletarStats(pcs: Map<string, RTCPeerConnection>, slotsPorPeer: Map<string, Slots>): Promise<StatsPeer[]> {
  const out: StatsPeer[] = [];
  for (const [peer, pc] of pcs) {
    if (pc.connectionState === "closed" || pc.connectionState === "new") continue;
    const slots = slotsPorPeer.get(peer) || {};
    let rel: RTCStatsReport;
    try {
      rel = await pc.getStats();
    } catch {
      continue;
    }
    const t = performance.now();
    const porId = new Map<string, any>();
    rel.forEach((r: any) => porId.set(r.id, r));
    const midMic = slots.audioTransceiver?.mid;
    const midTelaA = slots.screenAudioTransceiver?.mid;
    const midTelaV = slots.screenTransceiver?.mid;
    const item: StatsPeer = {
      peer,
      rede: { rttMs: null, disponivelKbps: null, tipoLocal: null, tipoRemoto: null },
      micEnviado: { nivelDb: -100, energia: null, kbps: null },
      telaAudioEnviado: null,
      telaVideoEnviado: null,
      vozRecebida: { nivelDb: -100, energia: null, kbps: null, ocultadoPct: null, perdidos: null, jitterMs: null },
      telaAudioRecebido: null,
    };
    rel.forEach((r: any) => {
      if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") {
        item.rede.rttMs = typeof r.currentRoundTripTime === "number" ? Math.round(r.currentRoundTripTime * 1000) : null;
        item.rede.disponivelKbps = typeof r.availableOutgoingBitrate === "number" ? Math.round(r.availableOutgoingBitrate / 1000) : null;
        item.rede.tipoLocal = porId.get(r.localCandidateId)?.candidateType || null;
        item.rede.tipoRemoto = porId.get(r.remoteCandidateId)?.candidateType || null;
      }
      if (r.type === "outbound-rtp") {
        const src = r.mediaSourceId ? porId.get(r.mediaSourceId) : null;
        const k = taxa(`${peer}:out:${r.ssrc}`, r.bytesSent, t);
        if (r.kind === "audio" && r.mid === midMic) {
          item.micEnviado = { nivelDb: dbDe(src?.audioLevel), energia: src?.totalAudioEnergy ?? null, kbps: k, duracao: src?.totalSamplesDuration ?? null } as any;
        } else if (r.kind === "audio" && r.mid === midTelaA) {
          item.telaAudioEnviado = { nivelDb: dbDe(src?.audioLevel), energia: src?.totalAudioEnergy ?? null, kbps: k, duracao: src?.totalSamplesDuration ?? null } as any;
        } else if (r.kind === "video" && r.mid === midTelaV) {
          item.telaVideoEnviado = { kbps: k, fps: r.framesPerSecond ?? null, limitacao: r.qualityLimitationReason ?? null };
        }
      }
      if (r.type === "inbound-rtp" && r.kind === "audio") {
        const k = taxa(`${peer}:in:${r.ssrc}`, r.bytesReceived, t);
        const ehMic = r.mid === midMic || (!r.mid && !item.vozRecebida.energia);
        const base = { nivelDb: dbDe(r.audioLevel), energia: r.totalAudioEnergy ?? null, kbps: k, duracao: r.totalSamplesDuration ?? null } as any;
        if (r.mid === midTelaA) item.telaAudioRecebido = base;
        else if (ehMic) {
          const tot = r.totalSamplesReceived || 0;
          item.vozRecebida = {
            ...base,
            ocultadoPct: tot > 0 ? +((100 * (r.concealedSamples || 0)) / tot).toFixed(2) : null,
            perdidos: r.packetsLost ?? null,
            jitterMs: typeof r.jitter === "number" ? Math.round(r.jitter * 1000) : null,
          };
        }
      }
    });
    try {
      const pm: any = slots.audioTransceiver?.sender.getParameters();
      const e = pm?.encodings?.[0];
      if (e) {
        item.micEnviado.prioridade = e.priority;
        item.micEnviado.maxKbps = e.maxBitrate ? Math.round(e.maxBitrate / 1000) : null;
      }
      const pv: any = slots.screenTransceiver?.sender.getParameters();
      const ev = pv?.encodings?.[0];
      if (item.telaVideoEnviado && ev) item.telaVideoEnviado.maxKbps = ev.maxBitrate ? Math.round(ev.maxBitrate / 1000) : null;
    } catch {
      /* ignore */
    }
    out.push(item);
  }
  return out;
}

/** Preferência do cancelamento de eco no ÁUDIO DA TELA: auto (padrão) | on | off. Fica no aparelho. */
export type TelaAec = "auto" | "on" | "off";
export function lerTelaAec(): TelaAec {
  try {
    const v = localStorage.getItem("eco_tela_aec");
    return v === "on" || v === "off" ? v : "auto";
  } catch {
    return "auto";
  }
}
export function salvarTelaAec(v: TelaAec) {
  try {
    localStorage.setItem("eco_tela_aec", v);
  } catch {
    /* ignore */
  }
}
