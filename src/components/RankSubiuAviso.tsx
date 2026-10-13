import React, { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { X } from "lucide-react";
import { PataCoin } from "./RankCoinsModal";

const CHAVE = "eco_rank_ultima_pos_v1";

type Aviso = { pos: number; ganho: number };

/**
 * Fica de olho na posição do usuário no Rank de Coins (aba Geral).
 * Quando ele sobe de posição, mostra o aviso "Você subiu para #N no Rank de Coins!".
 */
export const RankSubiuAviso: React.FC<{ socket: Socket; moedas: number; ativo: boolean; onAbrirRank?: () => void }> = ({ socket, moedas, ativo, onAbrirRank }) => {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checar = () => {
    socket.emit("rank:coins", { aba: "geral" }, (r: any) => {
      const voce = r?.ok ? r.voce : null;
      if (!voce || !voce.pos) return;
      let antes: { pos: number; moedas: number } | null = null;
      try {
        antes = JSON.parse(localStorage.getItem(CHAVE) || "null");
      } catch {
        antes = null;
      }
      localStorage.setItem(CHAVE, JSON.stringify({ pos: voce.pos, moedas: voce.moedas }));
      if (antes && voce.pos < antes.pos) {
        setAviso({ pos: voce.pos, ganho: Math.max(0, voce.moedas - (antes.moedas || 0)) });
      }
    });
  };

  // Checa alguns segundos depois de mudar o saldo (dá tempo de salvar na nuvem) e a cada 3 min
  useEffect(() => {
    if (!ativo) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(checar, 8000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moedas, ativo, socket]);

  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(checar, 3 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, socket]);

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(null), 7000);
    return () => clearTimeout(id);
  }, [aviso]);

  if (!aviso) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[400] animate-[rankEntra_.45s_ease-out]">
      <style>{`
        @keyframes rankEntra { from { opacity: 0; transform: translateY(20px) scale(.95) } to { opacity: 1; transform: none } }
        @keyframes rankBrilho { 0%,100% { box-shadow: 0 0 22px rgba(59,130,246,.55), inset 0 0 12px rgba(96,165,250,.25) } 50% { box-shadow: 0 0 40px rgba(59,130,246,.9), inset 0 0 18px rgba(147,197,253,.4) } }
        @keyframes rankFaisca { 0%,100% { opacity:.3; transform: scale(.8) } 50% { opacity:1; transform: scale(1.2) } }
      `}</style>
      <div
        onClick={() => {
          setAviso(null);
          onAbrirRank?.();
        }}
        className="relative w-[340px] cursor-pointer rounded-2xl border-2 border-[#3B82F6] bg-gradient-to-br from-[#0B1730] to-[#081022] px-5 pt-5 pb-4 pr-16"
        style={{ animation: "rankBrilho 2s ease-in-out infinite" }}
      >
        {/* Silhueta de aura + moeda no canto */}
        <svg viewBox="0 0 80 90" className="absolute -top-12 right-4 w-20 pointer-events-none" aria-hidden>
          <path d="M28 42 L20 4 L36 32 Q40 30 44 32 L60 4 L52 42 Q60 55 56 72 L48 88 L32 88 L24 72 Q20 55 28 42Z" fill="#1E3A8A" stroke="#60A5FA" strokeWidth="2" />
          <circle cx="35" cy="46" r="2" fill="#BFDBFE" />
          <circle cx="45" cy="46" r="2" fill="#BFDBFE" />
        </svg>
        <div className="absolute -top-4 -right-3">
          <PataCoin size={44} />
        </div>
        <span className="absolute top-2 right-14 text-[#F5E6B8] text-lg" style={{ animation: "rankFaisca 1.4s infinite" }}>✦</span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setAviso(null);
          }}
          className="absolute bottom-2 right-2 p-1 rounded text-[#8B95A8] hover:text-white"
          title="Fechar"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {aviso.ganho > 0 && <div className="absolute top-3 right-16 text-[#F5E6B8] font-bold text-sm">+{aviso.ganho.toLocaleString("pt-BR")} Coins</div>}
        <div className="text-[#CBD5E1] text-sm">Parabéns!</div>
        <div className="text-white font-extrabold text-lg leading-tight mt-0.5">
          Você subiu para #{aviso.pos} no Rank de Coins!
        </div>
      </div>
    </div>
  );
};
