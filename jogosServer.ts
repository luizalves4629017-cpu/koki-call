/**
 * jogosServer — Damas (1x1, regras brasileiras simplificadas) e Uno (2 a 6 jogadores).
 * Tudo é validado aqui no servidor; o vencedor ganha o prêmio configurado no Painel Master.
 */
import type { Server, Socket } from "socket.io";

type Eu = () => { rid: string | null; room: any; p: any };
type Jogador = { id: string; nome: string };

// ======================= DAMAS =======================
// Tabuleiro 8x8 (índice = linha*8+coluna). "b"/"B" = brancas (desafiante, embaixo), "p"/"P" = pretas. Maiúscula = dama.
interface Damas { id: string; b: Jogador; p: Jogador; casas: string[]; vez: "b" | "p"; seguindo: number | null; vencedor: string | null; aceito: boolean; premio: number }
type Mov = { de: number; para: number; cap: number | null };
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const dentro = (l: number, c: number) => l >= 0 && l < 8 && c >= 0 && c < 8;
const cor = (x: string) => (x ? x.toLowerCase() : "");

function tabuleiroInicial(): string[] {
  const t = Array(64).fill("");
  for (let l = 0; l < 8; l++) for (let c = 0; c < 8; c++) if ((l + c) % 2 === 1) {
    if (l < 3) t[l * 8 + c] = "p";
    else if (l > 4) t[l * 8 + c] = "b";
  }
  return t;
}

function movsDaPeca(t: string[], i: number): Mov[] {
  const peca = t[i]; if (!peca) return [];
  const minha = cor(peca), dama = peca !== minha;
  const l0 = Math.floor(i / 8), c0 = i % 8;
  const frente = minha === "b" ? -1 : 1;
  const res: Mov[] = [];
  for (const [dl, dc] of DIAG) {
    if (dama) {
      let l = l0 + dl, c = c0 + dc, inimigo: number | null = null;
      while (dentro(l, c)) {
        const x = t[l * 8 + c];
        if (!x) { res.push({ de: i, para: l * 8 + c, cap: inimigo }); }
        else if (cor(x) === minha || inimigo !== null) break;
        else inimigo = l * 8 + c;
        l += dl; c += dc;
      }
    } else {
      const l1 = l0 + dl, c1 = c0 + dc;
      if (!dentro(l1, c1)) continue;
      const x = t[l1 * 8 + c1];
      if (!x) { if (dl === frente) res.push({ de: i, para: l1 * 8 + c1, cap: null }); }
      else if (cor(x) !== minha) {
        const l2 = l1 + dl, c2 = c1 + dc;
        if (dentro(l2, c2) && !t[l2 * 8 + c2]) res.push({ de: i, para: l2 * 8 + c2, cap: l1 * 8 + c1 });
      }
    }
  }
  return res;
}

/** Movimentos válidos do lado (captura é obrigatória). */
export function movsValidos(j: Damas): Mov[] {
  const todos: Mov[] = [];
  if (j.seguindo !== null) return movsDaPeca(j.casas, j.seguindo).filter((m) => m.cap !== null);
  j.casas.forEach((x, i) => { if (cor(x) === j.vez) todos.push(...movsDaPeca(j.casas, i)); });
  const caps = todos.filter((m) => m.cap !== null);
  return caps.length ? caps : todos;
}

// ======================= UNO =======================
type Carta = { c: string; v: string }; // c: r g b y w(curinga) · v: 0-9, pula, inverte, +2, troca, +4
interface Uno { id: string; dono: string; jogadores: Jogador[]; maos: Record<string, Carta[]>; monte: Carta[]; topo: Carta | null; corAtual: string; vez: number; sentido: 1 | -1; comprou: boolean; iniciado: boolean; vencedor: string | null; premio: number; ultimo: string }

function baralho(): Carta[] {
  const b: Carta[] = [];
  for (const c of ["r", "g", "b", "y"]) {
    b.push({ c, v: "0" });
    for (const v of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "pula", "inverte", "+2"]) b.push({ c, v }, { c, v });
  }
  for (let k = 0; k < 4; k++) b.push({ c: "w", v: "troca" }, { c: "w", v: "+4" });
  for (let i = b.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [b[i], b[k]] = [b[k], b[i]]; }
  return b;
}
const podeJogar = (u: Uno, k: Carta) => k.c === "w" || k.c === u.corAtual || k.v === u.topo?.v;

