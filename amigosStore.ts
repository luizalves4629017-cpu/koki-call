/**
 * amigosStore — amigos e conversa privada (DM) entre contas logadas.
 *
 * Firebase:
 *   amizades/{uid}   -> { amigos: uid[], recebidos: {uid, em}[], enviados: {uid, em}[] }
 *   conversas/{a_b}  -> { participantes: [a, b], mensagens: (últimas 200), naoLidas: { uid: n } }
 *                       (id = os dois uids em ordem alfabética, separados por "_")
 * Só quem é amigo conversa. Mensagem chega na hora pelo socket se o amigo estiver online.
 */
import type { Server as SocketIOServer, Socket } from "socket.io";
import { temFirebase, lerDoc, salvarDoc } from "./dbStore";
import { checarSpam } from "./antiSpam";

interface Pedido {
  uid: string;
  em: number;
}
interface Amizades {
  amigos: string[];
  recebidos: Pedido[];
  enviados: Pedido[];
}
export interface MensagemDM {
  id: string;
  de: string;
  texto: string;
  em: number;
}
interface Conversa {
  participantes: [string, string];
  mensagens: MensagemDM[];
  naoLidas: Record<string, number>;
  atualizadoEm: number;
}

const MAX_MENSAGENS = 200;
const MAX_AMIGOS = 300;
const MAX_PEDIDOS = 100;

const cacheAmizades = new Map<string, Amizades>();
const cacheConversas = new Map<string, Conversa>();
const cachePerfis = new Map<string, { em: number; nome: string; avatarUrl?: string; avatarColor?: string }>();
/** uid -> sockets conectados com essa conta */
const online = new Map<string, Set<string>>();

const idConversa = (a: string, b: string) => [a, b].sort().join("_");
const vazio = (): Amizades => ({ amigos: [], recebidos: [], enviados: [] });

async function lerAmizades(uid: string): Promise<Amizades> {
  const c = cacheAmizades.get(uid);
  if (c) return c;
  const d = (await lerDoc<any>("amizades", uid)) || {};
  const a: Amizades = {
    amigos: Array.isArray(d.amigos) ? d.amigos.filter((x: any) => typeof x === "string") : [],
    recebidos: Array.isArray(d.recebidos) ? d.recebidos.filter((x: any) => x && typeof x.uid === "string") : [],
    enviados: Array.isArray(d.enviados) ? d.enviados.filter((x: any) => x && typeof x.uid === "string") : [],
  };
  cacheAmizades.set(uid, a);
  return a;
}

function salvarAmizades(uid: string, a: Amizades) {
  a.amigos = Array.from(new Set(a.amigos)).slice(0, MAX_AMIGOS);
  a.recebidos = a.recebidos.slice(-MAX_PEDIDOS);
  a.enviados = a.enviados.slice(-MAX_PEDIDOS);
  cacheAmizades.set(uid, a);
  if (temFirebase()) salvarDoc("amizades", uid, { ...a, atualizadoEm: Date.now() }, false).catch(() => {});
}

async function lerConversa(a: string, b: string): Promise<Conversa> {
  const id = idConversa(a, b);
  const c = cacheConversas.get(id);
  if (c) return c;
  const d = (await lerDoc<any>("conversas", id)) || {};
  const conv: Conversa = {
    participantes: [a, b].sort() as [string, string],
    mensagens: Array.isArray(d.mensagens) ? d.mensagens.slice(-MAX_MENSAGENS) : [],
    naoLidas: d.naoLidas && typeof d.naoLidas === "object" ? d.naoLidas : {},
    atualizadoEm: Number(d.atualizadoEm) || 0,
  };
  cacheConversas.set(id, conv);
  return conv;
}

function salvarConversa(conv: Conversa) {
  conv.mensagens = conv.mensagens.slice(-MAX_MENSAGENS);
  const id = idConversa(conv.participantes[0], conv.participantes[1]);
  cacheConversas.set(id, conv);
  if (temFirebase()) salvarDoc("conversas", id, JSON.parse(JSON.stringify(conv)), false).catch(() => {});
}

/** Perfil vindo da sala/lista de membros (vale pra quem não tem documento em usuarios, ex.: identidade "master"). */
let perfilReserva: (uid: string) => { nome: string; avatarUrl?: string; avatarColor?: string } | undefined = () => undefined;
export function definirPerfilReserva(fn: typeof perfilReserva) {
  perfilReserva = fn;
}
const perfisVivos = new Map<string, { nome: string; avatarUrl?: string; avatarColor?: string }>();

