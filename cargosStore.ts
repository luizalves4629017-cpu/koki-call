/**
 * cargosStore — guarda no Firebase o que o Dono dá pras pessoas:
 * insígnias, VIP e cargo de Co-fundador. Assim nada some quando o Render dorme ou reinicia.
 * Coleção "cargos", um documento por pessoa (nome#tag).
 */
import { temFirebase, lerColecao, salvarDoc } from "./dbStore";

type Leitor = (chave: string) => { insignias?: string[] | null; vip?: any | null; cofundador: boolean };

let leitor: Leitor | null = null;
let carregando = false;
const pendentes = new Set<string>();
let timer: NodeJS.Timeout | null = null;

const idDoc = (chave: string) => encodeURIComponent(chave).slice(0, 700);

/** Diz ao store como ler o estado atual de uma pessoa (os mapas ficam no server.ts). */
export function configurarCargos(fn: Leitor) {
  leitor = fn;
}

/** Marca uma pessoa pra ser salva (junta várias mudanças em uma escrita). */
export function agendarSalvarCargo(chave: string) {
  if (carregando || !chave || !temFirebase()) return;
  pendentes.add(chave);
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const lista = Array.from(pendentes);
    pendentes.clear();
    for (const k of lista) {
      if (!leitor) continue;
      const e = leitor(k);
      await salvarDoc(
        "cargos",
        idDoc(k),
        {
          chave: k,
          insignias: e.insignias ?? null,
          vip: e.vip ?? null,
          cofundador: e.cofundador,
          atualizadoEm: Date.now(),
        },
        false
      );
    }
  }, 400);
}

/** Lê tudo do Firebase ao iniciar o servidor e devolve pra preencher os mapas. */
export async function carregarCargos(
  aplicar: (chave: string, dados: { insignias?: string[] | null; vip?: any | null; cofundador?: boolean }) => void
): Promise<void> {
  if (!temFirebase()) return;
  carregando = true;
  try {
    const docs = await lerColecao<any>("cargos", 5000);
    for (const d of docs) {
      const chave = String(d.dados?.chave || decodeURIComponent(d.id));
      aplicar(chave, d.dados || {});
    }
    if (docs.length) console.log(`[cargos] ${docs.length} pessoas com insígnias/VIP/cargo carregadas do Firebase`);
  } finally {
    carregando = false;
  }
}
