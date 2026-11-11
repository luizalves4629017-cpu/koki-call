/**
 * salasTempServer — Salas de voz temporárias e "Sortear times".
 *
 * Qualquer pessoa cria uma sala temporária (nome, limite, "só quem eu chamar").
 * A sala some sozinha quando fica vazia (depois de 20 s de vida, pra dar tempo de entrar).
 *
 * Eventos:
 * - salas-temp:listar                         → cb({ salas })
 * - salas-temp:criar { nome, limite, privada } → cb({ ok, sala })   (e quem criou já entra)
 * - salas-temp:chamar { canal, alvoId }        → libera e avisa a pessoa (sala privada)
 * - times:enviar { jogo?, times: string[][] }  → cria uma sala por time e manda o resultado pra cada um
 * - salas-temp:lista (servidor → sala)         → lista atualizada
 * - salas-temp:chamado (servidor → pessoa)     → "Fulano te chamou pra sala X"
 * - times:resultado (servidor → sorteados)
 */
import type { Server, Socket } from "socket.io";

export interface SalaTemp {
  id: string;
  name: string;
  userLimit: number;
  privada: boolean;
  donoId: string;
  donoNome: string;
  permitidos: Set<string>;
  criada: number;
  cor?: string;
}

interface Ctx {
  rooms: Map<string, any>;
  salaAtual: () => string | null;
  /** Avisa a sala que o estado mudou (quem está em qual canal) */
  avisarSala: (room: any) => void;
}

