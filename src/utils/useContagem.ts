import { useEffect, useState } from "react";

/** Segundos que faltam até `ate` (ms, relógio do aparelho). 0 quando acabou. Atualiza a cada 1/4 s. */
export function useContagem(ate?: number): number {
  const calc = () => (ate ? Math.max(0, Math.ceil((ate - Date.now()) / 1000)) : 0);
  const [seg, setSeg] = useState(calc);
  useEffect(() => {
    setSeg(calc());
    if (!ate || ate <= Date.now()) return;
    const t = window.setInterval(() => {
      const v = calc();
      setSeg(v);
      if (v <= 0) window.clearInterval(t);
    }, 250);
    return () => window.clearInterval(t);
  }, [ate]); // eslint-disable-line react-hooks/exhaustive-deps
  return seg;
}

export const textoCalma = (seg: number) => `Calma! Aguarde ${seg}s para mandar mensagem.`;
