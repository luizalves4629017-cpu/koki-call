import React, { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { EcoCoinIcon } from "./EcoCoinIcon";

interface MoedaChuva {
  id: string;
  x: number;
  atraso: number;
  duracao: number;
}

interface ChuvaAtiva {
  id: string;
  valor: number;
  segundos: number;
  moedas: MoedaChuva[];
  inicio: number;
}

/** Tela inteira com moedas caindo. Quem clicar primeiro em cada moeda ganha. */
export const ChuvaMoedas: React.FC<{ socket: Socket }> = ({ socket }) => {
  const [chuva, setChuva] = useState<ChuvaAtiva | null>(null);
  const [pegas, setPegas] = useState<Set<string>>(new Set());
  const [meuTotal, setMeuTotal] = useState(0);
  const [popups, setPopups] = useState<Array<{ id: number; x: number; y: number; texto: string }>>([]);
  const [ranking, setRanking] = useState<Array<{ nome: string; total: number }> | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const chuvaRef = useRef<ChuvaAtiva | null>(null);

  useEffect(() => {
    const inicio = (d: any) => {
      const c: ChuvaAtiva = { ...d, inicio: Date.now() };
      chuvaRef.current = c;
      setChuva(c);
      setPegas(new Set());
      setMeuTotal(0);
      setRanking(null);
    };
    const pegou = (d: any) => {
      if (d?.chuvaId !== chuvaRef.current?.id) return;
      setPegas((s) => new Set(s).add(d.moedaId));
    };
    const fim = (d: any) => {
      if (d?.id !== chuvaRef.current?.id) return;
      chuvaRef.current = null;
      setChuva(null);
      setRanking(Array.isArray(d.ranking) ? d.ranking : []);
      setTimeout(() => setRanking(null), 5000);
    };
    socket.on("chuva:inicio", inicio);
    socket.on("chuva:pegou", pegou);
    socket.on("chuva:fim", fim);
    return () => {
      socket.off("chuva:inicio", inicio);
      socket.off("chuva:pegou", pegou);
      socket.off("chuva:fim", fim);
    };
  }, [socket]);

  useEffect(() => {
    if (!chuva) return;
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, [chuva]);

  const pegar = (m: MoedaChuva, e: React.MouseEvent) => {
    if (!chuva || pegas.has(m.id)) return;
    const x = e.clientX;
    const y = e.clientY;
    setPegas((s) => new Set(s).add(m.id));
    socket.emit("chuva:pegar", { chuvaId: chuva.id, moedaId: m.id }, (r: any) => {
      if (r?.ok) {
        setMeuTotal((t) => t + (r.valor || 0));
        const id = Date.now() + Math.random();
        setPopups((p) => [...p, { id, x, y, texto: `+${r.valor}` }]);
        setTimeout(() => setPopups((p) => p.filter((i) => i.id !== id)), 900);
      }
    });
  };

  if (!chuva && !ranking) return null;

  const restante = chuva ? Math.max(0, Math.ceil((chuva.inicio + chuva.segundos * 1000 - agora) / 1000)) : 0;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none overflow-hidden">
      <style>{`
        @keyframes eco-cair { from { transform: translateY(-80px) rotate(0deg); } to { transform: translateY(110vh) rotate(540deg); } }
        @keyframes eco-subir { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-40px) scale(1.3); } }
      `}</style>

      {chuva && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-[#1E2026]/95 border border-[#5EEAD4]/50 text-[#ECECEC] text-sm font-semibold shadow-[0_0_30px_#5EEAD455]">
            Chuva de Eco Coins! Clique nas moedas · 0:{String(restante).padStart(2, "0")}
          </div>
          <div className="absolute bottom-24 right-5 px-4 py-2 rounded-xl bg-[#1E2026]/95 border border-[#2A2D35] text-[#ECECEC] text-sm font-bold flex items-center gap-2">
            Você pegou: <span className="text-[#5EEAD4]">{meuTotal}</span> <EcoCoinIcon size={16} />
          </div>
          {chuva.moedas.map((m) =>
            pegas.has(m.id) ? null : (
              <button
                key={m.id}
                onMouseDown={(e) => pegar(m, e)}
                className="absolute top-0 pointer-events-auto cursor-pointer p-2 drop-shadow-[0_0_10px_#5EEAD4]"
                style={{
                  left: `${m.x}%`,
                  animation: `eco-cair ${m.duracao}ms linear ${m.atraso}ms both`,
                }}
                aria-label="Pegar moeda"
              >
                <EcoCoinIcon size={38} />
              </button>
            )
          )}
          {popups.map((p) => (
            <div
              key={p.id}
              className="absolute text-[#5EEAD4] font-black text-xl"
              style={{ left: p.x - 10, top: p.y - 30, animation: "eco-subir 900ms ease-out forwards" }}
            >
              {p.texto}
            </div>
          ))}
        </>
      )}

      {ranking && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[300px] rounded-2xl bg-[#1E2026] border border-[#2A2D35] p-4 text-[#ECECEC] shadow-2xl pointer-events-auto">
          <h3 className="font-bold text-center mb-2">Fim da chuva!</h3>
          {ranking.length === 0 ? (
            <p className="text-xs text-center text-[#8B8F98]">Ninguém pegou moeda dessa vez.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {ranking.map((r, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {i + 1}. {r.nome}
                  </span>
                  <span className="text-[#5EEAD4] font-bold">+{r.total}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};
