/** Tag que aparece na tela (#0001 do Dono, #0002 do Co-fundador, ou a tag da pessoa). */
export const TAG_COFUNDADOR = "0002";

export function tagVisivel(p?: { tag?: string; tagExibida?: string; isCofundador?: boolean; isMaster?: boolean } | null, padrao = "0000"): string {
  if (!p) return padrao;
  if (p.tagExibida) return p.tagExibida;
  if (p.isCofundador && !p.isMaster) return TAG_COFUNDADOR;
  return p.tag || padrao;
}

/** Data/hora curta no horário do aparelho: DD/MM HH:mm */
export function dataHoraCurta(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