const MAX_SALAS = 12;
const limpar = (v: any, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function salasTempDe(room: any): Map<string, SalaTemp> {
  if (!room.salasTemp) room.salasTemp = new Map<string, SalaTemp>();
  return room.salasTemp;
}

const publica = (s: SalaTemp) => ({
  id: s.id,
  name: s.name,
  userLimit: s.userLimit,
  privada: s.privada,
  donoId: s.donoId,
  donoNome: s.donoNome,
  permitidos: Array.from(s.permitidos),
  temporaria: true,
  cor: s.cor,
});

export function listaPublica(room: any) {
  return Array.from(salasTempDe(room).values()).map(publica);
}

function ocupacao(room: any, canal: string) {
  let n = 0;
  room.participants?.forEach((p: any) => p.voiceChannelId === canal && n++);
  return n;
}

/** Pode entrar nesse canal temporário? Retorna mensagem de erro ou null. Canal comum → null. */
export function bloqueioCanalTemp(room: any, canal: string, socketId: string, ehMaster: boolean): string | null {
  if (!String(canal).startsWith("tmp-")) return null;
  const s = salasTempDe(room).get(canal);
  if (!s) return "Essa sala temporária já acabou.";
  if (ehMaster) return null;
  if (s.privada && !s.permitidos.has(socketId) && s.donoId !== socketId) return "Sala fechada: só entra quem foi chamado.";
  if (ocupacao(room, canal) >= s.userLimit) return `Sala cheia (${s.userLimit}/${s.userLimit}).`;
  return null;
}

/** Apaga as salas temporárias vazias. Retorna true se mudou algo. */
export function limparVazias(room: any): boolean {
  const mapa = salasTempDe(room);
  let mudou = false;
  mapa.forEach((s, id) => {
    if (Date.now() - s.criada > 20_000 && ocupacao(room, id) === 0) {
      mapa.delete(id);
      mudou = true;
    }
  });
  return mudou;
}

let faxinaIniciada = false;
function iniciarFaxina(io: Server, ctx: Ctx) {
  if (faxinaIniciada) return;
  faxinaIniciada = true;
  setInterval(() => {
    ctx.rooms.forEach((room, roomId) => {
      if (room.salasTemp?.size && limparVazias(room)) io.to(roomId).emit("salas-temp:lista", listaPublica(room));
    });
  }, 10_000).unref?.();
}

const CORES_TIMES = ["#5EEAD4", "#C4B5FD", "#FBBF24", "#F472B6"];
const NOMES_TIMES = ["Time Aqua", "Time Lilás", "Time Ouro", "Time Rosa"];

export function registrarSalasTemp(io: Server, socket: Socket, ctx: Ctx) {
  iniciarFaxina(io, ctx);
  const sala = () => {
    const id = ctx.salaAtual();
    return id ? { id, room: ctx.rooms.get(id) } : null;
  };
  const novaId = () => `tmp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const avisarLista = (roomId: string, room: any) => io.to(roomId).emit("salas-temp:lista", listaPublica(room));

  socket.on("salas-temp:listar", (_d: any, cb?: any) => {
    const s = sala();
    if (typeof cb === "function") cb({ salas: s?.room ? listaPublica(s.room) : [] });
  });

  socket.on("salas-temp:criar", (data: { nome?: string; limite?: number; privada?: boolean }, cb?: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const s = sala();
    const p = s?.room?.participants?.get(socket.id);
    if (!s || !p) return responder({ ok: false, mensagem: "Entre numa sala primeiro." });
    const mapa = salasTempDe(s.room);
    limparVazias(s.room);
    if (mapa.size >= MAX_SALAS) return responder({ ok: false, mensagem: "Já tem salas temporárias demais agora. Tente daqui a pouco." });
    // uma sala aberta por pessoa (evita spam)
    const minha = Array.from(mapa.values()).find((x) => x.donoId === socket.id);
    if (minha) return responder({ ok: false, mensagem: `Você já tem a sala "${minha.name}" aberta.`, sala: publica(minha) });
    const nome = limpar(data?.nome, 32) || `Sala de ${limpar(p.name, 20) || "alguém"}`;
    const nova: SalaTemp = {
      id: novaId(),
      name: nome,
      userLimit: Math.max(2, Math.min(20, Number(data?.limite) || 5)),
      privada: Boolean(data?.privada),
      donoId: socket.id,
      donoNome: limpar(p.name, 40),
      permitidos: new Set([socket.id]),
      criada: Date.now(),
    };
    mapa.set(nova.id, nova);
    avisarLista(s.id, s.room);
    responder({ ok: true, sala: publica(nova) });
  });

  socket.on("salas-temp:chamar", (data: { canal?: string; alvoId?: string }, cb?: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const s = sala();
    const p = s?.room?.participants?.get(socket.id);
    const t = s ? salasTempDe(s.room).get(String(data?.canal || "")) : null;
    const alvo = s?.room?.participants?.get(String(data?.alvoId || ""));
    if (!s || !p || !t || !alvo) return responder({ ok: false, mensagem: "Não deu pra chamar." });
    if (t.privada && !t.permitidos.has(socket.id)) return responder({ ok: false, mensagem: "Só quem está na sala pode chamar." });
    t.permitidos.add(alvo.id);
    avisarLista(s.id, s.room);
    io.to(alvo.id).emit("salas-temp:chamado", { canal: t.id, nome: t.name, deNome: limpar(p.name, 40) });
    responder({ ok: true });
  });

  socket.on("times:enviar", (data: { jogo?: string; times?: string[][] }, cb?: any) => {
    const responder = (v: any) => typeof cb === "function" && cb(v);
    const s = sala();
    const p = s?.room?.participants?.get(socket.id);
    if (!s || !p) return responder({ ok: false, mensagem: "Entre numa sala primeiro." });
    const times = Array.isArray(data?.times) ? data!.times.slice(0, 4) : [];
    const vistos = new Set<string>();
    const limpos = times.map((t) =>
      (Array.isArray(t) ? t : [])
        .map(String)
        .filter((id) => s.room.participants.has(id) && !vistos.has(id) && (vistos.add(id), true))
        .slice(0, 10),
    );
    if (limpos.length < 2 || limpos.some((t) => t.length === 0)) return responder({ ok: false, mensagem: "Precisa de pelo menos 2 times com gente." });
    const mapa = salasTempDe(s.room);
    limparVazias(s.room);
    if (mapa.size + limpos.length > MAX_SALAS) return responder({ ok: false, mensagem: "Já tem salas temporárias demais agora." });
    const jogo = limpar(data?.jogo, 40);
    const resultado = limpos.map((ids, i) => {
      const t: SalaTemp = {
        id: novaId() + i,
        name: NOMES_TIMES[i],
        userLimit: Math.max(2, ids.length),
        privada: true,
        donoId: ids[0],
        donoNome: limpar(s.room.participants.get(ids[0])?.name, 40),
        permitidos: new Set(ids),
        criada: Date.now(),
        cor: CORES_TIMES[i],
      };
      mapa.set(t.id, t);
      return {
        nome: t.name,
        cor: t.cor,
        canal: t.id,
        membros: ids.map((id) => {
          const m = s.room.participants.get(id);
          return { id, nome: limpar(m?.name, 40), avatarUrl: m?.avatarUrl, avatarColor: m?.avatarColor };
        }),
      };
    });
    avisarLista(s.id, s.room);
    const msg = { por: limpar(p.name, 40), porId: socket.id, jogo, times: resultado };
    limpos.flat().forEach((id) => io.to(id).emit("times:resultado", msg));
    if (!vistos.has(socket.id)) socket.emit("times:resultado", msg);
    responder({ ok: true });
  });
}
