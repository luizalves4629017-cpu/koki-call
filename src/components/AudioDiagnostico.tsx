import React, { useEffect, useState } from "react";
import { X, Activity } from "lucide-react";
import type { StatsPeer, TelaAec } from "../utils/audioStats";

/**
 * Painel de diagnóstico do áudio (Ctrl+Shift+D, ou botão nas Configurações).
 * Mostra números reais, atualizados 1x por segundo: nível do mic que sai, áudio da tela, voz que chega,
 * kbps, RTT, banda disponível, % de áudio "inventado" (ocultação = pacotes que não chegaram a tempo).
 */
const cor = (db: number) => (db <= -60 ? "#F43F5E" : db <= -40 ? "#FBBF24" : "#4ADE80");
const Barra: React.FC<{ db: number }> = ({ db }) => {
  const pct = Math.max(0, Math.min(100, ((db + 70) / 70) * 100));
  return (
    <span className="inline-block w-16 h-1.5 rounded bg-[#2A2D35] align-middle mr-1 overflow-hidden">
      <span className="block h-full" style={{ width: `${pct}%`, background: cor(db) }} />
    </span>
  );
};
const N: React.FC<{ db: number }> = ({ db }) => (
  <span>
    <Barra db={db} />
    <span style={{ color: cor(db) }}>{db <= -100 ? "—" : `${db} dB`}</span>
  </span>
);

