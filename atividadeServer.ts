/**
 * atividadeServer — "Jogando agora", Convite pra jogar e estatísticas da aba Jogos.
 *
 * - atividade:definir  { jogo, modo? } | { jogo: null }   → grava p.atividade e avisa a sala
 * - jogos:stats        { alvoId }                          → horas da semana, favoritos, sequência
 * - convite:enviar     { alvoId, jogo, modo?, vagas? }     → popup no alvo (1 por alvo a cada 30 s)
 * - convite:responder  { conviteId, aceitar }              → atualiza as vagas pra todo mundo do convite
 *
 * Tempo de jogo: creditado de minuto em minuto por conta (uid: ou nome#tag), dividido por dia
 * no horário de Brasília. Salvo em data/jogos-stats.json e, com Firebase, na coleção jogosStats.
 */
import type { Server, Socket } from "socket.io";
import fs from "fs";
import path from "path";
import { lerDoc, salvarDoc, temFirebase } from "./dbStore";

interface Ctx {
  rooms: Map<string, any>;
  salaAtual: () => string | null;
  chave: (p: any) => string;
}

type Stats = { dias: Record<string, Record<string, number>>; total: Record<string, number> };

const DATA_DIR = process.env.ECO_DATA_DIR || path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "jogos-stats.json");
const stats = new Map<string, Stats>();
const sujos = new Set<string>();
const carregadosFirebase = new Set<string>();

try {
  const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
  Object.entries(raw || {}).forEach(([k, v]) => stats.set(k, v as Stats));
} catch {
  /* primeiro uso */
}

const idDoc = (chave: string) => encodeURIComponent(chave).replace(/\./g, "%2E").slice(0, 400);
const diaBR = (t = Date.now()) => new Date(t - 3 * 3600_000).toISOString().slice(0, 10);

async function obter(chave: string): Promise<Stats> {
  let s = stats.get(chave);
  if (!carregadosFirebase.has(chave) && temFirebase()) {
    carregadosFirebase.add(chave);
    const doc = await lerDoc<Stats>("jogosStats", idDoc(chave));
    if (doc && doc.total) {
      // junta o que estava na nuvem com o que já contou nesta execução
      const base: Stats = { dias: { ...(doc.dias || {}) }, total: { ...(doc.total || {}) } };
      if (s) {
        Object.entries(s.total).forEach(([j, m]) => (base.total[j] = Math.max(base.total[j] || 0, m)));
        Object.entries(s.dias).forEach(([d, porJogo]) => {
          base.dias[d] = base.dias[d] || {};
          Object.entries(porJogo).forEach(([j, m]) => (base.dias[d][j] = Math.max(base.dias[d][j] || 0, m)));
        });
      }
      s = base;
      stats.set(chave, s);
    }
  }
  if (!s) {
    s = { dias: {}, total: {} };
    stats.set(chave, s);
  }
  return s;
}

function creditar(chave: string, jogo: string, minutos: number) {
  const s = stats.get(chave) || { dias: {}, total: {} };
  const d = diaBR();
  s.dias[d] = s.dias[d] || {};
  s.dias[d][jogo] = (s.dias[d][jogo] || 0) + minutos;
  s.total[jogo] = (s.total[jogo] || 0) + minutos;
  // guarda só os últimos 60 dias
  const corte = diaBR(Date.now() - 60 * 86400_000);
  Object.keys(s.dias).forEach((k) => k < corte && delete s.dias[k]);
  stats.set(chave, s);
  sujos.add(chave);
}

let salvando = false;
function salvarTudo() {
  if (salvando || sujos.size === 0) return;
  salvando = true;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(stats)));
  } catch {
    /* disco cheio/somente leitura: segue só em memória */
  }
  const lote = Array.from(sujos);
  sujos.clear();
  Promise.all(lote.map((k) => salvarDoc("jogosStats", idDoc(k), stats.get(k) as any, false))).finally(() => (salvando = false));
}

