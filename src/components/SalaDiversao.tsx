import React, { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { Gamepad2, X } from "lucide-react";
import { DamasCard, UnoMesa } from "./JogosMesa";

/** Temas da Sala (fundo animado escolhido pelo dono) + Mini-jogo Jogo da Velha valendo Eco Coins. */

export const TEMAS_INFO: Array<{ id: string; nome: string; previa: string }> = [
  { id: "padrao", nome: "Padrão", previa: "#070b14" },
  { id: "buraco_negro", nome: "Buraco Negro", previa: "radial-gradient(circle, #000 30%, #e5e7eb 38%, #111 46%, #000 70%)" },
  { id: "aurora", nome: "Aurora", previa: "linear-gradient(160deg, #052e2b, #10b981 45%, #5EEAD4 60%, #1e1b4b)" },
  { id: "chuva", nome: "Chuva", previa: "linear-gradient(180deg, #0b1324, #1e3a5f)" },
  { id: "cerejeira", nome: "Cerejeira", previa: "linear-gradient(180deg, #1a1023, #4a1d3f 70%, #f9a8d4)" },
];

const CSS = `
@keyframes eco-tema-gira { to { transform: translate(-50%,-50%) rotate(-12deg) scale(2.6,.55) rotate(360deg); } }
@keyframes eco-tema-aurora { 0%,100% { transform: translateX(-8%) skewX(-8deg); opacity:.55 } 50% { transform: translateX(8%) skewX(8deg); opacity:.9 } }
@keyframes eco-tema-chuva { to { background-position: 0 600px, 0 600px; } }
@keyframes eco-tema-petala { 0% { transform: translate(0,-10vh) rotate(0); opacity:0 } 10% { opacity:.9 } 100% { transform: translate(18vw,110vh) rotate(540deg); opacity:.2 } }
`;

export const TemaFundo: React.FC<{ tema: string }> = ({ tema }) => {
  if (!tema || tema === "padrao") return null;
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
      <style>{CSS}</style>
      {tema === "buraco_negro" && (
        <div className="absolute inset-0 bg-black">
          <div className="absolute left-1/2 top-1/2 w-[38vmin] h-[38vmin] rounded-full"
            style={{ transform: "translate(-50%,-50%) rotate(-12deg) scale(2.6,.55)", background: "conic-gradient(#fff, #9ca3af, #111, #e5e7eb, #4b5563, #fff)", filter: "blur(10px)", opacity: 0.35, animation: "eco-tema-gira 40s linear infinite" }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vmin] h-[30vmin] rounded-full bg-black"
            style={{ boxShadow: "0 0 60px 18px rgba(229,231,235,.18), 0 0 0 2px rgba(255,255,255,.12)" }} />
        </div>
      )}
      {tema === "aurora" && (
        <div className="absolute inset-0 bg-[#04121a]">
          <div className="absolute -inset-x-1/4 top-0 h-2/3" style={{ background: "linear-gradient(180deg, transparent, rgba(16,185,129,.35), rgba(94,234,212,.25), transparent)", filter: "blur(40px)", animation: "eco-tema-aurora 14s ease-in-out infinite" }} />
          <div className="absolute -inset-x-1/4 top-10 h-1/2" style={{ background: "linear-gradient(180deg, transparent, rgba(196,181,253,.25), transparent)", filter: "blur(50px)", animation: "eco-tema-aurora 19s ease-in-out infinite reverse" }} />
        </div>
      )}
      {tema === "chuva" && (
        <div className="absolute inset-0" style={{
          backgroundColor: "#0b1324",
          backgroundImage: "repeating-linear-gradient(100deg, transparent 0 22px, rgba(148,197,255,.13) 22px 23px, transparent 23px 61px), repeating-linear-gradient(100deg, transparent 0 37px, rgba(148,197,255,.08) 37px 38px, transparent 38px 90px)",
          backgroundSize: "200px 300px, 260px 420px",
          animation: "eco-tema-chuva 1.1s linear infinite",
        }} />
      )}
      {tema === "cerejeira" && (
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #130b1a, #2a1030 70%, #4a1d3f)" }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="absolute top-0 w-2.5 h-2 rounded-[60%_0]"
              style={{ left: `${(i * 37) % 100}%`, background: "#f9a8d4", boxShadow: "0 0 6px #f9a8d488", animation: `eco-tema-petala ${9 + (i % 5) * 2}s linear ${-i * 1.3}s infinite` }} />
          ))}
        </div>
      )}
    </div>
  );
};

interface Velha { id: string; x: { id: string; nome: string }; o: { id: string; nome: string }; casas: string[]; vez: "X" | "O"; vencedor: string | null; aceito: boolean; premio: number }