export const AudioDiagnostico: React.FC<{ onFechar: () => void }> = ({ onFechar }) => {
  const [estado, setEstado] = useState<any>(null);
  const [stats, setStats] = useState<StatsPeer[]>([]);
  const [aec, setAec] = useState<{ pref: TelaAec; atual: boolean | null } | null>(null);

  useEffect(() => {
    let vivo = true;
    const ler = async () => {
      const api = (window as any).__ecoAudio;
      if (!api) return;
      try {
        const e = api.estado();
        const s = await api.stats();
        if (!vivo) return;
        setEstado(e);
        setStats(s);
        setAec(api.telaAec());
      } catch {
        /* ignore */
      }
    };
    ler();
    const id = window.setInterval(ler, 1000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, []);

  const trocarAec = (v: TelaAec) => {
    const api = (window as any).__ecoAudio;
    if (api) setAec(api.telaAec(v));
  };

  const ua = navigator.userAgent;
  const chromium = ua.match(/Chrom(?:e|ium)\/(\d+)/)?.[1] || "?";
  const ia = estado?.micIA;

  return (
    <div className="fixed top-3 left-3 z-[80] w-[340px] max-w-[94vw] max-h-[86vh] overflow-y-auto rounded-2xl bg-[#111216]/95 border border-[#2A2D35] shadow-2xl p-3 text-[11px] text-[#ECECEC] font-mono select-text">
      <div className="flex items-center justify-between mb-2 font-sans">
        <span className="flex items-center gap-1.5 font-bold text-xs">
          <Activity className="w-3.5 h-3.5 text-[#5EEAD4]" /> Diagnóstico de áudio
        </span>
        <button onClick={onFechar} className="p-1 rounded hover:bg-[#2A2D35] cursor-pointer" title="Fechar (Ctrl+Shift+D)">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-[#8B8F98] mb-2">Chromium {chromium} · {estado?.compartilhando ? "compartilhando tela" : "sem tela"}</div>

      <div className="mb-2">
        <div className="text-[#C4B5FD] font-sans font-semibold mb-0.5">Seu microfone</div>
        {estado?.mic ? (
          <div>
            trilha: {estado.mic.enabled ? "ligada" : "MUTADA"} · {estado.mic.readyState}
            {ia && (
              <>
                <br />mic cru (pico): {typeof ia.rawPeakDb === "number" ? <N db={Math.round(ia.rawPeakDb)} /> : "?"}
                <br />entrada (antes do gate): <N db={Math.round(ia.levelDb)} />
                <br />gate: {ia.gateOpen ? "aberto" : "fechado"} · limite {Math.round(ia.thresholdDb)} dB · ganho +{(ia.makeupDb || 0).toFixed(1)} dB
                <br />IA: {ia.aiOn ? "ligada" : "desligada"} · áudio {ia.ctxState} · AGC navegador: {String(ia.rawSettings?.autoGainControl ?? "?")} · eco: {String(ia.rawSettings?.echoCancellation ?? "?")}
              </>
            )}
          </div>
        ) : (
          <div className="text-[#F43F5E]">sem microfone</div>
        )}
      </div>

      {estado?.micVigia && (estado.micVigia.log.length > 0 || estado.micVigia.semEco) && (
        <div className="mb-2">
          <div className="text-[#C4B5FD] font-sans font-semibold mb-0.5">Vigia do microfone</div>
          {estado.micVigia.semEco && <div className="text-[#FBBF24]">mic sem cancelamento de eco (trocado pelo vigia)</div>}
          {estado.micVigia.log.map((l: any, i: number) => (
            <div key={i} className="text-[#8B8F98]">{l.hora} · {l.msg}</div>
          ))}
        </div>
      )}

      {estado?.telaAudio && (
        <div className="mb-2">
          <div className="text-[#C4B5FD] font-sans font-semibold mb-0.5">Áudio da tela</div>
          <div>
            {estado.telaAudio.enabled ? "ligado" : "DESLIGADO"} · {estado.telaAudio.readyState} · cancel. eco: {String(aec?.atual ?? "?")}
          </div>
        </div>
      )}
      <div className="mb-2 font-sans">
        <div className="text-[#8B8F98] mb-1">Cancelamento de eco no som da tela (vale no próximo compartilhamento e na hora):</div>
        <div className="flex gap-1">
          {(["auto", "on", "off"] as TelaAec[]).map((v) => (
            <button
              key={v}
              onClick={() => trocarAec(v)}
              className={`px-2 py-0.5 rounded-full border cursor-pointer ${aec?.pref === v ? "border-[#5EEAD4] text-[#5EEAD4]" : "border-[#2A2D35] text-[#8B8F98]"}`}
            >
              {v === "auto" ? "Automático (desligado)" : v === "on" ? "Ligado" : "Desligado"}
            </button>
          ))}
        </div>
      </div>

      {stats.length === 0 && <div className="text-[#8B8F98]">Ninguém conectado ainda.</div>}
      {stats.map((s) => {
        const nome = (estado?.nomes || {})[s.peer] || s.peer.slice(0, 6);
        return (
          <div key={s.peer} className="border-t border-[#2A2D35] pt-1.5 mt-1.5">
            <div className="text-[#5EEAD4] font-sans font-semibold">{nome}</div>
            <div className="text-[#8B8F98]">
              rede: RTT {s.rede.rttMs ?? "?"} ms · banda {s.rede.disponivelKbps ?? "?"} kbps · {s.rede.tipoLocal === "relay" || s.rede.tipoRemoto === "relay" ? "via TURN (relay)" : "direto"}
            </div>
            <div>
              mic enviado: <N db={s.micEnviado.nivelDb} /> {s.micEnviado.kbps ?? "?"} kbps {s.micEnviado.prioridade ? `· prio ${s.micEnviado.prioridade}` : ""}
            </div>
            {s.telaAudioEnviado && (
              <div>
                tela áudio enviado: <N db={s.telaAudioEnviado.nivelDb} /> {s.telaAudioEnviado.kbps ?? "?"} kbps
              </div>
            )}
            {s.telaVideoEnviado && (
              <div>
                tela vídeo: {s.telaVideoEnviado.kbps ?? "?"} / máx {s.telaVideoEnviado.maxKbps ?? "?"} kbps · {s.telaVideoEnviado.fps ?? "?"} fps
                {s.telaVideoEnviado.limitacao && s.telaVideoEnviado.limitacao !== "none" ? ` · limitado por ${s.telaVideoEnviado.limitacao}` : ""}
              </div>
            )}
            <div>
              voz recebida: <N db={s.vozRecebida.nivelDb} /> {s.vozRecebida.kbps ?? "?"} kbps
            </div>
            <div className="text-[#8B8F98]">
              ocultado {s.vozRecebida.ocultadoPct ?? "?"}% · perdidos {s.vozRecebida.perdidos ?? "?"} · jitter {s.vozRecebida.jitterMs ?? "?"} ms
            </div>
            {s.telaAudioRecebido && (
              <div>
                tela áudio recebido: <N db={s.telaAudioRecebido.nivelDb} /> {s.telaAudioRecebido.kbps ?? "?"} kbps
              </div>
            )}
          </div>
        );
      })}
      <div className="text-[#8B8F98] mt-2 font-sans">Dica: tire um print desta janela quando o som começar a sumir.</div>
    </div>
  );
};
