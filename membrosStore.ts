/**
 * membrosStore — lembra de todo mundo que já entrou no eco, mesmo depois que sai.
 * Serve pra lista de membros mostrar quem está offline ("visto há 2 h").
 * Coleção "membros" no Firebase, um documento por pessoa (uid:xxx ou nome#tag).
 */
import { temFirebase, lerColecao, salvarDoc, lerDoc } from "./dbStore";
import { createHash } from "crypto";
import { limparAura, type AuraConfig } from "./src/utils/auraCard";

export interface Membro {
  chave: string;
  nome: string;
  tag: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  vistoEm: number;
  /** salas por onde a pessoa passou: id -> nome e quando foi vista lá */
  salas: Record<string, { nome: string; vistoEm: number }>;
  /** itens da loja que a pessoa tem (id -> válido até) */
  perks?: Record<string, number>;
  /** itens que o Dono removeu (id -> "válido até" que foi tirado). Compra nova depois disso vale. */
  perksRemovidos?: Record<string, number>;
  /** primeira vez que a pessoa entrou no eco (nunca muda pra frente) */
  primeiroAcesso?: number;
  /** cargo dado pelo Dono (ex.: "Moderador"). Vazio = Membro */
  cargo?: string;
  /** poderes do cargo: "mutar", "expulsar", "porta" (aprovar quem bate) */
  poderes?: string[];
  /** perfil salvo pra aparecer mesmo offline */
  bannerUrl?: string;
  bannerColor?: string;
  customStatus?: string;
  customTitle?: string;
  bio?: string;
  /** já entrou como Dono Master (perfil dele sempre liberado) */
  ehDono?: boolean;
  /** uid da conta logada (Firebase), quando a pessoa já entrou com conta */
  uid?: string;
  /** último IP visto (pra banir quem está offline) */
  lastIp?: string;
  /** histórico de compras na loja: id -> primeira compra, última, válido até, quantas vezes */
  compras?: Record<string, { primeira: number; ultima: number; ate: number; vezes: number }>;
  /** Dono Master ou Co-fundador liberou a pessoa a trocar a aura do card */
  auraLiberada?: boolean;
  /** quem liberou: "dono" (Dono Master) ou "cofundador" */
  auraLiberadaPor?: "dono" | "cofundador";
  /** aura escolhida pela pessoa (só vale com auraLiberada) */
  aura?: AuraConfig;
  /** cor da "Aura do card" comprada na loja (só vale com o item aura_card ativo) */
  auraLoja?: string;
}

const membros = new Map<string, Membro>();
const pendentes = new Set<string>();
let timer: NodeJS.Timeout | null = null;

