/**
 * extrasServer — Raio-X ao vivo, Anúncio global, Chuva de moedas e Roleta (servidor).
 */
import type { Server, Socket } from "socket.io";
import { getAjustesLoja } from "./lojaStore";
import { registrarJogos } from "./jogosServer";

interface Ctx {
  rooms: Map<string, any>;
  salaAtual: () => string | null;
  ehMaster: (token?: string) => boolean;
}

// ---------- Raio-X ----------
const compras: Array<{ nome: string; item: string; quando: number }> = [];
const historicoOnline: Array<{ t: number; online: number }> = [];
let amostragemIniciada = false;

const NOMES_ITENS: Record<string, string> = {
  gif_avatar: "Avatar GIF",
  custom_banner: "Banner animado",
  custom_title: "Título personalizado",
  vip_role: "VIP",
  ring_nebulosa: "Anel Nebulosa",
  ring_aurora: "Anel Aurora",
  banner_nebulosa: "Banner Nebulosa",
  aura_card: "Aura do card",
};

export function registrarCompra(nome: string, itemId: string) {
  compras.unshift({ nome: String(nome || "Alguém").slice(0, 40), item: NOMES_ITENS[itemId] || itemId, quando: Date.now() });
  if (compras.length > 200) compras.length = 200;
}

function contarOnline(rooms: Map<string, any>) {
  let n = 0;
  rooms.forEach((r) => (n += r.participants?.size || 0));
  return n;
}

export function iniciarAmostragem(rooms: Map<string, any>) {
  if (amostragemIniciada) return;
  amostragemIniciada = true;
  const amostrar = () => {
    historicoOnline.push({ t: Date.now(), online: contarOnline(rooms) });
    while (historicoOnline.length > 144) historicoOnline.shift(); // 24h de 10 em 10 min
  };
  amostrar();
  setInterval(amostrar, 10 * 60 * 1000).unref?.();
}

// ---------- Anúncio ----------
interface Anuncio {
  id: string;
  texto: string;
  ate: number;
  autor: string;
}
const anuncios = new Map<string, Anuncio>(); // "*" = todas as salas, ou roomId

function anuncioAtivo(roomId: string | null): Anuncio | null {
  const agora = Date.now();
  const sala = roomId ? anuncios.get(roomId) : undefined;
  const geral = anuncios.get("*");
  const validos = [sala, geral].filter((a): a is Anuncio => Boolean(a && a.ate > agora));
  validos.sort((a, b) => b.ate - a.ate);
  return validos[0] || null;
}

// ---------- Chuva ----------
interface Chuva {
  id: string;
  roomId: string;
  valor: number;
  ate: number;
  moedas: Map<string, boolean>; // id -> já pegaram?
  placar: Map<string, { nome: string; total: number }>;
}
const chuvas = new Map<string, Chuva>(); // roomId -> chuva ativa
const ultimoClique = new Map<string, number>();

// ---------- Roleta ----------
const roletaUltimos = new Map<string, Array<{ nome: string; premio: string; quando: number }>>();
const PREMIOS_ROLETA = ["+50 Eco Coins", "+100 Eco Coins", "+500 Eco Coins", "Anel Aurora 24h", "VIP 24h", "Tente de novo"];

// ---------- Temas da Sala e Mini-jogos ----------
export const TEMAS = ["padrao", "buraco_negro", "aurora", "chuva", "cerejeira"] as const;
const PRECO_TEMA_PADRAO: Record<string, number> = { padrao: 0, buraco_negro: 200, aurora: 150, chuva: 100, cerejeira: 150 };
const PREMIO_PADRAO: Record<string, number> = { jogo_velha: 20, jogo_damas: 30, jogo_uno: 40 };
/** Valor editável pelo Dono Master na aba Jogos (fica salvo junto com os preços da loja) */
function valorConfig(chave: string, padrao: number): number {
  const v = getAjustesLoja()[chave]?.price;
  return typeof v === "number" && Number.isFinite(v) ? v : padrao;
}
export const precoTema = (t: string) => valorConfig(`tema_${t}`, PRECO_TEMA_PADRAO[t] ?? 0);
export const premioJogo = (j: string) => valorConfig(j, PREMIO_PADRAO[j] ?? 0);

