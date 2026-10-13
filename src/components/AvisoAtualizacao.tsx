import React, { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { RefreshCw, X, Megaphone } from "lucide-react";
import { BACKEND_OUTRA_ORIGEM } from "../utils/backend";

// Gerado no build (vite.config.ts). Em desenvolvimento o servidor não manda versão e o aviso não aparece.
declare const __ECO_BUILD__: string;
const VERSAO_CARREGADA: string = typeof __ECO_BUILD__ === "string" ? __ECO_BUILD__ : "";
const INTERVALO_MS = 2 * 60 * 1000;

/**
 * Aviso de atualização do Eco, pra todo mundo:
 * - Quando o servidor volta com outra versão (Render reiniciou depois do deploy) ou a checagem de 2 em 2 min
 *   em /version vê outra versão: "Nova atualização do Eco! Reinicie o app…" com Reiniciar agora / Depois.
 * - Quando o Dono Master toca "Avisar atualização": "O Eco vai atualizar em instantes…".
 * Reiniciar = window.location.reload() (funciona no navegador, no APK/TWA e no app do Windows).
 */
export const AvisoAtualizacao: React.FC<{ socket: Socket | null; baseUrl: string }> = ({ socket, baseUrl }) => {
  const [novaVersao, setNovaVersao] = useState<string | null>(null);
  const [adiadaPara, setAdiadaPara] = useState<string | null>(null);
  const [avisoDono, setAvisoDono] = useState<string | null>(null);
  const novaRef = useRef<string | null>(null);

  const conferir = (versao: any) => {
    const v = typeof versao === "string" ? versao : versao?.versao;
    if (!v || !VERSAO_CARREGADA || v === VERSAO_CARREGADA) return;
    novaRef.current = v;
    setNovaVersao(v);
    setAvisoDono(null); // a versão nova chegou: troca o aviso do Dono pelo de reiniciar
  };

  // Checagem por HTTP: a cada 2 min, quando volta pra aba e quando a internet volta
  useEffect(() => {
    if (!VERSAO_CARREGADA) return;
    let vivo = true;
    const buscar = () => {
      if (document.visibilityState === "hidden") return;
      // Front em outro domínio (Cloudflare Pages): a versão que vale é a do próprio front (/version.json lá).
      // Mesmo domínio (Render): /version do servidor, como antes.
      const url = BACKEND_OUTRA_ORIGEM ? `/version.json?t=${Date.now()}` : `${baseUrl.replace(/\/$/, "")}/version?t=${Date.now()}`;
      fetch(url, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => vivo && d && conferir(d))
        .catch(() => {});
    };
    const t = window.setInterval(buscar, INTERVALO_MS);
    const aoVoltar = () => document.visibilityState === "visible" && buscar();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", buscar);
    const primeira = window.setTimeout(buscar, 15000);
    return () => {
      vivo = false;
      window.clearInterval(t);
      window.clearTimeout(primeira);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", buscar);
    };
  }, [baseUrl]);

  // Pelo socket: o servidor manda a versão ao conectar (inclusive depois de reconectar) e o aviso do Dono
  useEffect(() => {
    if (!socket) return;
    // Com o front em outro domínio, a versão do servidor (Railway) pode chegar antes/depois do Pages:
    // só o /version.json do próprio front decide (checagem por HTTP acima).
    const aoConectar = () => { if (!BACKEND_OUTRA_ORIGEM) socket.emit("app:versao", {}, (d: any) => conferir(d)); };
    const aoVersaoServidor = (d: any) => { if (!BACKEND_OUTRA_ORIGEM) conferir(d); };
    const aoAviso = (d: any) => {
      if (novaRef.current) return;
      setAvisoDono(String(d?.mensagem || "O Eco vai atualizar em instantes. Quando aparecer o aviso, reinicie o app."));
    };
    socket.on("app:versao", aoVersaoServidor);
    socket.on("connect", aoConectar);
    socket.on("app:aviso-atualizacao", aoAviso);
    if (socket.connected) aoConectar();
    return () => {
      socket.off("app:versao", aoVersaoServidor);
      socket.off("connect", aoConectar);
      socket.off("app:aviso-atualizacao", aoAviso);
    };
  }, [socket]);

  const reiniciar = () => {
    try {
      // garante que o service worker pegue a versão nova antes de recarregar
      navigator.serviceWorker?.getRegistration?.().then((r) => r?.update()).catch(() => {});
    } catch {}
    window.setTimeout(() => window.location.reload(), 150);
  };

  const mostrarNova = novaVersao && adiadaPara !== novaVersao;

  if (mostrarNova) {
    return (
      <div className="fixed top-4 left-1/2 z-[300] w-[calc(100%-2rem)] max-w-md eco-aviso-descer" role="alert">
        <div className="rounded-2xl bg-[#1E2026] border border-[#5EEAD4]/40 shadow-2xl shadow-black/50 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5EEAD4]/15 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4.5 h-4.5 text-[#5EEAD4]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#ECECEC]">Nova atualização do Eco!</p>
            <p className="text-xs text-[#8B8F98] mt-0.5">Reinicie o app para usar a versão nova.</p>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={reiniciar} className="px-3.5 py-1.5 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-xs font-extrabold cursor-pointer">
                Reiniciar agora
              </button>
              <button onClick={() => setAdiadaPara(novaVersao)} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#B5B9C2] hover:text-white hover:bg-[#2A2D35] cursor-pointer">
                Depois
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (avisoDono) {
    return (
      <div className="fixed top-4 left-1/2 z-[300] w-[calc(100%-2rem)] max-w-md eco-aviso-descer" role="status">
        <div className="rounded-2xl bg-[#1E2026] border border-[#C4B5FD]/40 shadow-2xl shadow-black/50 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C4B5FD]/15 flex items-center justify-center shrink-0">
            <Megaphone className="w-4.5 h-4.5 text-[#C4B5FD]" />
          </div>
          <p className="flex-1 text-xs text-[#ECECEC] leading-relaxed pt-0.5">{avisoDono}</p>
          <button onClick={() => setAvisoDono(null)} className="p-1 rounded-md text-[#8B8F98] hover:text-white hover:bg-[#2A2D35] cursor-pointer" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
  return null;
};
