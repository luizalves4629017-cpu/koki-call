import React, { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

interface Anuncio {
  id: string;
  texto: string;
  ate: number;
}

/** Faixa lilás no topo com o aviso do Dono Master (aparece em todas as salas ou só nesta). */
export const AnuncioBanner: React.FC<{ socket: Socket }> = ({ socket }) => {
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const [fechados, setFechados] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("eco_anuncios_fechados") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const pedir = () => socket.emit("anuncio:atual", {}, (r: any) => setAnuncio(r?.anuncio || null));
    pedir();
    const novo = (a: Anuncio) => setAnuncio(a);
    const removido = () => setAnuncio(null);
    socket.on("anuncio:novo", novo);
    socket.on("anuncio:removido", removido);
    socket.on("connect", pedir);
    return () => {
      socket.off("anuncio:novo", novo);
      socket.off("anuncio:removido", removido);
      socket.off("connect", pedir);
    };
  }, [socket]);

  // some sozinho quando o tempo acaba
  useEffect(() => {
    if (!anuncio) return;
    const falta = anuncio.ate - Date.now();
    if (falta <= 0) {
      setAnuncio(null);
      return;
    }
    const t = setTimeout(() => setAnuncio(null), falta);
    return () => clearTimeout(t);
  }, [anuncio]);

  if (!anuncio || fechados.includes(anuncio.id)) return null;

  const fechar = () => {
    const lista = [...fechados, anuncio.id].slice(-20);
    setFechados(lista);
    sessionStorage.setItem("eco_anuncios_fechados", JSON.stringify(lista));
  };

  return (
    <div className="mx-3 mt-2 mb-1 px-4 py-2.5 rounded-xl bg-[#C4B5FD] text-[#16171B] flex items-center gap-3 shadow-[0_0_30px_#C4B5FD55] animate-in fade-in slide-in-from-top-2 duration-300 z-40">
      <span className="text-2xl font-black leading-none shrink-0">∞</span>
      <p className="flex-1 text-sm">
        <b>Aviso do Dono Master:</b> {anuncio.texto}
      </p>
      <button
        onClick={fechar}
        className="shrink-0 px-3 py-1 rounded-lg bg-[#5EEAD4] text-[#16171B] text-xs font-bold hover:bg-[#2DD4BF] cursor-pointer"
      >
        Fechar
      </button>
    </div>
  );
};
