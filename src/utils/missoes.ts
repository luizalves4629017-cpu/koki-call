/**
 * Missões do dia + sequência de dias (streak). Fica salvo no aparelho e na conta (se logado).
 */
const KEY = "eco_missoes_v1";
export const EVENTO_MISSOES = "eco_missoes_mudou";

export interface MissaoDef {
  id: "call" | "mensagens" | "tela";
  titulo: string;
  meta: number;
  unidade: string;
  premio: number;
}

export const MISSOES: MissaoDef[] = [
  { id: "call", titulo: "Ficar 30 min em call", meta: 30, unidade: "min", premio: 40 },
  { id: "mensagens", titulo: "Mandar 10 mensagens", meta: 10, unidade: "", premio: 25 },
  { id: "tela", titulo: "Compartilhar a tela 1 vez", meta: 1, unidade: "", premio: 30 },
];

export const BONUS_SEQUENCIA_7 = 150;

interface Estado {
  dia: string;
  progresso: Record<string, number>;
  resgatadas: string[];
  sequencia: number;
  ultimoDiaSequencia: string;
  bonus7Resgatado?: string;
}

const hoje = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ontem = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return hoje(d);
};

export function getMissoes(): Estado {
  let e: Estado;
  try {
    e = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    e = null as any;
  }
  if (!e || typeof e !== "object") e = { dia: hoje(), progresso: {}, resgatadas: [], sequencia: 0, ultimoDiaSequencia: "" };
  if (e.dia !== hoje()) {
    e.dia = hoje();
    e.progresso = {};
    e.resgatadas = [];
  }
  // sequência quebrou (pulou um dia)
  if (e.ultimoDiaSequencia && e.ultimoDiaSequencia !== hoje() && e.ultimoDiaSequencia !== ontem()) {
    e.sequencia = 0;
  }
  return e;
}

function salvar(e: Estado) {
  try {
    localStorage.setItem(KEY, JSON.stringify(e));
    window.dispatchEvent(new CustomEvent(EVENTO_MISSOES));
  } catch {
    // ignore
  }
}

export function somarMissao(id: MissaoDef["id"], qtd = 1) {
  const e = getMissoes();
  const def = MISSOES.find((m) => m.id === id);
  if (!def) return;
  const atual = e.progresso[id] || 0;
  if (atual >= def.meta) return;
  e.progresso[id] = Math.min(def.meta, atual + qtd);
  salvar(e);
}

/** Resgata a missão. Devolve quantas moedas ganhou (0 se não podia). */
export function resgatarMissao(id: MissaoDef["id"]): number {
  const e = getMissoes();
  const def = MISSOES.find((m) => m.id === id);
  if (!def || e.resgatadas.includes(id) || (e.progresso[id] || 0) < def.meta) return 0;
  e.resgatadas.push(id);
  if (e.ultimoDiaSequencia !== hoje()) {
    e.sequencia = e.ultimoDiaSequencia === ontem() ? e.sequencia + 1 : 1;
    e.ultimoDiaSequencia = hoje();
  }
  salvar(e);
  return def.premio;
}

/** Bônus de 7 dias seguidos (uma vez a cada 7 dias de sequência). */
export function podeResgatarBonus7(): boolean {
  const e = getMissoes();
  return e.sequencia > 0 && e.sequencia % 7 === 0 && e.bonus7Resgatado !== hoje();
}

export function resgatarBonus7(): number {
  if (!podeResgatarBonus7()) return 0;
  const e = getMissoes();
  e.bonus7Resgatado = hoje();
  salvar(e);
  return BONUS_SEQUENCIA_7;
}
