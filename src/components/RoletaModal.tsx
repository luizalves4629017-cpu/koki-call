import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Socket } from "socket.io-client";
import { EcoCoinIcon } from "./EcoCoinIcon";

export const CUSTO_GIRO = 2000;
const GIRO_GRATIS_KEY = "eco_roleta_gratis_v1";
const INTERVALO_GRATIS = 24 * 60 * 60 * 1000;

type Premio = { rotulo: string; moedas?: number; perk?: string; horas?: number; peso: number; cor: string };

// A ordem é a ordem das fatias na roda (sentido horário a partir do topo)
// Chances (peso = %): VIP 0,5% · Anel Aurora 1,5% · +500 3% · +100 28% · +50 45% · Tente de novo 22%
const FATIAS: Premio[] = [
  { rotulo: "+100", moedas: 100, peso: 28, cor: "#5EEAD4" },
  { rotulo: "Anel Aurora 24h", perk: "ring_aurora", horas: 24, peso: 1.5, cor: "#C4B5FD" },
  { rotulo: "VIP 24h", perk: "vip_role", horas: 24, peso: 0.5, cor: "#5EEAD4" },
  { rotulo: "Tente de novo", peso: 22, cor: "#C4B5FD" },
  { rotulo: "+500", moedas: 500, peso: 3, cor: "#5EEAD4" },
  { rotulo: "+50", moedas: 50, peso: 45, cor: "#C4B5FD" },
];

const NOME_SERVIDOR: Record<string, string> = {
  "+50": "+50 Eco Coins",
  "+100": "+100 Eco Coins",
  "+500": "+500 Eco Coins",
  "Anel Aurora 24h": "Anel Aurora 24h",
  "VIP 24h": "VIP 24h",
  "Tente de novo": "Tente de novo",
};

function sortear(): number {
  const total = FATIAS.reduce((s, f) => s + f.peso, 0);
  let r = Math.random() * total;
  for (let i = 0; i < FATIAS.length; i++) {
    r -= FATIAS[i].peso;
    if (r <= 0) return i;
  }
  return 0;
}

function formatarTempo(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
}

interface Props {
  socket: Socket;
  saldo: number;
  isMaster: boolean;
  onClose: () => void;
  onGastar: (moedas: number) => boolean;
  onGanharMoedas: (moedas: number, motivo: string) => void;
  onGanharItem: (perkId: string, horas: number) => void;
}