export function registrarJogos(io: Server, socket: Socket, eu: Eu, premioJogo: (j: string) => number) {
  const resp = (cb: any, v: any) => typeof cb === "function" && cb(v);
  const pagar = (room: any, id: string, valor: number) => {
    const g = room?.participants?.get(id);
    if (!g || valor <= 0 || g.isMaster) return;
    g.kokiCoins = (Number(g.kokiCoins) || 0) + valor;
    io.to(id).emit("coins:updated", { participantId: id, kokiCoins: g.kokiCoins, newBalance: g.kokiCoins, amount: valor });
  };

  // ---------------- Damas ----------------
  const enviarDamas = (rid: string) => io.to(rid).emit("damas:estado", damas.get(rid) || null);
  socket.on("damas:atual", (_d: any, cb: any) => { const { rid } = eu(); resp(cb, { jogo: (rid && damas.get(rid)) || null, premio: premioJogo("jogo_damas") }); });
  socket.on("damas:desafiar", (d: { alvoId?: string }, cb: any) => {
    const { rid, room, p } = eu();
    if (!rid || !room || !p) return resp(cb, { ok: false });
    const atual = damas.get(rid);
    if (atual && !atual.vencedor) return resp(cb, { ok: false, mensagem: "Já tem uma partida de Damas rolando." });
    const alvo = room.participants.get(String(d?.alvoId || ""));
    if (!alvo || alvo.id === socket.id) return resp(cb, { ok: false, mensagem: "Escolha alguém da call." });
    damas.set(rid, { id: `d${Date.now()}`, b: { id: socket.id, nome: p.name }, p: { id: alvo.id, nome: alvo.name }, casas: tabuleiroInicial(), vez: "b", seguindo: null, vencedor: null, aceito: false, premio: premioJogo("jogo_damas") });
    enviarDamas(rid); resp(cb, { ok: true });
  });
  socket.on("damas:aceitar", (d: { aceitar?: boolean }) => {
    const { rid } = eu(); const j = rid ? damas.get(rid) : null;
    if (!rid || !j || j.p.id !== socket.id || j.aceito) return;
    if (d?.aceitar) j.aceito = true; else damas.delete(rid);
    enviarDamas(rid);
  });
  socket.on("damas:mover", (d: { de?: number; para?: number }) => {
    const { rid, room } = eu(); const j = rid ? damas.get(rid) : null;
    if (!rid || !j || !j.aceito || j.vencedor) return;
    const lado = j.b.id === socket.id ? "b" : j.p.id === socket.id ? "p" : null;
    if (!lado || lado !== j.vez) return;
    const m = movsValidos(j).find((x) => x.de === Number(d?.de) && x.para === Number(d?.para));
    if (!m) return;
    j.casas[m.para] = j.casas[m.de]; j.casas[m.de] = "";
    if (m.cap !== null) j.casas[m.cap] = "";
    const linha = Math.floor(m.para / 8);
    const promoveu = j.casas[m.para] === lado && ((lado === "b" && linha === 0) || (lado === "p" && linha === 7));
    if (m.cap !== null && !promoveu && movsDaPeca(j.casas, m.para).some((x) => x.cap !== null)) {
      j.seguindo = m.para; // continua capturando com a mesma peça
    } else {
      if (promoveu) j.casas[m.para] = lado.toUpperCase();
      j.seguindo = null;
      j.vez = lado === "b" ? "p" : "b";
      if (movsValidos(j).length === 0) { j.vencedor = lado; pagar(room, lado === "b" ? j.b.id : j.p.id, j.premio); }
    }
    enviarDamas(rid);
  });
  socket.on("damas:sair", () => {
    const { rid, room } = eu(); const j = rid ? damas.get(rid) : null;
    if (!rid || !j) return;
    if (!j.vencedor && j.aceito && (j.b.id === socket.id || j.p.id === socket.id)) {
      // desistiu: o outro vence
      const outro = j.b.id === socket.id ? "p" : "b";
      j.vencedor = outro; pagar(room, outro === "b" ? j.b.id : j.p.id, j.premio);
      enviarDamas(rid); setTimeout(() => { if (damas.get(rid) === j) { damas.delete(rid); enviarDamas(rid); } }, 6000);
      return;
    }
    if (j.vencedor || !j.aceito) { damas.delete(rid); enviarDamas(rid); }
  });

  // ---------------- Uno ----------------
  const enviarUno = (rid: string) => {
    const u = unos.get(rid);
    if (!u) return io.to(rid).emit("uno:estado", null);
    const pub = { id: u.id, dono: u.dono, jogadores: u.jogadores.map((x) => ({ ...x, cartas: u.maos[x.id]?.length || 0 })), topo: u.topo, corAtual: u.corAtual, vez: u.jogadores[u.vez]?.id, sentido: u.sentido, comprou: u.comprou, iniciado: u.iniciado, vencedor: u.vencedor, premio: u.premio, ultimo: u.ultimo };
    io.to(rid).emit("uno:estado", pub);
    for (const x of u.jogadores) io.to(x.id).emit("uno:mao", { id: u.id, mao: u.maos[x.id] || [] });
  };
  const comprar = (u: Uno, id: string, n: number) => {
    for (let k = 0; k < n; k++) {
      if (!u.monte.length) { u.monte = baralho(); }
      u.maos[id].push(u.monte.pop()!);
    }
  };
  const proximo = (u: Uno, passos = 1) => { const n = u.jogadores.length; u.vez = (((u.vez + u.sentido * passos) % n) + n) % n; u.comprou = false; };

  socket.on("uno:atual", (_d: any, cb: any) => { const { rid } = eu(); if (rid) enviarUno(rid); resp(cb, { premio: premioJogo("jogo_uno") }); });
  socket.on("uno:criar", (_d: any, cb: any) => {
    const { rid, p } = eu();
    if (!rid || !p) return resp(cb, { ok: false });
    const atual = unos.get(rid);
    if (atual && !atual.vencedor) return resp(cb, { ok: false, mensagem: "Já tem uma mesa de Uno aberta." });
    unos.set(rid, { id: `u${Date.now()}`, dono: socket.id, jogadores: [{ id: socket.id, nome: p.name }], maos: {}, monte: [], topo: null, corAtual: "", vez: 0, sentido: 1, comprou: false, iniciado: false, vencedor: null, premio: premioJogo("jogo_uno"), ultimo: `${p.name} abriu a mesa` });
    enviarUno(rid); resp(cb, { ok: true });
  });
  socket.on("uno:entrar", (_d: any, cb: any) => {
    const { rid, p } = eu(); const u = rid ? unos.get(rid) : null;
    if (!rid || !p || !u || u.iniciado) return resp(cb, { ok: false, mensagem: "A partida já começou." });
    if (u.jogadores.length >= 6) return resp(cb, { ok: false, mensagem: "Mesa cheia (6)." });
    if (!u.jogadores.some((x) => x.id === socket.id)) u.jogadores.push({ id: socket.id, nome: p.name });
    enviarUno(rid); resp(cb, { ok: true });
  });
  socket.on("uno:iniciar", (_d: any, cb: any) => {
    const { rid } = eu(); const u = rid ? unos.get(rid) : null;
    if (!rid || !u || u.dono !== socket.id || u.iniciado) return resp(cb, { ok: false });
    if (u.jogadores.length < 2) return resp(cb, { ok: false, mensagem: "Precisa de pelo menos 2 jogadores." });
    u.monte = baralho();
    for (const x of u.jogadores) { u.maos[x.id] = []; comprar(u, x.id, 7); }
    let topo = u.monte.pop()!;
    while (topo.c === "w" || isNaN(Number(topo.v))) { u.monte.unshift(topo); topo = u.monte.pop()!; }
    u.topo = topo; u.corAtual = topo.c; u.iniciado = true; u.vez = 0; u.ultimo = "Partida começou!";
    enviarUno(rid); resp(cb, { ok: true });
  });
  socket.on("uno:jogar", (d: { idx?: number; cor?: string }, cb: any) => {
    const { rid, room } = eu(); const u = rid ? unos.get(rid) : null;
    if (!rid || !u || !u.iniciado || u.vencedor || u.jogadores[u.vez]?.id !== socket.id) return resp(cb, { ok: false });
    const mao = u.maos[socket.id]; const idx = Math.floor(Number(d?.idx));
    const k = mao?.[idx];
    if (!k || !podeJogar(u, k)) return resp(cb, { ok: false, mensagem: "Essa carta não serve agora." });
    if (k.c === "w" && !["r", "g", "b", "y"].includes(String(d?.cor))) return resp(cb, { ok: false, mensagem: "Escolha uma cor." });
    mao.splice(idx, 1);
    u.topo = k; u.corAtual = k.c === "w" ? String(d!.cor) : k.c;
    const nome = u.jogadores[u.vez].nome;
    u.ultimo = `${nome} jogou ${k.v}${mao.length === 1 ? " · UNO!" : ""}`;
    if (!mao.length) {
      u.vencedor = socket.id; u.ultimo = `${nome} venceu!`;
      pagar(room, socket.id, u.premio);
      enviarUno(rid); return resp(cb, { ok: true });
    }
    const n = u.jogadores.length;
    const alvo = () => u.jogadores[(((u.vez + u.sentido) % n) + n) % n].id;
    if (k.v === "inverte") { if (n === 2) proximo(u, 2); else { u.sentido = (u.sentido * -1) as 1 | -1; proximo(u); } }
    else if (k.v === "pula") proximo(u, 2);
    else if (k.v === "+2") { comprar(u, alvo(), 2); proximo(u, 2); }
    else if (k.v === "+4") { comprar(u, alvo(), 4); proximo(u, 2); }
    else proximo(u);
    enviarUno(rid); resp(cb, { ok: true });
  });
  socket.on("uno:comprar", () => {
    const { rid } = eu(); const u = rid ? unos.get(rid) : null;
    if (!rid || !u || !u.iniciado || u.vencedor || u.jogadores[u.vez]?.id !== socket.id || u.comprou) return;
    comprar(u, socket.id, 1); u.comprou = true;
    u.ultimo = `${u.jogadores[u.vez].nome} comprou uma carta`;
    enviarUno(rid);
  });
  socket.on("uno:passar", () => {
    const { rid } = eu(); const u = rid ? unos.get(rid) : null;
    if (!rid || !u || u.jogadores[u.vez]?.id !== socket.id || !u.comprou) return;
    proximo(u); enviarUno(rid);
  });
  const sairUno = (rid: string, id: string) => {
    const u = unos.get(rid); if (!u) return;
    if (u.vencedor || id === u.dono && !u.iniciado) { unos.delete(rid); return enviarUno(rid); }
    const pos = u.jogadores.findIndex((x) => x.id === id); if (pos < 0) return;
    u.jogadores.splice(pos, 1); delete u.maos[id];
    if (!u.jogadores.length) { unos.delete(rid); return enviarUno(rid); }
    if (u.dono === id) u.dono = u.jogadores[0].id;
    if (u.iniciado && u.jogadores.length === 1) { u.vencedor = u.jogadores[0].id; u.ultimo = `${u.jogadores[0].nome} venceu (os outros saíram)`; }
    if (pos < u.vez || u.vez >= u.jogadores.length) u.vez = (u.vez - (pos < u.vez ? 1 : 0) + u.jogadores.length) % u.jogadores.length;
    enviarUno(rid);
  };
  socket.on("uno:sair", () => { const { rid } = eu(); if (rid) sairUno(rid, socket.id); });

  socket.on("disconnect", () => {
    for (const [rid, j] of damas) if (!j.vencedor && (j.b.id === socket.id || j.p.id === socket.id)) { damas.delete(rid); io.to(rid).emit("damas:estado", null); }
    for (const [rid, u] of unos) if (u.jogadores.some((x) => x.id === socket.id)) sairUno(rid, socket.id);
  });
}

const damas = new Map<string, Damas>();
const unos = new Map<string, Uno>();
