import React, { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { Phone, Users } from "lucide-react";
import { aoMudarConta } from "../utils/conta";

interface Amigo { uid: string; nome: string; avatarUrl?: string; avatarColor?: string; online?: boolean }

/** Coluna "Amigos online" da tela inicial, com botão de ligar. */
export const AmigosOnlineLobby: React.FC<{ socket: Socket | null }> = ({ socket }) => {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [amigos, setAmigos] = useState<Amigo[]>([]);

  useEffect(() => {
    if (!socket) return;
    const buscar = () =>
      socket.emit("amigos:estado", {}, (r: any) => {
        if (!r?.ok) return;
        setLogado(Boolean(r.logado));
        setAmigos(Array.isArray(r.amigos) ? r.amigos : []);
      });
    buscar();
    const t1 = setTimeout(buscar, 1500); // a conta pode logar logo depois de abrir
    const desligar = aoMudarConta(() => setTimeout(buscar, 1500));
    socket.on("amigos:mudou", buscar);
    socket.on("connect", buscar);
    const intervalo = setInterval(buscar, 45_000);
    return () => {
      clearTimeout(t1);
      clearInterval(intervalo);
      desligar();
      socket.off("amigos:mudou", buscar);
      socket.off("connect", buscar);
    };
  }, [socket]);

  const online = amigos.filter((a) => a.online).length;

  return (
    <aside className="order-last lg:order-none relative z-10 w-full max-w-[440px] lg:max-w-none lg:w-[270px] lg:absolute lg:top-6 lg:right-6 rounded-2xl bg-[#1E2026]/75 backdrop-blur-xl border border-[#F9A8D4]/20 shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold flex items-center gap-2 text-[#ECECEC]">
          <Users className="w-4 h-4 text-[#F9A8D4]" /> Amigos online
        </h3>
        {logado && <span className="text-[11px] text-[#8B8E98]">{online} on</span>}
      </div>
      {logado === null ? (
        <p className="text-[12px] text-[#8B8E98]">Carregando...</p>
      ) : !logado ? (
        <p className="text-[12px] text-[#B5B8C0] leading-snug">Entre com sua conta pra ver seus amigos e ligar pra eles.</p>
      ) : amigos.length === 0 ? (
        <p className="text-[12px] text-[#B5B8C0] leading-snug">Você ainda não tem amigos adicionados. Adicione a galera dentro da call.</p>
      ) : (
        <ul className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
          {amigos.slice(0, 12).map((a) => (
            <li key={a.uid} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/5">
              <div className="relative w-8 h-8 shrink-0">
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: a.avatarColor || "#2A2D35" }}>
                  {a.avatarUrl ? <img src={a.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : (a.nome || "?").slice(0, 1).toUpperCase()}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1E2026] ${a.online ? "bg-emerald-400" : "bg-[#5C606A]"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-semibold truncate ${a.online ? "text-[#ECECEC]" : "text-[#8B8E98]"}`}>{a.nome}</div>
                <div className="text-[10px] text-[#8B8E98]">{a.online ? "Online" : "Offline"}</div>
              </div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("eco:ligar", { detail: { uid: a.uid } }))}
                disabled={!a.online}
                title={a.online ? `Ligar pra ${a.nome}` : "Offline"}
                className="p-2 rounded-lg text-[#F9A8D4] hover:bg-[#F9A8D4]/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Phone className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};
