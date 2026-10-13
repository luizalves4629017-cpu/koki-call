/** Itens da loja ativos em um participante (vale para você e para os outros na call) */
import type { Participant } from "../types";

export type TipoAnel = "nebulosa" | "aurora";

export function perkAtivo(p: Partial<Participant> | null | undefined, id: string): boolean {
  const ate = p?.purchasedPerks?.[id];
  return typeof ate === "number" && ate > Date.now();
}

export function anelDoParticipante(p: Partial<Participant> | null | undefined): TipoAnel | null {
  if (perkAtivo(p, "ring_nebulosa")) return "nebulosa";
  if (perkAtivo(p, "ring_aurora")) return "aurora";
  return null;
}

export const GRADIENTE_ANEL: Record<TipoAnel, string> = {
  nebulosa: "linear-gradient(135deg, #5EEAD4 0%, #C4B5FD 55%, #5EEAD4 100%)",
  aurora: "linear-gradient(135deg, #34D399 0%, #5EEAD4 50%, #A7F3D0 100%)",
};
