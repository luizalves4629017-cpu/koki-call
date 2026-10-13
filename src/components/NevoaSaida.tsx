import React, { useCallback, useRef, useState } from "react";

/** Fecha um painel com animação: desliza pro lado e some numa névoa cinza/branca. */
export function useFecharComNevoa(onClose?: () => void, duracaoMs = 480) {
  const [fechando, setFechando] = useState(false);
  const ativo = useRef(false);
  const fechar = useCallback(() => {
    if (!onClose || ativo.current) return;
    ativo.current = true;
    setFechando(true);
    window.setTimeout(() => {
      onClose();
      ativo.current = false;
      setFechando(false);
    }, duracaoMs);
  }, [onClose, duracaoMs]);
  return { fechando, fechar };
}

/** Nuvens de névoa que ficam pra trás enquanto o painel sai. */
export const NevoaSaida: React.FC<{ ativo: boolean }> = ({ ativo }) => {
  if (!ativo) return null;
  const puffs = [
    { l: "-20%", t: "8%", d: "0ms", c: false },
    { l: "10%", t: "30%", d: "50ms", c: true },
    { l: "-15%", t: "52%", d: "90ms", c: false },
    { l: "15%", t: "70%", d: "30ms", c: true },
    { l: "-10%", t: "85%", d: "120ms", c: false },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-visible" aria-hidden>
      {puffs.map((p, i) => (
        <span
          key={i}
          className={`eco-nevoa-puff ${p.c ? "eco-nevoa-clara" : ""}`}
          style={{ left: p.l, top: p.t, width: "110%", animationDelay: p.d }}
        />
      ))}
    </div>
  );
};