const idDoc = (chave: string) => encodeURIComponent(chave).slice(0, 700);
// Foto em base64 é grande demais pro banco: guarda só link http curto
const fotoLeve = (url?: string) => (typeof url === "string" && /^https?:\/\//.test(url) && url.length < 600 ? url : undefined);
// Foto/banner enviados do aparelho (base64): guarda se for pequeno o bastante pro banco (até ~220 KB)
const midiaPerfil = (url?: string) => {
  if (typeof url !== "string" || !url) return undefined;
  if (/^https?:\/\//.test(url)) return url.length < 2000 ? url : undefined;
  if (/^data:(image|video)\//.test(url)) return url.length < 9_000_000 ? url : undefined; // vídeo/GIF grande vai em pedaços (ver salvarMidia)
  return undefined;
};

// Banner/foto grandes (vídeo mp4, GIF) não cabem num documento do Firebase (limite 1 MB):
// guarda em pedaços na coleção "midias" e o membro fica só com a referência "midia:<hash>:<partes>".
const PEDACO = 900_000;
const CAMPOS_MIDIA = ["avatarUrl", "bannerUrl"] as const;
const midiasSalvas = new Set<string>();
async function salvarMidia(dataUrl: string): Promise<string> {
  const h = createHash("sha1").update(dataUrl).digest("hex").slice(0, 24);
  const n = Math.ceil(dataUrl.length / PEDACO);
  if (!midiasSalvas.has(h)) {
    for (let i = 0; i < n; i++) await salvarDoc("midias", `${h}_${i}`, { parte: dataUrl.slice(i * PEDACO, (i + 1) * PEDACO), total: n }, false);
    midiasSalvas.add(h);
  }
  return `midia:${h}:${n}`;
}
async function lerMidia(ref: string): Promise<string | undefined> {
  const [, h, nTxt] = ref.split(":");
  const n = Number(nTxt);
  if (!h || !n || n > 20) return undefined;
  const partes: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = await lerDoc<any>("midias", `${h}_${i}`).catch(() => null);
    if (!d?.parte) return undefined;
    partes.push(d.parte);
  }
  midiasSalvas.add(h);
  return partes.join("");
}

function agendar(chave: string) {
  if (!temFirebase()) return;
  pendentes.add(chave);
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const lista = Array.from(pendentes);
    pendentes.clear();
    for (const k of lista) {
      const m = membros.get(k);
      if (!m) continue;
      const doc = JSON.parse(JSON.stringify(m));
      for (const campo of CAMPOS_MIDIA) {
        const v = doc[campo];
        if (typeof v === "string" && v.startsWith("data:") && v.length > 200_000) {
          doc[campo] = await salvarMidia(v).catch(() => undefined);
          if (!doc[campo]) delete doc[campo];
        }
      }
      await salvarDoc("membros", idDoc(k), doc, false).catch(() => {});
    }
  }, 1500);
}

/** Pessoa entrou numa sala (ou mudou o perfil): atualiza o registro dela. */
export function registrarMembro(chave: string, pp: any, sala?: { id: string; nome: string }, chaveAntiga?: string) {
  if (!chave || !pp) return;
  let m = membros.get(chave);
  // Entrou na conta: junta o que tinha pelo nome#tag e apaga o registro velho da lista
  if (chaveAntiga && chaveAntiga !== chave && membros.has(chaveAntiga)) {
    const velho = membros.get(chaveAntiga)!;
    m = m
      ? {
          ...m,
          salas: { ...velho.salas, ...m.salas },
          primeiroAcesso: Math.min(m.primeiroAcesso || Infinity, velho.primeiroAcesso || Infinity) || undefined,
          cargo: m.cargo || velho.cargo,
          poderes: m.poderes?.length ? m.poderes : velho.poderes,
          lastIp: m.lastIp || velho.lastIp,
          auraLiberada: m.auraLiberada ?? velho.auraLiberada,
          auraLiberadaPor: m.auraLiberadaPor ?? velho.auraLiberadaPor,
          aura: m.aura ?? velho.aura,
          auraLoja: m.auraLoja ?? velho.auraLoja,
        }
      : { ...velho, chave };
    if (m.primeiroAcesso === Infinity) m.primeiroAcesso = undefined;
    membros.delete(chaveAntiga);
    if (temFirebase()) salvarDoc("membros", idDoc(chaveAntiga), { removido: true, chave: chaveAntiga }, false).catch(() => {});
  }
  const agora = Date.now();
  // Data do primeiro acesso: fica sempre a mais antiga que já se viu (aparelho, registro, salas)
  const candidatos = [m?.primeiroAcesso, Number(pp.memberSince), ...Object.values(m?.salas || {}).map((x) => x.vistoEm), m?.vistoEm, agora].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 1600000000000 && n <= agora + 60000
  );
  const primeiro = Math.min(...candidatos);
  m = {
    chave,
    nome: String(pp.name || m?.nome || "Membro").slice(0, 32),
    tag: String(pp.tag || m?.tag || ""),
    avatarUrl: pp.avatarUrl === "" ? undefined : midiaPerfil(pp.avatarUrl) ?? m?.avatarUrl,
    bannerUrl: pp.bannerUrl === "" ? undefined : midiaPerfil(pp.bannerUrl) ?? m?.bannerUrl,
    bannerColor: pp.bannerColor || m?.bannerColor,
    customStatus: typeof pp.customStatus === "string" ? pp.customStatus.slice(0, 60) : m?.customStatus,
    customTitle: typeof pp.customTitle === "string" ? pp.customTitle.slice(0, 40) : m?.customTitle,
    bio: typeof pp.bio === "string" ? pp.bio.slice(0, 160) : m?.bio,
    compras: m?.compras || {},
    ehDono: Boolean(pp.isMaster) || Boolean(m?.ehDono),
    avatarEmoji: pp.avatarEmoji || m?.avatarEmoji,
    avatarColor: pp.avatarColor || m?.avatarColor,
    vistoEm: agora,
    salas: { ...(m?.salas || {}) },
    perks: m?.perks || {},
    perksRemovidos: m?.perksRemovidos || {},
    primeiroAcesso: primeiro,
    cargo: m?.cargo,
    poderes: m?.poderes,
    uid: m?.uid,
    lastIp: m?.lastIp,
    // aura: só o servidor muda (membros:aura-liberar / user:aura-salvar), nunca o perfil enviado
    auraLiberada: m?.auraLiberada,
    auraLiberadaPor: m?.auraLiberadaPor,
    aura: m?.aura,
    auraLoja: m?.auraLoja,
  };
  if (sala?.id) m.salas[sala.id] = { nome: String(sala.nome || sala.id).slice(0, 40), vistoEm: agora };
  membros.set(chave, m);
  agendar(chave);
}

