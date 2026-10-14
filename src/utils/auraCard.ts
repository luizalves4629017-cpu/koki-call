/**
 * Aura do card que o membro pode trocar (quando o Dono Master ou o Co-fundador libera).
 * O servidor valida/limita os mesmos números (membrosStore.limparAura).
 */
export interface AuraConfig {
  /** matiz da cor principal (0–360) */
  cor1: number;
  /** tom: 0 = bem escuro, 50 = cor pura, 100 = quase branco */
  tom: number;
  /** força do brilho (opacidade e desfoque) 0–100 */
  intensidade: number;
  /** velocidade do giro 0 (devagar) – 100 (rápido) */
  velocidade: number;
  duasCores: boolean;
  /** matiz da segunda cor (0–360) */
  cor2: number;
  particulas: boolean;
}

export const AURA_PADRAO: AuraConfig = {
  cor1: 170,
  tom: 65,
  intensidade: 70,
  velocidade: 45,
  duasCores: false,
  cor2: 260,
  particulas: true,
};

export const AURA_PRESETS: { nome: string; config: AuraConfig }[] = [
  { nome: "Azul", config: { cor1: 215, tom: 62, intensidade: 70, velocidade: 45, duasCores: false, cor2: 215, particulas: true } },
  { nome: "Verde-água", config: { cor1: 170, tom: 65, intensidade: 70, velocidade: 45, duasCores: false, cor2: 170, particulas: true } },
  { nome: "Lilás", config: { cor1: 258, tom: 78, intensidade: 70, velocidade: 40, duasCores: false, cor2: 258, particulas: true } },
  { nome: "Fogo", config: { cor1: 12, tom: 55, intensidade: 85, velocidade: 70, duasCores: true, cor2: 42, particulas: true } },
  { nome: "Gelo", config: { cor1: 195, tom: 76, intensidade: 65, velocidade: 30, duasCores: true, cor2: 220, particulas: true } },
  { nome: "Dourado", config: { cor1: 45, tom: 60, intensidade: 75, velocidade: 40, duasCores: false, cor2: 45, particulas: true } },
  { nome: "Rosa", config: { cor1: 330, tom: 72, intensidade: 70, velocidade: 45, duasCores: true, cor2: 285, particulas: true } },
];

/** Faixa de tom permitida para auras de membro (vale no servidor também). */
export const TOM_MIN_MEMBRO = 20;
export const TOM_MAX_MEMBRO = 80;

const num = (v: any, min: number, max: number, padrao: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return padrao;
  return Math.round(Math.min(max, Math.max(min, n)));
};

/** Limpa e limita a configuração (mesmas regras do servidor). */
export function limparAura(c: any): AuraConfig {
  const x = c && typeof c === "object" ? c : {};
  return {
    cor1: num(x.cor1, 0, 360, AURA_PADRAO.cor1),
    // Tom limitado (20–80): membro nunca chega no branco/prata/cinza nem no preto,
    // que são exclusivos das auras do Dono Master e do Co-fundador.
    tom: num(x.tom, TOM_MIN_MEMBRO, TOM_MAX_MEMBRO, AURA_PADRAO.tom),
    intensidade: num(x.intensidade, 0, 100, AURA_PADRAO.intensidade),
    velocidade: num(x.velocidade, 0, 100, AURA_PADRAO.velocidade),
    duasCores: Boolean(x.duasCores),
    cor2: num(x.cor2, 0, 360, AURA_PADRAO.cor2),
    particulas: x.particulas === undefined ? true : Boolean(x.particulas),
  };
}

/** Cor HSL da aura. `tom` vira a luminosidade (8%–96%); muito claro/escuro perde saturação. */
export function corAura(hue: number, tom: number, alpha: number): string {
  const l = 8 + (tom / 100) * 88;
  const s = tom > 85 ? Math.max(8, 100 - (tom - 85) * 6) : 90;
  return `hsla(${hue}, ${s}%, ${l.toFixed(1)}%, ${alpha.toFixed(2)})`;
}

/** Duração de uma volta em segundos: 0 → 22 s (devagar), 100 → 2,5 s (rápido). */
export function duracaoAura(velocidade: number): number {
  return +(22 - (velocidade / 100) * 19.5).toFixed(2);
}

/** Gradiente cônico no mesmo desenho da aura do criador, montado com as cores escolhidas. */
export function gradienteAura(c: AuraConfig): string {
  const h1 = c.cor1;
  const h2 = c.duasCores ? c.cor2 : c.cor1;
  const a = corAura(h1, c.tom, 0.95);
  const a2 = corAura(h1, Math.max(0, c.tom - 25), 0.5);
  const b = corAura(h2, c.tom, 0.85);
  const b2 = corAura(h2, Math.max(0, c.tom - 25), 0.4);
  return `conic-gradient(from 0deg, transparent 0deg, ${a} 40deg, ${a2} 90deg, transparent 140deg, transparent 180deg, ${b} 220deg, ${b2} 270deg, transparent 320deg)`;
}
