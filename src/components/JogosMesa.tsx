import React, { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { X } from "lucide-react";

/** Damas e Uno na call. O servidor valida tudo; aqui só desenha e manda as jogadas. */

// ---------------- Damas ----------------
interface Damas { id: string; b: { id: string; nome: string }; p: { id: string; nome: string }; casas: string[]; vez: "b" | "p"; seguindo: number | null; vencedor: string | null; aceito: boolean; premio: number }

export const DamasCard: React.FC<{ socket: Socket; selfId: string }> = ({ socket, selfId }) => {
  const [j, setJ] = useState<Damas | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    const f = (x: Damas | null) => { setJ(x); setSel(x?.seguindo ?? null); if (!x || x.id !== j?.id) setOculto(false); };
    socket.emit("damas:atual", {}, (r: any) => r && setJ(r.jogo));
    socket.on("damas:estado", f);
    return () => { socket.off("damas:estado", f); };
  }, [socket, j?.id]);
  if (!j || oculto) return null;
  const lado = j.b.id === selfId ? "b" : j.p.id === selfId ? "p" : null;
  if (!lado && !j.aceito) return null;
  const minhaVez = !!lado && j.aceito && !j.vencedor && j.vez === lado;
  const virar = lado === "p"; // pretas veem o tabuleiro do lado delas
  const ordem = Array.from({ length: 64 }, (_, k) => (virar ? 63 - k : k));
  const clicar = (i: number) => {
    if (!minhaVez) return;
    const x = j.casas[i];
    if (x && x.toLowerCase() === lado && j.seguindo === null) return setSel(i);
    if (sel !== null && !x) socket.emit("damas:mover", { de: sel, para: i });
  };
  const nomeVez = j.vez === "b" ? j.b.nome : j.p.nome;
  return (
    <div className="fixed top-20 right-4 z-[66] w-[300px] max-w-[92vw] bg-[#1E2026]/95 border border-[#2A2D35] rounded-2xl p-3 text-[#ECECEC] shadow-2xl">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-bold truncate">♟ Damas · <span className="text-[#ECECEC]">{j.b.nome}</span> × <span className="text-[#C4B5FD]">{j.p.nome}</span></span>
        <button onClick={() => (lado ? socket.emit("damas:sair") : setOculto(true))} title={lado && j.aceito && !j.vencedor ? "Desistir" : "Fechar"} className="text-[#8B8E98] hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
      </div>
      {!j.aceito ? (
        lado === "p" ? (
          <div className="space-y-2 text-xs">
            <p>{j.b.nome} te desafiou nas Damas valendo {j.premio} Eco Coins!</p>
            <div className="flex gap-2">
              <button onClick={() => socket.emit("damas:aceitar", { aceitar: true })} className="flex-1 py-1.5 rounded-lg bg-[#5EEAD4] text-[#16171B] font-bold cursor-pointer">Aceitar</button>
              <button onClick={() => socket.emit("damas:aceitar", { aceitar: false })} className="flex-1 py-1.5 rounded-lg bg-[#2A2D35] cursor-pointer">Recusar</button>
            </div>
          </div>
        ) : <p className="text-xs text-[#8B8E98]">Esperando {j.p.nome} aceitar…</p>
      ) : (
        <>
          <div className="grid grid-cols-8 rounded-lg overflow-hidden border border-[#2A2D35]">
            {ordem.map((i) => {
              const escura = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
              const x = j.casas[i];
              return (
                <button key={i} onClick={() => clicar(i)} className={`aspect-square flex items-center justify-center ${escura ? "bg-[#3b3f4a]" : "bg-[#d6d3cb]"} ${sel === i ? "ring-2 ring-inset ring-[#5EEAD4]" : ""} ${minhaVez ? "cursor-pointer" : "cursor-default"}`}>
                  {x && (
                    <span className={`w-[78%] h-[78%] rounded-full flex items-center justify-center text-[10px] font-black shadow-md ${x.toLowerCase() === "b" ? "bg-[#f5f5f4] text-[#57534e] border-2 border-[#a8a29e]" : "bg-[#1c1917] text-[#FACC15] border-2 border-[#57534e]"}`}>
                      {x === x.toUpperCase() ? "♛" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-center text-[#B5B8C0]">
            {j.vencedor ? `${j.vencedor === "b" ? j.b.nome : j.p.nome} venceu e levou ${j.premio} Eco Coins!`
              : minhaVez ? (j.seguindo !== null ? "Continue capturando!" : "Sua vez · captura é obrigatória") : `Vez de ${nomeVez}`}
          </p>
        </>
      )}
    </div>
  );
};

// ---------------- Uno ----------------
type Carta = { c: string; v: string };
interface UnoPub { id: string; dono: string; jogadores: Array<{ id: string; nome: string; cartas: number }>; topo: Carta | null; corAtual: string; vez: string; comprou: boolean; iniciado: boolean; vencedor: string | null; premio: number; ultimo: string }
const COR: Record<string, string> = { r: "#ef4444", g: "#22c55e", b: "#3b82f6", y: "#eab308", w: "#18181b" };
const rotulo = (v: string) => (v === "pula" ? "⊘" : v === "inverte" ? "⇄" : v === "troca" ? "🌈" : v);

const CartaUno: React.FC<{ k: Carta; onClick?: () => void; apagada?: boolean; grande?: boolean }> = ({ k, onClick, apagada, grande }) => (
  <button onClick={onClick} disabled={!onClick}
    className={`${grande ? "w-14 h-20 text-xl" : "w-10 h-14 text-sm"} shrink-0 rounded-lg border-2 border-white/80 font-black text-white flex items-center justify-center shadow-md transition-transform ${onClick ? "hover:-translate-y-1.5 cursor-pointer" : ""} ${apagada ? "opacity-40" : ""}`}
    style={{ background: k.c === "w" ? "conic-gradient(#ef4444 0 25%, #3b82f6 0 50%, #eab308 0 75%, #22c55e 0)" : COR[k.c] }}>
    <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,.8)]">{rotulo(k.v)}</span>
  </button>
);

export const UnoMesa: React.FC<{ socket: Socket; selfId: string }> = ({ socket, selfId }) => {
  const [u, setU] = useState<UnoPub | null>(null);
  const [mao, setMao] = useState<Carta[]>([]);
  const [escolherCor, setEscolherCor] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  const [minimizado, setMinimizado] = useState(false);
  useEffect(() => {
    const e = (x: UnoPub | null) => { setU(x); if (!x) setMao([]); };
    const m = (d: { mao: Carta[] }) => setMao(d?.mao || []);
    socket.on("uno:estado", e); socket.on("uno:mao", m);
    socket.emit("uno:atual", {});
    return () => { socket.off("uno:estado", e); socket.off("uno:mao", m); };
  }, [socket]);
  if (!u) return null;
  const naMesa = u.jogadores.some((x) => x.id === selfId);
  const minhaVez = u.iniciado && !u.vencedor && u.vez === selfId;
  const serve = (k: Carta) => k.c === "w" || k.c === u.corAtual || k.v === u.topo?.v;
  const jogar = (idx: number, cor?: string) => {
    if (mao[idx]?.c === "w" && !cor) return setEscolherCor(idx);
    setEscolherCor(null);
    socket.emit("uno:jogar", { idx, cor }, (r: any) => { if (r?.ok === false && r?.mensagem) { setAviso(r.mensagem); setTimeout(() => setAviso(""), 2500); } });
  };
  const vencedor = u.jogadores.find((x) => x.id === u.vencedor)?.nome;

  if (minimizado) return (
    <button onClick={() => setMinimizado(false)} className="fixed bottom-24 left-20 z-[66] px-3 py-2 rounded-full bg-[#1E2026]/95 border border-[#2A2D35] text-xs font-bold text-[#FACC15] shadow-xl cursor-pointer">
      🃏 Uno {minhaVez ? "· sua vez!" : ""}
    </button>
  );

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[66] w-[560px] max-w-[96vw] bg-[#1E2026]/95 border border-[#2A2D35] rounded-2xl p-3 text-[#ECECEC] shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-bold">🃏 Uno · vale {u.premio} Eco Coins</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setMinimizado(true)} className="text-[#8B8E98] hover:text-white cursor-pointer">minimizar</button>
          {naMesa && <button onClick={() => socket.emit("uno:sair")} className="text-[#8B8E98] hover:text-white cursor-pointer" title="Sair da mesa"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {u.jogadores.map((x) => (
          <span key={x.id} className={`px-2 py-1 rounded-lg text-[11px] ${u.vez === x.id && u.iniciado ? "bg-[#5EEAD4]/20 text-[#5EEAD4] font-bold" : "bg-[#16171B] text-[#B5B8C0]"}`}>
            {x.nome}{u.iniciado ? ` · ${x.cartas}🂠` : ""}{x.id === u.dono ? " 👑" : ""}
          </span>
        ))}
      </div>

      {!u.iniciado ? (
        <div className="flex items-center gap-2 text-xs">
          {!naMesa && <button onClick={() => socket.emit("uno:entrar", {}, (r: any) => r?.ok === false && setAviso(r?.mensagem || ""))} className="px-3 py-1.5 rounded-lg bg-[#5EEAD4] text-[#16171B] font-bold cursor-pointer">Entrar na mesa</button>}
          {u.dono === selfId ? (
            <button onClick={() => socket.emit("uno:iniciar", {}, (r: any) => r?.ok === false && setAviso(r?.mensagem || ""))} className="px-3 py-1.5 rounded-lg bg-[#FACC15] text-[#16171B] font-bold cursor-pointer">Começar ({u.jogadores.length}/6)</button>
          ) : <span className="text-[#8B8E98]">Esperando o dono da mesa começar…</span>}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-4 my-2">
            {u.topo && <CartaUno k={{ ...u.topo, c: u.topo.c === "w" ? u.corAtual : u.topo.c }} grande />}
            <div className="text-[11px] text-[#B5B8C0] space-y-1">
              <div className="flex items-center gap-1">Cor: <span className="inline-block w-3 h-3 rounded-full" style={{ background: COR[u.corAtual] }} /></div>
              <div>{u.ultimo}</div>
              {minhaVez && !u.comprou && <button onClick={() => socket.emit("uno:comprar")} className="px-2 py-1 rounded-lg bg-[#2A2D35] hover:bg-[#3a3d45] text-[#ECECEC] font-bold cursor-pointer">Comprar carta</button>}
              {minhaVez && u.comprou && <button onClick={() => socket.emit("uno:passar")} className="px-2 py-1 rounded-lg bg-[#2A2D35] hover:bg-[#3a3d45] text-[#ECECEC] font-bold cursor-pointer">Passar a vez</button>}
            </div>
          </div>
          {vencedor && <p className="text-center text-sm font-bold text-[#FACC15] mb-2">{vencedor} venceu e levou {u.premio} Eco Coins!</p>}
          {naMesa && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 pt-2">
              {mao.map((k, i) => <CartaUno key={i} k={k} apagada={minhaVez && !serve(k)} onClick={minhaVez && serve(k) ? () => jogar(i) : undefined} />)}
            </div>
          )}
          {escolherCor !== null && (
            <div className="flex items-center gap-2 justify-center mt-2 text-xs">
              Escolha a cor:
              {["r", "g", "b", "y"].map((c) => <button key={c} onClick={() => jogar(escolherCor, c)} className="w-7 h-7 rounded-full border-2 border-white cursor-pointer" style={{ background: COR[c] }} />)}
            </div>
          )}
          {minhaVez && <p className="text-center text-[11px] text-[#5EEAD4] mt-1">Sua vez!</p>}
        </>
      )}
      {aviso && <p className="mt-2 text-xs text-center text-[#C4B5FD]">{aviso}</p>}
    </div>
  );
};
