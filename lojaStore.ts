/**
 * lojaStore — preços/ajustes da loja definidos pelo Dono Master.
 * Salva em JSON no disco do servidor (data/loja.json). Pronto para virar Firestore depois.
 */
import fs from "fs";
import path from "path";
import { temFirebase, lerDoc, salvarDoc } from "./dbStore";

export interface AjusteItemLoja {
  price?: number;
  originalPrice?: number;
  discountPercent?: number;
  durationHours?: number;
  isActive?: boolean;
}

const DATA_DIR = process.env.ECO_DATA_DIR || path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "loja.json");

let ajustes: Record<string, AjusteItemLoja> = {};
let carregado = false;
let timer: NodeJS.Timeout | null = null;

function load() {
  if (carregado) return;
  carregado = true;
  try {
    if (fs.existsSync(FILE)) ajustes = JSON.parse(fs.readFileSync(FILE, "utf8")) || {};
  } catch (e) {
    console.warn("[loja] não consegui ler, usando preços padrão:", e);
  }
}

function persist() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(ajustes));
    } catch (e) {
      console.warn("[loja] falha ao salvar:", e);
    }
    // Firebase: salva de verdade (o disco do Render some quando ele dorme)
    if (temFirebase()) void salvarDoc("config", "loja", { ajustes: JSON.parse(JSON.stringify(ajustes)) }, false);
  }, 300);
}

export function getAjustesLoja(): Record<string, AjusteItemLoja> {
  load();
  return ajustes;
}

export function setAjusteLoja(itemId: string, a: AjusteItemLoja): Record<string, AjusteItemLoja> {
  load();
  const limpo: AjusteItemLoja = { ...(ajustes[itemId] || {}) };
  const n = (v: any, min: number, max: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.max(min, Math.min(max, Math.floor(x))) : undefined;
  };
  if (a.price !== undefined) limpo.price = n(a.price, 0, 10000000);
  if (a.originalPrice !== undefined) limpo.originalPrice = n(a.originalPrice, 0, 10000000);
  if (a.discountPercent !== undefined) limpo.discountPercent = n(a.discountPercent, 0, 100);
  if (a.durationHours !== undefined) limpo.durationHours = n(a.durationHours, 1, 24 * 365);
  if (typeof a.isActive === "boolean") limpo.isActive = a.isActive;
  ajustes[itemId] = limpo;
  persist();
  return ajustes;
}

/** Na hora que o servidor liga: puxa os preços salvos no Firebase. */
export async function carregarLojaDoBanco(): Promise<void> {
  load();
  if (!temFirebase()) return;
  const doc = await lerDoc<{ ajustes?: Record<string, AjusteItemLoja> }>("config", "loja");
  if (doc?.ajustes && typeof doc.ajustes === "object") {
    ajustes = doc.ajustes;
    console.log(`[loja] ${Object.keys(ajustes).length} ajustes de preço carregados do Firebase`);
  }
}
