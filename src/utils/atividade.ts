/** "Jogando agora": lista de jogos, cores dos blocos e formatação do tempo. */
import { useEffect, useState } from "react";

export interface Atividade {
  jogo: string;
  modo?: string;
  desde: number;
  auto?: boolean;
}

export const JOGOS_COMUNS = [
  "Valorant",
  "Minecraft",
  "Fortnite",
  "Counter-Strike 2",
  "League of Legends",
  "Roblox",
  "Free Fire",
  "GTA V",
  "Apex Legends",
  "EA Sports FC",
  "Rocket League",
  "Brawl Stars",
];

const CORES: Record<string, [string, string]> = {
  valorant: ["#FF4655", "#3B1218"],
  minecraft: ["#5EBA3A", "#1F3316"],
  fortnite: ["#9D4DFF", "#241338"],
  "counter-strike 2": ["#F5A623", "#3A2A10"],
  "league of legends": ["#C8AA6E", "#10202C"],
  roblox: ["#E2E2E2", "#2A2D35"],
  "free fire": ["#FF8A00", "#3A2208"],
  "gta v": ["#5FD068", "#132416"],
  "apex legends": ["#DA292A", "#2E1010"],
  "ea sports fc": ["#33FF99", "#0E2A1E"],
  "rocket league": ["#2E9BFF", "#0F2238"],
  "brawl stars": ["#FFC800", "#3A2F05"],
};

export function corDoJogo(jogo: string): [string, string] {
  const k = String(jogo || "").toLowerCase();
  if (CORES[k]) return CORES[k];
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 360;
  return [`hsl(${h} 70% 68%)`, `hsl(${h} 30% 16%)`];
}

export function siglaDoJogo(jogo: string): string {
  const partes = String(jogo || "?").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return (partes[0] || "?").slice(0, 2).toUpperCase();
}

export function tempoDesde(desde: number, agora = Date.now()): string {
  const min = Math.max(0, Math.floor((agora - desde) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
}

export function horas(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1).replace(".0", "").replace(".", ",")}h`;
}

/** Re-renderiza de minuto em minuto, pra "32 min" andar sozinho. */
export function useAgoraMinuto(): number {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  return agora;
}