async function perfil(uid: string) {
  const c = cachePerfis.get(uid);
  if (c && Date.now() - c.em < 60_000) return c;
  const d = uid === "master" ? {} : (await lerDoc<any>("usuarios", uid).catch(() => null)) || {};
  if (!d.perfil) {
    const r = perfisVivos.get(uid) || perfilReserva(uid);
    if (r) {
      const novo = { em: Date.now(), nome: String(r.nome || "Membro").slice(0, 40), avatarUrl: r.avatarUrl, avatarColor: r.avatarColor };
      cachePerfis.set(uid, novo);
      return novo;
    }
  }
  const p = d.perfil || {};
  const foto = typeof p.avatarUrl === "string" && /^https?:\/\//.test(p.avatarUrl) && p.avatarUrl.length < 2000 ? p.avatarUrl : undefined;
  const novo = {
    em: Date.now(),
    nome: String(p.name || "Membro").slice(0, 40),
    avatarUrl: foto,
    avatarColor: typeof p.avatarColor === "string" ? p.avatarColor.slice(0, 20) : undefined,
  };
  cachePerfis.set(uid, novo);
  return novo;
}

/** Perfil que a pessoa está usando agora na sala (mais novo que o salvo). */
export function atualizarPerfilAmigo(uid: string, pp: { name?: string; avatarUrl?: string; avatarColor?: string }) {
  if (!uid || !pp) return;
  const foto = typeof pp.avatarUrl === "string" && /^https?:\/\//.test(pp.avatarUrl) && pp.avatarUrl.length < 2000 ? pp.avatarUrl : undefined;
  const v = { nome: String(pp.name || "Membro").slice(0, 40), avatarUrl: foto, avatarColor: pp.avatarColor };
  perfisVivos.set(uid, v);
  cachePerfis.set(uid, { em: Date.now(), ...v });
}

const estaOnline = (uid: string) => (online.get(uid)?.size || 0) > 0;

export function marcarOnline(uid: string, sid: string) {
  if (!uid) return;
  let s = online.get(uid);
  if (!s) online.set(uid, (s = new Set()));
  s.add(sid);
}
export function marcarOffline(uid: string | undefined, sid: string) {
  if (!uid) return;
  const s = online.get(uid);
  if (!s) return;
  s.delete(sid);
  if (s.size === 0) online.delete(uid);
}

/** Resultado de "quem é essa pessoa" pra amizade */
export interface AlvoAmizade {
  /** identidade de amizade (uid da conta, ou "master") */
  id?: string;
  /** pessoa existe mas não tem conta (convidado) */
  semConta?: boolean;
  /** não achou ninguém */
  naoAchou?: boolean;
}

interface Contexto {
  /** Dono Master / Co-fundador não passam pelo anti-spam */
  isento: (socket: Socket) => boolean;
  /** Identidade de amizade de quem pede (uid da conta; o Dono Master sem conta ganha uma fixa) */
  meuId: (socket: Socket) => string | undefined;
  /** Resolve o alvo: socket id de quem está online ou "membro:<chave>" de quem está offline */
  resolverAlvo: (ref: string) => AlvoAmizade;
}

