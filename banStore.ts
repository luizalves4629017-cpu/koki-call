/**
 * banStore — suspensões (com prazo) e banimentos permanentes do app.
 *
 * Cada punição guarda vários "rastros" da pessoa pra ela não escapar trocando de nome:
 *   - uid da conta logada (Firebase), quando tiver;
 *   - chave nome#tag (convidado) / uid:xxx;
 *   - IP (primeiro do x-forwarded-for, ou o endereço do socket).
 * Fica salvo no Firebase (coleção "banimentos") e numa cópia em memória.
 * Desbanir não apaga o documento: marca ativo=false (fica o histórico).
 */
import { temFirebase, lerColecao, salvarDoc } from "./dbStore";

export interface Banimento {
  id: string;
  tipo: "suspensao" | "permanente";
  /** onde vale: "app" (o Eco inteiro) ou "sala:<roomId>" (só aquele servidor/sala). Antigos = "app" */
  escopo?: string;
  /** nome da sala (só pra mostrar), quando escopo = sala */
  salaNome?: string;
  /** até quando vale (ms). null = pra sempre */
  ate: number | null;
  motivo?: string;
  uid?: string;
  chave?: string;
  ip?: string;
  nome: string;
  tag?: string;
  avatarUrl?: string;
  avatarColor?: string;
  porNome: string;
  porChave?: string;
  criadoEm: number;
  ativo: boolean;
  desbanidoEm?: number;
  desbanidoPor?: string;
}

const banimentos = new Map<string, Banimento>();

const valendo = (b: Banimento, agora = Date.now()) => b.ativo && (b.ate === null || b.ate > agora);

/** IPs que não devem ser usados pra banir (localhost / rede interna do Render). */
const ipInutil = (ip?: string) => !ip || ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1" || ip === "unknown";

export function normalizarIp(ip?: string | null): string | undefined {
  if (!ip || typeof ip !== "string") return undefined;
  let v = ip.split(",")[0].trim();
  if (v.startsWith("::ffff:")) v = v.slice(7);
  return ipInutil(v) ? undefined : v.slice(0, 64);
}

export async function carregarBanimentos(): Promise<void> {
  if (!temFirebase()) return;
  const docs = await lerColecao<Banimento>("banimentos", 5000);
  let n = 0;
  for (const d of docs) {
    const b = d.dados;
    if (!b || !b.id) continue;
    banimentos.set(b.id, { ...b, escopo: b.escopo || "app", ate: b.ate ?? null, ativo: b.ativo !== false });
    if (valendo(b)) n++;
  }
  if (docs.length) console.log(`[banimentos] ${n} punições valendo (de ${docs.length} no histórico)`);
}

function salvar(b: Banimento) {
  if (!temFirebase()) return;
  salvarDoc("banimentos", b.id, JSON.parse(JSON.stringify(b)), false).catch(() => {});
}

export function criarBanimento(dados: Omit<Banimento, "id" | "criadoEm" | "ativo">): Banimento {
  const b: Banimento = {
    ...dados,
    ip: normalizarIp(dados.ip),
    escopo: dados.escopo && dados.escopo.startsWith("sala:") ? dados.escopo.slice(0, 120) : "app",
    motivo: dados.motivo ? String(dados.motivo).slice(0, 200) : undefined,
    id: `ban-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    criadoEm: Date.now(),
    ativo: true,
  };
  banimentos.set(b.id, b);
  salvar(b);
  return b;
}

export function removerBanimento(id: string, porNome: string): Banimento | null {
  const b = banimentos.get(id);
  if (!b || !b.ativo) return null;
  b.ativo = false;
  b.desbanidoEm = Date.now();
  b.desbanidoPor = porNome;
  salvar(b);
  return b;
}

/**
 * Procura uma punição valendo para qualquer um dos rastros da pessoa.
 * Sem salaId: só banimentos do app inteiro. Com salaId: do app OU daquela sala.
 */
export function procurarBanimento(r: { uid?: string | null; chave?: string | null; ip?: string | null }, salaId?: string | null): Banimento | null {
  const agora = Date.now();
  const ip = normalizarIp(r.ip || undefined);
  let achado: Banimento | null = null;
  for (const b of banimentos.values()) {
    if (!valendo(b, agora)) continue;
    const esc = b.escopo || "app";
    if (esc !== "app" && (!salaId || esc !== `sala:${salaId}`)) continue;
    const bate =
      (r.uid && b.uid && b.uid === r.uid) ||
      (r.chave && b.chave && b.chave === r.chave) ||
      (ip && b.ip && b.ip === ip);
    if (!bate) continue;
    // Permanente ganha; entre suspensões, a que dura mais
    if (!achado || b.ate === null || (achado.ate !== null && b.ate > achado.ate)) achado = b;
    if (achado.ate === null) break;
  }
  return achado;
}

export function listarBanimentos(): Banimento[] {
  const agora = Date.now();
  return Array.from(banimentos.values())
    .filter((b) => valendo(b, agora))
    .sort((a, b) => b.criadoEm - a.criadoEm);
}

/** Versão pra mandar ao navegador (sem IP nem uid). */
export function banimentoPublico(b: Banimento) {
  return {
    id: b.id,
    tipo: b.tipo,
    escopo: b.escopo || "app",
    salaNome: b.salaNome,
    ate: b.ate,
    motivo: b.motivo,
    nome: b.nome,
    tag: b.tag,
    avatarUrl: b.avatarUrl && !b.avatarUrl.startsWith("data:") ? b.avatarUrl : undefined,
    avatarColor: b.avatarColor,
    porNome: b.porNome,
    criadoEm: b.criadoEm,
    temConta: Boolean(b.uid),
  };
}

/** Texto que a pessoa punida vê. */
export function textoBanimento(b: Banimento): string {
  const sala = (b.escopo || "app").startsWith("sala:");
  const onde = sala ? `da sala ${b.salaNome || (b.escopo || "").slice(5)}` : "do Eco";
  if (b.tipo === "permanente" || b.ate === null) return `Você foi banido permanentemente ${onde}.`;
  const d = new Date(b.ate - 3 * 3600 * 1000); // horário de Brasília
  const p = (n: number) => String(n).padStart(2, "0");
  return `Você está banido ${onde} até ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}.`;
}

/** O que vai pro navegador de quem foi punido (BanidoTela). */
export function avisoBanimento(b: Banimento) {
  const sala = (b.escopo || "app").startsWith("sala:");
  return {
    tipo: b.tipo,
    ate: b.ate,
    motivo: b.motivo,
    mensagem: textoBanimento(b),
    escopo: sala ? "sala" : "app",
    salaId: sala ? (b.escopo || "").slice(5) : undefined,
    salaNome: sala ? b.salaNome || (b.escopo || "").slice(5) : undefined,
  };
}