export const RoletaModal: React.FC<Props> = ({ socket, saldo, isMaster, onClose, onGastar, onGanharMoedas, onGanharItem }) => {
  const [angulo, setAngulo] = useState(0);
  const [girando, setGirando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [ultimos, setUltimos] = useState<Array<{ nome: string; premio: string }>>([]);
  const [agora, setAgora] = useState(Date.now());
  const [proximoGratis, setProximoGratis] = useState(() => Number(localStorage.getItem(GIRO_GRATIS_KEY) || 0) + INTERVALO_GRATIS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    socket.emit("roleta:ultimos", {}, (r: any) => Array.isArray(r?.lista) && setUltimos(r.lista));
    const novo = (item: any) => setUltimos((l) => [item, ...l].slice(0, 10));
    socket.on("roleta:novo-premio", novo);
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => {
      socket.off("roleta:novo-premio", novo);
      clearInterval(t);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [socket]);

  const gratis = agora >= proximoGratis;
  const fatia = 360 / FATIAS.length;

  const girar = () => {
    if (girando) return;
    setResultado(null);
    if (gratis) {
      localStorage.setItem(GIRO_GRATIS_KEY, String(Date.now()));
      setProximoGratis(Date.now() + INTERVALO_GRATIS);
    } else if (!isMaster) {
      if (saldo < CUSTO_GIRO || !onGastar(CUSTO_GIRO)) {
        setResultado("Moedas insuficientes pra girar.");
        return;
      }
    }
    const idx = sortear();
    // a fatia idx precisa parar embaixo do ponteiro (topo)
    const centro = idx * fatia + fatia / 2;
    const jitter = (Math.random() - 0.5) * (fatia * 0.6);
    const voltaAtual = angulo - (angulo % 360);
    const destino = voltaAtual + 360 * 6 + (360 - centro) + jitter;
    setGirando(true);
    setAngulo(destino);
    timerRef.current = setTimeout(() => {
      setGirando(false);
      const p = FATIAS[idx];
      if (p.moedas) onGanharMoedas(p.moedas, "Roleta da Sorte");
      if (p.perk) onGanharItem(p.perk, p.horas || 24);
      setResultado(p.moedas || p.perk ? `Você ganhou: ${p.rotulo}!` : "Não foi dessa vez. Tente de novo!");
      socket.emit("roleta:premio", { premio: NOME_SERVIDOR[p.rotulo] });
    }, 4300);
  };

  // desenho da roda em SVG
  const R = 150;
  const fatiasSvg = FATIAS.map((f, i) => {
    const a0 = ((i * fatia - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * fatia - 90) * Math.PI) / 180;
    const x0 = R + R * Math.cos(a0);
    const y0 = R + R * Math.sin(a0);
    const x1 = R + R * Math.cos(a1);
    const y1 = R + R * Math.sin(a1);
    const meio = i * fatia + fatia / 2;
    return (
      <g key={i}>
        <path d={`M${R},${R} L${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} Z`} fill={f.cor} stroke="#16171B" strokeWidth={3} />
        <text
          x={R}
          y={R - R * 0.62}
          transform={`rotate(${meio} ${R} ${R})`}
          textAnchor="middle"
          fontSize={f.rotulo.length > 6 ? 15 : 24}
          fontWeight={900}
          fill="#16171B"
        >
          {f.rotulo.length > 8
            ? f.rotulo.split(" ").reduce<string[]>((acc, w) => {
                if (acc.length && (acc[acc.length - 1] + " " + w).length <= 9) acc[acc.length - 1] += " " + w;
                else acc.push(w);
                return acc;
              }, []).map((linha, k) => (
                <tspan key={k} x={R} dy={k === 0 ? 0 : 17}>
                  {linha}
                </tspan>
              ))
            : f.rotulo}
        </text>
      </g>
    );
  });

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-[720px] bg-[#1E2026] border border-[#2A2D35] rounded-2xl shadow-2xl p-5 text-[#ECECEC]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Roleta da Sorte</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#2A2D35] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-5">
          <div className="flex-1 flex flex-col items-center">
            <div className="relative w-[300px] h-[300px] max-w-full">
              {/* ponteiro */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-[#ECECEC] drop-shadow" />
              <svg
                viewBox={`0 0 ${R * 2} ${R * 2}`}
                className="w-full h-full rounded-full shadow-[0_0_40px_#5EEAD433] border-[6px] border-[#2A2D35]"
                style={{ transform: `rotate(${angulo}deg)`, transition: girando ? "transform 4.2s cubic-bezier(0.12, 0.8, 0.1, 1)" : "none" }}
              >
                {fatiasSvg}
                <circle cx={R} cy={R} r={20} fill="#2A2D35" stroke="#16171B" strokeWidth={4} />
              </svg>
            </div>

            <button
              onClick={girar}
              disabled={girando}
              className="mt-4 px-8 py-2.5 rounded-full bg-gradient-to-r from-[#5EEAD4] to-[#C4B5FD] text-[#16171B] font-bold text-sm cursor-pointer disabled:opacity-60 active:scale-95 flex items-center gap-2"
            >
              {girando ? "Girando..." : gratis ? "Girar grátis" : (
                <>
                  Girar · {CUSTO_GIRO} <EcoCoinIcon size={14} />
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-[#8B8F98]">
              {gratis ? "Você tem 1 giro grátis hoje!" : `Próximo giro grátis em ${formatarTempo(proximoGratis - agora)}`}
            </p>
            {resultado && <p className="mt-2 text-sm font-bold text-[#5EEAD4] text-center">{resultado}</p>}
          </div>

          <div className="md:w-[230px] rounded-xl bg-[#16171B] border border-[#2A2D35] p-3">
            <h3 className="text-sm font-semibold mb-2">Últimos prêmios</h3>
            {ultimos.length === 0 ? (
              <p className="text-xs text-[#8B8F98]">Ninguém girou nesta sala ainda.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {ultimos.map((u, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-[#5EEAD4]">•</span>
                    <span className="truncate">
                      <b>{u.nome}</b>: {u.premio}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