/** Pessoa saiu: marca a hora em que foi vista por último. */
export function marcarVisto(chave: string, salaId?: string) {
  const m = membros.get(chave);
  if (!m) return;
  m.vistoEm = Date.now();
  if (salaId && m.salas[salaId]) m.salas[salaId].vistoEm = m.vistoEm;
  agendar(chave);
}

export function listarMembros(): Membro[] {
  return Array.from(membros.values());
}

export function membroPorChave(chave: string): Membro | undefined {
  return membros.get(chave);
}

/** Lê do Firebase ao iniciar o servidor. */
export async function carregarMembros(): Promise<void> {
  if (!temFirebase()) return;
  const docs = await lerColecao<any>("membros", 5000);
  for (const d of docs) {
    const m = d.dados;
    if (!m || m.removido || !m.chave) continue;
    membros.set(String(m.chave), { ...m, salas: m.salas || {} });
  }
  if (docs.length) console.log(`[membros] ${membros.size} membros carregados do Firebase`);
  // Remonta banners/fotos grandes guardados em pedaços (em segundo plano, não trava a subida)
  void (async () => {
    for (const m of membros.values()) {
      for (const campo of CAMPOS_MIDIA) {
        const v: any = (m as any)[campo];
        if (typeof v === "string" && v.startsWith("midia:")) (m as any)[campo] = await lerMidia(v);
      }
    }
  })();
}

/** Tira da lista o que o Dono já removeu. Compra nova (validade maior) continua valendo. */
export function filtrarPerks(chave: string, perks: Record<string, number>): { perks: Record<string, number>; removidos: string[] } {
  const rem = membros.get(chave)?.perksRemovidos || {};
  const limpos: Record<string, number> = {};
  const removidos: string[] = [];
  for (const [id, ate] of Object.entries(perks || {})) {
    if (rem[id] && ate <= rem[id] + 60000) removidos.push(id);
    else limpos[id] = ate;
  }
  return { perks: limpos, removidos };
}

