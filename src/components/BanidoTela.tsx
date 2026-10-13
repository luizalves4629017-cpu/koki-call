import React from "react";
import { Ban, Clock } from "lucide-react";
import { dataHoraCurta } from "../utils/tagExibida";
import { useContagem } from "../utils/useContagem";

export interface InfoBan {
  tipo: "suspensao" | "permanente";
  ate: number | null;
  motivo?: string;
  mensagem?: string;
  /** "app" = Eco inteiro; "sala" = só um servidor/sala */
  escopo?: "app" | "sala";
  salaId?: string;
  salaNome?: string;
}

/** Tela de bloqueio pra quem foi suspenso ou banido do Eco. */
export const BanidoTela: React.FC<{ info: InfoBan; onFechar: () => void }> = ({ info, onFechar }) => {
  const permanente = info.tipo === "permanente" || !info.ate;
  const daSala = info.escopo === "sala";
  const onde = daSala ? `da sala ${info.salaNome || info.salaId || ""}`.trim() : "do Eco";
  const falta = useContagem(permanente ? undefined : info.ate || undefined);
  const acabou = !permanente && falta <= 0;
  const restante = (() => {
    const d = Math.floor(falta / 86400);
    const h = Math.floor((falta % 86400) / 3600);
    const m = Math.floor((falta % 3600) / 60);
    const s = falta % 60;
    if (d > 0) return `${d}d ${h}h ${m}min`;
    if (h > 0) return `${h}h ${m}min`;
    if (m > 0) return `${m}min ${s}s`;
    return `${s}s`;
  })();
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-[#16171B]/95 backdrop-blur-md select-none">
      <div className="w-full max-w-sm rounded-3xl bg-[#1E2026] border border-[#2A2D35] shadow-2xl p-6 text-center space-y-4">
        <div
          className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
            permanente ? "bg-[#F43F5E]/15 text-[#F43F5E]" : "bg-[#5EEAD4]/15 text-[#5EEAD4]"
          }`}
        >
          {permanente ? <Ban className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
        </div>
        <h2 className="text-lg font-extrabold text-[#ECECEC] leading-snug">
          {permanente
            ? `Você foi banido permanentemente ${onde}`
            : acabou
            ? "Seu banimento acabou"
            : `Você está banido ${onde} até ${dataHoraCurta(info.ate as number)}`}
        </h2>
        {!permanente && !acabou && (
          <p className="text-xs text-[#8B8F98]">
            Faltam <span className="font-mono font-bold text-[#5EEAD4]">{restante}</span> para você poder entrar de novo.
          </p>
        )}
        {info.motivo && (
          <p className="text-xs text-[#B5B8C0] bg-[#16171B] border border-[#2A2D35] rounded-xl px-3 py-2">
            Motivo: <span className="text-[#ECECEC]">{info.motivo}</span>
          </p>
        )}
        {daSala && (
          <p className="text-[11px] text-[#8B8F98]">Você ainda pode usar as outras salas do Eco.</p>
        )}
        {daSala ? (
          <button
            onClick={onFechar}
            className="w-full py-2.5 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-xs font-black cursor-pointer"
          >
            Voltar ao início
          </button>
        ) : !permanente && (
          <button
            onClick={onFechar}
            disabled={!acabou}
            className="w-full py-2.5 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-xs font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {acabou ? "Voltar ao Eco" : "Aguarde o fim do banimento"}
          </button>
        )}
      </div>
    </div>
  );
};
