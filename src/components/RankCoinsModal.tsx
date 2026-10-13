import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Socket } from "socket.io-client";
import { EcoAvatar } from "./EcoAvatar";

export type AbaRank = "geral" | "semana" | "mes";
export interface LinhaRank {
  pos: number;
  nome: string;
  avatarUrl?: string;
  avatarColor?: string;
  moedas: number;
  semana: number;
  mes: number;
  eu?: boolean;
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString("pt-BR");

/** Moeda da pata (tema aura azul) */
export const PataCoin: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} className="inline-block shrink-0">
    <defs>
      <radialGradient id="pataCoinG" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#7CC4FF" />
        <stop offset="60%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#0B1E4A" />
      </radialGradient>
    </defs>
    <circle cx="16" cy="16" r="15" fill="url(#pataCoinG)" stroke="#9FD3FF" strokeWidth="1.5" />
    <g fill="#0B1222">
      <ellipse cx="16" cy="19.5" rx="5" ry="4.2" />
      <ellipse cx="10" cy="13.5" rx="2" ry="2.6" />
      <ellipse cx="14" cy="10.5" rx="2" ry="2.6" />
      <ellipse cx="18" cy="10.5" rx="2" ry="2.6" />
      <ellipse cx="22" cy="13.5" rx="2" ry="2.6" />
    </g>
  </svg>
);

const ABAS: { id: AbaRank; rotulo: string }[] = [
  { id: "geral", rotulo: "Geral" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
];

const OrbeTop: React.FC<{ l?: LinhaRank; tamanho: "g" | "p"; className?: string }> = ({ l, tamanho, className = "" }) => {
  const grande = tamanho === "g";
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className={`relative rounded-full flex items-center justify-center ${grande ? "w-36 h-36" : "w-24 h-24"} aura-orbe`}
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(59,130,246,0.35), rgba(30,64,175,0.15) 55%, transparent 70%)",
          boxShadow: grande ? "0 0 45px 10px rgba(56,139,253,0.55), inset 0 0 30px rgba(125,211,252,0.6)" : "0 0 28px 6px rgba(56,139,253,0.45), inset 0 0 18px rgba(125,211,252,0.5)",
          border: "2px solid rgba(147,197,253,0.6)",
        }}
      >
        <div className="rounded-full ring-2 ring-[#F5E6B8] overflow-hidden">
          {l ? (
            <EcoAvatar name={l.nome} avatarUrl={l.avatarUrl} avatarColor={l.avatarColor} size={grande ? "xl" : "lg"} />
          ) : (
            <div className={`${grande ? "w-20 h-20" : "w-14 h-14"} bg-[#0B1222]`} />
          )}
        </div>
      </div>
      <div className={`mt-2 text-center font-bold text-[#F5E6B8] ${grande ? "text-base" : "text-sm"}`} style={{ textShadow: "0 0 8px rgba(56,139,253,0.8)" }}>
        #{l?.pos ?? (grande ? 1 : "–")}: {l ? l.nome : "—"}
      </div>
      <div className="text-xs font-semibold text-[#F5E6B8]/90">{l ? fmt(l.moedas) : "0"}</div>
    </div>
  );
};

interface Props {
  socket: Socket;
  onClose: () => void;
}