function resumo(s: Stats) {
  const hoje = Date.now();
  const semana: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = diaBR(hoje - i * 86400_000);
    Object.entries(s.dias[d] || {}).forEach(([j, m]) => (semana[j] = (semana[j] || 0) + m));
  }
  const maisJogados = Object.entries(semana)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([jogo, minutos]) => ({ jogo, minutos }));
  const favoritos = Object.entries(s.total)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([jogo, minutos]) => ({ jogo, minutos }));
  const totalSemana = Object.values(semana).reduce((a, b) => a + b, 0);
  // sequência: dias seguidos com jogo, contando de hoje (ou de ontem, se hoje ainda não jogou)
  let seq = 0;
  let i = Object.keys(s.dias[diaBR(hoje)] || {}).length ? 0 : 1;
  for (; i < 60; i++) {
    const d = s.dias[diaBR(hoje - i * 86400_000)];
    if (d && Object.values(d).some((m) => m > 0)) seq++;
    else break;
  }
  const top = maisJogados[0];
  const viciado = top && top.minutos >= 600 ? top.jogo : null;
  return { maisJogados, favoritos, totalSemana, sequencia: seq, viciado };
}

// ---------- sessões e convites ----------
const sessoes = new Map<string, { chave: string; jogo: string; desde: number; ultimo: number }>();
interface Convite {
  id: string;
  deId: string;
  deNome: string;
  sala: string;
  canal: string;
  jogo: string;
  modo?: string;
  vagas: number;
  aceitos: Array<{ id: string; nome: string; avatarUrl?: string; avatarColor?: string; avatarEmoji?: string }>;
  convidados: Set<string>;
  expira: number;
}
const convites = new Map<string, Convite>();
const ultimoConvite = new Map<string, number>(); // `${de}>${alvo}` → quando

let tickIniciado = false;
function iniciarTick() {
  if (tickIniciado) return;
  tickIniciado = true;
  setInterval(() => {
    const agora = Date.now();
    sessoes.forEach((s) => {
      const min = Math.floor((agora - s.ultimo) / 60_000);
      if (min >= 1) {
        creditar(s.chave, s.jogo, min);
        s.ultimo += min * 60_000;
      }
    });
    convites.forEach((c, id) => agora > c.expira + 60_000 && convites.delete(id));
    ultimoConvite.forEach((t, k) => agora - t > 60_000 && ultimoConvite.delete(k));
  }, 60_000).unref?.();
  setInterval(salvarTudo, 5 * 60_000).unref?.();
}