export function registrarAmigosSocket(io: SocketIOServer, socket: Socket, ctx: Contexto) {
  const meuUid = () => ctx.meuId(socket);
  const refDoAlvo = (p: any) => String(p?.alvo || p?.socketId || "").slice(0, 800);
  const avisar = (uid: string, evento: string, dados: any = {}) => {
    const s = online.get(uid);
    if (s) for (const sid of s) io.to(sid).emit(evento, dados);
  };
  const semConta = (cb: any) => typeof cb === "function" && cb({ ok: false, semConta: true, mensagem: "Entre com sua conta para adicionar amigos" });

  socket.on("amigos:estado", async (_p: any, cb: any) => {
    if (typeof cb !== "function") return;
    const eu = meuUid();
    if (!eu) return cb({ ok: true, logado: false, amigos: [], recebidos: [], enviados: [], naoLidas: {} });
    const a = await lerAmizades(eu);
    const montar = async (uid: string, em?: number) => ({ uid, ...(await perfil(uid)), em, online: estaOnline(uid) });
    const amigos = await Promise.all(a.amigos.map((u) => montar(u)));
    const recebidos = await Promise.all(a.recebidos.map((p) => montar(p.uid, p.em)));
    const enviados = await Promise.all(a.enviados.map((p) => montar(p.uid, p.em)));
    const naoLidas: Record<string, number> = {};
    await Promise.all(
      a.amigos.map(async (u) => {
        const c = await lerConversa(eu, u);
        const n = Number(c.naoLidas?.[eu]) || 0;
        if (n > 0) naoLidas[u] = n;
      })
    );
    cb({
      ok: true,
      logado: true,
      eu,
      amigos: amigos.sort((x, y) => Number(y.online) - Number(x.online) || x.nome.localeCompare(y.nome)),
      recebidos,
      enviados,
      naoLidas,
    });
  });

  // Relação com alguém da sala (pra mostrar o botão certo no perfil)
  socket.on("amigos:relacao", async (p: { socketId?: string; alvo?: string }, cb: any) => {
    if (typeof cb !== "function") return;
    try {
      const eu = meuUid();
      const r = ctx.resolverAlvo(refDoAlvo(p));
      if (r.naoAchou) return cb({ ok: false, mensagem: "Não achei essa pessoa." });
      if (!r.id) return cb({ ok: true, status: "sem-conta" });
      if (r.id === eu) return cb({ ok: true, status: "voce" });
      if (!eu) return cb({ ok: true, status: "sem-login", uid: r.id });
      const a = await lerAmizades(eu);
      const status = a.amigos.includes(r.id) ? "amigos" : a.enviados.some((x) => x.uid === r.id) ? "enviado" : a.recebidos.some((x) => x.uid === r.id) ? "recebido" : "nenhum";
      cb({ ok: true, status, uid: r.id });
    } catch {
      cb({ ok: false, mensagem: "Não deu pra ver a amizade agora." });
    }
  });

  socket.on("amigos:pedir", async (p: { socketId?: string; alvo?: string; uid?: string }, cb: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const eu = meuUid();
    if (!eu) return semConta(cb);
    let alvo = typeof p?.uid === "string" && p.uid ? p.uid.slice(0, 200) : undefined;
    if (!alvo) {
      const r = ctx.resolverAlvo(refDoAlvo(p));
      if (r.naoAchou) return responder({ ok: false, mensagem: "Não achei essa pessoa (talvez tenha saído)." });
      alvo = r.id;
    }
    if (!alvo) return responder({ ok: false, mensagem: "Essa pessoa é convidada (sem conta), então não dá pra adicionar." });
    if (alvo === eu) return responder({ ok: false, mensagem: "Você não pode adicionar você mesmo." });
    const minhas = await lerAmizades(eu);
    const dele = await lerAmizades(alvo);
    if (minhas.amigos.includes(alvo)) return responder({ ok: true, status: "amigos" });
    if (minhas.amigos.length >= MAX_AMIGOS) return responder({ ok: false, mensagem: "Você chegou no limite de amigos." });
    // Ele já tinha me pedido? Vira amizade direto
    if (minhas.recebidos.some((x) => x.uid === alvo)) {
      minhas.recebidos = minhas.recebidos.filter((x) => x.uid !== alvo);
      dele.enviados = dele.enviados.filter((x) => x.uid !== eu);
      minhas.amigos.push(alvo);
      dele.amigos.push(eu);
      salvarAmizades(eu, minhas);
      salvarAmizades(alvo, dele);
      avisar(eu, "amigos:mudou");
      avisar(alvo, "amigos:mudou");
      return responder({ ok: true, status: "amigos" });
    }
    if (!minhas.enviados.some((x) => x.uid === alvo)) {
      const em = Date.now();
      minhas.enviados.push({ uid: alvo, em });
      dele.recebidos = dele.recebidos.filter((x) => x.uid !== eu);
      dele.recebidos.push({ uid: eu, em });
      salvarAmizades(eu, minhas);
      salvarAmizades(alvo, dele);
    }
    avisar(eu, "amigos:mudou");
    avisar(alvo, "amigos:mudou", { novoPedido: (await perfil(eu)).nome });
    responder({ ok: true, status: "enviado" });
  });

  socket.on("amigos:responder", async (p: { uid: string; aceitar: boolean }, cb: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const eu = meuUid();
    if (!eu) return semConta(cb);
    const alvo = String(p?.uid || "");
    const minhas = await lerAmizades(eu);
    if (!minhas.recebidos.some((x) => x.uid === alvo)) return responder({ ok: false, mensagem: "Pedido não encontrado." });
    const dele = await lerAmizades(alvo);
    minhas.recebidos = minhas.recebidos.filter((x) => x.uid !== alvo);
    dele.enviados = dele.enviados.filter((x) => x.uid !== eu);
    if (p?.aceitar) {
      minhas.amigos.push(alvo);
      dele.amigos.push(eu);
    }
    salvarAmizades(eu, minhas);
    salvarAmizades(alvo, dele);
    avisar(eu, "amigos:mudou");
    avisar(alvo, "amigos:mudou");
    responder({ ok: true });
  });

  socket.on("amigos:cancelar", async (p: { uid: string }, cb: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const eu = meuUid();
    if (!eu) return semConta(cb);
    const alvo = String(p?.uid || "");
    const minhas = await lerAmizades(eu);
    const dele = await lerAmizades(alvo);
    minhas.enviados = minhas.enviados.filter((x) => x.uid !== alvo);
    dele.recebidos = dele.recebidos.filter((x) => x.uid !== eu);
    salvarAmizades(eu, minhas);
    salvarAmizades(alvo, dele);
    avisar(eu, "amigos:mudou");
    avisar(alvo, "amigos:mudou");
    responder({ ok: true });
  });

  socket.on("amigos:remover", async (p: { uid: string }, cb: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const eu = meuUid();
    if (!eu) return semConta(cb);
    const alvo = String(p?.uid || "");
    const minhas = await lerAmizades(eu);
    const dele = await lerAmizades(alvo);
    minhas.amigos = minhas.amigos.filter((x) => x !== alvo);
    dele.amigos = dele.amigos.filter((x) => x !== eu);
    salvarAmizades(eu, minhas);
    salvarAmizades(alvo, dele);
    avisar(eu, "amigos:mudou");
    avisar(alvo, "amigos:mudou");
    responder({ ok: true });
  });

  socket.on("dm:historico", async (p: { uid: string }, cb: any) => {
    if (typeof cb !== "function") return;
    const eu = meuUid();
    if (!eu) return semConta(cb);
    const alvo = String(p?.uid || "");
    const minhas = await lerAmizades(eu);
    if (!minhas.amigos.includes(alvo)) return cb({ ok: false, mensagem: "Vocês precisam ser amigos para conversar." });
    const conv = await lerConversa(eu, alvo);
    if (conv.naoLidas?.[eu]) {
      conv.naoLidas[eu] = 0;
      salvarConversa(conv);
    }
    cb({ ok: true, mensagens: conv.mensagens });
  });

  socket.on("dm:lido", async (p: { uid: string }) => {
    const eu = meuUid();
    if (!eu || !p?.uid) return;
    const conv = await lerConversa(eu, String(p.uid));
    if (conv.naoLidas?.[eu]) {
      conv.naoLidas[eu] = 0;
      salvarConversa(conv);
    }
  });

  socket.on("dm:enviar", async (p: { uid: string; texto: string }, cb: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const eu = meuUid();
    if (!eu) return semConta(cb);
    const alvo = String(p?.uid || "");
    const bruto = typeof p?.texto === "string" ? p.texto : "";
    const spam = checarSpam(`dm:${eu}`, bruto, ctx.isento(socket));
    if (!spam.ok) {
      if (spam.motivo === "spam") socket.emit("chat:timeout", { segundos: spam.segundos, escopo: "dm", mensagem: spam.mensagem });
      return responder({ ok: false, mensagem: spam.mensagem, segundos: spam.motivo === "spam" ? spam.segundos : undefined });
    }
    const texto = bruto.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/javascript:/gi, "blocked-script:").trim();
    if (!texto) return responder({ ok: false, mensagem: "Mensagem vazia." });
    const minhas = await lerAmizades(eu);
    if (!minhas.amigos.includes(alvo)) return responder({ ok: false, mensagem: "Vocês precisam ser amigos para conversar." });
    const conv = await lerConversa(eu, alvo);
    const msg: MensagemDM = { id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, de: eu, texto, em: Date.now() };
    conv.mensagens.push(msg);
    conv.naoLidas = { ...(conv.naoLidas || {}), [alvo]: (Number(conv.naoLidas?.[alvo]) || 0) + 1 };
    conv.atualizadoEm = msg.em;
    salvarConversa(conv);
    const quem = await perfil(eu);
    avisar(alvo, "dm:mensagem", { com: eu, nome: quem.nome, msg });
    // Outras abas/aparelhos meus também recebem
    const meus = online.get(eu);
    if (meus) for (const sid of meus) if (sid !== socket.id) io.to(sid).emit("dm:mensagem", { com: alvo, msg });
    responder({ ok: true, msg });
  });
}

/** Avisa os amigos online que alguém entrou/saiu (pra bolinha verde atualizar). */
export async function avisarPresenca(io: SocketIOServer, uid: string | undefined) {
  if (!uid) return;
  try {
    const a = await lerAmizades(uid);
    for (const amigo of a.amigos) {
      const s = online.get(amigo);
      if (s) for (const sid of s) io.to(sid).emit("amigos:mudou", { presenca: true });
    }
  } catch {
    // ignore
  }
}