export const SalaDiversao: React.FC<{
  socket: Socket;
  selfId: string;
  podeTema: boolean;
  isMaster: boolean;
  masterToken?: string | null;
  participantes: Array<{ id: string; name: string }>;
  onTema: (t: string) => void;
}> = ({ socket, selfId, podeTema, isMaster, masterToken, participantes, onTema }) => {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<"jogos" | "temas">("jogos");
  const [tema, setTema] = useState("padrao");
  const [precos, setPrecos] = useState<Record<string, number>>({});
  const [premio, setPremio] = useState(20);
  const [jogo, setJogo] = useState<Velha | null>(null);
  const [aviso, setAviso] = useState("");
  const [jogoSel, setJogoSel] = useState<"velha" | "damas" | "uno">("velha");
  const [premios, setPremios] = useState<Record<string, number>>({});

  useEffect(() => {
    const t = (d: any) => { setTema(d?.tema || "padrao"); onTema(d?.tema || "padrao"); };
    const v = (j: Velha | null) => setJogo(j);
    socket.emit("tema:atual", {}, (r: any) => { if (r) { t(r); setPrecos(r.precos || {}); } });
    socket.emit("velha:atual", {}, (r: any) => { if (r) { setJogo(r.jogo); setPremio(r.premio ?? 20); } });
    socket.on("tema:mudou", t);
    socket.on("velha:estado", v);
    return () => { socket.off("tema:mudou", t); socket.off("velha:estado", v); };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = () => {
    socket.emit("tema:atual", {}, (r: any) => r && setPrecos(r.precos || {}));
    socket.emit("velha:atual", {}, (r: any) => r && setPremio(r.premio ?? 20));
    socket.emit("damas:atual", {}, (r: any) => r && setPremios((x) => ({ ...x, damas: r.premio })));
    socket.emit("uno:atual", {}, (r: any) => r && setPremios((x) => ({ ...x, uno: r.premio })));
    setAviso("");
    setAberto(true);
  };
  const avisar = (m: string) => { setAviso(m); setTimeout(() => setAviso(""), 3500); };
  const escolherTema = (id: string) =>
    socket.emit("tema:definir", { tema: id, masterToken: masterToken || undefined }, (r: any) => (r?.ok ? avisar("Tema aplicado para todos!") : avisar(r?.mensagem || "Não deu.")));
  const desafiar = (id: string) =>
    socket.emit(jogoSel === "damas" ? "damas:desafiar" : "velha:desafiar", { alvoId: id }, (r: any) => { if (r?.ok) setAberto(false); else avisar(r?.mensagem || "Não deu."); });

  const souX = jogo?.x.id === selfId, souO = jogo?.o.id === selfId, jogador = souX || souO;
  const minhaVez = jogo && jogo.aceito && !jogo.vencedor && ((souX && jogo.vez === "X") || (souO && jogo.vez === "O"));
  const outros = participantes.filter((p) => p.id !== selfId);

  return (
    <>
      <button onClick={abrir} title="Mini-jogos e Temas"
        className="fixed bottom-24 left-4 z-[60] w-11 h-11 rounded-full bg-[#1E2026]/95 border border-[#2A2D35] text-[#5EEAD4] flex items-center justify-center shadow-xl hover:scale-105 transition-transform cursor-pointer">
        <Gamepad2 className="w-5 h-5" />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setAberto(false)}>
          <div className="w-full max-w-sm bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-4 text-[#ECECEC]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1 bg-[#16171B] rounded-xl p-1">
                {(["jogos", "temas"] as const).map((a) => (
                  <button key={a} onClick={() => setAba(a)} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${aba === a ? "bg-[#5EEAD4]/15 text-[#5EEAD4]" : "text-[#8B8E98]"}`}>
                    {a === "jogos" ? "Mini-jogos" : "Temas da Sala"}
                  </button>
                ))}
              </div>
              <button onClick={() => setAberto(false)} className="text-[#8B8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {aba === "jogos" && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {([["velha", "⭕ Velha"], ["damas", "♟ Damas"], ["uno", "🃏 Uno"]] as const).map(([id, nome]) => (
                    <button key={id} onClick={() => setJogoSel(id)} className={`py-2 rounded-lg text-xs font-bold cursor-pointer border ${jogoSel === id ? "border-[#5EEAD4] text-[#5EEAD4] bg-[#5EEAD4]/10" : "border-[#2A2D35] text-[#B5B8C0] bg-[#16171B]"}`}>{nome}</button>
                  ))}
                </div>
                {jogoSel === "uno" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-[#8B8E98]">De 2 a 6 jogadores · quem zerar a mão ganha <b className="text-[#FACC15]">{premios.uno ?? 40} Eco Coins</b>.</p>
                    <button onClick={() => socket.emit("uno:criar", {}, (r: any) => (r?.ok ? setAberto(false) : avisar(r?.mensagem || "Não deu.")))} className="w-full py-2 rounded-lg bg-[#FACC15] text-[#16171B] font-bold text-sm cursor-pointer">Abrir mesa de Uno</button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-[#8B8E98]">{jogoSel === "damas" ? "Damas" : "Jogo da Velha"} · quem vencer ganha <b className="text-[#FACC15]">{jogoSel === "damas" ? premios.damas ?? 30 : premio} Eco Coins</b>. Desafie alguém:</p>
                    {outros.length === 0 && <p className="text-xs text-[#8B8E98]">Ninguém mais na call ainda.</p>}
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {outros.map((p) => (
                        <button key={p.id} onClick={() => desafiar(p.id)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#16171B] hover:bg-[#2A2D35] text-sm cursor-pointer">
                          <span className="truncate">{p.name}</span><span className="text-[#5EEAD4] text-xs font-bold">Desafiar</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {aba === "temas" && (
              <div>
                {!podeTema && <p className="text-xs text-[#8B8E98] mb-2">Só o dono da sala escolhe o tema.</p>}
                <div className="grid grid-cols-2 gap-2">
                  {TEMAS_INFO.map((t) => (
                    <button key={t.id} disabled={!podeTema} onClick={() => escolherTema(t.id)}
                      className={`rounded-xl overflow-hidden border text-left cursor-pointer disabled:cursor-not-allowed ${tema === t.id ? "border-[#5EEAD4]" : "border-[#2A2D35]"}`}>
                      <div className="h-16" style={{ background: t.previa }} />
                      <div className="px-2 py-1.5 flex items-center justify-between text-xs">
                        <span className="font-bold">{t.nome}</span>
                        <span className="text-[#FACC15]">{tema === t.id ? "✓" : isMaster || !precos[t.id] ? "grátis" : `${precos[t.id]} 🪙`}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {aviso && <p className="mt-3 text-xs text-center text-[#C4B5FD]">{aviso}</p>}
          </div>
        </div>
      )}

      <DamasCard socket={socket} selfId={selfId} />
      <UnoMesa socket={socket} selfId={selfId} />

      {jogo && (jogador || jogo.aceito) && (
        <div className="fixed top-20 right-4 z-[65] w-56 bg-[#1E2026]/95 border border-[#2A2D35] rounded-2xl p-3 text-[#ECECEC] shadow-2xl">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold"><span className="text-[#5EEAD4]">{jogo.x.nome}</span> × <span className="text-[#C4B5FD]">{jogo.o.nome}</span></span>
            <button onClick={() => (jogador || jogo.vencedor ? socket.emit("velha:sair") : setJogo(null))} className="text-[#8B8E98] hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          {!jogo.aceito ? (
            souO ? (
              <div className="space-y-2 text-xs">
                <p>{jogo.x.nome} te desafiou no Jogo da Velha valendo {jogo.premio} Eco Coins!</p>
                <div className="flex gap-2">
                  <button onClick={() => socket.emit("velha:aceitar", { aceitar: true })} className="flex-1 py-1.5 rounded-lg bg-[#5EEAD4] text-[#16171B] font-bold cursor-pointer">Aceitar</button>
                  <button onClick={() => socket.emit("velha:aceitar", { aceitar: false })} className="flex-1 py-1.5 rounded-lg bg-[#2A2D35] cursor-pointer">Recusar</button>
                </div>
              </div>
            ) : <p className="text-xs text-[#8B8E98]">Esperando {jogo.o.nome} aceitar…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {jogo.casas.map((c, i) => (
                  <button key={i} disabled={!minhaVez || !!c} onClick={() => socket.emit("velha:jogar", { casa: i })}
                    className={`aspect-square rounded-lg bg-[#16171B] text-2xl font-extrabold ${minhaVez && !c ? "hover:bg-[#2A2D35] cursor-pointer" : ""} ${c === "X" ? "text-[#5EEAD4]" : "text-[#C4B5FD]"}`}>{c}</button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-center text-[#B5B8C0]">
                {jogo.vencedor === "empate" ? "Deu velha! Empate."
                  : jogo.vencedor ? `${jogo.vencedor === "X" ? jogo.x.nome : jogo.o.nome} venceu e levou ${jogo.premio} Eco Coins!`
                  : minhaVez ? "Sua vez!" : `Vez de ${jogo.vez === "X" ? jogo.x.nome : jogo.o.nome}`}
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
};
