/**
 * contasStore — login salvo (Google ou e-mail) usando Firebase Auth + Firestore.
 * Guarda por conta: perfil, "membro desde", moedas, itens da loja e "Minhas salas".
 * Assim você e seus amigos entram de qualquer aparelho e já está tudo lá.
 */
import type { Socket } from "socket.io";
import { temFirebase, verificarToken, lerDoc, salvarDoc, lerColecao, configWebFirebase } from "./dbStore";
import { manterDataUrl } from "./blobCache";

const PERKS_VALIDOS = ["gif_avatar", "custom_banner", "custom_title", "vip_role", "ring_nebulosa", "ring_aurora", "banner_nebulosa", "aura_card"];

function limparDados(d: any, atual: any) {
  const out: Record<string, any> = {};
  if (!d || typeof d !== "object") return out;

  if (d.perfil && typeof d.perfil === "object") {
    const p = d.perfil;
    const txt = (v: any, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
    out.perfil = {
      name: txt(p.name, 40),
      avatarColor: txt(p.avatarColor, 20),
      avatarUrl: txt(p.avatarUrl, 2000),
      bannerColor: txt(p.bannerColor, 20),
      bannerUrl: txt(p.bannerUrl, 2000),
      customStatus: txt(p.customStatus, 120),
      bio: txt(p.bio, 300),
      tag: txt(p.tag, 6),
    };
  }

  const desde = Number(d.memberSince);
  if (Number.isFinite(desde) && desde > 1600000000000 && desde <= Date.now() + 60000) {
    out.memberSince = atual?.memberSince ? Math.min(atual.memberSince, desde) : desde;
  }

  const moedas = Number(d.moedas);
  if (Number.isFinite(moedas) && moedas >= 0 && moedas < 999999) {
    out.moedas = Math.floor(moedas);
    // Marco de início da semana/mês, pra calcular quanto cada um ganhou no período
    const anterior = Number.isFinite(Number(atual?.moedas)) ? Number(atual.moedas) : out.moedas;
    const sem = chaveSemana();
    const mes = chaveMes();
    out.rankBase = {
      semana: atual?.rankBase?.semana === sem ? atual.rankBase.semana : sem,
      baseSemana: atual?.rankBase?.semana === sem ? Number(atual.rankBase.baseSemana) || 0 : anterior,
      mes: atual?.rankBase?.mes === mes ? atual.rankBase.mes : mes,
      baseMes: atual?.rankBase?.mes === mes ? Number(atual.rankBase.baseMes) || 0 : anterior,
    };
  }

  if (d.perks && typeof d.perks === "object") {
    const limite = Date.now() + 366 * 24 * 3600 * 1000;
    const perks: Record<string, number> = {};
    for (const id of PERKS_VALIDOS) {
      const ate = Number(d.perks[id]);
      if (Number.isFinite(ate) && ate > Date.now()) perks[id] = Math.min(ate, limite);
    }
    out.perks = perks;
  }

  if (Array.isArray(d.salas)) {
    out.salas = d.salas
      .filter((s: any) => s && typeof s.roomId === "string")
      .slice(0, 100)
      .map((s: any) => ({
        roomId: s.roomId.slice(0, 60),
        nome: String(s.nome || s.roomId).slice(0, 80),
        ultimaVez: Number(s.ultimaVez) || Date.now(),
        hostToken: typeof s.hostToken === "string" ? s.hostToken.slice(0, 120) : undefined,
        emoji: typeof s.emoji === "string" ? s.emoji.slice(0, 8) : undefined,
      }));
  }

  if (d.missoes && typeof d.missoes === "object") {
    const txt = JSON.stringify(d.missoes);
    if (txt.length < 4000) out.missoes = JSON.parse(txt);
  }
  return out;
}

function chaveSemana(t = Date.now()) {
  // Semana começa segunda 00:00 no horário de Brasília (UTC-3)
  const d = new Date(t - 3 * 3600 * 1000);
  const dia = (d.getUTCDay() + 6) % 7;
  const seg = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia);
  return new Date(seg).toISOString().slice(0, 10);
}
function chaveMes(t = Date.now()) {
  return new Date(t - 3 * 3600 * 1000).toISOString().slice(0, 7);
}

// Quem não entra no Rank (Dono Master e Co-fundadores têm moedas infinitas). Definido pelo server.ts.
let foraDoRank: (uid: string) => boolean = () => false;
export function definirForaDoRank(fn: (uid: string) => boolean) {
  foraDoRank = fn;
  cacheRank = null;
}
// Checagem de banimento ao entrar na conta (definida pelo server.ts)
let checarBanConta: ((socket: Socket, uid: string) => { mensagem: string; dados: any } | null) | null = null;
export function definirChecagemBanConta(fn: (socket: Socket, uid: string) => { mensagem: string; dados: any } | null) {
  checarBanConta = fn;
}

type LinhaRank = { uid: string; nome: string; avatarUrl?: string; avatarColor?: string; moedas: number; semana: number; mes: number };
let cacheRank: { em: number; linhas: LinhaRank[] } | null = null;