const temaDaSala = new Map<string, string>();
interface Velha { id: string; x: { id: string; nome: string }; o: { id: string; nome: string }; casas: string[]; vez: "X" | "O"; vencedor: string | null; aceito: boolean; premio: number }
const velhas = new Map<string, Velha>(); // por sala (um jogo por vez)
const LINHAS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function registrarExtras(io: Server, socket: Socket, ctx: Ctx) {
  const resp = (cb: any, v: any) => typeof cb === "function" && cb(v);
  const eu = () => {
    const rid = ctx.salaAtual();
    const room = rid ? ctx.rooms.get(rid) : null;
    const p = room?.participants?.get(socket.id);
    return { rid, room, p };
  };

  // Raio-X (só Dono Master)
  socket.on("master:raiox", (d: { masterToken?: string }, cb: any) => {
    if (!ctx.ehMaster(d?.masterToken)) return resp(cb, { ok: false, mensagem: "Só o Dono Master." });
    const salas: any[] = [];
    let moedas = 0;
    ctx.rooms.forEach((r: any) => {
      const pessoas = Array.from(r.participants?.values?.() || []) as any[];
      pessoas.forEach((p) => {
        const c = Number(p.kokiCoins) || 0;
        if (!p.isMaster && c < 999999) moedas += c;
      });
      salas.push({
        roomId: r.roomId,
        nome: r.roomName,
        pessoas: pessoas.length,
        nomes: pessoas.slice(0, 8).map((p) => p.name),
        criadaEm: r.createdAt,
      });
    });
    salas.sort((a, b) => b.pessoas - a.pessoas);
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    resp(cb, {
      ok: true,
      salas,
      online: contarOnline(ctx.rooms),
      moedasCirculando: moedas,
      comprasHoje: compras.filter((c) => c.quando >= inicioDia.getTime()).length,
      ultimasCompras: compras.slice(0, 12),
      historico: historicoOnline.slice(-144),
    });
  });

  // Anúncio global
  socket.on("anuncio:atual", (_d: any, cb: any) => resp(cb, { anuncio: anuncioAtivo(ctx.salaAtual()) }));

  socket.on("anuncio:publicar", (d: { masterToken?: string; texto?: string; todasSalas?: boolean; minutos?: number }, cb: any) => {
    if (!ctx.ehMaster(d?.masterToken)) return resp(cb, { ok: false, mensagem: "Só o Dono Master." });
    const texto = String(d?.texto || "").trim().slice(0, 200);
    if (!texto) return resp(cb, { ok: false, mensagem: "Escreva o aviso." });
    const minutos = Math.max(1, Math.min(24 * 60, Math.floor(Number(d?.minutos) || 10)));
    const { rid } = eu();
    const chave = d?.todasSalas || !rid ? "*" : rid;
    const a: Anuncio = { id: `an-${Date.now()}`, texto, ate: Date.now() + minutos * 60000, autor: "Dono Master" };
    anuncios.set(chave, a);
    if (chave === "*") io.emit("anuncio:novo", a);
    else io.to(chave).emit("anuncio:novo", a);
    resp(cb, { ok: true });
  });

  socket.on("anuncio:remover", (d: { masterToken?: string }, cb: any) => {
    if (!ctx.ehMaster(d?.masterToken)) return resp(cb, { ok: false });
    anuncios.clear();
    io.emit("anuncio:removido", {});
    resp(cb, { ok: true });
  });

  // Chuva de moedas (Dono Master solta na sala em que está)
  socket.on("chuva:iniciar", (d: { masterToken?: string; quantidade?: number; valor?: number; segundos?: number }, cb: any) => {
    if (!ctx.ehMaster(d?.masterToken)) return resp(cb, { ok: false, mensagem: "Só o Dono Master." });
    const { rid } = eu();
    if (!rid) return resp(cb, { ok: false, mensagem: "Entre numa sala primeiro." });
    if (chuvas.get(rid) && chuvas.get(rid)!.ate > Date.now()) return resp(cb, { ok: false, mensagem: "Já tem uma chuva rolando." });

    const quantidade = Math.max(5, Math.min(80, Math.floor(Number(d?.quantidade) || 30)));
    const valor = Math.max(1, Math.min(1000, Math.floor(Number(d?.valor) || 25)));
    const segundos = Math.max(5, Math.min(60, Math.floor(Number(d?.segundos) || 15)));
    const id = `chuva-${Date.now()}`;
    const chuva: Chuva = { id, roomId: rid, valor, ate: Date.now() + segundos * 1000 + 1500, moedas: new Map(), placar: new Map() };
    const lista = Array.from({ length: quantidade }, (_, i) => {
      const mid = `m${i}`;
      chuva.moedas.set(mid, false);
      return {
        id: mid,
        x: Math.round(4 + Math.random() * 90),
        atraso: Math.round(Math.random() * Math.max(0, segundos * 1000 - 3500)),
        duracao: Math.round(2800 + Math.random() * 2200),
      };
    });
    chuvas.set(rid, chuva);
    io.to(rid).emit("chuva:inicio", { id, valor, segundos, moedas: lista });
    resp(cb, { ok: true });

    setTimeout(() => {
      if (chuvas.get(rid)?.id !== id) return;
      const ranking = Array.from(chuva.placar.values()).sort((a, b) => b.total - a.total).slice(0, 5);
      io.to(rid).emit("chuva:fim", { id, ranking });
      chuvas.delete(rid);
    }, segundos * 1000 + 2000);
  });

  socket.on("chuva:pegar", (d: { chuvaId?: string; moedaId?: string }, cb: any) => {
    const { rid, room, p } = eu();
    if (!rid || !room || !p) return resp(cb, { ok: false });
    const chuva = chuvas.get(rid);
    if (!chuva || chuva.id !== d?.chuvaId || chuva.ate < Date.now()) return resp(cb, { ok: false });
    const agora = Date.now();
    if (agora - (ultimoClique.get(socket.id) || 0) < 120) return resp(cb, { ok: false });
    ultimoClique.set(socket.id, agora);
    const mid = String(d?.moedaId || "");
    if (!chuva.moedas.has(mid) || chuva.moedas.get(mid)) return resp(cb, { ok: false, pega: true });
    chuva.moedas.set(mid, true);

    const placar = chuva.placar.get(socket.id) || { nome: p.name, total: 0 };
    placar.total += chuva.valor;
    chuva.placar.set(socket.id, placar);

    if (!p.isMaster) p.kokiCoins = (Number(p.kokiCoins) || 0) + chuva.valor;
    socket.emit("coins:updated", { participantId: socket.id, kokiCoins: p.kokiCoins, newBalance: p.kokiCoins, amount: p.isMaster ? 0 : chuva.valor });
    io.to(rid).emit("chuva:pegou", { chuvaId: chuva.id, moedaId: mid, quem: p.name, quemId: socket.id });
    resp(cb, { ok: true, valor: chuva.valor });
  });

  // Roleta da sorte: o giro acontece no aparelho; aqui só espalha o prêmio pra sala ver
  socket.on("roleta:ultimos", (_d: any, cb: any) => resp(cb, { lista: roletaUltimos.get(ctx.salaAtual() || "") || [] }));

  socket.on("roleta:premio", (d: { premio?: string }) => {
    const { rid, p } = eu();
    if (!rid || !p) return;
    const premio = String(d?.premio || "");
    if (!PREMIOS_ROLETA.includes(premio)) return;
    const lista = roletaUltimos.get(rid) || [];
    const item = { nome: p.name, premio, quando: Date.now() };
    lista.unshift(item);
    if (lista.length > 10) lista.length = 10;
    roletaUltimos.set(rid, lista);
    io.to(rid).emit("roleta:novo-premio", item);
  });

  registrarJogos(io, socket, eu, premioJogo);

  // ----- Temas da Sala -----
  socket.on("tema:atual", (_d: any, cb: any) => {
    const rid = ctx.salaAtual();
    resp(cb, { tema: (rid && temaDaSala.get(rid)) || "padrao", precos: Object.fromEntries(TEMAS.map((t) => [t, precoTema(t)])) });
  });
  socket.on("tema:definir", (d: { tema?: string; masterToken?: string }, cb: any) => {
    const { rid, p } = eu();
    if (!rid || !p) return resp(cb, { ok: false, mensagem: "Entre numa sala primeiro." });
    const master = ctx.ehMaster(d?.masterToken) || p.isMaster;
    if (!master && !p.isHost) return resp(cb, { ok: false, mensagem: "Só o dono da sala escolhe o tema." });
    const tema = String(d?.tema || "");
    if (!(TEMAS as readonly string[]).includes(tema)) return resp(cb, { ok: false, mensagem: "Tema inválido." });
    const preco = master ? 0 : precoTema(tema);
    if (preco > 0) {
      if ((Number(p.kokiCoins) || 0) < preco) return resp(cb, { ok: false, mensagem: `Precisa de ${preco} Eco Coins.` });
      p.kokiCoins = (Number(p.kokiCoins) || 0) - preco;
      socket.emit("coins:updated", { participantId: socket.id, kokiCoins: p.kokiCoins, newBalance: p.kokiCoins, amount: -preco });
    }
    temaDaSala.set(rid, tema);
    io.to(rid).emit("tema:mudou", { tema, por: p.name });
    resp(cb, { ok: true });
  });

  // ----- Mini-jogo: Jogo da Velha (um por sala, todo mundo assiste) -----
  const enviarVelha = (rid: string) => io.to(rid).emit("velha:estado", velhas.get(rid) || null);
  socket.on("velha:atual", (_d: any, cb: any) => { const rid = ctx.salaAtual(); resp(cb, { jogo: (rid && velhas.get(rid)) || null, premio: premioJogo("jogo_velha") }); });
  socket.on("velha:desafiar", (d: { alvoId?: string }, cb: any) => {
    const { rid, room, p } = eu();
    if (!rid || !room || !p) return resp(cb, { ok: false });
    const atual = velhas.get(rid);
    if (atual && !atual.vencedor) return resp(cb, { ok: false, mensagem: "Já tem uma partida rolando." });
    const alvo = room.participants.get(String(d?.alvoId || ""));
    if (!alvo || alvo.id === socket.id) return resp(cb, { ok: false, mensagem: "Escolha alguém da call." });
    const jogo: Velha = { id: `v${Date.now()}`, x: { id: socket.id, nome: p.name }, o: { id: alvo.id, nome: alvo.name }, casas: Array(9).fill(""), vez: "X", vencedor: null, aceito: false, premio: premioJogo("jogo_velha") };
    velhas.set(rid, jogo);
    enviarVelha(rid);
    resp(cb, { ok: true });
  });
  socket.on("velha:aceitar", (d: { aceitar?: boolean }) => {
    const { rid } = eu(); const j = rid ? velhas.get(rid) : null;
    if (!rid || !j || j.o.id !== socket.id || j.aceito) return;
    if (d?.aceitar) j.aceito = true; else velhas.delete(rid);
    enviarVelha(rid);
  });
  socket.on("velha:jogar", (d: { casa?: number }) => {
    const { rid, room } = eu(); const j = rid ? velhas.get(rid) : null;
    if (!rid || !room || !j || !j.aceito || j.vencedor) return;
    const minha = j.x.id === socket.id ? "X" : j.o.id === socket.id ? "O" : null;
    const c = Math.floor(Number(d?.casa));
    if (!minha || minha !== j.vez || !(c >= 0 && c < 9) || j.casas[c]) return;
    j.casas[c] = minha;
    const ganhou = LINHAS.some((l) => l.every((i) => j.casas[i] === minha));
    if (ganhou) {
      j.vencedor = minha;
      const g = room.participants.get(minha === "X" ? j.x.id : j.o.id);
      if (g && j.premio > 0 && !g.isMaster) {
        g.kokiCoins = (Number(g.kokiCoins) || 0) + j.premio;
        io.to(g.id).emit("coins:updated", { participantId: g.id, kokiCoins: g.kokiCoins, newBalance: g.kokiCoins, amount: j.premio });
      }
    } else if (j.casas.every(Boolean)) j.vencedor = "empate";
    else j.vez = minha === "X" ? "O" : "X";
    enviarVelha(rid);
  });
  socket.on("velha:sair", () => {
    const { rid } = eu(); const j = rid ? velhas.get(rid) : null;
    if (!rid || !j) return;
    if (j.vencedor || j.x.id === socket.id || j.o.id === socket.id) { velhas.delete(rid); enviarVelha(rid); }
  });

  socket.on("disconnect", () => {
    ultimoClique.delete(socket.id);
    for (const [rid, j] of velhas) if (!j.vencedor && (j.x.id === socket.id || j.o.id === socket.id)) { velhas.delete(rid); io.to(rid).emit("velha:estado", null); }
  });
}
