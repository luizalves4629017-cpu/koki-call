/** Modo Desempenho: deixa o Eco leve enquanto você joga. */
import { useEffect, useState } from "react";

export type ModoDesempenho = "auto" | "on" | "off";
const CHAVE = "eco:modoDesempenho";
const EVENTO = "eco:modo-desempenho";

export function getModoDesempenho(): ModoDesempenho {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === "on" || v === "off" || v === "auto") return v;
  } catch {}
  return "auto";
}

export function setModoDesempenho(m: ModoDesempenho) {
  try { localStorage.setItem(CHAVE, m); } catch {}
  try { window.dispatchEvent(new CustomEvent(EVENTO, { detail: m })); } catch {}
}

export function useModoDesempenho(): ModoDesempenho {
  const [m, setM] = useState<ModoDesempenho>(() => getModoDesempenho());
  useEffect(() => {
    const f = () => setM(getModoDesempenho());
    window.addEventListener(EVENTO, f);
    window.addEventListener("storage", f);
    return () => {
      window.removeEventListener(EVENTO, f);
      window.removeEventListener("storage", f);
    };
  }, []);
  return m;
}

/** Está ativo agora? (ligado sempre, ou automático enquanto marca que está jogando) */
export const desempenhoAtivo = (modo: ModoDesempenho, jogando: boolean) => modo === "on" || (modo === "auto" && jogando);

/** Tela compartilhada que quem está no Modo Desempenho recebe */
export const LEVE_MAX_FPS = 15;
export const LEVE_MAX_ALTURA = 540;
export const LEVE_MAX_BPS = 1_000_000;
