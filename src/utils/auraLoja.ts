/** Cores da "Aura do card" comprada na loja (brilho simples, sem giro nem partículas). */
export const CORES_AURA_LOJA: { id: string; nome: string; cor: string }[] = [
  { id: "azul", nome: "Azul", cor: "#60A5FA" },
  { id: "rosa", nome: "Rosa", cor: "#F472B6" },
  { id: "verde", nome: "Verde", cor: "#4ADE80" },
  { id: "roxo", nome: "Roxo", cor: "#A78BFA" },
  { id: "laranja", nome: "Laranja", cor: "#FB923C" },
  { id: "vermelho", nome: "Vermelho", cor: "#F87171" },
];

export const corAuraLoja = (id?: string) => CORES_AURA_LOJA.find((c) => c.id === id);
