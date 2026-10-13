import React, { useEffect, useState } from "react";
import { LogOut, Mail, Trash2, ArrowRight, Users } from "lucide-react";
import {
  aoMudarConta,
  aoMudarMinhasSalas,
  getMinhasSalas,
  esquecerSala,
  loginDisponivel,
  entrarComGoogle,
  entrarComEmail,
  sairDaConta,
  ContaInfo,
  MinhaSala,
} from "../utils/conta";

interface Props {
  onEntrarSala: (roomId: string) => void;
}

const quando = (t: number) => {
  const d = Date.now() - t;
  if (d < 3600000) return "agora há pouco";
  if (d < 86400000) return `há ${Math.floor(d / 3600000)} h`;
  const dias = Math.floor(d / 86400000);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
};

const GoogleG = () => (
  <svg viewBox="0 0 48 48" className="w-4 h-4">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** Topo do Lobby: login salvo (Google / e-mail) e "Minhas salas" com 1 clique pra entrar. */
export const ContaSalas: React.FC<Props> = ({ onEntrarSala }) => {
  const [conta, setConta] = useState<ContaInfo | null>(null);
  const [disponivel, setDisponivel] = useState(false);
  const [salas, setSalas] = useState<MinhaSala[]>(() => getMinhasSalas());
  const [modoEmail, setModoEmail] = useState(false);
  const [criar, setCriar] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    void loginDisponivel().then(setDisponivel);
    const a = aoMudarConta(setConta);
    const b = aoMudarMinhasSalas(() => setSalas(getMinhasSalas()));
    return () => {
      a();
      b();
    };
  }, []);

  const google = async () => {
    setErro(null);
    setCarregando(true);
    const e = await entrarComGoogle();
    setCarregando(false);
    if (e) setErro(e);
  };

  const comEmail = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErro(null);
    setCarregando(true);
    const e = await entrarComEmail(email, senha, criar);
    setCarregando(false);
    if (e) setErro(e);
  };

  const campo = "w-full bg-[#16171B] border border-[#2A2D35] rounded-lg px-3 py-2 text-xs text-[#ECECEC] outline-none focus:border-[#5EEAD4]/60";

  return (
    <div className="mb-4 space-y-3">
      {/* Conta */}
      {disponivel && (
        <div className="rounded-xl bg-[#16171B] border border-[#2A2D35] p-3">
          {conta ? (
            <div className="flex items-center gap-2.5">
              {conta.foto ? (
                <img src={conta.foto} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#5EEAD4]/20 text-[#5EEAD4] flex items-center justify-center text-sm font-bold">
                  {conta.nome.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{conta.nome}</p>
                <p className="text-[10px] text-[#8B8F98] truncate">Login salvo · {conta.email}</p>
              </div>
              <button
                onClick={() => void sairDaConta()}
                className="p-1.5 rounded-lg text-[#8B8F98] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 cursor-pointer"
                title="Sair da conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : !modoEmail ? (
            <div className="space-y-2">
              <p className="text-[11px] text-[#8B8F98]">Entre pra salvar seu perfil, moedas e salas em qualquer aparelho.</p>
              <div className="flex gap-2">
                <button
                  onClick={google}
                  disabled={carregando}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white text-[#16171B] text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  <GoogleG /> Entrar com Google
                </button>
                <button
                  onClick={() => setModoEmail(true)}
                  className="px-3 py-2 rounded-lg bg-[#2A2D35] text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#353943]"
                >
                  <Mail className="w-3.5 h-3.5" /> E-mail
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={comEmail} className="space-y-2">
              <input type="email" required placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
              <input type="password" required minLength={6} placeholder="Senha (mín. 6)" value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
              <div className="flex gap-2">
                <button type="submit" disabled={carregando} className="flex-1 py-2 rounded-lg bg-[#5EEAD4] text-[#16171B] text-xs font-bold cursor-pointer disabled:opacity-60">
                  {criar ? "Criar conta" : "Entrar"}
                </button>
                <button type="button" onClick={() => setModoEmail(false)} className="px-3 py-2 rounded-lg bg-[#2A2D35] text-xs cursor-pointer">
                  Voltar
                </button>
              </div>
              <button type="button" onClick={() => setCriar(!criar)} className="text-[11px] text-[#5EEAD4] hover:underline cursor-pointer">
                {criar ? "Já tenho conta" : "Não tenho conta: criar"}
              </button>
            </form>
          )}
          {erro && <p className="mt-2 text-[11px] text-[#F43F5E]">{erro}</p>}
        </div>
      )}

      {/* Minhas salas */}
      {salas.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#8B8F98] uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <Users className="w-3 h-3" /> Minhas salas
          </p>
          <div className="space-y-1.5 max-h-[168px] overflow-y-auto pr-0.5">
            {salas.slice(0, 8).map((s) => (
              <div key={s.roomId} className="group flex items-center gap-2 rounded-lg bg-[#16171B] border border-[#2A2D35] hover:border-[#5EEAD4]/40 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{s.nome}</p>
                  <p className="text-[10px] text-[#8B8F98] truncate">
                    #{s.roomId} · {quando(s.ultimaVez)}
                  </p>
                </div>
                <button
                  onClick={() => esquecerSala(s.roomId)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#8B8F98] hover:text-[#F43F5E] cursor-pointer"
                  title="Tirar da lista"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onEntrarSala(s.roomId)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5EEAD4] text-[#16171B] text-[11px] font-bold cursor-pointer hover:bg-[#2DD4BF] active:scale-95"
                >
                  Entrar <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
