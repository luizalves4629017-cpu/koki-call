import React from "react";
import { corDoJogo, siglaDoJogo } from "../utils/atividade";

/** Bloquinho colorido com a sigla do jogo (sem depender de imagem externa). */
export function JogoTile({ jogo, tamanho = 44, className = "" }: { jogo: string; tamanho?: number; className?: string }) {
  const [cor, fundo] = corDoJogo(jogo);
  return (
    <div
      className={`shrink-0 rounded-xl flex items-center justify-center font-black tracking-tight select-none ${className}`}
      style={{
        width: tamanho,
        height: tamanho,
        background: `linear-gradient(145deg, ${fundo}, #16171B)`,
        border: `1px solid ${cor}55`,
        color: cor,
        fontSize: Math.round(tamanho * 0.36),
      }}
      title={jogo}
    >
      {siglaDoJogo(jogo)}
    </div>
  );
}
