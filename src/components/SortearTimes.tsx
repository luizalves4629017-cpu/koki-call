import React, { useMemo, useState } from "react";
import { Dices, X, Check } from "lucide-react";
import { Participant } from "../types";

const NOMES = ["Time Aqua", "Time Lilás", "Time Ouro", "Time Rosa"];
const CORES = ["#5EEAD4", "#C4B5FD", "#FBBF24", "#F472B6"];

const Avatar: React.FC<{ nome: string; url?: string; cor?: string; borda?: string }> = ({ nome, url, cor, borda }) => (
  <div
    className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0"
    style={{ backgroundColor: cor || "#2DD4BF", boxShadow: borda ? `0 0 0 2px ${borda}` : undefined }}
  >
    {url ? <img src={url} alt={nome} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : (nome || "E").slice(0, 1).toUpperCase()}
  </div>
);

function embaralhar<T>(lista: T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface TimesResultado {
  por: string;
  porId: string;
  jogo?: string;
  times: Array<{ nome: string; cor: string; canal: string; membros: Array<{ id: string; nome: string; avatarUrl?: string; avatarColor?: string }> }>;
}

/** Sortear times: escolhe quem joga, divide no aleatório e manda cada time pra sua call. */
export const SortearTimesModal: React.FC<{
  participants: Participant[];
  selfId: string;
  meuCanal: string;
  jogo?: string | null;
  socket: any;
  onAviso: (t: string, tipo?: "success" | "error" | "info") => void;
  onClose: () => void;
}> = ({ participants, selfId, meuCanal, jogo, socket, onAviso, onClose }) => {
  const pessoas = useMemo(() => participants.filter((p) => !String(p.id).startsWith("membro:")), [participants]);
  const [marcados, setMarcados] = useState<Set<string>>((): Set<string> => {
    const doCanal = pessoas.filter((p) => (p.voiceChannelId || "voice-geral") === meuCanal).map((p) => p.id);
    return new Set(doCanal.length >= 2 ? doCanal : pessoas.map((p) => p.id));
  });
  const [qtdTimes, setQtdTimes] = useState(2);
  const [times, setTimes] = useState<string[][] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const porId = (id: string) => pessoas.find((p) => p.id === id);

  const sortear = () => {
    const ids = embaralhar((Array.from(marcados) as string[]).filter((id) => porId(id)));
    if (ids.length < qtdTimes) return onAviso(`Marque pelo menos ${qtdTimes} pessoas.`, "error");
    const novos: string[][] = Array.from({ length: qtdTimes }, () => []);
    ids.forEach((id, i) => novos[i % qtdTimes].push(id));
    setTimes(novos);
  };

  const enviar = () => {
    if (!times || enviando) return;
    setEnviando(true);
    socket.emit("times:enviar", { jogo: jogo || "", times }, (r: any) => {
      setEnviando(false);
      if (!r?.ok) return onAviso(r?.mensagem || "Não deu pra criar as calls dos times.", "error");
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="w-full max-w-[620px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1E2026] border border-[#2A2D35] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <Dices className="w-6 h-6 text-[#ECECEC]" />
            <h2 className="text-xl font-extrabold text-[#ECECEC]">Sortear times</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8B8F98] hover:text-[#ECECEC] hover:bg-white/5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#8B8F98] mb-4">
          {jogo ? `${jogo} · ` : ""}{marcados.size} {marcados.size === 1 ? "jogador" : "jogadores"}
        </p>

        {!times ? (
          <>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B8F98] mb-2">Quem vai jogar</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4">
              {pessoas.map((p) => {
                const on = marcados.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setMarcados((prev) => {
                        const n = new Set(prev);
                        on ? n.delete(p.id) : n.add(p.id);
                        return n;
                      })
                    }
                    className={`flex items-center gap-2 p-1.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      on ? "border-[#5EEAD4]/50 bg-[#5EEAD4]/10" : "border-[#2A2D35] hover:border-[#8B8F98]/50"
                    }`}
                  >
                    <Avatar nome={p.name} url={p.avatarUrl} cor={p.avatarColor} />
                    <span className="text-xs text-[#ECECEC] truncate flex-1">{p.name}{p.id === selfId ? " (você)" : ""}</span>
                    {on && <Check className="w-3.5 h-3.5 text-[#5EEAD4] shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                <span>Times:</span>
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQtdTimes(n)}
                    className={`w-8 py-1 rounded-lg border font-bold cursor-pointer ${qtdTimes === n ? "border-[#5EEAD4]/60 text-[#5EEAD4] bg-[#5EEAD4]/10" : "border-[#2A2D35] text-[#8B8F98]"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={sortear} className="px-5 py-2.5 rounded-xl bg-[#5EEAD4] text-[#16171B] text-sm font-bold hover:brightness-110 cursor-pointer flex items-center gap-1.5">
                <Dices className="w-4 h-4" /> Sortear
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`grid gap-3 mb-4 ${times.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {times.map((t, i) => (
                <div key={i} className="rounded-xl border border-[#2A2D35] bg-[#16171B] p-3">
                  <div className="text-center font-extrabold mb-2.5" style={{ color: CORES[i] }}>{NOMES[i]}</div>
                  <div className="space-y-2">
                    {t.map((id) => {
                      const p = porId(id);
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <Avatar nome={p?.name || "?"} url={p?.avatarUrl} cor={p?.avatarColor} borda={CORES[i]} />
                          <span className="text-sm text-[#ECECEC] truncate">{p?.name || "Saiu"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={sortear} className="py-2.5 rounded-xl bg-[#2A2D35] text-[#ECECEC] text-sm font-semibold hover:bg-[#33363F] cursor-pointer">
                Sortear de novo
              </button>
              <button
                onClick={enviar}
                disabled={enviando}
                className="py-2.5 rounded-xl bg-[#5EEAD4] text-[#16171B] text-sm font-bold hover:brightness-110 disabled:opacity-60 cursor-pointer"
              >
                Mandar cada time pra sua call
              </button>
            </div>
            <button onClick={() => setTimes(null)} className="mt-2 w-full text-[11px] text-[#8B8F98] hover:text-[#ECECEC] cursor-pointer">
              Mudar quem vai jogar
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/** Resultado que chega pra cada sorteado: mostra os times e leva pra call do seu time. */
export const TimesResultadoModal: React.FC<{
  resultado: TimesResultado;
  selfId: string;
  onEntrar: (canal: string) => void;
  onClose: () => void;
}> = ({ resultado, selfId, onEntrar, onClose }) => {
  const meu = resultado.times.find((t) => t.membros.some((m) => m.id === selfId));
  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-[620px] rounded-2xl bg-[#1E2026] border border-[#2A2D35] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <Dices className="w-6 h-6 text-[#ECECEC]" />
          <h2 className="text-xl font-extrabold text-[#ECECEC]">Times sorteados</h2>
        </div>
        <p className="text-xs text-[#8B8F98] mb-4">
          Por {resultado.por}{resultado.jogo ? ` · ${resultado.jogo}` : ""}
        </p>
        <div className={`grid gap-3 mb-4 ${resultado.times.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {resultado.times.map((t) => (
            <div key={t.canal} className="rounded-xl border bg-[#16171B] p-3" style={{ borderColor: meu?.canal === t.canal ? `${t.cor}88` : "#2A2D35" }}>
              <div className="text-center font-extrabold mb-2.5" style={{ color: t.cor }}>{t.nome}</div>
              <div className="space-y-2">
                {t.membros.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <Avatar nome={m.nome} url={m.avatarUrl} cor={m.avatarColor} borda={t.cor} />
                    <span className="text-sm text-[#ECECEC] truncate">{m.nome}{m.id === selfId ? " (você)" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} className="py-2.5 rounded-xl bg-[#2A2D35] text-[#ECECEC] text-sm font-semibold cursor-pointer">
            Fechar
          </button>
          {meu ? (
            <button
              onClick={() => {
                onEntrar(meu.canal);
                onClose();
              }}
              className="py-2.5 rounded-xl text-[#16171B] text-sm font-bold hover:brightness-110 cursor-pointer"
              style={{ backgroundColor: meu.cor }}
            >
              Ir pra call do {meu.nome}
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
};