export const RankCoinsModal: React.FC<Props> = ({ socket, onClose }) => {
  const [aba, setAba] = useState<AbaRank>("semana");
  const [lista, setLista] = useState<LinhaRank[]>([]);
  const [voce, setVoce] = useState<LinhaRank | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    socket.emit("rank:coins", { aba }, (r: any) => {
      setCarregando(false);
      if (!r?.ok) return setErro(r?.mensagem || "Não deu pra carregar o rank agora.");
      setLista(Array.isArray(r.lista) ? r.lista : []);
      setVoce(r.voce || null);
    });
  }, [socket, aba]);

  const [p1, p2, p3] = [lista[0], lista[1], lista[2]];
  const colunaPeriodo = aba === "mes" ? "MÊS" : "SEMANA";
  const valorPeriodo = (l: LinhaRank) => (aba === "mes" ? l.mes : l.semana);
  const voceForaDaLista = voce && !lista.some((l) => l.eu);

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <style>{`
        @keyframes auraPulso { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.04); filter: brightness(1.25); } }
        .aura-orbe { animation: auraPulso 2.6s ease-in-out infinite; }
        @keyframes auraChama { 0% { transform: translateY(0) scaleY(1); opacity: .55 } 50% { transform: translateY(-10px) scaleY(1.15); opacity: .85 } 100% { transform: translateY(0) scaleY(1); opacity: .55 } }
        .aura-chama { animation: auraChama 2.2s ease-in-out infinite; transform-origin: bottom; }
      `}</style>
      <div
        className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-[#1E3A6E] bg-[#0A0F1E] shadow-[0_0_60px_rgba(37,99,235,0.35)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de título */}
        <div className="flex items-center justify-center relative py-3 border-b border-[#16264A] bg-[#0C1426]">
          <h2 className="text-[#F5E6B8] font-bold tracking-wider text-lg">RANK DE COINS</h2>
          <button onClick={onClose} className="absolute right-3 p-1.5 rounded-lg text-[#F5E6B8]/80 hover:text-white hover:bg-white/10 cursor-pointer" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Lado esquerdo: top 3 nas esferas de aura */}
          <div className="relative md:w-[48%] min-h-[360px] overflow-hidden flex flex-col items-center justify-center py-6">
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(30,64,175,0.35), transparent 65%)" }} />
            {/* Silhueta de aura ao fundo (orelhas de chacal) */}
            <svg viewBox="0 0 200 260" className="absolute right-2 top-6 w-56 opacity-25 pointer-events-none" aria-hidden>
              <path d="M70 120 L52 20 L88 92 Q100 86 112 92 L148 20 L130 120 Q150 150 140 200 L120 250 L80 250 L60 200 Q50 150 70 120Z" fill="#1E3A8A" stroke="#60A5FA" strokeWidth="2" />
              <circle cx="88" cy="128" r="4" fill="#93C5FD" />
              <circle cx="112" cy="128" r="4" fill="#93C5FD" />
              <circle cx="100" cy="185" r="6" fill="#BFDBFE" />
            </svg>
            {/* Chamas de aura */}
            <div className="absolute bottom-0 left-0 right-0 h-28 flex items-end justify-around pointer-events-none">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="aura-chama w-16 rounded-t-full"
                  style={{ height: `${60 + ((i * 37) % 50)}px`, animationDelay: `${i * 0.3}s`, background: "linear-gradient(to top, rgba(37,99,235,0.9), rgba(96,165,250,0.4), transparent)", filter: "blur(6px)" }}
                />
              ))}
            </div>

            <div className="relative z-10 flex flex-col items-center gap-4 w-full">
              {carregando ? (
                <div className="text-[#93C5FD] text-sm">Carregando aura…</div>
              ) : (
                <>
                  <OrbeTop l={p1} tamanho="g" />
                  <div className="flex justify-center gap-10 sm:gap-16">
                    <OrbeTop l={p2} tamanho="p" />
                    <OrbeTop l={p3} tamanho="p" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Lado direito: tabela */}
          <div className="md:w-[52%] p-4 md:p-5 flex flex-col min-h-0">
            <div className="rounded-xl border border-[#1E2C4A] bg-[#0D1424] flex flex-col min-h-0 flex-1">
              <div className="grid grid-cols-3 gap-1 p-1.5 border-b border-[#1E2C4A]">
                {ABAS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAba(a.id)}
                    className={`py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${aba === a.id ? "bg-[#1C2740] text-white" : "text-[#8B95A8] hover:text-white"}`}
                  >
                    {a.rotulo}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[2rem_1fr_6rem_5.5rem] px-4 py-2 text-[11px] font-semibold text-[#8B95A8] tracking-wide">
                <span>#</span>
                <span>MEMBRO</span>
                <span className="text-right">COINS</span>
                <span className="text-right">{aba === "geral" ? "SEMANA" : colunaPeriodo}</span>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 min-h-[200px]">
                {erro && <div className="text-center text-sm text-red-300 py-8">{erro}</div>}
                {!erro && !carregando && lista.length === 0 && (
                  <div className="text-center text-sm text-[#8B95A8] py-8">Ninguém no rank ainda. Entre com sua conta e junte coins!</div>
                )}
                {lista.map((l) => (
                  <Linha key={`${l.pos}-${l.nome}`} l={l} periodo={aba === "geral" ? l.semana : valorPeriodo(l)} />
                ))}
              </div>

              {voceForaDaLista && voce && (
                <div className="border-t border-[#1E2C4A] p-2">
                  <Linha l={{ ...voce, nome: `Você · ${voce.nome}` }} periodo={aba === "geral" ? voce.semana : valorPeriodo(voce)} />
                </div>
              )}
              {!voce && !carregando && !erro && (
                <div className="border-t border-[#1E2C4A] px-4 py-2 text-[11px] text-[#8B95A8]">Entre com sua conta pra aparecer no rank.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Linha: React.FC<{ l: LinhaRank; periodo: number }> = ({ l, periodo }) => {
  const destaque = l.pos === 1 || l.eu;
  return (
    <div
      className={`grid grid-cols-[2rem_1fr_6rem_5.5rem] items-center px-2 py-2 rounded-lg ${
        destaque ? "border border-[#3B82F6] bg-[#0F1D3A] shadow-[0_0_14px_rgba(59,130,246,0.5)]" : "border border-transparent hover:bg-white/5"
      }`}
    >
      <span className="text-sm font-semibold text-[#ECECEC] pl-1">{l.pos}</span>
      <div className="flex items-center gap-3 min-w-0">
        <EcoAvatar name={l.nome} avatarUrl={l.avatarUrl} avatarColor={l.avatarColor} size="sm" />
        <span className="text-sm text-[#ECECEC] truncate">{l.nome}</span>
      </div>
      <span className="flex items-center justify-end gap-1.5 text-sm text-[#ECECEC]">
        <PataCoin size={18} />
        {fmt(l.moedas)}
      </span>
      <span className={`text-right text-sm font-semibold ${periodo > 0 ? "text-[#4ADE80]" : "text-[#8B95A8]"}`}>{periodo > 0 ? `+${fmt(periodo)}` : "0"}</span>
    </div>
  );
};
