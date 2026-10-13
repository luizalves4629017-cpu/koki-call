import React, { useEffect, useRef, useState } from "react";
import { Plus, X, Hash, KeyRound, Trash2, Ghost } from "lucide-react";
import { aoMudarMinhasSalas, getMinhasSalas, esquecerSala, definirEmojiSala, MinhaSala } from "../utils/conta";
import { getHostToken } from "../utils/storage";

/** Iniciais da sala, estilo ícone de servidor do Discord. */
export const iniciaisSala = (nome: string) => {
  const partes = (nome || "?").replace(/^sala\s+(de\s+)?/i, "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
};

export function useMinhasSalas(): MinhaSala[] {
  const [salas, setSalas] = useState<MinhaSala[]>(() => getMinhasSalas());
  useEffect(() => aoMudarMinhasSalas(() => setSalas(getMinhasSalas())), []);
  return salas;
}

const EMOJIS_PADRAO = ["🎮", "🍕", "🔥", "🌙", "🎧", "⚡", "🌊", "🎲", "🚀", "💜", "🍿", "🏆"];
const GRADIENTES = [
  "linear-gradient(135deg,#5EEAD4,#F472B6)",
  "linear-gradient(135deg,#FBBF24,#A855F7)",
  "linear-gradient(135deg,#F472B6,#818CF8)",
  "linear-gradient(135deg,#7C3AED,#2563EB)",
  "linear-gradient(135deg,#34D399,#3B82F6)",
  "linear-gradient(135deg,#FB923C,#EC4899)",
  "linear-gradient(135deg,#A78BFA,#5EEAD4)",
  "linear-gradient(135deg,#F43F5E,#FBBF24)",
];
const hashSala = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
export const emojiDaSala = (s: MinhaSala) => s.emoji || EMOJIS_PADRAO[hashSala(s.roomId) % EMOJIS_PADRAO.length];
export const capaDaSala = (roomId: string) => GRADIENTES[hashSala(roomId + "*") % GRADIENTES.length];
const OPCOES_EMOJI = ["🎮", "🍕", "🔥", "🌙", "🎧", "⚡", "🌊", "🎲", "🚀", "💜", "🍿", "🏆", "⚽", "🎵", "😂", "👑"];

interface SalasDockProps {
  salaAtivaId?: string | null;
  onAbrirSala: (roomId: string) => void;
  onAdicionar: () => void;
  /** Modo invisível (só Dono Master / Co-fundador recebem isso) */
  onEntrarInvisivel?: (roomId: string) => void;
}

/** Capas das salas salvas, dentro da barra de controles da call (estilo próprio do Eco). */
export const SalasDock: React.FC<SalasDockProps> = ({ salaAtivaId, onAbrirSala, onAdicionar, onEntrarInvisivel }) => {
  const salas = useMinhasSalas();
  const [menu, setMenu] = useState<{ sala: MinhaSala; x: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const fechar = () => setMenu(null);
    window.addEventListener("click", fechar);
    return () => window.removeEventListener("click", fechar);
  }, [menu]);

  return (
    <div className="flex items-end gap-1.5 max-w-[46vw] overflow-x-auto px-1 pt-11 -mt-11 pointer-events-none [scrollbar-width:none] [&>*]:pointer-events-auto">
      {salas.map((s) => {
        const ativa = s.roomId === salaAtivaId;
        const dono = Boolean(getHostToken(s.roomId));
        return (
          <div key={s.roomId} className="relative group flex flex-col items-center shrink-0">
            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#0B0D12] border border-white/10 px-2 py-1 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {dono ? "👑 " : ""}
              {s.nome}
            </span>
            <button
              onClick={() => onAbrirSala(s.roomId)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ sala: s, x: e.clientX });
              }}
              title=""
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg cursor-pointer transition-all duration-200 origin-bottom group-hover:scale-125 group-hover:-translate-y-1 shadow-lg ${
                ativa ? "ring-2 ring-white/80 scale-110 -translate-y-0.5" : "opacity-85 hover:opacity-100"
              }`}
              style={{ background: capaDaSala(s.roomId) }}
            >
              <span className="drop-shadow">{emojiDaSala(s)}</span>
            </button>
            {onEntrarInvisivel && (
              <button
                type="button"
                title="Entrar invisível"
                onClick={(e) => {
                  e.stopPropagation();
                  onEntrarInvisivel(s.roomId);
                }}
                className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-[#16171B] border border-[#C4B5FD]/50 text-[#C4B5FD] hover:text-[#16171B] hover:bg-[#C4B5FD] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
              >
                <Ghost className="w-3 h-3" />
              </button>
            )}
            <span className={`mt-1 w-1 h-1 rounded-full ${ativa ? "bg-white" : "bg-transparent"}`} />
          </div>
        );
      })}
      <div className="relative group flex flex-col items-center shrink-0">
        <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#0B0D12] border border-white/10 px-2 py-1 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
          Nova sala
        </span>
        <button
          onClick={onAdicionar}
          className="w-10 h-10 rounded-xl border border-dashed border-white/25 text-[#ECECEC] hover:border-[#5EEAD4] hover:text-[#5EEAD4] flex items-center justify-center cursor-pointer transition-all group-hover:scale-110"
        >
          <Plus className="w-5 h-5" />
        </button>
        <span className="mt-1 w-1 h-1" />
      </div>

      {menu && (
        <div
          className="fixed bottom-24 z-[60] w-56 rounded-xl bg-[#111214] border border-white/10 p-2 shadow-2xl"
          style={{ left: Math.max(8, Math.min(menu.x - 112, window.innerWidth - 232)) }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-1 pb-1.5 text-[11px] text-[#8B8F98] truncate">
            {menu.sala.nome} · #{menu.sala.roomId}
          </p>
          <div className="grid grid-cols-8 gap-1 pb-2 border-b border-white/5">
            {OPCOES_EMOJI.map((e) => (
              <button
                key={e}
                onClick={() => {
                  definirEmojiSala(menu.sala.roomId, e);
                  setMenu(null);
                }}
                className={`h-6 rounded hover:bg-white/10 cursor-pointer text-sm ${emojiDaSala(menu.sala) === e ? "bg-white/10" : ""}`}
              >
                {e}
              </button>
            ))}
          </div>
          {onEntrarInvisivel && (
            <button
              onClick={() => {
                onEntrarInvisivel(menu.sala.roomId);
                setMenu(null);
              }}
              className="mt-1.5 w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#C4B5FD] hover:bg-[#C4B5FD]/10 cursor-pointer"
            >
              <Ghost className="w-3.5 h-3.5" /> Entrar invisível
            </button>
          )}
          <button
            onClick={() => {
              esquecerSala(menu.sala.roomId);
              setMenu(null);
            }}
            className="mt-1.5 w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#F43F5E] hover:bg-[#F43F5E]/10 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Tirar da minha lista
          </button>
        </div>
      )}
    </div>
  );
};

interface AdicionarSalaProps {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (nome: string, codigo: string, senha: string) => void;
  onEntrar: (codigo: string, senha?: string) => void;
  nomeUsuario?: string;
}

/** Modal do botão +: criar a própria sala ou entrar com código. */
export const AdicionarSalaModal: React.FC<AdicionarSalaProps> = ({ aberto, onFechar, onCriar, onEntrar, nomeUsuario }) => {
  const [modo, setModo] = useState<"escolher" | "criar" | "entrar">("escolher");
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const primeiro = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setModo("escolher");
      setNome("");
      setCodigo("");
      setSenha("");
    }
  }, [aberto]);

  useEffect(() => {
    if (modo !== "escolher") setTimeout(() => primeiro.current?.focus(), 50);
  }, [modo]);

  if (!aberto) return null;

  const campo =
    "w-full bg-[#1E1F22] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#ECECEC] outline-none focus:border-[#A78BFA]";
  const limparCodigo = (v: string) => v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").slice(0, 40);

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="w-full max-w-sm rounded-2xl bg-[#2B2D31] border border-[#A78BFA]/30 shadow-2xl p-5 text-[#ECECEC]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {modo === "criar" ? "Criar minha sala" : modo === "entrar" ? "Entrar com código" : "Adicionar sala"}
          </h2>
          <button onClick={onFechar} className="p-1 rounded text-[#8B8F98] hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {modo === "escolher" && (
          <div className="space-y-2.5">
            <p className="text-xs text-[#B5BAC1] mb-1">Ela fica salva na sua barra de salas para sempre.</p>
            <button
              onClick={() => setModo("criar")}
              className="w-full py-3 rounded-xl bg-[#A78BFA] hover:bg-[#9675F5] text-[#0B0D12] font-bold text-sm cursor-pointer active:scale-[0.98] transition"
            >
              Criar minha sala
            </button>
            <button
              onClick={() => setModo("entrar")}
              className="w-full py-3 rounded-xl border border-white/20 hover:bg-white/5 font-bold text-sm cursor-pointer active:scale-[0.98] transition"
            >
              Entrar com código
            </button>
          </div>
        )}

        {modo === "criar" && (
          <form
            className="space-y-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              onCriar(nome.trim() || `Sala de ${nomeUsuario || "Eco"}`, codigo.trim(), senha.trim());
              onFechar();
            }}
          >
            <label className="text-[11px] font-bold uppercase text-[#B5BAC1]">Nome da sala</label>
            <input ref={primeiro} value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder={`Sala de ${nomeUsuario || "Eco"}`} className={campo} />
            <label className="text-[11px] font-bold uppercase text-[#B5BAC1] flex items-center gap-1">
              <Hash className="w-3 h-3" /> Código (opcional)
            </label>
            <input value={codigo} onChange={(e) => setCodigo(limparCodigo(e.target.value))} placeholder="ex: galera-do-tri" className={campo} />
            <label className="text-[11px] font-bold uppercase text-[#B5BAC1] flex items-center gap-1">
              <KeyRound className="w-3 h-3" /> Senha (opcional)
            </label>
            <input value={senha} onChange={(e) => setSenha(e.target.value.slice(0, 40))} placeholder="Deixe vazio para sala aberta" className={campo} />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setModo("escolher")} className="px-4 py-2.5 rounded-lg text-sm hover:underline cursor-pointer">
                Voltar
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-lg bg-[#A78BFA] text-[#0B0D12] font-bold text-sm cursor-pointer">
                Criar
              </button>
            </div>
          </form>
        )}

        {modo === "entrar" && (
          <form
            className="space-y-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!codigo.trim()) return;
              onEntrar(codigo.trim(), senha.trim() || undefined);
              onFechar();
            }}
          >
            <label className="text-[11px] font-bold uppercase text-[#B5BAC1]">Código ou link do convite</label>
            <input
              ref={primeiro}
              value={codigo}
              onChange={(e) => {
                const v = e.target.value;
                const m = v.match(/[?&]room=([^&\s]+)/);
                setCodigo(m ? limparCodigo(decodeURIComponent(m[1])) : limparCodigo(v));
              }}
              placeholder="ex: galera-do-tri"
              className={campo}
            />
            <label className="text-[11px] font-bold uppercase text-[#B5BAC1]">Senha (se tiver)</label>
            <input value={senha} onChange={(e) => setSenha(e.target.value.slice(0, 40))} className={campo} />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setModo("escolher")} className="px-4 py-2.5 rounded-lg text-sm hover:underline cursor-pointer">
                Voltar
              </button>
              <button type="submit" disabled={!codigo.trim()} className="flex-1 py-2.5 rounded-lg bg-[#A78BFA] text-[#0B0D12] font-bold text-sm cursor-pointer disabled:opacity-50">
                Entrar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
