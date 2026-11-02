import React, { useEffect, useState } from "react";
import { JogoTile } from "./JogoTile";

export interface ConviteJogo {
  id: string;
  deId: string;
  deNome: string;
  deAvatarUrl?: string;
  deAvatarColor?: string;
  jogo: string;
  modo?: string;
  vagas: number;
  aceitos: Array<{ id: string; nome: string; avatarUrl?: string; avatarColor?: string }>;
  expira: number;
}

const Avatar: React.FC<{ nome: string; url?: string; cor?: string; tamanho: number }> = ({ nome, url, cor, tamanho }) => {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center font-bold text-white shrink-0 border-2 border-[#1E2026]"
      style={{ width: tamanho, height: tamanho, backgroundColor: cor || "#2DD4BF", fontSize: tamanho * 0.4 }}
      title={nome}
    >
      {url ? <img src={url} alt={nome} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : (nome || "E").slice(0, 1).toUpperCase()}
    </div>
  );
};

/** Popup "Fulano te chamou pra jogar", canto inferior direito, 45 s. */
export function ConvitePopup({
  convite,
  onResponder,
}: {
  convite: ConviteJogo;
  onResponder: (aceitar: boolean) => void;
}) {
  const total = 45_000;
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const resta = Math.max(0, convite.expira - agora);
  useEffect(() => {
    if (resta <= 0) onResponder(false);
  }, [resta <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const seg = Math.ceil(resta / 1000);
  const vazias = Math.max(0, convite.vagas - convite.aceitos.length);
  const falta = vazias;

  return (
    <div className="fixed bottom-24 right-3 sm:right-5 z-[90] w-[min(360px,calc(100vw-24px))] rounded-2xl bg-[#1E2026] border-2 border-[#5EEAD4]/70 shadow-[0_0_28px_rgba(94,234,212,0.28)] p-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex gap-3">
        <Avatar nome={convite.deNome} url={convite.deAvatarUrl} cor={convite.deAvatarColor} tamanho={52} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[#ECECEC] leading-snug">
            {convite.deNome} te chamou pra jogar
          </div>
          <div className="flex items-center gap-2.5 mt-2">
            <JogoTile jogo={convite.jogo} tamanho={40} />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#ECECEC] truncate">{convite.jogo}</div>
              {convite.modo && <div className="text-[11px] text-[#8B8F98] truncate">{convite.modo}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-[#8B8F98]">
        {falta > 0 ? `Falta${falta > 1 ? "m" : ""} ${falta} pro time` : "Time completo"} ({convite.aceitos.length}/{convite.vagas})
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        {convite.aceitos.slice(0, 10).map((a) => (
          <Avatar key={a.id} nome={a.nome} url={a.avatarUrl} cor={a.avatarColor} tamanho={28} />
        ))}
        {Array.from({ length: Math.min(vazias, 10 - convite.aceitos.length) }).map((_, i) => (
          <div key={i} className="w-7 h-7 rounded-full border-2 border-dashed border-[#8B8F98]/50" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={() => onResponder(true)}
          disabled={falta <= 0}
          className="py-2 rounded-xl bg-[#5EEAD4] text-[#16171B] text-sm font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer"
        >
          Entrar
        </button>
        <button
          onClick={() => onResponder(false)}
          className="py-2 rounded-xl bg-[#2A2D35] text-[#ECECEC] text-sm font-bold hover:bg-[#33363F] cursor-pointer"
        >
          Agora não
        </button>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 h-1.5 rounded-full bg-[#2A2D35] overflow-hidden">
          <div className="h-full bg-[#5EEAD4] transition-[width] duration-300" style={{ width: `${(resta / total) * 100}%` }} />
        </div>
        <span className="text-[11px] font-mono text-[#8B8F98] w-8 text-right">0:{String(seg).padStart(2, "0")}</span>
      </div>
    </div>
  );
}