/** Guarda o que a pessoa tem na loja (pra o Dono ver mesmo com ela offline). */
export function salvarPerksMembro(chave: string, perks: Record<string, number>) {
  const m = membros.get(chave);
  if (!m) return;
  m.perks = { ...perks };
  // Histórico: tudo que a pessoa já comprou (não some quando vence)
  const agora = Date.now();
  m.compras = m.compras || {};
  for (const [id, ate] of Object.entries(perks || {})) {
    const c = m.compras[id];
    if (!c) m.compras[id] = { primeira: agora, ultima: agora, ate: Number(ate), vezes: 1 };
    else if (Number(ate) > c.ate + 60000) m.compras[id] = { ...c, ultima: agora, ate: Number(ate), vezes: c.vezes + 1 };
  }
  agendar(chave);
}

/** Dono removeu um item da loja dessa pessoa. */
export function removerPerkMembro(chave: string, itemId: string, ateConhecido?: number) {
  const m = membros.get(chave);
  if (!m) return;
  const ate = Math.max(Number(m.perks?.[itemId] || 0), Number(ateConhecido || 0), Date.now());
  m.perksRemovidos = { ...(m.perksRemovidos || {}), [itemId]: ate };
  if (m.perks) delete m.perks[itemId];
  // tira do perfil salvo o que esse item liberava
  if (itemId === "custom_banner") m.bannerUrl = undefined;
  if (itemId === "custom_title" || itemId === "vip_role") m.customTitle = undefined;
  if (itemId === "gif_avatar" || itemId === "vip_role") m.avatarUrl = undefined;
  if (itemId === "aura_card") m.auraLoja = undefined;
  if (m.compras?.[itemId]) m.compras[itemId] = { ...m.compras[itemId], ate: Math.min(m.compras[itemId].ate, Date.now()), removido: true } as any;
  agendar(chave);
}

export function perksAtivosMembro(chave: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, ate] of Object.entries(membros.get(chave)?.perks || {})) if (ate > Date.now()) out[id] = ate;
  return out;
}

export function desdeMembro(chave: string): number | undefined {
  return membros.get(chave)?.primeiroAcesso;
}

export function cargoMembro(chave: string): string | undefined {
  return membros.get(chave)?.cargo || undefined;
}

/** Dono define (ou tira, com texto vazio) o cargo da pessoa. */
export const PODERES_VALIDOS = ["mutar", "expulsar", "porta"];

export function poderesMembro(chave: string): string[] {
  return membros.get(chave)?.poderes || [];
}

export function definirCargo(chave: string, cargo: string, poderes?: string[]): boolean {
  const m = membros.get(chave);
  if (!m) return false;
  const limpo = String(cargo || "").trim().slice(0, 30);
  m.cargo = limpo || undefined;
  // Sem cargo não tem poder nenhum
  m.poderes = limpo && Array.isArray(poderes) ? PODERES_VALIDOS.filter((x) => poderes.includes(x)) : [];
  agendar(chave);
  return true;
}

/** Pessoa saiu do servidor/sala por vontade própria: some da lista de membros dela. Entrar de novo coloca de volta. */
export function sairDaSala(chave: string, salaId: string): boolean {
  const m = membros.get(chave);
  if (!m || !m.salas?.[salaId]) return false;
  delete m.salas[salaId];
  agendar(chave);
  return true;
}

export function comprasMembro(chave: string) {
  return membros.get(chave)?.compras || {};
}

/** Guarda a conta (uid) e o último IP de quem conectou (amizade e banimento de quem está offline). */
export function anotarRastros(chave: string, r: { uid?: string; ip?: string }) {
  const m = membros.get(chave);
  if (!m) return;
  let mudou = false;
  if (r.uid && m.uid !== r.uid) { m.uid = r.uid; mudou = true; }
  if (r.ip && m.lastIp !== r.ip) { m.lastIp = r.ip.slice(0, 64); mudou = true; }
  if (mudou) agendar(chave);
}

/** Conta (uid) de um membro salvo: pela chave "uid:xxx" ou pelo uid guardado. */
export function uidDoMembro(chave: string): string | undefined {
  if (chave.startsWith("uid:")) return chave.slice(4);
  return membros.get(chave)?.uid || undefined;
}

