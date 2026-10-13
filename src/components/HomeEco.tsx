import React, { useEffect, useState } from "react";
import { LogOut, Plus, LogIn } from "lucide-react";
import { EcoLogo } from "./EcoLogo";
import { aoMudarConta, sairDaConta, ContaInfo } from "../utils/conta";
import { useMinhasSalas, emojiDaSala, capaDaSala } from "./SalasDock";
import { getHostToken } from "../utils/storage";

interface Props {
  onAbrirSala: (roomId: string) => void;
  onAdicionar: () => void;
  onLogoClick?: () => void;
  aviso?: string | null;
}

/** Tela inicial de quem tem login: sem formulário, só as salas salvas e o botão +. */
export const HomeEco: React.FC<Props> = ({ onAbrirSala, onAdicionar, onLogoClick, aviso }) => {
  const [conta, setConta] = useState<ContaInfo | null>(null);
  const salas = useMinhasSalas();
  useEffect(() => aoMudarConta(setConta), []);

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#1A1B1F] text-[#ECECEC]">
      <header className="h-14 px-5 flex items-center justify-between border-b border-white/5">
        <button onClick={onLogoClick} className="cursor-default">
          <EcoLogo size="sm" />
        </button>
        {conta && (
          <div className="flex items-center gap-2.5">
            {conta.foto ? (
              <img src={conta.foto} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#A78BFA]/25 text-[#A78BFA] flex items-center justify-center text-xs font-bold">
                {conta.nome.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-semibold hidden sm:block">{conta.nome}</span>
            <button
              onClick={() => void sairDaConta()}
              title="Sair da conta"
              className="p-1.5 rounded-lg text-[#8B8F98] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        {aviso && (
          <div className="mb-5 rounded-xl border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-4 py-2.5 text-xs text-[#FDA4AF]">{aviso}</div>
        )}
        <h1 className="text-2xl font-bold">Oi{conta ? `, ${conta.nome.split(" ")[0]}` : ""}!</h1>
        <p className="text-sm text-[#8B8F98] mt-1">
          {salas.length ? "Suas salas ficam salvas aqui. Clique numa para entrar." : "Você ainda não tem salas. Crie a sua ou entre com um código."}
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {salas.map((s) => (
            <button
              key={s.roomId}
              onClick={() => onAbrirSala(s.roomId)}
              className="flex items-center gap-3 rounded-xl bg-[#232428] hover:bg-[#2B2D31] border border-white/5 hover:border-[#A78BFA]/40 p-3 text-left cursor-pointer transition"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-lg"
                style={{ background: capaDaSala(s.roomId) }}
              >
                {emojiDaSala(s)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{s.nome}</p>
                <p className="text-[11px] text-[#8B8F98] truncate">
                  #{s.roomId}
                  {getHostToken(s.roomId) ? " · 👑 sua sala" : ""}
                </p>
              </div>
            </button>
          ))}
          <button
            onClick={onAdicionar}
            className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 hover:border-[#23A55A] hover:bg-[#23A55A]/5 p-3 text-left cursor-pointer transition"
          >
            <div className="w-11 h-11 rounded-[14px] bg-[#23A55A]/15 text-[#23A55A] flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Adicionar sala</p>
              <p className="text-[11px] text-[#8B8F98] flex items-center gap-1">
                <LogIn className="w-3 h-3" /> Criar ou entrar com código
              </p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};
