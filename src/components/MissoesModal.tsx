import React, { useEffect, useState } from "react";
import { X, Flame, Target } from "lucide-react";
import { MISSOES, EVENTO_MISSOES, getMissoes, resgatarMissao, podeResgatarBonus7, resgatarBonus7, BONUS_SEQUENCIA_7 } from "../utils/missoes";
import { EcoCoinIcon } from "./EcoCoinIcon";

interface Props {
  onClose: () => void;
  onGanhar: (moedas: number, motivo: string) => void;
}

export const MissoesModal: React.FC<Props> = ({ onClose, onGanhar }) => {
  const [estado, setEstado] = useState(() => getMissoes());

  useEffect(() => {
    const atualizar = () => setEstado(getMissoes());
    window.addEventListener(EVENTO_MISSOES, atualizar);
    const t = setInterval(atualizar, 15000);
    return () => {
      window.removeEventListener(EVENTO_MISSOES, atualizar);
      clearInterval(t);
    };
  }, []);

  const resgatar = (id: any, titulo: string) => {
    const ganho = resgatarMissao(id);
    if (ganho > 0) onGanhar(ganho, titulo);
    setEstado(getMissoes());
  };

  const bonusLiberado = podeResgatarBonus7();
  const diasAcesos = estado.sequencia === 0 ? 0 : ((estado.sequencia - 1) % 7) + 1;

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-[460px] bg-[#1E2026] border border-[#2A2D35] rounded-2xl shadow-2xl p-5 text-[#ECECEC]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[#5EEAD4]" />
            <h2 className="text-lg font-bold">Missões do dia</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Flame className="w-3.5 h-3.5" /> Sequência: {estado.sequencia} {estado.sequencia === 1 ? "dia" : "dias"}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#2A2D35] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {MISSOES.map((m) => {
            const feito = Math.min(m.meta, estado.progresso[m.id] || 0);
            const pronto = feito >= m.meta;
            const resgatada = estado.resgatadas.includes(m.id);
            return (
              <div key={m.id} className="rounded-xl bg-[#16171B] border border-[#2A2D35] p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{m.titulo}</span>
                    <span className="text-xs text-[#8B8F98] shrink-0 ml-2">
                      {feito}/{m.meta}
                      {m.unidade ? ` ${m.unidade}` : ""}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#2A2D35] overflow-hidden">
                    <div className="h-full bg-[#5EEAD4] rounded-full transition-all" style={{ width: `${(feito / m.meta) * 100}%` }} />
                  </div>
                </div>
                {resgatada ? (
                  <span className="text-xs font-bold text-[#8B8F98] w-[92px] text-center">Resgatado ✓</span>
                ) : pronto ? (
                  <button
                    onClick={() => resgatar(m.id, m.titulo)}
                    className="w-[92px] py-2 rounded-lg bg-[#5EEAD4] text-[#16171B] text-xs font-bold hover:bg-[#2DD4BF] cursor-pointer active:scale-95"
                  >
                    Resgatar
                  </button>
                ) : (
                  <span className="w-[92px] flex items-center justify-center gap-1 text-base font-black text-[#C4B5FD]">
                    +{m.premio}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl bg-[#16171B] border border-[#2A2D35] p-3">
          <div className="flex items-center justify-between text-xs text-[#8B8F98] mb-2.5">
            <span>Complete 1 missão por dia pra manter a sequência</span>
            <span className="flex items-center gap-1 text-[#C4B5FD] font-semibold">
              7 dias = +{BONUS_SEQUENCIA_7} <EcoCoinIcon size={12} />
            </span>
          </div>
          <div className="flex items-center justify-between px-1">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full border-[3px] transition-all ${
                  i < diasAcesos ? "bg-[#5EEAD4] border-[#5EEAD4]/40 shadow-[0_0_12px_#5EEAD4aa]" : "bg-[#2A2D35] border-[#1E2026]"
                }`}
              />
            ))}
          </div>
          {bonusLiberado && (
            <button
              onClick={() => {
                const g = resgatarBonus7();
                if (g) onGanhar(g, "7 dias seguidos");
                setEstado(getMissoes());
              }}
              className="mt-3 w-full py-2 rounded-lg bg-[#C4B5FD] text-[#16171B] text-xs font-bold cursor-pointer active:scale-95"
            >
              Resgatar bônus de 7 dias (+{BONUS_SEQUENCIA_7})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
