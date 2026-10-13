/** Preços da loja vindos do servidor (definidos pelo Dono Master) aplicados por cima dos itens padrão */
import type { StorePerk } from "../types";

export type AjustesLoja = Record<string, Partial<Pick<StorePerk, "price" | "originalPrice" | "discountPercent" | "durationHours" | "isActive">>>;

let ajustesLoja: AjustesLoja = {};

export function setAjustesLoja(a: AjustesLoja) {
  ajustesLoja = a || {};
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("eco_store_items_updated"));
}

export function aplicarAjustes(items: StorePerk[]): StorePerk[] {
  return items.map((it) => {
    const a = ajustesLoja[it.id];
    return a ? { ...it, ...a } : it;
  });
}
