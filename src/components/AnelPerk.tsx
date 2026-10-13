import React from "react";
import type { TipoAnel } from "../utils/perks";
import { GRADIENTE_ANEL } from "../utils/perks";

/** Anel orbital comprado na loja, desenhado em volta do avatar */
export const AnelPerk: React.FC<{ tipo: TipoAnel; escala?: number; satelites?: boolean }> = ({ tipo, escala = 1.45, satelites = true }) => {
  const anel = (s: number, inclinacao: number, opacidade = 1, duracao = 14) => (
    <div className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${inclinacao}deg) scale(${s}, ${s * 0.38})` }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundImage: GRADIENTE_ANEL[tipo],
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: 2,
          opacity: opacidade,
          filter: `drop-shadow(0 0 4px ${tipo === "aurora" ? "#34D39988" : "#5EEAD488"})`,
          animation: `spin ${duracao}s linear infinite`,
        }}
      />
    </div>
  );
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {anel(escala, -22)}
      {tipo === "nebulosa" && anel(escala * 1.12, -14, 0.6, 22)}
      {satelites && (
        <div className="absolute inset-0" style={{ transform: `rotate(-22deg) scale(${escala}, ${escala * 0.38})` }}>
          <div className="absolute inset-0" style={{ animation: "spin 9s linear infinite" }}>
            <span
              className="absolute left-1/2 -top-[3px] w-[6px] h-[6px] rounded-full"
              style={{ background: tipo === "aurora" ? "#A7F3D0" : "#C4B5FD", boxShadow: "0 0 6px currentColor", transform: `scale(1, ${1 / 0.38})` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