async function montarRank(): Promise<LinhaRank[]> {
  if (cacheRank && Date.now() - cacheRank.em < 60_000) return cacheRank.linhas;
  const docs = await lerColecao<any>("usuarios", 2000);
  const sem = chaveSemana();
  const mes = chaveMes();
  const linhas: LinhaRank[] = [];
  for (const { id, dados } of docs) {
    if (foraDoRank(id) || dados?.ehDono || dados?.ehCofundador) continue;
    const moedas = Number(dados?.moedas);
    if (!Number.isFinite(moedas) || moedas <= 0) continue;
    const rb = dados.rankBase || {};
    const nome = String(dados?.perfil?.name || "").trim();
    if (!nome) continue;
    linhas.push({
      uid: id,
      nome: nome.slice(0, 40),
      avatarUrl: typeof dados.perfil?.avatarUrl === "string" && !dados.perfil.avatarUrl.startsWith("data:") ? dados.perfil.avatarUrl : undefined,
      avatarColor: dados.perfil?.avatarColor,
      moedas,
      semana: rb.semana === sem ? Math.max(0, moedas - (Number(rb.baseSemana) || 0)) : 0,
      mes: rb.mes === mes ? Math.max(0, moedas - (Number(rb.baseMes) || 0)) : 0,
    });
  }
  cacheRank = { em: Date.now(), linhas };
  return linhas;
}

export function registrarContas(app: any) {
  app.get("/api/firebase-config", (_req: any, res: any) => {
    const config = configWebFirebase();
    res.json({ ativo: Boolean(config && temFirebase()), config: config || null });
  });
}

export function registrarContasSocket(socket: Socket) {
  socket.on("conta:entrar", async (p: { idToken?: string }, cb: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    if (!temFirebase()) return responder({ ok: false, mensagem: "Login ainda não configurado no servidor." });
    const conta = await verificarToken(p?.idToken);
    if (!conta) return responder({ ok: false, mensagem: "Login inválido ou expirado. Entre de novo." });
    // Banido/suspenso não entra
    const ban = checarBanConta ? checarBanConta(socket, conta.uid) : null;
    if (ban) {
      // Guarda a conta pra continuar barrando mesmo se ele tentar entrar como convidado
      (socket.data as any).uidBloqueado = conta.uid;
      socket.emit("ban:bloqueado", ban.dados);
      return responder({ ok: false, banido: true, mensagem: ban.mensagem });
    }
    (socket.data as any).uid = conta.uid;
    for (const fn of ((socket.data as any).aoEntrar || []) as Array<(uid: string) => void>) {
      try { fn(conta.uid); } catch {}
    }
    const dados = (await lerDoc("usuarios", conta.uid)) || null;
    if (!dados) {
      await salvarDoc("usuarios", conta.uid, { email: conta.email || "", criadoEm: Date.now() });
    }
    // dados da própria conta: o cliente salva no aparelho, então vão com os data: originais (sem link /api/m)
    responder(manterDataUrl({ ok: true, conta, dados, novo: !dados }));
  });

  socket.on("conta:salvar", async (p: { dados?: any }, cb: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const uid = (socket.data as any).uid;
    if (!uid) return responder({ ok: false });
    const atual = await lerDoc("usuarios", uid);
    const limpos = limparDados(p?.dados, atual);
    if (Object.keys(limpos).length) {
      await salvarDoc("usuarios", uid, JSON.parse(JSON.stringify({ ...limpos, atualizadoEm: Date.now() })), true);
      cacheRank = null;
    }
    responder({ ok: true });
  });

  // Rank de Coins: aba "geral" (saldo), "semana" ou "mes" (quanto ganhou no período)
  socket.on("rank:coins", async (p: { aba?: string }, cb: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    if (!temFirebase()) return responder({ ok: false, mensagem: "Rank indisponível no momento." });
    const aba = p?.aba === "semana" || p?.aba === "mes" ? p.aba : "geral";
    const campo = aba === "geral" ? "moedas" : aba;
    const todas = (await montarRank()).filter((l) => !foraDoRank(l.uid)).sort((a, b) => (b as any)[campo] - (a as any)[campo] || b.moedas - a.moedas);
    const uid = (socket.data as any).uid;
    const idx = uid ? todas.findIndex((l) => l.uid === uid) : -1;
    const limpar = (l: LinhaRank, i: number) => ({ pos: i + 1, nome: l.nome, avatarUrl: l.avatarUrl, avatarColor: l.avatarColor, moedas: l.moedas, semana: l.semana, mes: l.mes, eu: l.uid === uid });
    responder({
      ok: true,
      aba,
      lista: todas.slice(0, 50).map(limpar),
      voce: idx >= 0 ? limpar(todas[idx], idx) : null,
      total: todas.length,
    });
  });

  socket.on("conta:sair", () => {
    const uid = (socket.data as any).uid;
    (socket.data as any).uid = undefined;
    for (const fn of ((socket.data as any).aoSair || []) as Array<(uid: string) => void>) {
      try { fn(uid); } catch {}
    }
  });
}

/** Avisa o server.ts quando a pessoa entra na conta (pra prender insígnias/VIP na conta). */
export function aoEntrarNaConta(socket: Socket, fn: (uid: string) => void) {
  const d = socket.data as any;
  d.aoEntrar = [...(d.aoEntrar || []), fn];
}

/** Avisa quando a pessoa sai da conta (sem desconectar). */
export function aoSairDaConta(socket: Socket, fn: (uid: string) => void) {
  const d = socket.data as any;
  d.aoSair = [...(d.aoSair || []), fn];
}