/** Conta que o Dono Master usou por último (pra ele ter sempre a mesma identidade de amizade). */
export function uidDoDonoMaster(): string | undefined {
  let melhor: Membro | undefined;
  for (const m of membros.values()) {
    if (!m.ehDono) continue;
    const uid = m.uid || (m.chave.startsWith("uid:") ? m.chave.slice(4) : undefined);
    if (!uid) continue;
    if (!melhor || m.vistoEm > melhor.vistoEm) melhor = m;
  }
  return melhor ? melhor.uid || melhor.chave.slice(4) : undefined;
}

/** Nome/foto salvos de um uid (ou do Dono, pra identidade "master"). */
export function perfilSalvoPorUid(uid: string): { nome: string; avatarUrl?: string; avatarColor?: string } | undefined {
  let achado: Membro | undefined;
  for (const m of membros.values()) {
    const bate = uid === "master" ? m.ehDono : m.chave === `uid:${uid}` || m.uid === uid;
    if (bate && (!achado || m.vistoEm > achado.vistoEm)) achado = m;
  }
  if (!achado) return undefined;
  const foto = typeof achado.avatarUrl === "string" && /^https?:\/\//.test(achado.avatarUrl) && achado.avatarUrl.length < 2000 ? achado.avatarUrl : undefined;
  return { nome: achado.nome, avatarUrl: foto, avatarColor: achado.avatarColor };
}

/** Aura do card: liberada pra pessoa trocar? Quem liberou? Qual a aura dela? */
export function auraDoMembro(chave: string): { liberada: boolean; por?: "dono" | "cofundador"; config?: AuraConfig } {
  const m = membros.get(chave);
  if (!m?.auraLiberada) return { liberada: false };
  return { liberada: true, por: m.auraLiberadaPor, config: m.aura ? limparAura(m.aura) : undefined };
}

/** Dono Master / Co-fundador libera ou tira a troca de aura. Tirar apaga a aura personalizada. */
export function liberarAuraMembro(chave: string, liberado: boolean, por: "dono" | "cofundador"): boolean {
  const m = membros.get(chave);
  if (!m) return false;
  if (liberado) {
    m.auraLiberada = true;
    m.auraLiberadaPor = por;
  } else {
    m.auraLiberada = false;
    m.auraLiberadaPor = undefined;
    m.aura = undefined;
  }
  agendar(chave);
  return true;
}

/** Pessoa salva (ou remove, com null) a própria aura. Só funciona se estiver liberada. */
export function salvarAuraMembro(chave: string, config: any | null): AuraConfig | undefined | false {
  const m = membros.get(chave);
  if (!m?.auraLiberada) return false;
  m.aura = config ? limparAura(config) : undefined;
  agendar(chave);
  return m.aura;
}

/** Cores da "Aura do card" da loja (mesma lista do cliente em src/utils/auraLoja.ts). */
export const CORES_AURA_LOJA = ["azul", "rosa", "verde", "roxo", "laranja", "vermelho"];

/** Cor da aura da loja, só se o item aura_card estiver ativo (não vencido, não removido pelo Dono). */
export function auraLojaDoMembro(chave: string): string | undefined {
  const m = membros.get(chave);
  if (!m?.auraLoja) return undefined;
  return perksAtivosMembro(chave).aura_card ? m.auraLoja : undefined;
}

/** Salva a cor escolhida (quem chama já conferiu que a pessoa tem o item). */
export function salvarAuraLojaMembro(chave: string, cor: string | null): boolean {
  const m = membros.get(chave);
  if (!m) return false;
  m.auraLoja = cor && CORES_AURA_LOJA.includes(cor) ? cor : undefined;
  agendar(chave);
  return true;
}

/** Cor salva da aura da loja (sem conferir o item; quem está online confere pelos perks ao vivo). */
export function corAuraLojaSalva(chave: string): string | undefined {
  return membros.get(chave)?.auraLoja;
}