const limpar = (v: any, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function registrarAtividade(io: Server, socket: Socket, ctx: Ctx) {
  iniciarTick();
  const eu = () => {
    const sala = ctx.salaAtual();
    return sala ? ctx.rooms.get(sala)?.participants?.get(socket.id) : null;
  };

  const encerrarSessao = () => {
    const s = sessoes.get(socket.id);
    if (!s) return;
    const min = Math.floor((Date.now() - s.ultimo) / 60_000);
    if (min >= 1) creditar(s.chave, s.jogo, min);
    sessoes.delete(socket.id);
  };

  socket.on("atividade:definir", (data: { jogo?: string | null; modo?: string; origem?: string }, cb?: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const p = eu();
    const sala = ctx.salaAtual();
    if (!p || !sala) return responder({ ok: false });
    const jogo = limpar(data?.jogo, 40);
    const atual = p.atividade?.jogo;
    if (!jogo) {
      if (!p.atividade) return responder({ ok: true });
      encerrarSessao();
      p.atividade = null;
    } else {
      if (atual === jogo) return responder({ ok: true }); // nada mudou (o app manda de 15 em 15 s)
      encerrarSessao();
      const agora = Date.now();
      p.atividade = { jogo, modo: limpar(data?.modo, 30) || undefined, desde: agora, auto: data?.origem === "desktop" };
      sessoes.set(socket.id, { chave: ctx.chave(p), jogo, desde: agora, ultimo: agora });
    }
    io.to(sala).emit("room:user-updated", p);
    responder({ ok: true });
  });

  // Modo Desempenho: quem está jogando pede uma tela compartilhada mais leve (15 fps, ~540p)
  socket.on("desempenho:leve", (data: { ativo?: boolean }) => {
    const p = eu();
    const sala = ctx.salaAtual();
    if (!p || !sala) return;
    const ativo = Boolean(data?.ativo);
    if (Boolean(p.modoLeve) === ativo) return;
    p.modoLeve = ativo;
    io.to(sala).emit("room:user-updated", p);
  });

  socket.on("jogos:stats", async (data: { alvoId?: string }, cb?: any) => {
    if (typeof cb !== "function") return;
    const sala = ctx.salaAtual();
    const alvo = sala ? ctx.rooms.get(sala)?.participants?.get(String(data?.alvoId || socket.id)) : null;
    if (!alvo) return cb({ ok: false });
    const chave = ctx.chave(alvo);
    // credita o que está rolando agora antes de responder
    sessoes.forEach((s) => {
      if (s.chave !== chave) return;
      const min = Math.floor((Date.now() - s.ultimo) / 60_000);
      if (min >= 1) {
        creditar(s.chave, s.jogo, min);
        s.ultimo += min * 60_000;
      }
    });
    cb({ ok: true, ...resumo(await obter(chave)) });
  });

  const publicoConvite = (c: Convite) => ({
    id: c.id,
    deId: c.deId,
    deNome: c.deNome,
    jogo: c.jogo,
    modo: c.modo,
    vagas: c.vagas,
    aceitos: c.aceitos,
    expira: c.expira,
  });

  socket.on("convite:enviar", (data: { alvoId?: string; jogo?: string; modo?: string; vagas?: number }, cb?: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const p = eu();
    const sala = ctx.salaAtual();
    if (!p || !sala) return responder({ ok: false, mensagem: "Entre numa sala primeiro." });
    const alvoId = String(data?.alvoId || "");
    const alvo = ctx.rooms.get(sala)?.participants?.get(alvoId);
    if (!alvo || alvoId === socket.id) return responder({ ok: false, mensagem: "Essa pessoa não está na sala." });
    const k = `${socket.id}>${alvoId}`;
    if (Date.now() - (ultimoConvite.get(k) || 0) < 30_000) return responder({ ok: false, mensagem: "Espere um pouco pra chamar de novo." });
    ultimoConvite.set(k, Date.now());
    const jogo = limpar(data?.jogo || p.atividade?.jogo, 40);
    if (!jogo) return responder({ ok: false, mensagem: "Escolha o jogo." });
    // reaproveita o convite aberto do mesmo jogo (assim as vagas somam)
    let c = Array.from(convites.values()).find((x) => x.deId === socket.id && x.jogo === jogo && x.expira > Date.now());
    if (!c) {
      c = {
        id: `cv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        deId: socket.id,
        deNome: limpar(p.name, 40) || "Alguém",
        sala,
        canal: p.voiceChannelId || "voice-geral",
        jogo,
        modo: limpar(data?.modo || p.atividade?.modo, 30) || undefined,
        vagas: Math.max(2, Math.min(10, Number(data?.vagas) || 5)),
        aceitos: [{ id: socket.id, nome: limpar(p.name, 40), avatarUrl: p.avatarUrl, avatarColor: p.avatarColor, avatarEmoji: p.avatarEmoji }],
        convidados: new Set(),
        expira: Date.now() + 45_000,
      };
      convites.set(c.id, c);
    } else {
      c.expira = Date.now() + 45_000;
    }
    if (c.aceitos.length >= c.vagas) return responder({ ok: false, mensagem: "O time já está completo." });
    c.convidados.add(alvoId);
    io.to(alvoId).emit("convite:recebido", { ...publicoConvite(c), deAvatarUrl: p.avatarUrl, deAvatarColor: p.avatarColor, deAvatarEmoji: p.avatarEmoji });
    responder({ ok: true, convite: publicoConvite(c) });
  });

  socket.on("convite:responder", (data: { conviteId?: string; aceitar?: boolean }, cb?: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const c = convites.get(String(data?.conviteId || ""));
    const p = eu();
    if (!c || !p || !c.convidados.has(socket.id)) return responder({ ok: false, mensagem: "Convite expirou." });
    c.convidados.delete(socket.id);
    if (!data?.aceitar) {
      io.to(c.deId).emit("convite:recusado", { conviteId: c.id, nome: limpar(p.name, 40) });
      return responder({ ok: true });
    }
    if (Date.now() > c.expira + 2000) return responder({ ok: false, mensagem: "Convite expirou." });
    if (c.aceitos.length >= c.vagas) return responder({ ok: false, mensagem: "O time já está completo." });
    if (!c.aceitos.some((a) => a.id === socket.id)) c.aceitos.push({ id: socket.id, nome: limpar(p.name, 40), avatarUrl: p.avatarUrl, avatarColor: p.avatarColor, avatarEmoji: p.avatarEmoji });
    const dono = ctx.rooms.get(c.sala)?.participants?.get(c.deId);
    const canal = dono?.voiceChannelId || c.canal;
    const avisar = new Set<string>([c.deId, ...c.aceitos.map((a) => a.id), ...c.convidados]);
    avisar.forEach((id) => io.to(id).emit("convite:atualizado", publicoConvite(c!)));
    responder({ ok: true, canal: c.sala === ctx.salaAtual() ? canal : null });
  });

  socket.on("disconnect", () => {
    encerrarSessao();
  });
}
