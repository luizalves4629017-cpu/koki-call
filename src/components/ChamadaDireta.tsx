import React, { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Phone, PhoneOff } from "lucide-react";

interface Recebida { id: string; de: string; nome: string; avatarUrl?: string; avatarColor?: string }

/** Toque suave: duas notas senoidais com entrada e saída lentas, volume baixo. */
function criarToque(tipo: "recebendo" | "chamando") {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const nota = (freq: number, inicio: number, dur: number, vol: number) => {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const t = ctx.currentTime + inicio;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const tocar = () => {
    if (tipo === "recebendo") {
      nota(523.25, 0, 1.1, 0.07); // dó
      nota(659.25, 0.28, 1.1, 0.06); // mi
      nota(783.99, 0.56, 1.4, 0.05); // sol
    } else {
      nota(440, 0, 1.0, 0.035);
    }
  };
  return {
    iniciar() {
      try {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        tocar();
        timer = setInterval(tocar, tipo === "recebendo" ? 2600 : 3000);
      } catch {}
    },
    parar() {
      if (timer) clearInterval(timer);
      timer = null;
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}

interface Props {
  socket: Socket | null;
  /** Quem ligou cria a sala; quem atendeu entra nela. */
  onCriarSala: (nome: string, codigo: string, senha: string) => void;
  onEntrarSala: (codigo: string, senha: string) => void;
}

/** Pop-up de chamada direta (tocando pra mim) e aviso "Chamando..." (eu liguei). */
export const ChamadaDireta: React.FC<Props> = ({ socket, onCriarSala, onEntrarSala }) => {
  const [recebida, setRecebida] = useState<Recebida | null>(null);
  const [chamando, setChamando] = useState<{ id: string; nome: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const toqueRef = useRef<ReturnType<typeof criarToque> | null>(null);
  const chamandoRef = useRef(chamando);
  chamandoRef.current = chamando;

  const pararToque = () => {
    toqueRef.current?.parar();
    toqueRef.current = null;
  };
  const tocar = (tipo: "recebendo" | "chamando") => {
    pararToque();
    toqueRef.current = criarToque(tipo);
    toqueRef.current.iniciar();
  };
  const mostrarAviso = (t: string) => {
    setAviso(t);
    setTimeout(() => setAviso(null), 3500);
  };

  useEffect(() => {
    if (!socket) return;
    const aoReceber = (d: Recebida) => {
      setRecebida(d);
      tocar("recebendo");
    };
    const aoFim = (d: { id: string; motivo: string }) => {
      setRecebida((r) => (r?.id === d.id ? null : r));
      if (chamandoRef.current?.id === d.id) {
        const nome = chamandoRef.current.nome;
        setChamando(null);
        if (d.motivo === "recusada") mostrarAviso(`${nome} não pode atender agora.`);
        else if (d.motivo === "sem-resposta") mostrarAviso(`${nome} não atendeu.`);
      }
      pararToque();
    };
    const aoAceita = (d: { id: string; sala: string; senha: string; criar: boolean }) => {
      pararToque();
      const nome = chamandoRef.current?.nome;
      setRecebida(null);
      setChamando(null);
      if (d.criar) onCriarSala(`Chamada com ${nome || "amigo"}`, d.sala, d.senha);
      else setTimeout(() => onEntrarSala(d.sala, d.senha), 2500);
    };
    const aoLigar = (e: Event) => {
      const uid = (e as CustomEvent).detail?.uid;
      if (!uid) return;
      socket.emit("dm:ligar", { uid }, (r: any) => {
        if (!r?.ok) return mostrarAviso(r?.mensagem || "Não deu pra ligar agora.");
        setChamando({ id: r.id, nome: r.nome || "seu amigo" });
        tocar("chamando");
      });
    };
    socket.on("dm:chamada", aoReceber);
    socket.on("dm:chamada-fim", aoFim);
    socket.on("dm:chamada-aceita", aoAceita);
    window.addEventListener("eco:ligar", aoLigar);
    return () => {
      socket.off("dm:chamada", aoReceber);
      socket.off("dm:chamada-fim", aoFim);
      socket.off("dm:chamada-aceita", aoAceita);
      window.removeEventListener("eco:ligar", aoLigar);
      pararToque();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, onCriarSala, onEntrarSala]);

  const responder = (aceitar: boolean) => {
    if (!recebida || !socket) return;
    socket.emit("dm:chamada-responder", { id: recebida.id, aceitar });
    pararToque();
    if (!aceitar) setRecebida(null);
  };

  return (
    <>
      {recebida && (
        <div className="fixed inset-0 z-[500] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <style>{`@keyframes ecoOnda{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.9);opacity:0}}.eco-onda{animation:ecoOnda 2.4s ease-out infinite}`}</style>
          <div className="w-[300px] rounded-3xl bg-[#1E2026] border border-[#5EEAD4]/30 shadow-[0_0_60px_rgba(94,234,212,0.25)] px-6 py-7 flex flex-col items-center text-center">
            <div className="relative w-28 h-28 flex items-center justify-center mb-4">
              <span className="eco-onda absolute inset-0 rounded-full border-2 border-[#5EEAD4]/60" />
              <span className="eco-onda absolute inset-0 rounded-full border-2 border-[#5EEAD4]/40" style={{ animationDelay: "1.2s" }} />
              {recebida.avatarUrl ? (
                <img src={recebida.avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-extrabold text-white" style={{ background: recebida.avatarColor || "#8B5CF6" }}>
                  {recebida.nome.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-xl font-extrabold text-[#ECECEC] truncate max-w-full">{recebida.nome}</div>
            <div className="text-sm text-[#ECECEC]/80 mt-0.5">está te ligando...</div>
            <div className="flex gap-10 mt-6">
              <button onClick={() => responder(false)} className="flex flex-col items-center gap-1.5 cursor-pointer group">
                <span className="w-14 h-14 rounded-full bg-[#EF4444] flex items-center justify-center group-hover:brightness-110"><PhoneOff className="w-6 h-6 text-white" /></span>
                <span className="text-xs text-[#ECECEC]">Recusar</span>
              </button>
              <button onClick={() => responder(true)} className="flex flex-col items-center gap-1.5 cursor-pointer group">
                <span className="w-14 h-14 rounded-full bg-[#5EEAD4] flex items-center justify-center group-hover:brightness-110"><Phone className="w-6 h-6 text-[#0B1222]" /></span>
                <span className="text-xs text-[#ECECEC]">Atender</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {chamando && (
        <div className="fixed top-4 right-4 z-[500] rounded-2xl bg-[#1E2026] border border-[#2A2D35] shadow-xl px-4 py-3 flex items-center gap-3 text-sm text-[#ECECEC]">
          <Phone className="w-4 h-4 text-[#5EEAD4] animate-pulse" />
          <span>Chamando {chamando.nome}...</span>
          <button
            onClick={() => {
              socket?.emit("dm:chamada-cancelar", { id: chamando.id });
              setChamando(null);
              pararToque();
            }}
            className="text-[#5EEAD4] font-semibold hover:underline cursor-pointer"
          >
            cancelar
          </button>
        </div>
      )}
      {aviso && (
        <div className="fixed top-4 right-4 z-[500] rounded-2xl bg-[#1E2026] border border-[#2A2D35] shadow-xl px-4 py-3 text-sm text-[#ECECEC]">{aviso}</div>
      )}
    </>
  );
};
