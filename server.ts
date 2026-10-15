import express from "express";
// Rodando o bundle (npm start -> dist/server.cjs) sem NODE_ENV: assume produção (Railway/Render)
if (!process.env.NODE_ENV && /dist[\\/]server\.cjs$/.test(process.argv[1] || "")) process.env.NODE_ENV = "production";
import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as loja from "./lojaStore";
import * as midia from "./mediaStore";
import { iniciarFirebase } from "./dbStore";
import { configurarCargos, agendarSalvarCargo, carregarCargos } from "./cargosStore";
import { carregarSalasDoBanco, getSalaSalva, salvarSala } from "./salasStore";
import { registrarContas, registrarContasSocket, aoEntrarNaConta, aoSairDaConta, definirForaDoRank, definirChecagemBanConta } from "./contasStore";
import { carregarBanimentos, criarBanimento, removerBanimento, procurarBanimento, listarBanimentos, banimentoPublico, textoBanimento, avisoBanimento, normalizarIp, Banimento } from "./banStore";
import { checarSpam, limparSpam, LIMITE_CARACTERES } from "./antiSpam";
import { registrarAmigosSocket, marcarOnline, marcarOffline, avisarPresenca, atualizarPerfilAmigo, definirPerfilReserva, AlvoAmizade } from "./amigosStore";
import { registrarMembro, marcarVisto, listarMembros, membroPorChave, carregarMembros, filtrarPerks, salvarPerksMembro, removerPerkMembro, perksAtivosMembro, desdeMembro, cargoMembro, definirCargo, poderesMembro, sairDaSala, comprasMembro, anotarRastros, uidDoMembro, uidDoDonoMaster, perfilSalvoPorUid, auraDoMembro, liberarAuraMembro, salvarAuraMembro, auraLojaDoMembro, salvarAuraLojaMembro, corAuraLojaSalva, CORES_AURA_LOJA } from "./membrosStore";
import { registrarExtras, registrarCompra, iniciarAmostragem } from "./extrasServer";
import { parserEco, paraServidor, registrarRotaBlob, aprenderBase } from "./blobCache";

// ---------- CORS: front no Cloudflare Pages (outro domínio) + mesmo domínio (Render/Electron/APK) ----------
const ORIGENS_EXTRAS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((x) => x.trim().replace(/\/+$/, ""))
  .filter(Boolean);
function origemPermitida(origin: string | undefined, host?: string): boolean {
  if (!origin) return true; // mesmo domínio, apps nativos, curl
  if (ORIGENS_EXTRAS.includes("*")) return true;
  let u: URL;
  try { u = new URL(origin); } catch { return false; }
  if (host && u.host === host) return true; // mesma origem (Render single-host)
  const limpa = `${u.protocol}//${u.host}`;
  for (const o of ORIGENS_EXTRAS) {
    if (o === limpa) return true;
    if (o.includes("*")) {
      const re = new RegExp("^" + o.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9-]+") + "$", "i");
      if (re.test(limpa)) return true;
    }
  }
  if (u.protocol === "https:" && /\.pages\.dev$/i.test(u.hostname)) return true; // Cloudflare Pages (produção e prévias)
  if (/\.onrender\.com$/i.test(u.hostname) || /\.up\.railway\.app$/i.test(u.hostname)) return true;
  if (/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return true; // dev
  return false;
}


// Mapas que salvam sozinhos no Firebase a cada mudança (ver cargosStore.ts)
class MapaSalvo<V> extends Map<string, V> {
  set(k: string, v: V) { super.set(k, v); agendarSalvarCargo(k); return this; }
  delete(k: string) { const r = super.delete(k); agendarSalvarCargo(k); return r; }
}
class ConjuntoSalvo extends Set<string> {
  add(k: string) { super.add(k); if (typeof agendarSalvarCargo === "function") agendarSalvarCargo(k); return this; }
  delete(k: string) { const r = super.delete(k); agendarSalvarCargo(k); return r; }
}
// VIP dado pelo Dono fica guardado por pessoa (nome#tag), pra não sumir ao sair/voltar da sala
const vipPorPessoa = new MapaSalvo<any>();
// Conta logada (uid do Firebase) de cada participante. Fica só no servidor, nunca vai pros outros.
const uidDoParticipante = new WeakMap<object, string>();
// Chave antiga, só pra convidado sem conta (pode mudar se trocar de nome ou limpar o navegador)
const chaveNomeTag = (pp: any) => `${String(pp?.name || "").trim().toLowerCase()}#${String(pp?.tag || "")}`;
// Com conta logada, o cargo fica preso na conta: trocar nome ou # não tira nada
const chaveVip = (pp: any) => {
  const uid = pp && typeof pp === "object" ? uidDoParticipante.get(pp) : undefined;
  return uid ? `uid:${uid}` : chaveNomeTag(pp);
};
/** Liga o participante à conta logada e traz pra conta o que ele tinha pelo nome#tag. */
function ligarConta(pp: any, uid?: string | null) {
  if (!pp || !uid) return;
  uidDoParticipante.set(pp, uid);
  pp.temConta = true;
  const nova = `uid:${uid}`;
  const antiga = chaveNomeTag(pp);
  if (antiga === nova) return;
  if (!insigniasPorPessoa.has(nova) && insigniasPorPessoa.has(antiga)) {
    insigniasPorPessoa.set(nova, insigniasPorPessoa.get(antiga)!);
    insigniasPorPessoa.delete(antiga);
  }
  if (!vipPorPessoa.has(nova) && vipPorPessoa.has(antiga)) {
    vipPorPessoa.set(nova, vipPorPessoa.get(antiga));
    vipPorPessoa.delete(antiga);
  }
  if (coFundadores.has(antiga) && !coFundadores.has(nova)) {
    coFundadores.add(nova);
    // quem veio da variável COFUNDADORES continua lá; os dados pelo Dono passam pra conta
    if (!String(process.env.COFUNDADORES || "").toLowerCase().split(",").map((x) => x.trim()).includes(antiga)) coFundadores.delete(antiga);
  }
}
// Insígnias dadas pelo Dono também ficam guardadas por pessoa
const insigniasPorPessoa = new MapaSalvo<string[]>();
// Só estas insígnias liberam foto/GIF, banner e título
const INSIGNIAS_LIBERAM_PERFIL = ["nitro_owner", "vip_granted"];
// Co-fundadores (cargo abaixo do Dono Master). Fixos via env COFUNDADORES="nome#tag,outro#tag" + os dados pelo Dono.
const coFundadores = new ConjuntoSalvo(
  String(process.env.COFUNDADORES || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
);
const INSIGNIAS_SO_DO_DONO = ["singularidade", "cofundador", "koki_creator"];
/** Insígnia que só o Dono Master dá ou tira (Criador/Singularidade, Co-fundador e as "owner", menos a VIP Nitro). */
const insigniaSoDoDono = (b: string) => INSIGNIAS_SO_DO_DONO.includes(b) || (b.includes("owner") && b !== "nitro_owner");
/**
 * Lista final de insígnias quando quem mexe NÃO é o Dono Master (Co-fundador):
 * pode dar e tirar as comuns, mas as do Dono que a pessoa já tem ficam, e ele não dá nenhuma do Dono.
 */
function insigniasPeloCofundador(atuais: string[], pedidas: string[]): string[] {
  const protegidas = (atuais || []).filter(insigniaSoDoDono);
  const comuns = (Array.isArray(pedidas) ? pedidas : []).filter((b) => typeof b === "string" && !insigniaSoDoDono(b));
  return Array.from(new Set([...protegidas, ...comuns]));
}
// Tag que aparece pro Co-fundador (#0002). Só de exibição: a chave nome#tag continua com a tag original.
const TAG_COFUNDADOR = "0002";
function aplicarCofundador(pp: any) {
  pp.isCofundador = true;
  pp.tagExibida = TAG_COFUNDADOR;
  pp.badges = Array.from(new Set([...(pp.badges || []), "cofundador"]));
  pp.vipPermissions = { canUseGifAvatar: true, canUseVideoMp4Banner: true, canEditAdvancedProfile: true, hasVipBadge: true, grantedAt: Date.now(), expiresAt: null, grantedBy: "dono" };
}
/** Tira o cargo de Co-fundador do participante (a tag volta a ser a dele). */
function tirarCofundador(pp: any) {
  pp.isCofundador = false;
  delete pp.tagExibida;
  pp.badges = (pp.badges || []).filter((b: string) => b !== "cofundador");
}
function restaurarVip(pp: any) {
  if (!pp) return;
  if (coFundadores.has(chaveVip(pp))) aplicarCofundador(pp);
  else if (pp.isCofundador || pp.tagExibida) { pp.isCofundador = false; delete pp.tagExibida; }
  const ins = insigniasPorPessoa.get(chaveVip(pp));
  // O que o Dono definiu por último vale (inclusive remoções)
  if (ins) pp.badges = [...ins];
  if (pp.vipPermissions) return;
  const v = vipPorPessoa.get(chaveVip(pp));
  if (!v) return;
  if (v.expiresAt && v.expiresAt < Date.now()) { vipPorPessoa.delete(chaveVip(pp)); return; }
  pp.vipPermissions = { ...v };
  // Se o Dono já definiu a lista de insígnias, ela manda (não volta o VIP que ele tirou)
  if (v.hasVipBadge && !ins) pp.badges = Array.from(new Set([...(pp.badges || []), "vip_granted"]));
}

// ES Module polyfill for __filename and __dirname
// Funciona tanto em ESM (tsx, dev) quanto no bundle CJS (produção / Cloud Run)
const safeDirname: string = (() => {
  try {
    const metaUrl = (import.meta as any)?.url;
    if (metaUrl) return dirname(fileURLToPath(metaUrl));
  } catch {}
  // eslint-disable-next-line no-undef
  return typeof __dirname !== "undefined" ? __dirname : process.cwd();
})();

interface ServerParticipant {
  id: string;
  name: string;
  tag: string;
  isHost: boolean;
  isMaster?: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  isMutedByHost: boolean;
  avatarColor: string;
  avatarEmoji?: string;
  avatarUrl?: string;
  bannerColor?: string;
  bannerUrl?: string;
  customStatus?: string;
  customTitle?: string;
  bio?: string;
  badges?: string[];
  kokiCoins?: number;
  vipPermissions?: {
    canUseGifAvatar: boolean;
    canUseVideoMp4Banner: boolean;
    canEditAdvancedProfile: boolean;
    hasVipBadge: boolean;
    grantedAt: number;
    expiresAt: number | null;
    grantedBy: string;
  };
  joinedAt: number;
  voiceChannelId?: string;
  /** Tag só de exibição (Co-fundador = 0002). A tag real (chave) continua em `tag`. */
  tagExibida?: string;
  /** Entrou com conta logada (pode receber pedido de amizade) */
  temConta?: boolean;
  /** Modo invisível (só Dono Master / Co-fundador). Fica em room.invisiveis, nunca em room.participants. */
  invisivel?: boolean;
}

interface ServerTextChannel {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

interface ServerChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatarEmoji?: string;
  senderAvatarColor?: string;
  senderAvatarUrl?: string;
  senderIsHost?: boolean;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isSecurityWarning?: boolean;
  attachments?: midia.ChatAttachment[];
}

interface PendingKnock {
  socketId: string;
  name: string;
  tag: string;
  avatarEmoji?: string;
  avatarColor?: string;
  avatarUrl?: string;
  customStatus?: string;
  requestedAt: number;
}

interface ServerRoom {
  roomId: string;
  roomName: string;
  hostSocketId: string;
  hostSecretToken: string;
  hostPasscodeHash?: string;
  isLocked: boolean;
  createdAt: number;
  channels: ServerTextChannel[];
  messagesByChannel: Map<string, ServerChatMessage[]>;
  pendingKnocks: Map<string, PendingKnock>;
  settings: {
    allowScreenShare: boolean;
    allowVideo: boolean;
    allowGuestChat: boolean;
    maxParticipants: number;
    lowBandwidthDefault: boolean;
    requireKnockApproval: boolean;
  };
  participants: Map<string, ServerParticipant>;
  /** Quem está na sala no modo invisível (Dono Master / Co-fundador). Fora de toda lista/contagem dos outros. */
  invisiveis?: Map<string, ServerParticipant>;
}

/** Invisível com "falar invisível" ligado: só o 1º slot (microfone) pode enviar; câmera e tela continuam só-recebe. */
function sdpSoVoz(desc: any): any {
  if (!desc || typeof desc !== "object" || typeof desc.sdp !== "string") return desc;
  const partes = desc.sdp.split(/(?=\nm=)/);
  const sdp = partes.map((sec: string, i: number) => (i === 1 && /^\nm=audio/.test(sec) ? sec : sec.replace(/a=sendrecv/g, "a=recvonly").replace(/a=sendonly/g, "a=inactive"))).join("");
  return { type: desc.type, sdp };
}

/** SDP de quem está invisível: só recebe. Mesmo que o cliente tente mandar mídia, o outro lado responde sem receber nada. */
function sdpSoRecebe(desc: any): any {
  if (!desc || typeof desc !== "object" || typeof desc.sdp !== "string") return desc;
  return { type: desc.type, sdp: desc.sdp.replace(/a=sendrecv/g, "a=recvonly").replace(/a=sendonly/g, "a=inactive") };
}

const DEFAULT_CHANNELS: ServerTextChannel[] = [
  { id: "geral", name: "geral", description: "Canal principal de texto da call" },
  { id: "anuncios", name: "anuncios", description: "Canal oficial de anúncios e avisos da call" },
  { id: "links-midia", name: "links-e-mídia", description: "Links, clips de jogos e imagens seguras" },
  { id: "comandos", name: "comandos-bots", description: "Rolar dados, moedas e interações" },
];

const AVATAR_COLORS = [
  "#38bdf8", "#818cf8", "#a855f7", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#10b981", "#14b8a6", "#06b6d4"
];

const BANNER_COLORS = [
  "#0f172a", "#1e1b4b", "#022c22", "#164e63", "#311042", "#3b0764", "#431407", "#1e293b"
];

const MASTER_TAG = "0001";
const MASTER_NAME = "Luiz";
const RESERVED_MASTER_TAGS = new Set(["0001", "01", "1", "0000", "00", "001"]);

function isReservedTag(tag?: string | null): boolean {
  if (!tag || typeof tag !== "string") return false;
  const clean = tag.trim().replace(/^#/, "");
  return RESERVED_MASTER_TAGS.has(clean);
}

function getRandomColor(array: string[]): string {
  return array[Math.floor(Math.random() * array.length)];
}

function generateTag(): string {
  let tag = Math.floor(1000 + Math.random() * 9000).toString();
  while (RESERVED_MASTER_TAGS.has(tag)) {
    tag = Math.floor(1000 + Math.random() * 9000).toString();
  }
  return tag;
}

function resolveServerParticipantTag(
  name: string,
  isMaster: boolean,
  requestedTag?: string | null
): string {
  if (isMaster) {
    return MASTER_TAG;
  }
  // If NOT authenticated as master, NEVER give MASTER_TAG (0001, 01, 1, 0000, etc.)
  if (requestedTag && !isReservedTag(requestedTag)) {
    const clean = requestedTag.trim().replace(/^#/, "");
    if (clean.length === 4 && !isNaN(Number(clean)) && Number(clean) >= 1000) {
      return clean;
    }
  }
  return generateTag();
}

// Security sanitization & Antivirus heuristic filter
const DANGEROUS_EXTENSIONS = /\.(exe|scr|bat|vbs|apk|cmd|pif|msi|ps1|reg|hta|jar)($|\?)/i;

// Chave do Dono: só o HASH fica no código (a senha em si não aparece em lugar nenhum).
// Pode trocar via variável de ambiente ECO_MASTER_KEY_HASH ou KOKI_MASTER_KEY.
const MASTER_KEY_HASH = process.env.ECO_MASTER_KEY_HASH || "631264b451a89c0930b210cd0e9ff69a3e15443f99ca3c756c72b999bd2461ce";
const MASTER_SIGNING_SALT = process.env.ECO_SIGNING_SECRET || "791eb5c51a2323601174c767cb7b972614b9a0b6c1e0847c98495a3c46f08351";

function hashMasterKey(rawKey: string): string {
  return crypto.createHash("sha256").update(`eco-dono:${rawKey.trim()}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function verifyRawMasterKey(rawKey?: string): boolean {
  if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length < 8) return false;
  const envKey = process.env.KOKI_MASTER_KEY;
  if (envKey && safeEqual(rawKey.trim(), envKey.trim())) return true;
  const h = hashMasterKey(rawKey);
  // Senha nova do Dono (2026-10-13), vale mesmo se ECO_MASTER_KEY_HASH antigo continuar no painel
  if (safeEqual(h, "545dc1b095c693df0677c0090cc4032f51ff13621be96ea18aa146b0480705f4")) return true;
  return safeEqual(h, MASTER_KEY_HASH);
}

// O token do Dono é assinado pelo servidor; não dá pra fabricar no navegador
function generateMasterTokenFromKey(_rawKey?: string): string {
  return crypto.createHmac("sha256", MASTER_SIGNING_SALT).update(`eco-dono-token:${MASTER_KEY_HASH}`).digest("hex");
}

function validateServerMasterAuth(providedToken?: string, _clientIp?: string): { isMaster: boolean; authMethod: "owner_key" | "env_secret" | "machine_id" | "none" } {
  if (typeof providedToken === "string" && providedToken.trim().length > 0) {
    if (safeEqual(providedToken.trim(), generateMasterTokenFromKey())) {
      return { isMaster: true, authMethod: "owner_key" };
    }
  }
  return { isMaster: false, authMethod: "none" };
}

function normalizeRoomId(rawRoomId?: string | null): string {
  if (!rawRoomId || typeof rawRoomId !== "string") {
    return "main-lounge";
  }
  let clean = rawRoomId.trim();
  if (!clean) {
    return "main-lounge";
  }

  // Extract ?room= value if entire query string or URL was passed
  if (clean.includes("?room=") || clean.includes("&room=")) {
    try {
      const match = clean.match(/[?&]room=([^&?#\s]+)/i);
      if (match && match[1]) {
        clean = decodeURIComponent(match[1]).trim();
      }
    } catch {}
  }

  // Also handle cases like "/?room=xyz" or "http://...?room=xyz"
  if (clean.includes("?")) {
    const queryPart = clean.split("?")[1];
    if (queryPart && queryPart.includes("room=")) {
      const match = queryPart.match(/room=([^&?#\s]+)/i);
      if (match && match[1]) {
        clean = decodeURIComponent(match[1]).trim();
      }
    }
  }

  // Strip leading question marks, slashes, or room= prefix
  clean = clean.replace(/^[/?#&]+/, "");
  if (clean.toLowerCase().startsWith("room=")) {
    clean = clean.slice(5);
  }

  // Strip query parameters (&role=..., ?role=..., etc.), hashes, and unwanted characters
  clean = clean.split("?")[0].split("&")[0].split("#")[0].trim();
  clean = clean.replace(/^[\/\s]+|[\/\s]+$/g, "").trim().replace(/\s+/g, "-").toLowerCase();

  return clean || "main-lounge";
}

function ipDoSocket(s: Socket): string | undefined {
  const xf = s.handshake?.headers?.["x-forwarded-for"];
  const primeiro = (Array.isArray(xf) ? xf[0] : String(xf || "")).split(",")[0].trim();
  return normalizarIp(primeiro) || normalizarIp(s.handshake?.address);
}

function sanitizeAndInspectText(input: string): { cleanText: string; isSecurityWarning: boolean } {
  if (!input) return { cleanText: "", isSecurityWarning: false };

  // 1. Strip HTML tags / script injection
  let text = input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/javascript:/gi, "blocked-script:")
    .trim();

  // 2. Detect virus / executable link attempts
  let isSecurityWarning = false;
  if (DANGEROUS_EXTENSIONS.test(text)) {
    text = `🛡️ [eco Shield Bloqueou]: Link ou anexo com extensão executável suspeita detectado.`;
    isSecurityWarning = true;
  }

  return { cleanText: text.slice(0, LIMITE_CARACTERES), isSecurityWarning };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // CORS pro front em outro domínio (Cloudflare Pages). Sem cookies: o token do Dono vai no corpo.
  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && origemPermitida(origin, req.headers.host)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", String(req.headers["access-control-request-headers"] || "Content-Type, x-eco-socket, x-eco-room, Authorization"));
        res.setHeader("Access-Control-Max-Age", "86400");
        return res.status(204).end();
      }
    }
    next();
  });

  app.use(express.json({ limit: "2mb" }));
  // Fotos/banners de perfil servidos por link (ver blobCache.ts) em vez de base64 dentro do socket
  registrarRotaBlob(app);

  // Banco permanente (Firebase): preços da loja, salas fixas e contas
  iniciarFirebase();
  await loja.carregarLojaDoBanco().catch(() => {});
  await carregarSalasDoBanco().catch(() => {});
  // Insígnias, VIP e Co-fundadores dados pelo Dono voltam do Firebase
  configurarCargos((chave) => ({
    insignias: insigniasPorPessoa.get(chave) ?? null,
    vip: vipPorPessoa.get(chave) ?? null,
    cofundador: coFundadores.has(chave),
  }));
  await carregarCargos((chave, d) => {
    if (Array.isArray(d.insignias)) Map.prototype.set.call(insigniasPorPessoa, chave, d.insignias);
    if (d.vip) Map.prototype.set.call(vipPorPessoa, chave, d.vip);
    if (d.cofundador) Set.prototype.add.call(coFundadores, chave);
  }).catch((e) => console.warn("[cargos] erro ao carregar:", (e as Error).message));
  await carregarMembros().catch((e) => console.warn("[membros] erro ao carregar:", (e as Error).message));
  await carregarBanimentos().catch((e) => console.warn("[banimentos] erro ao carregar:", (e as Error).message));
  // Rank de Coins: Co-fundador (moedas infinitas) fica de fora, igual ao Dono Master
  definirForaDoRank((uid) => coFundadores.has(`uid:${uid}`));
  // Entrar na conta estando banido/suspenso: bloqueia
  definirChecagemBanConta((sock, uid) => {
    // Só pela conta aqui (o IP é conferido ao entrar na sala, onde o Dono Master fica de fora)
    void sock;
    const b = procurarBanimento({ uid });
    if (!b) return null;
    return { mensagem: textoBanimento(b), dados: avisoBanimento(b) };
  });
  registrarContas(app);

  // Render & Load Balancer Root Health Check (HTTP 200 OK)
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  // Versão do build (dist/version.json, gerado pelo vite build). O cliente compara com a que carregou
  // e mostra "Nova atualização do Eco! Reinicie o app". Em desenvolvimento não tem versão (sem aviso).
  const VERSAO_APP: string | null = (() => {
    if (process.env.NODE_ENV !== "production") return null;
    for (const dir of [path.resolve(process.cwd(), "dist"), path.resolve(safeDirname, "dist"), path.resolve(safeDirname, "..", "dist"), safeDirname]) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, "version.json"), "utf8"));
        if (j?.versao) return String(j.versao).slice(0, 64);
      } catch {}
    }
    return null;
  })();
  if (VERSAO_APP) console.log(`[versao] build ${VERSAO_APP}`);
  app.get("/version", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.json({ versao: VERSAO_APP });
  });

  // In-memory room store
  const rooms = new Map<string, ServerRoom>();
  // Lista de membros (inclusive offline): anota quem entrou em cada sala
  const anotarMembro = (pp: any, roomId: string) => {
    if (!pp) return;
    const comConta = uidDoParticipante.has(pp);
    registrarMembro(chaveVip(pp), pp, { id: roomId, nome: rooms.get(roomId)?.roomName || roomId }, comConta ? chaveNomeTag(pp) : undefined);
    aplicarDesdeECargo(pp);
    // Guarda conta + último IP (amizade e banimento de quem estiver offline depois)
    let sid: string | undefined;
    for (const [k, p] of rooms.get(roomId)?.participants || []) if (p === pp) { sid = k; break; }
    const sock = sid ? io.sockets.sockets.get(sid) : undefined;
    anotarRastros(chaveVip(pp), { uid: uidDoParticipante.get(pp), ip: sock ? ipDoSocket(sock) : undefined });
    if (sock) {
      if (pp.isMaster) (sock.data as any).ehMaster = true;
      sincronizarAmigo(sock);
      const idA = (sock.data as any).amigoId as string | undefined;
      if (idA) atualizarPerfilAmigo(idA, pp);
    }
  };

  // ===== Identidade de amizade =====
  // Conta logada = uid. Dono Master sem conta = a última conta que ele usou, senão "master" (fixo).
  const idMasterAmigo = () => uidDoDonoMaster() || "master";
  const idAmigoDoSocket = (s: Socket | undefined): string | undefined => {
    if (!s) return undefined;
    const d = s.data as any;
    if (d?.uid) return d.uid;
    if (d?.ehMaster) return idMasterAmigo();
    return undefined;
  };
  /** Marca online/offline pela identidade atual do socket (entrou/saiu da conta, virou Master...). */
  const sincronizarAmigo = (s: Socket, saindo = false) => {
    const d = s.data as any;
    const antigo: string | undefined = d.amigoId;
    const novo = saindo ? undefined : idAmigoDoSocket(s);
    if (antigo === novo) return;
    if (antigo) { marcarOffline(antigo, s.id); void avisarPresenca(io, antigo); }
    d.amigoId = novo;
    if (novo) { marcarOnline(novo, s.id); void avisarPresenca(io, novo); }
  };
  /** socket id de quem está online, ou "membro:<chave>" de quem está offline -> identidade de amizade */
  const resolverAlvoAmizade = (ref: string): AlvoAmizade => {
    if (!ref) return { naoAchou: true };
    if (ref.startsWith("membro:")) {
      const chave = ref.slice(7);
      // Está online agora com essa chave? usa o socket
      for (const r of rooms.values()) for (const [sid, p] of r.participants) if (chaveVip(p) === chave) {
        const id = idAmigoDoSocket(io.sockets.sockets.get(sid)) || ((p as any).isMaster ? idMasterAmigo() : undefined);
        if (id) return { id };
      }
      const m = membroPorChave(chave);
      const uid = uidDoMembro(chave);
      if (uid) return { id: uid };
      if (m?.ehDono) return { id: idMasterAmigo() };
      return m ? { semConta: true } : { naoAchou: true };
    }
    const s = io.sockets.sockets.get(ref);
    let pp: any = null;
    for (const r of rooms.values()) { const p = r.participants.get(ref); if (p) { pp = p; break; } }
    if (!s && !pp) return { naoAchou: true };
    const id = idAmigoDoSocket(s) || (pp?.isMaster ? idMasterAmigo() : undefined) || (pp ? uidDoParticipante.get(pp) : undefined);
    return id ? { id } : { semConta: true };
  };
  definirPerfilReserva((id) => perfilSalvoPorUid(id));
  // "Membro desde" = primeiro acesso salvo no servidor; cargo = o que o Dono deu
  const aplicarDesdeECargo = (pp: any) => {
    const ch = chaveVip(pp);
    const desde = desdeMembro(ch);
    if (desde) pp.memberSince = desde;
    pp.cargo = cargoMembro(ch);
    pp.poderes = poderesMembro(ch);
    aplicarAura(pp);
  };
  // Aura do card personalizada: só o servidor define (liberada pelo Dono Master/Co-fundador)
  const aplicarAura = (pp: any) => {
    const a = auraDoMembro(chaveVip(pp));
    if (a.liberada && !pp.isMaster && !pp.isCofundador) {
      pp.auraLiberada = true;
      pp.auraLiberadaPor = a.por;
      if (a.config) pp.auraCard = a.config;
      else delete pp.auraCard;
    } else {
      delete pp.auraLiberada;
      delete pp.auraLiberadaPor;
      delete pp.auraCard;
    }
    // Aura simples comprada na loja: só com o item "aura_card" ativo (vencido/removido pelo Dono = some)
    const corLoja = corAuraLojaSalva(chaveVip(pp));
    if (corLoja && Number(pp.purchasedPerks?.aura_card || 0) > Date.now() && !pp.isMaster && !pp.isCofundador) pp.auraLoja = corLoja;
    else delete pp.auraLoja;
  };
  // Quem pode fazer o quê na sala: Dono da sala, Dono Master ou cargo com o poder
  const temPoder = (room: ServerRoom, sid: string, poder: string) => {
    const p: any = room.participants.get(sid);
    if (!p) return false;
    // Criar a sala não dá poder: só o Dono Master ou cargo que ele deu
    if (p.isMaster || p.isCofundador) return true;
    return Array.isArray(p.poderes) && p.poderes.includes(poder);
  };
  // Manda pedidos de entrada pro Dono e pra quem tem o poder "porta"
  const avisarPorta = (room: ServerRoom, evento: string, dados: any) => {
    const enviados = new Set<string>();
    if (room.hostSocketId) { io.to(room.hostSocketId).emit(evento, dados); enviados.add(room.hostSocketId); }
    for (const [sid] of room.participants) if (!enviados.has(sid) && temPoder(room, sid, "porta")) io.to(sid).emit(evento, dados);
  };
  const perksSincronizados = new WeakSet<object>();
  iniciarAmostragem(rooms);

  // Rate limiter tracker per socket (Max 5 msgs per 2 sec)
  const messageRateLimiter = new Map<string, { count: number; resetAt: number }>();
  const mediaRateLimiter = new Map<string, { count: number; resetAt: number }>();

  // VIP auto-expiration timers Map (key: roomId:socketId)
  const vipTimers = new Map<string, NodeJS.Timeout>();

  // REST API Routes
  midia.registrarRotaMidia(app, (sid, rid) => Boolean(rooms.get(rid)?.participants.has(sid)));
  // TURN da Cloudflare: credenciais temporárias geradas aqui no servidor (o token nunca vai pro navegador)
  let turnCache: { at: number; iceServers: any[] } | null = null;
  app.get("/api/turn-credentials", async (_req, res) => {
    // TURN com usuário/senha fixos (ex.: ExpressTURN grátis, sem cartão)
    const staticUser = process.env.TURN_USERNAME;
    const staticPass = process.env.TURN_PASSWORD;
    if (staticUser && staticPass) {
      const host = (process.env.TURN_HOST || "free.expressturn.com:3478").trim();
      return res.json({
        iceServers: [
          { urls: [`turn:${host}`, `turn:${host}?transport=tcp`], username: staticUser.trim(), credential: staticPass.trim() },
        ],
      });
    }
    const keyId = process.env.CF_TURN_KEY_ID;
    const apiToken = process.env.CF_TURN_API_TOKEN;
    if (!keyId || !apiToken) return res.json({ iceServers: [] });
    try {
      if (turnCache && Date.now() - turnCache.at < 60 * 60 * 1000) {
        return res.json({ iceServers: turnCache.iceServers });
      }
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 86400 }),
      });
      if (!r.ok) throw new Error(`Cloudflare TURN ${r.status}`);
      const data: any = await r.json();
      const raw = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
      // Tira as URLs da porta 53 (bloqueadas em muitos navegadores/redes)
      const iceServers = raw.map((srv: any) => ({
        ...srv,
        urls: (Array.isArray(srv.urls) ? srv.urls : [srv.urls]).filter((u: string) => !/:53(\?|$)/.test(u)),
      }));
      turnCache = { at: Date.now(), iceServers };
      res.json({ iceServers });
    } catch (err) {
      console.error("Falha ao gerar TURN Cloudflare:", err);
      res.json({ iceServers: [] });
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "eco", security: "eco Shield Ativo", timestamp: Date.now() });
  });

  // Master Machine & Hardware Validation Endpoint
  app.post("/api/auth/master-check", (req, res) => {
    const { masterToken, masterKey } = req.body || {};
    let auth = validateServerMasterAuth(masterToken);
    if (!auth.isMaster && masterKey && typeof masterKey === "string") {
      if (verifyRawMasterKey(masterKey)) {
        auth = { isMaster: true, authMethod: "owner_key" };
      }
    }
    res.json({
      isMaster: auth.isMaster,
      authMethod: auth.authMethod,
      timestamp: Date.now(),
    });
  });

  // Master Login with Key/Password (For Owner Manual Login / Web Access)
  app.post("/api/auth/master-login", (req, res) => {
    const { masterKey } = req.body || {};
    if (!masterKey || typeof masterKey !== "string") {
      return res.status(400).json({ success: false, error: "Chave mestre não informada" });
    }

    const isValid = verifyRawMasterKey(masterKey);
    if (!isValid) {
      return res.status(401).json({ success: false, error: "Chave mestre incorreta ou não autorizada" });
    }

    const masterToken = generateMasterTokenFromKey(masterKey);
    return res.json({
      success: true,
      isMaster: true,
      masterToken,
      tag: MASTER_TAG,
      defaultName: MASTER_NAME,
      authMethod: "owner_key",
      message: "Autenticado como Dono Master com sucesso.",
    });
  });

  app.get("/api/auth/master-status", (req, res) => {
    const auth = validateServerMasterAuth();
    res.json({
      isMaster: auth.isMaster,
      authMethod: auth.authMethod,
    });
  });

  app.get("/api/room/:roomId", (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId.toLowerCase());
    if (!room) {
      return res.status(404).json({ error: "Sala não encontrada" });
    }

    return res.json({
      roomId: room.roomId,
      roomName: room.roomName,
      isLocked: room.isLocked,
      channels: room.channels,
      participantCount: room.participants.size,
      settings: room.settings,
    });
  });

  app.get("/api/stats", (req, res) => {
    let totalUsers = 0;
    rooms.forEach((room) => {
      totalUsers += room.participants.size;
    });
    res.json({
      activeRooms: rooms.size,
      totalUsers,
    });
  });

  const io = new SocketIOServer(server, {
    maxHttpBufferSize: 10_000_000, // fotos/GIF/vídeo de perfil passam de 1 MB (limite padrão derrubava o envio)
    // Troca data: grandes por links /api/m/... em TODO pacote que sai (economiza banda)
    parser: parserEco,
    // Comprime as mensagens do websocket (JSON repetitivo encolhe muito)
    perMessageDeflate: { threshold: 1024 },
    httpCompression: { threshold: 1024 },
    cors: {
      origin: true, // reflete a origem; quem decide é o allowRequest abaixo
      methods: ["GET", "POST"],
      credentials: true,
    },
    allowRequest: (req, cb) => {
      const ok = origemPermitida(req.headers.origin as string | undefined, req.headers.host);
      if (ok) aprenderBase(req as any);
      cb(null, ok);
    },
  });

  // ---------------- Modo invisível (Dono Master / Co-fundador) ----------------
  // Invisível = fica em room.invisiveis (NÃO em room.participants). Assim nenhuma lista, contagem,
  // aviso de entrada/saída ou room:sync manda essa pessoa pros outros. Ela recebe tudo da sala
  // (está no room do socket.io) e abre conexões só-recebe com cada participante.
  const fantasmas = (room: ServerRoom): Map<string, ServerParticipant> => {
    if (!room.invisiveis) room.invisiveis = new Map();
    return room.invisiveis;
  };
  const acharFantasma = (sid?: string | null): { room: ServerRoom; g: ServerParticipant } | null => {
    if (!sid) return null;
    for (const r of rooms.values()) {
      const g = r.invisiveis?.get(sid);
      if (g) return { room: r, g };
    }
    return null;
  };
  const ehPrivilegiado = (p: any) => Boolean(p?.isMaster || p?.isCofundador);
  /** Manda a lista de invisíveis só pro Dono Master / Co-fundador que estão na sala (visíveis ou não). */
  const emitirInvisiveis = (room: ServerRoom) => {
    const lista = Array.from(fantasmas(room).values());
    const todos: Array<[string, ServerParticipant]> = [...room.participants.entries(), ...fantasmas(room).entries()];
    for (const [sid, p] of todos) {
      if (!ehPrivilegiado(p)) continue;
      io.to(sid).emit("sala:invisiveis", { roomId: room.roomId, invisiveis: lista.filter((g) => g.id !== sid) });
    }
  };

  io.on("connection", (socket: Socket) => {
    // Links /api/m/... que o cliente devolve viram de novo o data: original antes de qualquer handler
    socket.use((packet, next) => {
      for (let i = 1; i < packet.length; i++) if (typeof packet[i] !== "function") packet[i] = paraServidor(packet[i]);
      next();
    });
    // Guarda da sinalização WebRTC e dos avisos de tela quando há alguém invisível no meio.
    // - Ninguém oferece conexão PARA um invisível (só ele oferece, e só-recebe).
    // - Oferta do invisível é reescrita pra recvonly (nada sai dele) e marcada espectador:true pelo servidor.
    // - Invisível não manda resposta, não usa os eventos antigos de sinal e não anuncia tela.
    const SINAIS = new Set(["signal:offer", "signal:answer", "signal:ice-candidate", "signal:ice_candidate", "signal", "offer", "answer", "ice-candidate"]);
    socket.use((packet, next) => {
      const ev = String(packet[0] || "");
      const p: any = packet[1];
      const euFantasma = acharFantasma(socket.id);
      if (euFantasma && (ev === "screen-share-started" || ev === "screen-share-stopped")) return; // descarta
      if (!SINAIS.has(ev)) return next();
      if (!p || typeof p !== "object") return next();
      const destId = String(p.targetId || p.to || "");
      const destFantasma = acharFantasma(destId);
      if (!euFantasma && !destFantasma) {
        delete p.espectador; // só o servidor marca
        return next();
      }
      if (euFantasma && destFantasma) return; // invisível com invisível: nada
      if (euFantasma) {
        // só pros participantes visíveis da MESMA sala
        if (!euFantasma.room.participants.has(destId)) return;
        if (ev === "signal:offer") {
          p.offer = (euFantasma.g as any).vozInvisivel ? sdpSoVoz(p.offer) : sdpSoRecebe(p.offer);
          p.espectador = true;
          return next();
        }
        if (ev === "signal:ice-candidate" || ev === "signal:ice_candidate") {
          delete p.espectador;
          return next();
        }
        return; // resposta / eventos antigos: descarta
      }
      // destino invisível: só resposta e ICE de quem está visível na mesma sala
      if (!destFantasma!.room.participants.has(socket.id)) return;
      if (ev === "signal:answer" || ev === "signal:ice-candidate" || ev === "signal:ice_candidate") {
        delete p.espectador;
        return next();
      }
      return; // oferta pra invisível (ou eventos antigos): descarta
    });
    // Versão do app logo ao conectar (reconectou depois de um deploy = versão nova → aviso de reiniciar)
    socket.emit("app:versao", { versao: VERSAO_APP });
    socket.on("app:versao", (_d: any, cb?: any) => typeof cb === "function" && cb({ versao: VERSAO_APP }));
    // Dono Master avisa todo mundo conectado que vai sair atualização
    socket.on("master:avisar-atualizacao", (data: { masterToken?: string; mensagem?: string }, cb?: any) => {
      const responder = (v: any) => typeof cb === "function" && cb(v);
      let ehMaster = validateServerMasterAuth(data?.masterToken).isMaster;
      if (!ehMaster) for (const r of rooms.values()) { const p: any = r.participants.get(socket.id); if (p?.isMaster) ehMaster = true; }
      if (!ehMaster) return responder({ success: false, message: "Só o Dono Master pode avisar atualização." });
      const mensagem = "O Eco vai atualizar em instantes. Quando aparecer o aviso, reinicie o app.";
      io.emit("app:aviso-atualizacao", { mensagem, quando: Date.now() });
      responder({ success: true, conectados: io.engine.clientsCount });
    });
    let currentRoomId: string | null = null;

    // Login salvo + extras (Raio-X, anúncio, chuva de moedas, roleta)
    registrarContasSocket(socket);
    // Entrou na conta já dentro da call: prende os cargos na conta e restaura o que ela tiver
    aoEntrarNaConta(socket, (uid) => {
      if (!currentRoomId) return;
      const r = rooms.get(currentRoomId);
      const pp: any = r?.participants.get(socket.id);
      if (!r || !pp) return;
      ligarConta(pp, uid);
      pp.temConta = true;
      restaurarVip(pp);
      anotarMembro(pp, currentRoomId);
      atualizarPerfilAmigo(uid, pp);
      io.to(currentRoomId).emit("room:user-updated", pp);
      socket.emit("badges:assigned", { badges: pp.badges || [] });
    });
    // Amigos: online/offline pela identidade (conta, ou a fixa do Dono Master)
    aoEntrarNaConta(socket, () => {
      sincronizarAmigo(socket);
    });
    aoSairDaConta(socket, () => {
      sincronizarAmigo(socket);
      if (!currentRoomId) return;
      const r = rooms.get(currentRoomId);
      const pp: any = r?.participants.get(socket.id);
      if (pp) { pp.temConta = false; io.to(currentRoomId).emit("room:user-updated", pp); }
    });
    socket.on("disconnect", () => {
      sincronizarAmigo(socket, true);
      limparSpam(`sala:${socket.id}`);
    });
    // Dono Master e Co-fundador não passam pelo anti-spam
    const ehIsentoSpam = () => {
      const r = currentRoomId ? rooms.get(currentRoomId) : undefined;
      const pp: any = r?.participants.get(socket.id);
      if (pp?.isMaster || pp?.isCofundador) return true;
      const uid = (socket.data as any)?.uid;
      return Boolean(uid && coFundadores.has(`uid:${uid}`));
    };
    registrarAmigosSocket(io, socket, {
      isento: () => ehIsentoSpam(),
      meuId: (s) => idAmigoDoSocket(s),
      resolverAlvo: (ref) => resolverAlvoAmizade(ref),
    });

    /** Confere se quem está entrando está suspenso/banido (conta, nome#tag ou IP). */
    const banDeQuemEntra = (nome: string, tag?: string | null, ehMaster = false, salaId?: string): Banimento | null => {
      if (ehMaster) return null;
      const uid = ((socket.data as any)?.uid || (socket.data as any)?.uidBloqueado) as string | undefined;
      const chaves = [uid ? `uid:${uid}` : null, chaveNomeTag({ name: nome, tag: String(tag || "").replace(/^#/, "") })];
      for (const chave of chaves) {
        if (!chave) continue;
        const b = procurarBanimento({ uid, chave, ip: ipDoSocket(socket) }, salaId);
        if (b) return b;
      }
      return procurarBanimento({ uid, ip: ipDoSocket(socket) }, salaId);
    };
    const recusarPorBan = (b: Banimento, callback: any) => {
      const dados = avisoBanimento(b);
      socket.emit("ban:bloqueado", dados);
      if (typeof callback === "function") callback({ success: false, banido: dados, message: textoBanimento(b) });
    };
    registrarExtras(io, socket, {
      rooms,
      salaAtual: () => currentRoomId,
      ehMaster: (t?: string) => validateServerMasterAuth(t).isMaster,
    });

    // Loja: preços definidos pelo Dono Master valem para todo mundo
    socket.on("loja:config", (_p: any, cb: any) => {
      if (typeof cb === "function") cb({ ok: true, ajustes: loja.getAjustesLoja() });
    });
    socket.on("loja:ajustar", (p: { itemId: string; ajuste: any; masterToken?: string }, cb: any) => {
      const responder = (v: any) => typeof cb === "function" && cb(v);
      if (!validateServerMasterAuth(p?.masterToken).isMaster) return responder({ ok: false, mensagem: "Só o Dono Master muda preços." });
      if (!p?.itemId || typeof p.itemId !== "string") return responder({ ok: false, mensagem: "Item inválido." });
      const ajustes = loja.setAjusteLoja(p.itemId.slice(0, 60), p.ajuste || {});
      io.emit("loja:config-atualizada", { ajustes });
      responder({ ok: true, ajustes });
    });

    const formatRoomPayload = (room: ServerRoom) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      hostSocketId: room.hostSocketId,
      isLocked: room.isLocked,
      channels: room.channels,
      settings: room.settings,
      participants: Array.from(room.participants.values()),
    });

    const broadcastRoomState = (room: ServerRoom) => {
      const participantsList = Array.from(room.participants.values());
      const payload = formatRoomPayload(room);

      // 1. Full room state sync
      io.to(room.roomId).emit("room:sync", payload);

      // 2. Canonical array of active room participants
      io.to(room.roomId).emit("room:participants", participantsList);

      // (Antes também ia voice:participants, room:users_list, room:users-list e voice:map com a MESMA lista:
      //  7 cópias por mudança. O cliente trata todos com o mesmo handler, então room:sync + room:participants bastam.)
    };

    // 0. Master Auth Check (No Password Modal Handshake)
    socket.on("auth:check-master", (payload: { masterToken?: string }, callback) => {
      const auth = validateServerMasterAuth(payload?.masterToken);
      if (typeof callback === "function") {
        callback({
          isMaster: auth.isMaster,
          authMethod: auth.authMethod,
        });
      }
    });

    // 0.1 Master Manual Login via Key
    socket.on("auth:master-login", (payload: { masterKey?: string }, callback) => {
      if (!payload?.masterKey || !verifyRawMasterKey(payload.masterKey)) {
        if (typeof callback === "function") {
          callback({ success: false, error: "Chave mestre inválida ou não autorizada" });
        }
        return;
      }
      const masterToken = generateMasterTokenFromKey(payload.masterKey);
      if (typeof callback === "function") {
        callback({
          success: true,
          isMaster: true,
          masterToken,
          authMethod: "owner_key",
        });
      }
    });

    // 1. Create Room (Host Master)
    socket.on("room:create", (payload: {
      roomId: string;
      roomName: string;
      hostName: string;
      hostPasscode?: string;
      masterToken?: string;
      profile?: {
        avatarEmoji?: string;
        avatarColor?: string;
        avatarUrl?: string;
        bannerColor?: string;
        bannerUrl?: string;
        customStatus?: string;
        bio?: string;
        tag?: string;
        badges?: string[];
      };
      settings?: Partial<ServerRoom["settings"]>;
    }, callback) => {
      try {
        if (!payload) {
          if (typeof callback === "function") callback({ success: false, message: "Dados da sala inválidos." });
          return;
        }

        const { roomId, roomName, hostName, hostPasscode, masterToken, profile, settings } = payload;
        const cleanRoomId = normalizeRoomId(roomId) || "main-lounge";

        // Verify Master status on creation
        const auth = validateServerMasterAuth(masterToken);
        const isMasterHost = Boolean(auth.isMaster);
        // Suspenso/banido não cria sala
        {
          const b = banDeQuemEntra(String(hostName || ""), profile?.tag, isMasterHost, cleanRoomId);
          if (b) return recusarPorBan(b, callback);
        }
        const hostSecretToken = `hst_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;

        let existingRoom = rooms.get(cleanRoomId);
        let targetRoomId = cleanRoomId;

        // Código já pertence a uma sala fixa de outra pessoa? Não deixa "roubar"
        const salaFixa = !existingRoom ? getSalaSalva(cleanRoomId) : null;
        if (salaFixa && !isMasterHost && (payload as any).hostSecretToken !== salaFixa.hostSecretToken) {
          if (typeof callback === "function") callback({ success: false, message: `O código "${cleanRoomId}" já é de outra sala. Escolha outro código ou entre nela pela aba Entrar.` });
          return;
        }

        const messagesMap = existingRoom ? existingRoom.messagesByChannel : new Map<string, ServerChatMessage[]>();
        if (!existingRoom) {
          DEFAULT_CHANNELS.forEach((ch) => {
            messagesMap.set(ch.id, [
              {
                id: `sys-welcome-${ch.id}`,
                channelId: ch.id,
                senderId: "system",
                senderName: "eco Bot",
                senderAvatarEmoji: "🤖",
                senderIsHost: false,
                text: `Bem-vindo ao canal #${ch.name}! ${ch.description}.`,
                timestamp: Date.now(),
                isSystem: true,
              }
            ]);
          });
        }

        const resolvedTag = resolveServerParticipantTag(hostName, isMasterHost, profile?.tag);

        let cleanBadges: string[] = [];
        if (isMasterHost) {
          cleanBadges = profile?.badges && profile.badges.length > 0
            ? profile.badges
            : ["singularidade", "horizonte"];
        } else {
          cleanBadges = (profile?.badges || []).filter(
            (b) => (b === "nitro_owner" || !b.includes("owner")) && !INSIGNIAS_SO_DO_DONO.includes(b) && b !== "host_room"
          );
        }

        const hostParticipant: ServerParticipant = {
          id: socket.id,
          name: (hostName && hostName.trim().length > 0) ? hostName.trim() : (isMasterHost ? MASTER_NAME : "Anfitrião"),
          tag: resolvedTag,
          isHost: true,
          isMaster: isMasterHost,
          hasAudio: true,
          hasVideo: false,
          isScreenSharing: false,
          isDeafened: false,
          isMutedByHost: false,
          avatarColor: profile?.avatarColor || getRandomColor(AVATAR_COLORS),
          avatarEmoji: profile?.avatarEmoji || (isMasterHost ? "👑" : "🎙️"),
          avatarUrl: isMasterHost ? profile?.avatarUrl : undefined,
          bannerColor: profile?.bannerColor || getRandomColor(BANNER_COLORS),
          bannerUrl: isMasterHost ? profile?.bannerUrl : undefined,
          customStatus: (profile?.customStatus && profile.customStatus !== "Anfitrião da Sala" ? profile.customStatus : "") || (isMasterHost ? "👑 Dono Master da Sala" : "🟢 Conectado na Call"),
          bio: profile?.bio || (isMasterHost ? "Criador e moderador oficial do eco." : "Participante do eco."),
          badges: cleanBadges,
          joinedAt: Date.now(),
          voiceChannelId: "voice-geral",
        };

        const targetRoom: ServerRoom = {
          roomId: targetRoomId,
          roomName: roomName || (isMasterHost ? `Sala Master de ${hostParticipant.name}` : `Sala de ${hostParticipant.name}`),
          hostSocketId: socket.id,
          hostSecretToken: existingRoom ? existingRoom.hostSecretToken : (salaFixa?.hostSecretToken || hostSecretToken),
          hostPasscodeHash: hostPasscode ? hostPasscode.trim() : undefined,
          isLocked: false,
          createdAt: existingRoom ? existingRoom.createdAt : Date.now(),
          channels: existingRoom ? existingRoom.channels : [...DEFAULT_CHANNELS],
          messagesByChannel: messagesMap,
          pendingKnocks: new Map(),
          settings: {
            allowScreenShare: settings?.allowScreenShare ?? true,
            allowVideo: settings?.allowVideo ?? true,
            allowGuestChat: settings?.allowGuestChat ?? true,
            maxParticipants: settings?.maxParticipants ?? (isMasterHost ? 64 : 16),
            lowBandwidthDefault: settings?.lowBandwidthDefault ?? false,
            requireKnockApproval: settings?.requireKnockApproval ?? false,
          },
          participants: existingRoom ? existingRoom.participants : new Map(),
        };

        ligarConta(hostParticipant, (socket.data as any)?.uid); restaurarVip(hostParticipant); targetRoom.participants.set(socket.id, hostParticipant);
        rooms.set(targetRoomId, targetRoom);
        anotarMembro(hostParticipant, targetRoomId);
        // Sala fixa: nome, canais e dono ficam salvos mesmo quando todo mundo sai
        salvarSala(targetRoomId, {
          roomName: targetRoom.roomName,
          hostSecretToken: targetRoom.hostSecretToken,
          hostPasscodeHash: targetRoom.hostPasscodeHash,
          channels: targetRoom.channels,
          createdAt: targetRoom.createdAt,
        });
        currentRoomId = targetRoomId;
        socket.join(targetRoomId);
        socket.join(`${targetRoomId}:voice-geral`);
        socket.join(`${targetRoomId}:Geral`);

        const participantsList = Array.from(targetRoom.participants.values());
        // Broadcast active room and user state
        io.to(targetRoomId).emit("room:user-joined", hostParticipant);
        io.to(targetRoomId).emit("room:participants", participantsList);
        broadcastRoomState(targetRoom);

        if (typeof callback === "function") {
          callback({
            success: true,
            hostSecretToken: targetRoom.hostSecretToken,
            room: formatRoomPayload(targetRoom),
            self: hostParticipant,
          });
        }
      } catch (err: any) {
        console.error("Error creating room:", err);
        if (typeof callback === "function") {
          callback({ success: false, message: err?.message || "Erro ao criar sala." });
        }
      }
    });

    // 2. Join or Request Entry (Knock approval gatekeeper)
    socket.on("room:join", (payload: {
      roomId: string;
      username?: string;
      name?: string;
      isMaster?: boolean;
      role?: "guest" | "host" | "auto";
      isGuestOnly?: boolean;
      masterToken?: string;
      hostSecretToken?: string;
      passcode?: string;
      profile?: {
        avatarEmoji?: string;
        avatarColor?: string;
        avatarUrl?: string;
        bannerColor?: string;
        bannerUrl?: string;
        customStatus?: string;
        bio?: string;
        tag?: string;
        badges?: string[];
      };
    }, callback) => {
      try {
        if (!payload) {
          if (typeof callback === "function") callback({ success: false, message: "Dados de entrada inválidos." });
          return;
        }

        const { roomId, username, name, role, isGuestOnly, masterToken, hostSecretToken, passcode, profile } = payload;
        // Suspenso/banido não entra em sala nenhuma (confere conta, nome#tag e IP)
        {
          const b = banDeQuemEntra(String(username || name || "").trim(), profile?.tag, validateServerMasterAuth(masterToken).isMaster, normalizeRoomId(roomId) || "main-lounge");
          if (b) return recusarPorBan(b, callback);
        }
        // Modo invisível: só Dono Master (token) ou Co-fundador (cargo salvo no servidor). Membro comum nunca.
        const pedeInvisivel = (payload as any).invisivel === true;
        if (pedeInvisivel) {
          let pode = validateServerMasterAuth(masterToken).isMaster;
          if (!pode) {
            const nomeTmp = String(username || name || "").trim();
            const tmp: any = { name: nomeTmp, tag: resolveServerParticipantTag(nomeTmp, false, profile?.tag) };
            const uidTmp = (socket.data as any)?.uid as string | undefined;
            pode = coFundadores.has(chaveNomeTag(tmp)) || Boolean(uidTmp && coFundadores.has(`uid:${uidTmp}`));
          }
          if (!pode) {
            if (typeof callback === "function") callback({ success: false, message: "Só o Dono Master e o Co-fundador podem entrar invisível." });
            return;
          }
        }
        const cleanRoomId = normalizeRoomId(roomId) || "main-lounge";
        // Ensure socket.join(cleanRoomId) is called immediately when joining a room
        socket.join(cleanRoomId);
        socket.join(`${cleanRoomId}:voice-geral`);
        socket.join(`${cleanRoomId}:Geral`);
        currentRoomId = cleanRoomId;

        const effectiveName = (username || name || "").trim() || `Convidado ${Math.floor(100 + Math.random() * 900)}`;

        let room = rooms.get(cleanRoomId);

        // Validate Master status strictly via masterToken or explicit isMaster parameter
        const masterAuth = validateServerMasterAuth(masterToken);
        // Só o token assinado vale (antes qualquer um podia mandar isMaster:true)
        const isMasterUser = Boolean(masterAuth.isMaster);

        // If room was not found in memory (e.g. server restart or invite link opened before host created),
        // seamlessly auto-create the room so guests and friends never get blocked with an error!
        if (!room) {
          const messagesMap = new Map<string, ServerChatMessage[]>();
          DEFAULT_CHANNELS.forEach((ch) => {
            messagesMap.set(ch.id, [
              {
                id: `sys-${Date.now()}-${ch.id}`,
                channelId: ch.id,
                senderId: "system",
                senderName: "eco Bot",
                senderAvatarEmoji: "🤖",
                text: `🚀 Sala **${cleanRoomId}** pronta para conexões por voz, vídeo e chat!`,
                timestamp: Date.now(),
                isSystem: true,
              }
            ]);
          });

          // Sala fixa salva? Volta com o mesmo nome, canais e dono
          const salva = getSalaSalva(cleanRoomId);
          room = {
            roomId: cleanRoomId,
            roomName: salva?.roomName || `Sala ${cleanRoomId.toUpperCase()}`,
            hostSocketId: "",
            hostSecretToken: salva?.hostSecretToken || hostSecretToken || `sec-${Math.random().toString(36).substring(2, 12)}`,
            hostPasscodeHash: salva ? salva.hostPasscodeHash : (passcode ? passcode.trim() : undefined),
            isLocked: false,
            createdAt: salva?.createdAt || Date.now(),
            channels: salva?.channels && salva.channels.length ? (salva.channels as any) : [...DEFAULT_CHANNELS],
            messagesByChannel: messagesMap,
            pendingKnocks: new Map(),
            settings: {
              allowScreenShare: true,
              allowVideo: true,
              allowGuestChat: true,
              maxParticipants: 16,
              lowBandwidthDefault: false,
              requireKnockApproval: false,
            },
            participants: new Map(),
          };
          rooms.set(cleanRoomId, room);
        }

        // Check if caller is explicitly joining as a guest or authenticated host
        const isExplicitGuest = Boolean(isGuestOnly || role === "guest");
        const isAuthenticHost = !isExplicitGuest && Boolean(
          isMasterUser ||
          (hostSecretToken && hostSecretToken === room.hostSecretToken) ||
          (room.hostPasscodeHash && passcode && room.hostPasscodeHash === passcode.trim())
        );

        // Entrou de novo nesta sala (normal ou invisível): tira o registro invisível antigo
        if (fantasmas(room).delete(socket.id)) {
          socket.to(cleanRoomId).emit("espectador:fim", { id: socket.id });
        }

        if (room.isLocked && !isAuthenticHost && !pedeInvisivel) {
          if (typeof callback === "function") {
            return callback({ success: false, message: "Esta sala está trancada pelo anfitrião." });
          }
          return;
        }

        if (room.participants.size >= room.settings.maxParticipants && !pedeInvisivel) {
          if (typeof callback === "function") {
            return callback({ success: false, message: "A sala atingiu o limite máximo de participantes." });
          }
          return;
        }

        // If user is a guest and room requires Host Approval and Host is currently online in the room:
        const hostIsOnline = Array.from(room.participants.keys()).some((sid) => temPoder(room, sid, "porta"));
        if (!isAuthenticHost && !pedeInvisivel && room.settings.requireKnockApproval && hostIsOnline) {
          const knock: PendingKnock = {
            socketId: socket.id,
            name: (name && name.trim().length > 0) ? name.trim() : `Convidado ${Math.floor(100 + Math.random() * 900)}`,
            tag: resolveServerParticipantTag(name, false, profile?.tag),
            avatarEmoji: profile?.avatarEmoji || "🎮",
            avatarColor: profile?.avatarColor || getRandomColor(AVATAR_COLORS),
            avatarUrl: undefined,
            customStatus: profile?.customStatus || "🟢 Aguardando aprovação...",
            requestedAt: Date.now(),
          };

          room.pendingKnocks.set(socket.id, knock);
          avisarPorta(room, "host:knock-request", knock);

          if (typeof callback === "function") {
            return callback({
              success: true,
              needsApproval: true,
              message: "Sua solicitação foi enviada ao Dono da sala. Aguarde a liberação.",
            });
          }
          return;
        }

        // Direct entry
        const isHost = isAuthenticHost;
        const resolvedTag = resolveServerParticipantTag(effectiveName, isMasterUser, profile?.tag);

        let cleanBadges: string[] = [];
        if (isMasterUser) {
          cleanBadges = profile?.badges && profile.badges.length > 0
            ? profile.badges
            : ["singularidade", "horizonte"];
        } else {
          cleanBadges = (profile?.badges || []).filter(
            (b) => !b.includes("owner") && b !== "singularidade" && b !== "koki_creator" && b !== "pioneer_member" && b !== "host_room"
          );
        }

        const participant: ServerParticipant = {
          id: socket.id,
          name: effectiveName || (isHost ? (isMasterUser ? MASTER_NAME : "Anfitrião") : `Convidado ${Math.floor(100 + Math.random() * 900)}`),
          tag: resolvedTag,
          isHost,
          isMaster: isMasterUser,
          hasAudio: true,
          hasVideo: false,
          isScreenSharing: false,
          isDeafened: false,
          isMutedByHost: false,
          avatarColor: profile?.avatarColor || getRandomColor(AVATAR_COLORS),
          avatarEmoji: isHost ? (profile?.avatarEmoji || (isMasterUser ? "👑" : "🎙️")) : (profile?.avatarEmoji || "🎮"),
          avatarUrl: isMasterUser ? profile?.avatarUrl : undefined,
          bannerColor: profile?.bannerColor || getRandomColor(BANNER_COLORS),
          bannerUrl: isMasterUser ? profile?.bannerUrl : undefined,
          customStatus: (profile?.customStatus && profile.customStatus !== "Anfitrião da Sala" ? profile.customStatus : "") || (isMasterUser ? "👑 Dono Master do eco" : "🟢 Conectado na Call"),
          bio: profile?.bio || (isMasterUser ? "Criador e moderador oficial do eco." : "Participante do eco."),
          badges: cleanBadges,
          joinedAt: Date.now(),
          voiceChannelId: "voice-geral",
        };

        // ---- Entrada invisível: ninguém fica sabendo (sem lista, sem aviso, sem contagem, sem "visto") ----
        if (pedeInvisivel) {
          ligarConta(participant, (socket.data as any)?.uid);
          restaurarVip(participant);
          if (!participant.isMaster && !(participant as any).isCofundador) {
            socket.leave(cleanRoomId); socket.leave(`${cleanRoomId}:voice-geral`); socket.leave(`${cleanRoomId}:Geral`);
            currentRoomId = null;
            if (typeof callback === "function") callback({ success: false, message: "Só o Dono Master e o Co-fundador podem entrar invisível." });
            return;
          }
          participant.invisivel = true;
          participant.hasAudio = false;
          participant.hasVideo = false;
          participant.isScreenSharing = false;
          // Estava visível nesta sala (mesmo socket)? Sai da lista dos outros antes
          const antes = room.participants.get(socket.id);
          if (antes) {
            room.participants.delete(socket.id);
            io.to(cleanRoomId).emit("room:user-left", { id: socket.id, name: antes.name });
            broadcastRoomState(room);
          }
          fantasmas(room).set(socket.id, participant);
          currentRoomId = cleanRoomId;
          const salaPayload = formatRoomPayload(room);
          const visiveisAgora = Array.from(room.participants.values());
          // Só pra própria pessoa: ela vê a sala real e abre conexões só-recebe com todos
          socket.emit("room:joined", { roomId: cleanRoomId, room: salaPayload, self: participant, isMaster: participant.isMaster, participants: visiveisAgora, invisivel: true });
          socket.emit("room:sync", salaPayload);
          socket.emit("room:participants", visiveisAgora);
          emitirInvisiveis(room);
          if (typeof callback === "function") {
            callback({ success: true, isHost: false, invisivel: true, room: salaPayload, self: participant });
          }
          return;
        }

        if (isHost && (!room.hostSocketId || !room.participants.has(room.hostSocketId))) {
          room.hostSocketId = socket.id;
        }

        ligarConta(participant, (socket.data as any)?.uid); restaurarVip(participant); room.participants.set(socket.id, participant); anotarMembro(participant, cleanRoomId);
        currentRoomId = cleanRoomId;
        socket.join(cleanRoomId);
        socket.join(`${cleanRoomId}:voice-geral`);
        socket.join(`${cleanRoomId}:Geral`);

        const currentParticipants = Array.from(room.participants.values());
        const formattedRoom = formatRoomPayload(room);

        // Immediately emit room:joined back to the user
        socket.emit("room:joined", {
          roomId: cleanRoomId,
          room: formattedRoom,
          self: participant,
          isMaster: participant.isMaster,
          participants: currentParticipants,
        });

        // Immediately emit room:participants and voice:participants with array of active users to everyone in the room
        io.to(cleanRoomId).emit("room:participants", currentParticipants);

        // Broadcast participant join events to room
        io.to(cleanRoomId).emit("room:user-joined", participant);
        broadcastRoomState(room);

        const joinMsg: ServerChatMessage = {
          id: `sys-join-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          channelId: "geral",
          senderId: "system",
          senderName: "eco Bot",
          senderAvatarEmoji: isHost ? "👑" : "👋",
          text: isHost
            ? `👑 **${participant.name}** (${isMasterUser ? "Dono Master" : "Anfitrião"}) entrou na chamada!`
            : `👋 **${participant.name}** (Convidado) entrou na chamada!`,
          timestamp: Date.now(),
          isSystem: true,
        };

        const geralMsgs = room.messagesByChannel.get("geral");
        if (geralMsgs) {
          geralMsgs.push(joinMsg);
          if (geralMsgs.length > 100) geralMsgs.shift();
        }
        io.to(cleanRoomId).emit("room:chat-message", joinMsg);
        // Dono Master / Co-fundador que entrou agora vê quem está invisível na sala
        if (ehPrivilegiado(participant) && fantasmas(room).size > 0) emitirInvisiveis(room);

        if (typeof callback === "function") {
          callback({
            success: true,
            isHost,
            hostSecretToken: isHost ? room.hostSecretToken : undefined,
            room: formatRoomPayload(room),
            self: participant,
          });
        }
      } catch (err: any) {
        console.error("Error in room:join:", err);
        if (typeof callback === "function") {
          callback({ success: false, message: err?.message || "Erro ao entrar na sala." });
        }
      }
    });

    // 3. Host Knock Approval / Rejection Handler
    socket.on("host:get-pending-knocks", (callback) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || !temPoder(room, socket.id, "porta")) {
        if (typeof callback === "function") callback({ knocks: [] });
        return;
      }
      if (typeof callback === "function") {
        callback({ knocks: Array.from(room.pendingKnocks.values()) });
      }
    });

    socket.on("host:knock-response", (data: { targetSocketId: string; approved: boolean }) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || !temPoder(room, socket.id, "porta")) return;

      const { targetSocketId, approved } = data;
      const knock = room.pendingKnocks.get(targetSocketId);
      if (!knock) return;

      room.pendingKnocks.delete(targetSocketId);
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      avisarPorta(room, "host:knock-cancelled", { socketId: targetSocketId });

      if (!approved) {
        if (targetSocket) {
          targetSocket.emit("room:knock-rejected", {
            message: "O Dono da sala recusou sua solicitação de entrada.",
          });
        }
        return;
      }

      // If approved, create guest participant
      const participant: ServerParticipant = {
        id: knock.socketId,
        name: knock.name,
        tag: resolveServerParticipantTag(knock.name, false, knock.tag),
        isHost: false,
        hasAudio: true,
        hasVideo: false,
        isScreenSharing: false,
        isDeafened: false,
        isMutedByHost: false,
        avatarColor: knock.avatarColor || getRandomColor(AVATAR_COLORS),
        avatarEmoji: knock.avatarEmoji || "🎮",
        avatarUrl: knock.avatarUrl,
        bannerColor: getRandomColor(BANNER_COLORS),
        customStatus: "🟢 Conectado na Call",
        bio: "Participante autorizado pelo Dono.",
        joinedAt: Date.now(),
        voiceChannelId: "voice-geral",
      };

      ligarConta(participant, (io.sockets.sockets.get(knock.socketId)?.data as any)?.uid); restaurarVip(participant); room.participants.set(knock.socketId, participant); anotarMembro(participant, room.roomId);

      if (targetSocket) {
        targetSocket.join(room.roomId);
        targetSocket.join(`${room.roomId}:voice-geral`);
        targetSocket.join(`${room.roomId}:Geral`);
        targetSocket.emit("room:knock-approved", {
          room: formatRoomPayload(room),
          self: participant,
        });
      }

      const currentParticipants = Array.from(room.participants.values());
      io.to(room.roomId).emit("room:user-joined", participant);
      io.to(room.roomId).emit("room:participants", currentParticipants);
      broadcastRoomState(room);

      const joinMsg: ServerChatMessage = {
        id: `sys-join-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channelId: "geral",
        senderId: "system",
        senderName: "eco Bot",
        senderAvatarEmoji: "👋",
        text: `🛡️ ${participant.name} foi aprovado pelo Dono e entrou na chamada!`,
        timestamp: Date.now(),
        isSystem: true,
      };

      const geralMsgs = room.messagesByChannel.get("geral");
      if (geralMsgs) {
        geralMsgs.push(joinMsg);
        if (geralMsgs.length > 100) geralMsgs.shift();
      }
      io.to(room.roomId).emit("room:chat-message", joinMsg);
    });

    socket.on("host:knock-approve-all", () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || !temPoder(room, socket.id, "porta")) return;

      const knocks = Array.from(room.pendingKnocks.values());
      room.pendingKnocks.clear();
      knocks.forEach((k) => avisarPorta(room, "host:knock-cancelled", { socketId: k.socketId }));

      knocks.forEach((knock) => {
        const targetSocket = io.sockets.sockets.get(knock.socketId);
        const participant: ServerParticipant = {
          id: knock.socketId,
          name: knock.name,
          tag: resolveServerParticipantTag(knock.name, false, knock.tag),
          isHost: false,
          hasAudio: true,
          hasVideo: false,
          isScreenSharing: false,
          isDeafened: false,
          isMutedByHost: false,
          avatarColor: knock.avatarColor || getRandomColor(AVATAR_COLORS),
          avatarEmoji: knock.avatarEmoji || "🎮",
          avatarUrl: knock.avatarUrl,
          bannerColor: getRandomColor(BANNER_COLORS),
          customStatus: "🟢 Conectado na Call",
          bio: "Participante autorizado pelo Dono.",
          joinedAt: Date.now(),
          voiceChannelId: "voice-geral",
        };

        ligarConta(participant, (io.sockets.sockets.get(knock.socketId)?.data as any)?.uid); restaurarVip(participant); room.participants.set(knock.socketId, participant); anotarMembro(participant, room.roomId);

        if (targetSocket) {
          targetSocket.join(room.roomId);
          targetSocket.join(`${room.roomId}:voice-geral`);
          targetSocket.join(`${room.roomId}:Geral`);
          targetSocket.emit("room:knock-approved", {
            room: formatRoomPayload(room),
            self: participant,
          });
        }

        io.to(room.roomId).emit("room:user-joined", participant);
      });

      const currentParticipants = Array.from(room.participants.values());
      io.to(room.roomId).emit("room:participants", currentParticipants);
      broadcastRoomState(room);
    });

    // 4. WebRTC Mesh Signaling with streamType and screen sharing support
    socket.on("signal:offer", (payload: { targetId?: string; to?: string; offer: RTCSessionDescriptionInit; streamType?: string; isScreen?: boolean }) => {
      const destId = payload?.targetId || payload?.to;
      if (!destId || !payload?.offer) return;
      io.to(destId).emit("signal:offer", {
        senderId: socket.id,
        from: socket.id,
        targetId: destId,
        offer: payload.offer,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
        // marcado pelo servidor (guarda acima): conexão só-recebe de um invisível, sem card na tela
        ...((payload as any).espectador === true ? { espectador: true } : {}),
      });
    });

    socket.on("signal:answer", (payload: { targetId?: string; to?: string; answer: RTCSessionDescriptionInit; streamType?: string; isScreen?: boolean }) => {
      const destId = payload?.targetId || payload?.to;
      if (!destId || !payload?.answer) return;
      io.to(destId).emit("signal:answer", {
        senderId: socket.id,
        from: socket.id,
        targetId: destId,
        answer: payload.answer,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
      });
    });

    socket.on("signal:ice-candidate", (payload: { targetId?: string; to?: string; candidate?: RTCIceCandidateInit; iceCandidate?: RTCIceCandidateInit; streamType?: string; isScreen?: boolean }) => {
      const destId = payload?.targetId || payload?.to;
      const candidate = payload?.candidate || payload?.iceCandidate;
      if (!destId || !candidate) return;
      io.to(destId).emit("signal:ice-candidate", {
        senderId: socket.id,
        from: socket.id,
        targetId: destId,
        candidate,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
      });
    });

    socket.on("signal:ice_candidate", (payload: { targetId?: string; to?: string; candidate?: RTCIceCandidateInit; iceCandidate?: RTCIceCandidateInit; streamType?: string; isScreen?: boolean }) => {
      const destId = payload?.targetId || payload?.to;
      const candidate = payload?.candidate || payload?.iceCandidate;
      if (!destId || !candidate) return;
      io.to(destId).emit("signal:ice-candidate", {
        senderId: socket.id,
        from: socket.id,
        targetId: destId,
        candidate,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
      });
    });

    socket.on("signal", (payload: { to?: string; targetId?: string; signal?: any; offer?: any; answer?: any; candidate?: any; iceCandidate?: any; streamType?: string; isScreen?: boolean }) => {
      const destId = payload?.targetId || payload?.to;
      if (!destId) return;
      if (payload.offer) {
        io.to(destId).emit("signal:offer", {
          senderId: socket.id,
          from: socket.id,
          targetId: destId,
          offer: payload.offer,
          streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
          isScreen: Boolean(payload.isScreen),
        });
      } else if (payload.answer) {
        io.to(destId).emit("signal:answer", {
          senderId: socket.id,
          from: socket.id,
          targetId: destId,
          answer: payload.answer,
          streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
          isScreen: Boolean(payload.isScreen),
        });
      } else if (payload.candidate || payload.iceCandidate) {
        io.to(destId).emit("signal:ice-candidate", {
          senderId: socket.id,
          from: socket.id,
          targetId: destId,
          candidate: payload.candidate || payload.iceCandidate,
          streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
          isScreen: Boolean(payload.isScreen),
        });
      }
      io.to(destId).emit("signal", {
        senderId: socket.id,
        from: socket.id,
        targetId: destId,
        ...payload,
      });
    });

    socket.on("offer", (payload: { targetId?: string; to?: string; offer: RTCSessionDescriptionInit; streamType?: string; isScreen?: boolean }) => {
      const destId = payload?.targetId || payload?.to;
      if (!destId || !payload?.offer) return;
      io.to(destId).emit("signal:offer", {
        senderId: socket.id,
        from: socket.id,
        targetId: destId,
        offer: payload.offer,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
      });
    });

    socket.on("answer", (payload: { targetId?: string; to?: string; answer: RTCSessionDescriptionInit; streamType?: string; isScreen?: boolean }) => {
      const destId = payload?.targetId || payload?.to;
      if (!destId || !payload?.answer) return;
      io.to(destId).emit("signal:answer", {
        senderId: socket.id,
        from: socket.id,
        targetId: destId,
        answer: payload.answer,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
      });
    });

    socket.on("ice-candidate", (payload: { targetId?: string; to?: string; candidate?: RTCIceCandidateInit; iceCandidate?: RTCIceCandidateInit; streamType?: string; isScreen?: boolean }) => {
      const destId = payload?.targetId || payload?.to;
      const candidate = payload?.candidate || payload?.iceCandidate;
      if (!destId || !candidate) return;
      io.to(destId).emit("signal:ice-candidate", {
        senderId: socket.id,
        from: socket.id,
        targetId: destId,
        candidate,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
      });
    });

    // Screen Share Direct Identification Events
    // O servidor guarda que a pessoa está compartilhando: assim qualquer atualização de perfil
    // (insígnias, VIP, cargo, moedas...) manda isScreenSharing certo e a tela não "cai" pra quem assiste.
    socket.on("screen-share-started", (data: { userId?: string; streamId?: string; trackId?: string; roomId?: string; hasAudio?: boolean }) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) return;
      const pp = rooms.get(targetRoomId)?.participants.get(socket.id);
      if (pp) pp.isScreenSharing = true;
      socket.to(targetRoomId).emit("screen-share-started", {
        userId: socket.id,
        streamId: data.streamId,
        trackId: data.trackId,
        hasAudio: typeof data.hasAudio === "boolean" ? data.hasAudio : undefined,
      });
    });

    socket.on("screen-share-stopped", (data: { userId?: string; roomId?: string }) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) return;
      const pp = rooms.get(targetRoomId)?.participants.get(socket.id);
      if (pp) pp.isScreenSharing = false;
      socket.to(targetRoomId).emit("screen-share-stopped", {
        userId: socket.id,
      });
    });

    // 4.5. Host / Master VIP Grants & Revocations
    socket.on("host:grant-vip", (data: {
      targetSocketId: string;
      permissions: {
        canUseGifAvatar: boolean;
        canUseVideoMp4Banner: boolean;
        canEditAdvancedProfile: boolean;
        hasVipBadge: boolean;
      };
      durationMinutes: number | null;
      masterToken?: string;
      roomId?: string;
    }, callback) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inativa" });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = validateServerMasterAuth(data.masterToken).isMaster || Boolean((requester as any)?.isMaster);
      // Criar a sala não dá poder nenhum: só o Dono Master (e quem ele deu cargo)
      const isRoomHost = false;

      const isCofundadorReq = Boolean((requester as any)?.isCofundador);
      // Dono Master, Co-fundador ou Anfitrião podem dar VIP
      if (!isMasterAuth && !isRoomHost && !isCofundadorReq) {
        if (typeof callback === "function") callback({ success: false, message: "Apenas o Dono pode conceder VIP." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado na sala." });
        return;
      }

      // Só o Dono mexe em quem já é VIP ou Co-fundador (os outros só podem dar, nunca tirar/reduzir)
      const alvoVip = room.participants.get(data.targetSocketId) as any;
      if (!isMasterAuth && alvoVip && (alvoVip.isMaster || alvoVip.vipPermissions || alvoVip.isCofundador)) {
        if (typeof callback === "function") callback({ success: false, message: "Só o Dono pode alterar o VIP de quem já tem." });
        return;
      }
      const timerKey = `${targetRoomId}:${data.targetSocketId}`;
      const existingTimer = vipTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        vipTimers.delete(timerKey);
      }

      const grantedAt = Date.now();
      const expiresAt =
        data.durationMinutes && data.durationMinutes > 0
          ? grantedAt + data.durationMinutes * 60 * 1000
          : null;

      target.vipPermissions = {
        canUseGifAvatar: Boolean(data.permissions?.canUseGifAvatar),
        canUseVideoMp4Banner: Boolean(data.permissions?.canUseVideoMp4Banner),
        canEditAdvancedProfile: Boolean(data.permissions?.canEditAdvancedProfile),
        hasVipBadge: Boolean(data.permissions?.hasVipBadge),
        grantedAt,
        expiresAt,
        grantedBy: socket.id,
      };
      vipPorPessoa.set(chaveVip(target), { ...target.vipPermissions });

      // Add VIP badge if enabled
      if (data.permissions?.hasVipBadge) {
        const badgesSet = new Set(target.badges || []);
        badgesSet.add("vip_granted");
        target.badges = Array.from(badgesSet);
      }

      // If duration is specified, set auto-expiration timer
      if (expiresAt && data.durationMinutes) {
        const timeoutMs = data.durationMinutes * 60 * 1000;
        const timer = setTimeout(() => {
          const cRoom = rooms.get(targetRoomId);
          if (!cRoom) return;
          const cTarget = cRoom.participants.get(data.targetSocketId);
          if (cTarget && cTarget.vipPermissions) {
            cTarget.vipPermissions = undefined; vipPorPessoa.delete(chaveVip(cTarget));
            if (cTarget.badges) {
              cTarget.badges = cTarget.badges.filter((b) => b !== "vip_granted");
            }

            io.to(data.targetSocketId).emit("vip:expired", {
              message: "Suas permissões VIP concedidas pelo Dono expiraram.",
            });
            io.to(targetRoomId).emit("room:user-updated", cTarget);

            const expMsg: ServerChatMessage = {
              id: `sys-vip-exp-${Date.now()}`,
              channelId: "geral",
              senderId: "system",
              senderName: "eco Bot",
              senderAvatarEmoji: "⏳",
              text: `O tempo de VIP de **${cTarget.name}** encerrou.`,
              timestamp: Date.now(),
              isSystem: true,
            };
            const gMsgs = cRoom.messagesByChannel.get("geral");
            if (gMsgs) {
              gMsgs.push(expMsg);
              if (gMsgs.length > 100) gMsgs.shift();
            }
            io.to(targetRoomId).emit("room:chat-message", expMsg);
          }
          vipTimers.delete(timerKey);
        }, timeoutMs);

        vipTimers.set(timerKey, timer);
      }

      io.to(targetRoomId).emit("room:user-updated", target);

      io.to(data.targetSocketId).emit("vip:granted", {
        participant: target,
        permissions: target.vipPermissions,
        durationMinutes: data.durationMinutes,
        message: "O Dono concedeu permissões VIP para você!",
      });

      const durationText = data.durationMinutes
        ? `${data.durationMinutes} minutos`
        : "tempo permanente";
      const vipMsg: ServerChatMessage = {
        id: `sys-vip-${Date.now()}`,
        channelId: "geral",
        senderId: "system",
        senderName: "eco Bot",
        senderAvatarEmoji: "💎",
        text: `👑 O Dono concedeu **Permissões VIP** para **${target.name}** (${durationText})!`,
        timestamp: Date.now(),
        isSystem: true,
      };
      const gMsgs = room.messagesByChannel.get("geral");
      if (gMsgs) {
        gMsgs.push(vipMsg);
        if (gMsgs.length > 100) gMsgs.shift();
      }
      io.to(targetRoomId).emit("room:chat-message", vipMsg);

      if (typeof callback === "function") {
        callback({ success: true, message: `Permissão VIP concedida com sucesso para ${target.name}!` });
      }
    });

    socket.on("host:revoke-vip", (data: { targetSocketId: string; masterToken?: string; roomId?: string }, callback) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inativa" });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = validateServerMasterAuth(data.masterToken).isMaster || Boolean((requester as any)?.isMaster);
      // Criar a sala não dá poder nenhum: só o Dono Master (e quem ele deu cargo)
      const isRoomHost = false;

      if (!isMasterAuth) { // só o Dono Master remove
        if (typeof callback === "function") callback({ success: false, message: "Só o Dono pode remover VIP." });
        return;
      }
      if (false) {
        if (typeof callback === "function") callback({ success: false, message: "Sem permissão para revogar VIP." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado." });
        return;
      }

      const timerKey = `${targetRoomId}:${data.targetSocketId}`;
      const existingTimer = vipTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        vipTimers.delete(timerKey);
      }

      target.vipPermissions = undefined; vipPorPessoa.delete(chaveVip(target));
      if (target.badges) {
        target.badges = target.badges.filter((b) => b !== "vip_granted");
      }

      io.to(targetRoomId).emit("room:user-updated", target);
      io.to(data.targetSocketId).emit("vip:revoked", {
        participantId: target.id,
        message: "O Dono encerrou suas permissões VIP.",
      });

      const revMsg: ServerChatMessage = {
        id: `sys-vip-rev-${Date.now()}`,
        channelId: "geral",
        senderId: "system",
        senderName: "eco Bot",
        senderAvatarEmoji: "🛡️",
        text: `As permissões VIP de **${target.name}** foram revogadas pelo Dono.`,
        timestamp: Date.now(),
        isSystem: true,
      };
      const gMsgs = room.messagesByChannel.get("geral");
      if (gMsgs) {
        gMsgs.push(revMsg);
        if (gMsgs.length > 100) gMsgs.shift();
      }
      io.to(targetRoomId).emit("room:chat-message", revMsg);

      if (typeof callback === "function") {
        callback({ success: true, message: `VIP revogado de ${target.name}.` });
      }
    });

    // 4.3 Send or Deduct Eco Coins (Host / Master action)
    socket.on("host:give-coins", (data: { targetSocketId: string; amount: number; action?: "add" | "deduct"; masterToken?: string; roomId?: string }, callback) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada." });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inexistente." });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = validateServerMasterAuth(data.masterToken).isMaster;
      // Criar a sala não dá poder nenhum: só o Dono Master (e o Co-fundador, só sobre membros)
      const isRoomHost = false;
      const isCofReq = Boolean((requester as any)?.isCofundador);

      if (!isMasterAuth && !isRoomHost && !isCofReq) {
        if (typeof callback === "function") callback({ success: false, message: "Apenas o Dono pode gerenciar moedas." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado na sala." });
        return;
      }
      if (!isMasterAuth && ((target as any).isMaster || ((target as any).isCofundador && target !== requester))) {
        if (typeof callback === "function") callback({ success: false, message: "O Co-fundador só mexe nas moedas dos membros." });
        return;
      }

      const rawAmount = Number(data.amount);
      if (isNaN(rawAmount) || rawAmount === 0) {
        if (typeof callback === "function") callback({ success: false, message: "Quantidade de moedas inválida." });
        return;
      }

      const isDeduct = data.action === "deduct" || rawAmount < 0;
      const absAmount = Math.abs(Math.floor(rawAmount));

      if (isDeduct) {
        // Deduct coins from participant (floor at 0)
        const prevCoins = target.kokiCoins || 0;
        target.kokiCoins = Math.max(0, prevCoins - absAmount);

        // Broadcast user updated to sync room participants
        io.to(targetRoomId).emit("room:user-updated", target);

        // Remoção é silenciosa: o alvo não recebe aviso, só o saldo atualizado
        io.to(data.targetSocketId).emit("coins:updated", {
          participantId: data.targetSocketId,
          kokiCoins: target.kokiCoins,
          newBalance: target.kokiCoins,
          amount: -absAmount,
        });

        // System chat announcement
        const coinMsg: ServerChatMessage = {
          id: `sys-coins-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          channelId: "geral",
          senderId: "system",
          senderName: "eco Bot",
          senderAvatarEmoji: "💸",
          text: `💸 **${requester?.name || "O Dono"}** removeu **-${absAmount.toLocaleString()} Eco Coins** de **${target.name}**! (Saldo atual: ${target.kokiCoins.toLocaleString()})`,
          timestamp: Date.now(),
          isSystem: true,
        };
        // Envio/remoção de moedas não aparece mais no chat
        void coinMsg;

        if (typeof callback === "function") {
          callback({
            success: true,
            action: "deduct",
            deducted: absAmount,
            newBalance: target.kokiCoins,
            message: `-${absAmount.toLocaleString()} Eco Coins removidas de ${target.name} com sucesso!`,
          });
        }
      } else {
        // Add coins to participant
        target.kokiCoins = (target.kokiCoins || 0) + absAmount;

        // Broadcast user updated to sync room participants
        io.to(targetRoomId).emit("room:user-updated", target);

        // Direct notification to target socket
        io.to(data.targetSocketId).emit("coins:received", {
          amount: absAmount,
          senderName: requester?.name || "Dono da Sala",
          newBalance: target.kokiCoins,
          message: `Você recebeu ${absAmount.toLocaleString()} Eco Coins do Dono!`,
        });
        io.to(data.targetSocketId).emit("coins:updated", {
          participantId: data.targetSocketId,
          kokiCoins: target.kokiCoins,
          newBalance: target.kokiCoins,
          amount: absAmount,
        });

        // System chat announcement
        const coinMsg: ServerChatMessage = {
          id: `sys-coins-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          channelId: "geral",
          senderId: "system",
          senderName: "eco Bot",
          senderAvatarEmoji: "💰",
          text: `💰 **${requester?.name || "O Dono"}** concedeu **+${absAmount.toLocaleString()} Eco Coins** para **${target.name}**!`,
          timestamp: Date.now(),
          isSystem: true,
        };
        // Envio/remoção de moedas não aparece mais no chat
        void coinMsg;

        if (typeof callback === "function") {
          callback({
            success: true,
            action: "add",
            added: absAmount,
            newBalance: target.kokiCoins,
            message: `+${absAmount.toLocaleString()} Eco Coins enviadas para ${target.name} com sucesso!`,
          });
        }
      }
    });

    // 4.3.1 Dedicated alias for deducting coins
    socket.on("host:deduct-coins", (data: { targetSocketId: string; amount: number; masterToken?: string; roomId?: string }, callback) => {
      socket.emit("host:give-coins", { ...data, action: "deduct" }, callback);
    });

    // 4.5. Host / Master Assign Badges to Member
    // Dono Master dá ou tira o cargo de Co-fundador
    socket.on("master:set-cofundador", (data: { targetSocketId: string; ativo: boolean; masterToken?: string }, callback?: any) => {
      if (!validateServerMasterAuth(data?.masterToken).isMaster) {
        if (typeof callback === "function") callback({ success: false, message: "Só o Dono Master pode fazer isso." });
        return;
      }
      const rid = currentRoomId;
      const room = rid ? rooms.get(rid) : undefined;
      const target: any = room?.participants.get(data.targetSocketId);
      if (!room || !target) return;
      const chave = chaveVip(target);
      if (data.ativo) {
        coFundadores.add(chave);
        aplicarCofundador(target);
        vipPorPessoa.set(chave, { ...target.vipPermissions });
      } else {
        coFundadores.delete(chave);
        tirarCofundador(target);
      }
      insigniasPorPessoa.set(chave, [...(target.badges || [])]);
      io.to(rid!).emit("room:user-updated", target);
      if (data.ativo) io.to(data.targetSocketId).emit("vip:granted", { participant: target, permissions: target.vipPermissions, durationMinutes: null, message: "Você agora é Co-fundador do eco!" });
      if (typeof callback === "function") callback({ success: true });
    });

    // Lista de membros com quem está offline: "sala" = quem já passou por esta sala, "eco" = todo mundo
    socket.on("membros:listar", (data: { roomId?: string; escopo?: "sala" | "eco"; masterToken?: string }, callback) => {
      if (typeof callback !== "function") return;
      // "Esta sala": qualquer um que está na sala vê os membros dela (online e offline).
      // "Todo o eco": só o Dono Master.
      const salaQuemPede = currentRoomId ? rooms.get(currentRoomId) : undefined;
      const quemPede: any = salaQuemPede ? salaQuemPede.participants.get(socket.id) || salaQuemPede.invisiveis?.get(socket.id) : null;
      const ehMaster = validateServerMasterAuth(data?.masterToken).isMaster || Boolean(quemPede?.isMaster) || Boolean(quemPede?.isCofundador);
      const salaId = (data?.roomId ? normalizeRoomId(data.roomId) : "") || currentRoomId || "";
      if (!ehMaster) {
        if (data?.escopo === "eco" || !quemPede || salaId !== currentRoomId) return callback({ success: false, membros: [] });
      }
      // quem está online agora e onde
      const online = new Map<string, { salaId: string; salaNome: string; socketId: string }>();
      for (const [rid, r] of rooms) {
        for (const [sid, p] of r.participants) online.set(chaveVip(p), { salaId: rid, salaNome: r.roomName, socketId: sid });
      }
      // Invisíveis: só o Dono Master / Co-fundador fica sabendo (pros outros continuam offline)
      const invisivelAgora = new Map<string, { salaId: string; salaNome: string; socketId: string }>();
      if (ehMaster) {
        for (const [rid, r] of rooms) {
          for (const [sid, g] of r.invisiveis || []) {
            const k = chaveVip(g);
            if (!online.has(k)) invisivelAgora.set(k, { salaId: rid, salaNome: r.roomName, socketId: sid });
          }
        }
      }
      const lista = listarMembros()
        .filter((m) => data?.escopo === "eco" || Boolean(m.salas?.[salaId]))
        .map((m) => {
          const on = online.get(m.chave);
          // Perfil só mostra o que a pessoa ainda tem permissão de usar (item vencido/removido some)
          const ins = insigniasPorPessoa.get(m.chave) || [];
          const pk = perksAtivosMembro(m.chave);
          const vivo: any = on ? rooms.get(on.salaId)?.participants.get(on.socketId) : null;
          const chefe = Boolean((m as any).ehDono) || ins.includes("singularidade") || coFundadores.has(m.chave) || Boolean(vivo?.isMaster);
          const vipOk = chefe || ins.includes("vip_role") || Boolean(pk.vip_role);
          const libera = {
            avatar: vipOk || Boolean(pk.gif_avatar),
            banner: chefe || ins.includes("nitro_owner") || Boolean(pk.custom_banner),
            titulo: vipOk || Boolean(pk.custom_title),
          };
          return {
            chave: m.chave,
            nome: m.nome,
            tag: m.tag,
            avatarUrl: vivo ? vivo.avatarUrl : libera.avatar ? m.avatarUrl : undefined,
            avatarEmoji: m.avatarEmoji,
            avatarColor: m.avatarColor,
            badges: insigniasPorPessoa.get(m.chave) || [],
            isCofundador: coFundadores.has(m.chave),
            ehDono: Boolean((m as any).ehDono) || Boolean(vivo?.isMaster),
            purchasedPerks: ehMaster ? perksAtivosMembro(m.chave) : undefined,
            memberSince: m.primeiroAcesso,
            bannerUrl: vivo ? vivo.bannerUrl : libera.banner ? m.bannerUrl : undefined,
            bannerColor: vivo ? vivo.bannerColor : m.bannerColor,
            customStatus: vivo ? vivo.customStatus : m.customStatus,
            customTitle: vivo ? vivo.customTitle : libera.titulo ? m.customTitle : undefined,
            bio: vivo ? vivo.bio : m.bio,
            cargo: m.cargo,
            poderes: m.poderes || [],
            // aura do card (aparece pra todo mundo, inclusive offline)
            ...(() => {
              if (chefe) return {};
              const a = auraDoMembro(m.chave);
              const auraLoja = vivo ? vivo.auraLoja : auraLojaDoMembro(m.chave);
              return { ...(a.liberada ? { auraLiberada: true, auraLiberadaPor: a.por, auraCard: a.config } : {}), ...(auraLoja ? { auraLoja } : {}) };
            })(),
            vistoEm: data?.escopo === "eco" ? m.vistoEm : m.salas?.[salaId]?.vistoEm || m.vistoEm,
            online: ehMaster ? Boolean(on) : Boolean(on && on.salaId === salaId),
            salaId: ehMaster ? on?.salaId : undefined,
            salaNome: ehMaster ? on?.salaNome : undefined,
            socketId: ehMaster || on?.salaId === salaId ? on?.socketId : undefined,
            // Só pro Dono Master / Co-fundador: está invisível agora (e onde) + última sala (pra entrar invisível)
            ...(ehMaster && invisivelAgora.has(m.chave)
              ? { invisivel: true, invisivelSalaId: invisivelAgora.get(m.chave)!.salaId, invisivelSalaNome: invisivelAgora.get(m.chave)!.salaNome }
              : {}),
            ...(ehMaster
              ? (() => {
                  const ult = Object.entries(m.salas || {}).sort((a, b) => (b[1]?.vistoEm || 0) - (a[1]?.vistoEm || 0))[0];
                  return ult ? { ultimaSalaId: ult[0], ultimaSalaNome: ult[1]?.nome } : {};
                })()
              : {}),
          };
        })
        .sort((a, b) => Number(b.online) - Number(a.online) || b.vistoEm - a.vistoEm)
        .slice(0, 500);
      callback({ success: true, membros: lista });
    });

    // Dono Master vê tudo que a pessoa já comprou na loja (ativo e vencido)
    socket.on("membros:compras", (data: { alvo: string; masterToken?: string }, callback) => {
      if (typeof callback !== "function") return;
      const req: any = currentRoomId ? rooms.get(currentRoomId)?.participants.get(socket.id) : null;
      if (!validateServerMasterAuth(data?.masterToken).isMaster && !req?.isMaster && !req?.isCofundador) return callback({ success: false, compras: {} });
      const alvo = String(data?.alvo || "");
      let chave = alvo.startsWith("membro:") ? alvo.slice(7) : "";
      let perksAgora: Record<string, number> = {};
      if (!chave) for (const r of rooms.values()) { const p: any = r.participants.get(alvo); if (p) { chave = chaveVip(p); perksAgora = p.purchasedPerks || {}; } }
      if (chave && !Object.keys(perksAgora).length) perksAgora = perksAtivosMembro(chave);
      const compras: Record<string, any> = { ...comprasMembro(chave) };
      // garante que o que está ativo agora aparece, mesmo se veio antes do histórico existir
      for (const [id, ate] of Object.entries(perksAgora)) {
        if (!compras[id]) compras[id] = { primeira: undefined, ultima: undefined, ate, vezes: 1 };
        else if (Number(ate) > compras[id].ate) compras[id] = { ...compras[id], ate, removido: false };
      }
      callback({ success: true, compras });
    });

    // Membro sai do servidor/sala (portinha): some da lista de membros dela
    socket.on("sala:sair", (data: { roomId?: string }, callback?: any) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const salaId = (data?.roomId ? normalizeRoomId(data.roomId) : "") || currentRoomId || "";
      let eu: any = null;
      for (const r of rooms.values()) { const p = r.participants.get(socket.id); if (p) { eu = p; break; } }
      if (!eu || !salaId) return responder({ success: false, message: "Entre numa sala primeiro." });
      sairDaSala(chaveVip(eu), salaId);
      const r = rooms.get(salaId);
      if (r) io.to(salaId).emit("membros:mudou", { roomId: salaId });
      responder({ success: true });
    });

    // Dono Master dá ou tira cargo (texto vazio = volta a ser "Membro")
    socket.on("membros:cargo", (data: { alvo: string; cargo: string; poderes?: string[]; masterToken?: string }, callback) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const req: any = currentRoomId ? rooms.get(currentRoomId)?.participants.get(socket.id) : null;
      const ehMasterCargo = validateServerMasterAuth(data?.masterToken).isMaster || Boolean(req?.isMaster);
      if (!ehMasterCargo && !req?.isCofundador) return responder({ success: false, message: "Apenas o Dono pode mudar cargos." });
      const alvo = String(data?.alvo || "");
      let chave = alvo.startsWith("membro:") ? alvo.slice(7) : "";
      let alvoP: any = null;
      if (!chave) for (const r of rooms.values()) { const p = r.participants.get(alvo); if (p) { chave = chaveVip(p); alvoP = p; } }
      if (!ehMasterCargo && (alvoP?.isMaster || alvoP?.isCofundador || coFundadores.has(chave) || chave === chaveVip(req))) return responder({ success: false, message: "O Co-fundador só muda cargo dos membros." });
      if (!chave || !definirCargo(chave, data?.cargo || "", data?.poderes)) return responder({ success: false, message: "Membro não encontrado." });
      const cargo = cargoMembro(chave);
      for (const [rid, r] of rooms) {
        for (const [, p] of r.participants) {
          if (chaveVip(p) !== chave) continue;
          (p as any).cargo = cargo;
          (p as any).poderes = poderesMembro(chave);
          io.to(rid).emit("room:user-updated", p);
          broadcastRoomState(r);
        }
      }
      responder({ success: true, cargo: cargo || "", poderes: poderesMembro(chave) });
    });

    // Dono Master ou Co-fundador libera (ou tira) a troca de aura do card de um membro.
    // alvo = socket id (online) ou "membro:<chave>" (offline / outra sala). Tirar apaga a aura personalizada.
    socket.on("membros:aura-liberar", (data: { alvo: string; liberado: boolean; masterToken?: string }, callback?: any) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const req: any = currentRoomId ? rooms.get(currentRoomId)?.participants.get(socket.id) : null;
      const ehMasterReq = validateServerMasterAuth(data?.masterToken).isMaster || Boolean(req?.isMaster);
      const ehCofReq = !ehMasterReq && Boolean(req?.isCofundador);
      if (!ehMasterReq && !ehCofReq) return responder({ success: false, message: "Só o Dono Master ou o Co-fundador liberam a aura." });
      const alvo = String(data?.alvo || "");
      let chave = alvo.startsWith("membro:") ? alvo.slice(7) : "";
      let alvoP: any = null;
      if (!chave) for (const r of rooms.values()) { const p = r.participants.get(alvo); if (p) { chave = chaveVip(p); alvoP = p; } }
      if (!chave || !membroPorChave(chave)) return responder({ success: false, message: "Membro não encontrado." });
      if (!alvoP) for (const r of rooms.values()) for (const p of r.participants.values()) if (chaveVip(p) === chave) alvoP = p;
      // Dono Master e Co-fundadores têm aura fixa: ninguém mexe
      const alvoChefe = Boolean(alvoP?.isMaster || alvoP?.isCofundador || membroPorChave(chave)?.ehDono || coFundadores.has(chave) || (insigniasPorPessoa.get(chave) || []).includes("singularidade"));
      if (alvoChefe) return responder({ success: false, message: "A aura do Dono Master e dos Co-fundadores é fixa." });
      if (req && chave === chaveVip(req)) return responder({ success: false, message: "Você não pode liberar a sua própria aura." });
      const liberado = Boolean(data?.liberado);
      liberarAuraMembro(chave, liberado, ehMasterReq ? "dono" : "cofundador");
      for (const [rid, r] of rooms) {
        let mexeu = false;
        for (const [, p] of r.participants) {
          if (chaveVip(p) !== chave) continue;
          aplicarAura(p);
          io.to(rid).emit("room:user-updated", p);
          mexeu = true;
        }
        if (mexeu) broadcastRoomState(r);
      }
      const a = auraDoMembro(chave);
      responder({ success: true, auraLiberada: a.liberada, auraLiberadaPor: a.por });
    });

    // Membro salva (ou remove, com config null) a própria aura do card. Só com auraLiberada.
    // Dono Master e Co-fundador não usam isso: as auras deles são fixas.
    socket.on("user:aura-salvar", (data: { config?: any; remover?: boolean }, callback?: any) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const room = currentRoomId ? rooms.get(currentRoomId) : undefined;
      const eu: any = room?.participants.get(socket.id);
      if (!room || !eu) return responder({ success: false, message: "Entre numa sala primeiro." });
      if (eu.isMaster || eu.isCofundador) return responder({ success: false, message: "Sua aura é fixa." });
      const chave = chaveVip(eu);
      const remover = Boolean(data?.remover) || !data?.config || typeof data.config !== "object";
      const r = salvarAuraMembro(chave, remover ? null : data.config);
      if (r === false) return responder({ success: false, message: "Sua aura ainda não foi liberada pelo Dono Master ou Co-fundador." });
      for (const [rid, rm] of rooms) {
        for (const [, p] of rm.participants) {
          if (chaveVip(p) !== chave) continue;
          aplicarAura(p);
          io.to(rid).emit("room:user-updated", p);
        }
      }
      responder({ success: true, auraCard: r || null });
    });

    // "Aura do card" da loja: a pessoa escolhe uma das cores prontas (ou null pra tirar).
    // O servidor confere se ela tem o item ativo (comprado, não vencido e não removido pelo Dono).
    socket.on("user:aura-loja", (data: { cor?: string | null }, callback?: any) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const room = currentRoomId ? rooms.get(currentRoomId) : undefined;
      const eu: any = room?.participants.get(socket.id);
      if (!room || !eu) return responder({ success: false, message: "Entre numa sala primeiro." });
      if (eu.isMaster || eu.isCofundador) return responder({ success: false, message: "Sua aura é fixa." });
      const cor = data?.cor ? String(data.cor) : null;
      if (cor && !CORES_AURA_LOJA.includes(cor)) return responder({ success: false, message: "Cor inválida." });
      const ativo = Number(eu.purchasedPerks?.aura_card || 0) > Date.now();
      if (cor && !ativo) return responder({ success: false, message: "Compre a Aura do card na loja primeiro." });
      const chave = chaveVip(eu);
      if (!salvarAuraLojaMembro(chave, cor)) return responder({ success: false, message: "Não deu pra salvar agora." });
      for (const [rid, rm] of rooms) {
        for (const [, p] of rm.participants) {
          if (chaveVip(p) !== chave) continue;
          aplicarAura(p);
          io.to(rid).emit("room:user-updated", p);
        }
      }
      responder({ success: true, auraLoja: eu.auraLoja || null });
    });

    // Dono Master remove um item comprado na loja (e o que ele liberava: banner, foto, título, VIP...)
    socket.on("loja:remover-item", (data: { alvo: string; itemId: string; masterToken?: string }, callback) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const req: any = currentRoomId ? rooms.get(currentRoomId)?.participants.get(socket.id) : null;
      if (!validateServerMasterAuth(data?.masterToken).isMaster && !req?.isMaster) return responder({ success: false, message: "Apenas o Dono pode remover itens." });
      const itemId = String(data?.itemId || "").slice(0, 60);
      const alvo = String(data?.alvo || "");
      let chave = alvo.startsWith("membro:") ? alvo.slice(7) : "";
      if (!chave) for (const r of rooms.values()) { const p = r.participants.get(alvo); if (p) chave = chaveVip(p); }
      if (!chave || !itemId) return responder({ success: false, message: "Membro não encontrado." });
      let ateConhecido = 0;
      let mexeu = false;
      for (const [rid, r] of rooms) {
        for (const [sid, p] of r.participants) {
          if (chaveVip(p) !== chave) continue;
          const pp: any = p;
          ateConhecido = Math.max(ateConhecido, Number(pp.purchasedPerks?.[itemId] || 0));
          if (pp.purchasedPerks) { pp.purchasedPerks = { ...pp.purchasedPerks }; delete pp.purchasedPerks[itemId]; }
          const temPerk = (id: string) => Number(pp.purchasedPerks?.[id] || 0) > Date.now();
          if (itemId === "vip_role") p.badges = (p.badges || []).filter((b: string) => b !== "vip_role");
          if (itemId === "aura_card") delete pp.auraLoja;
          const vip = temPerk("vip_role") || (p.badges || []).some((b: string) => INSIGNIAS_LIBERAM_PERFIL.includes(b));
          const podeAvatar = Boolean(p.vipPermissions?.canEditAdvancedProfile || p.vipPermissions?.canUseGifAvatar || temPerk("gif_avatar") || vip);
          const podeBanner = Boolean((p.badges || []).includes("nitro_owner") || pp.isCofundador || temPerk("custom_banner"));
          const podeTitulo = Boolean(temPerk("custom_title") || vip || p.vipPermissions?.canEditAdvancedProfile);
          const limpar = { avatar: !podeAvatar && Boolean(p.avatarUrl), banner: !podeBanner && Boolean(p.bannerUrl), titulo: !podeTitulo && Boolean(pp.customTitle) };
          if (limpar.avatar) p.avatarUrl = undefined;
          if (limpar.banner) p.bannerUrl = undefined;
          if (limpar.titulo) pp.customTitle = undefined;
          io.to(sid).emit("loja:itens-removidos", { itens: [itemId], limpar, badges: p.badges });
          io.to(rid).emit("room:user-updated", p);
          broadcastRoomState(r);
          mexeu = true;
        }
      }
      if (!mexeu && !membroPorChave(chave)) return responder({ success: false, message: "Membro não encontrado." });
      if (itemId === "vip_role" && insigniasPorPessoa.has(chave)) insigniasPorPessoa.set(chave, (insigniasPorPessoa.get(chave) || []).filter((b) => b !== "vip_role"));
      removerPerkMembro(chave, itemId, ateConhecido);
      responder({ success: true });
    });

    // Dar/tirar insígnias de quem está offline (ou em outra sala), pela chave da pessoa
    socket.on("membros:insignias", (data: { chave: string; badges: string[]; masterToken?: string }, callback) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const chave = String(data?.chave || "");
      if (!chave || !membroPorChave(chave)) return responder({ success: false, message: "Membro não encontrado." });
      const req: any = currentRoomId ? rooms.get(currentRoomId)?.participants.get(socket.id) : null;
      const isMasterAuth = validateServerMasterAuth(data.masterToken).isMaster || Boolean(req?.isMaster);
      // Offline / outra sala: Dono Master ou Co-fundador (este só nos membros: nunca no Dono nem em outro Co-fundador)
      const ehCofReq = !isMasterAuth && Boolean(req?.isCofundador);
      if (!isMasterAuth && !ehCofReq) return responder({ success: false, message: "Apenas o Dono pode gerenciar insígnias." });
      if (ehCofReq && (membroPorChave(chave)?.ehDono || coFundadores.has(chave) || chave === chaveVip(req))) {
        return responder({ success: false, message: "O Co-fundador só mexe nas insígnias dos membros." });
      }
      const atuais = insigniasPorPessoa.get(chave) || [];
      const pedidas = (Array.isArray(data.badges) ? data.badges : []).filter(
        (b) => typeof b === "string" && (b === "nitro_owner" || !b.includes("owner")) && b !== "koki_creator" && b !== "singularidade"
      );
      // Dono Master: a lista dele vale (dá e tira tudo). Co-fundador: dá e tira as comuns.
      let finais = isMasterAuth ? Array.from(new Set(pedidas)) : insigniasPeloCofundador(atuais, data.badges);
      if (coFundadores.has(chave) && !finais.includes("cofundador")) {
        if (isMasterAuth) coFundadores.delete(chave);
        else finais.push("cofundador");
      }
      if (isMasterAuth && finais.includes("cofundador")) coFundadores.add(chave);
      insigniasPorPessoa.set(chave, finais);
      if (finais.some((b) => INSIGNIAS_LIBERAM_PERFIL.includes(b)) && !vipPorPessoa.get(chave)) {
        vipPorPessoa.set(chave, { canUseGifAvatar: true, canUseVideoMp4Banner: finais.includes("nitro_owner"), canEditAdvancedProfile: true, hasVipBadge: finais.includes("vip_granted"), grantedAt: Date.now(), expiresAt: null, grantedBy: socket.id });
      }
      // Se a pessoa estiver online em alguma sala, atualiza na hora
      for (const [rid, r] of rooms) {
        for (const [sid, p] of r.participants) {
          if (chaveVip(p) !== chave) continue;
          restaurarVip(p);
          p.badges = [...finais];
          if (!coFundadores.has(chave)) { (p as any).isCofundador = false; delete (p as any).tagExibida; }
          io.to(rid).emit("room:user-updated", p);
          io.to(sid).emit("badges:assigned", { badges: p.badges });
        }
      }
      responder({ success: true, badges: finais });
    });

    socket.on("host:assign-badges", (data: { targetSocketId: string; badges: string[]; masterToken?: string; roomId?: string }, callback) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inexistente" });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = validateServerMasterAuth(data.masterToken).isMaster || Boolean((requester as any)?.isMaster);
      // Criar a sala não dá poder nenhum: só o Dono Master (e quem ele deu cargo)
      const isRoomHost = false;

      const isCofundadorReq = Boolean((requester as any)?.isCofundador);
      if (!isMasterAuth && !isRoomHost && !isCofundadorReq) {
        if (typeof callback === "function") callback({ success: false, message: "Apenas o Dono pode gerenciar insígnias." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado na sala." });
        return;
      }
      if (!isMasterAuth && ((target as any).isMaster || ((target as any).isCofundador && target !== requester))) {
        if (typeof callback === "function") callback({ success: false, message: "O Co-fundador só mexe nos membros." });
        return;
      }

      // Dono Master: dá e tira qualquer uma (menos Criador/Singularidade, que é só dele).
      // Co-fundador: dá E tira as comuns; não mexe nas do Dono (Criador, Co-fundador, "owner").
      const filteredBadges = (Array.isArray(data.badges) ? data.badges : []).filter(
        (b) => typeof b === "string" && (b === "nitro_owner" || !b.includes("owner")) && b !== "koki_creator" && b !== "singularidade"
      );
      const finalBadges = isMasterAuth
        ? Array.from(new Set(filteredBadges))
        : insigniasPeloCofundador(target.badges || [], Array.isArray(data.badges) ? data.badges : []);
      // Co-fundador: a insígnia acompanha o cargo
      if ((target as any).isCofundador && !finalBadges.includes("cofundador")) {
        if (isMasterAuth) {
          // Dono tirou a insígnia Co-fundador no painel: tira o cargo junto
          (target as any).isCofundador = false;
          delete (target as any).tagExibida;
          coFundadores.delete(chaveVip(target));
        } else {
          finalBadges.push("cofundador");
        }
      }
      if (isMasterAuth && finalBadges.includes("cofundador") && !(target as any).isCofundador) { aplicarCofundador(target); coFundadores.add(chaveVip(target)); }
      filteredBadges.length = 0; filteredBadges.push(...finalBadges);

      target.badges = filteredBadges;
      insigniasPorPessoa.set(chaveVip(target), [...filteredBadges]);

      // Ganhou a insígnia VIP do Dono = libera editar o perfil (foto/GIF, banner, título), sem prazo
      if (filteredBadges.some((b) => INSIGNIAS_LIBERAM_PERFIL.includes(b)) && !target.vipPermissions?.canEditAdvancedProfile) {
        target.vipPermissions = {
          canUseGifAvatar: true,
          canUseVideoMp4Banner: filteredBadges.includes("nitro_owner"),
          canEditAdvancedProfile: true,
          hasVipBadge: filteredBadges.includes("vip_granted"),
          grantedAt: Date.now(),
          expiresAt: null,
          grantedBy: socket.id,
        } as any;
        vipPorPessoa.set(chaveVip(target), { ...target.vipPermissions });
        io.to(data.targetSocketId).emit("vip:granted", { participant: target, permissions: target.vipPermissions, durationMinutes: null, message: "Você ganhou a insígnia VIP e agora pode editar seu perfil!" });
      }

      // Broadcast user updated to sync all participants in the room
      io.to(targetRoomId).emit("room:user-updated", target);

      // Direct notification to target socket
      io.to(data.targetSocketId).emit("badges:assigned", {
        badges: target.badges,
        message: "O Dono da Sala atualizou suas insígnias!",
      });

      // System chat announcement
      const badgeMsg: ServerChatMessage = {
        id: `sys-badge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channelId: "geral",
        senderId: "system",
        senderName: "eco Bot",
        senderAvatarEmoji: "🎖️",
        text: `🎖️ **${requester?.name || "O Dono"}** atualizou as insígnias de **${target.name}**!`,
        timestamp: Date.now(),
        isSystem: true,
      };
      const gMsgs = room.messagesByChannel.get("geral");
      if (gMsgs) {
        gMsgs.push(badgeMsg);
        if (gMsgs.length > 100) gMsgs.shift();
      }
      io.to(targetRoomId).emit("room:chat-message", badgeMsg);

      if (typeof callback === "function") {
        callback({
          success: true,
          badges: target.badges,
          message: `Insígnias atualizadas para ${target.name} com sucesso!`,
        });
      }
    });

    // 5. Update Profile - Strictly Enforce Master or Granted VIP for Custom Avatar/Banner/Media
    socket.on("user:update-profile", (updates: Partial<ServerParticipant> & { masterToken?: string; roomId?: string }) => {
      const targetRoomId = currentRoomId || updates.roomId;
      if (!targetRoomId) return;
      const room = rooms.get(targetRoomId);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant) {
        const safeUpdates = { ...updates };
        delete (safeUpdates as any).isHost;
        delete (safeUpdates as any).id;
        delete (safeUpdates as any).vipPermissions;
        delete (safeUpdates as any).masterToken;
        delete (safeUpdates as any).roomId;
        delete (safeUpdates as any).isMaster;
        delete (safeUpdates as any).isCofundador;
        // Campos que só o servidor controla (mute do Dono, tela/câmera, cargo, tag de exibição...)
        for (const k of ["isMutedByHost", "tagExibida", "temConta", "isScreenSharing", "hasVideo", "hasAudio", "isDeafened", "joinedAt", "voiceChannelId", "cargo", "poderes", "auraLiberada", "auraLiberadaPor", "auraCard", "aura", "auraLoja"]) delete (safeUpdates as any)[k];

        // "Membro desde": data do primeiro acesso (não aceita data no futuro nem absurda)
        delete (safeUpdates as any).memberSince;
        const desde = Number((updates as any).memberSince);
        if (Number.isFinite(desde) && desde > 1600000000000 && desde <= Date.now() + 60000) {
          (participant as any).memberSince = Math.floor(desde);
        }

        // Itens comprados na loja (id -> válido até). Limita a 1 ano pra frente.
        delete (safeUpdates as any).purchasedPerks;
        const perksRecebidos = (updates as any).purchasedPerks;
        let itensRemovidosAgora: string[] = [];
        const perksAntes: Record<string, number> = { ...((participant as any).purchasedPerks || {}) };
        if (perksRecebidos && typeof perksRecebidos === "object") {
          const PERKS_VALIDOS = ["gif_avatar", "custom_banner", "custom_title", "vip_role", "ring_nebulosa", "ring_aurora", "banner_nebulosa", "aura_card"];
          const limite = Date.now() + 366 * 24 * 3600 * 1000;
          const limpos: Record<string, number> = {};
          for (const id of PERKS_VALIDOS) {
            const ate = Number(perksRecebidos[id]);
            if (Number.isFinite(ate) && ate > Date.now()) limpos[id] = Math.min(ate, limite);
          }
          // O que o Dono removeu não volta (mesmo que o navegador da pessoa ainda tenha guardado)
          const filtro = filtrarPerks(chaveVip(participant), limpos);
          if (filtro.removidos.length) {
            for (const id of filtro.removidos) delete limpos[id];
            itensRemovidosAgora = filtro.removidos;
          }
          (participant as any).purchasedPerks = limpos;
          // Raio-X: conta compra nova (item que não tinha ou que foi renovado)
          for (const [id, ate] of Object.entries(limpos)) {
            if (!perksAntes[id] || ate > perksAntes[id] + 60000) {
              if (perksSincronizados.has(participant)) registrarCompra(participant.name, id);
            }
          }
          perksSincronizados.add(participant);
        }
        const temPerk = (id: string) => Number((participant as any).purchasedPerks?.[id] || 0) > Date.now();

        // Verify if user is truly the authenticated Master Owner OR has explicit VIP permissions from Master
        const masterAuth = validateServerMasterAuth(updates.masterToken);
        const isAuthenticMaster = Boolean(masterAuth.isMaster);
        const vipComprado = temPerk("vip_role") || (participant.badges || []).some((b: string) => INSIGNIAS_LIBERAM_PERFIL.includes(b));
        const podeAvatar = Boolean(
          participant.vipPermissions?.canEditAdvancedProfile || participant.vipPermissions?.canUseGifAvatar || temPerk("gif_avatar") || vipComprado
        );
        // Banner: só VIP Nitro, Co-fundador ou quem comprou o Banner na loja. VIP normal troca só a foto.
        const podeBanner = Boolean(
          (participant.badges || []).includes("nitro_owner") || (participant as any).isCofundador || temPerk("custom_banner")
        );

        // Voltou com item que o Dono removeu: tira também o que ele liberava
        if (itensRemovidosAgora.length && !isAuthenticMaster) {
          if (itensRemovidosAgora.includes("vip_role")) participant.badges = (participant.badges || []).filter((b: string) => b !== "vip_role");
          const vipAinda = temPerk("vip_role") || (participant.badges || []).some((b: string) => INSIGNIAS_LIBERAM_PERFIL.includes(b));
          const limpar = {
            avatar: !(podeAvatar && (vipAinda || temPerk("gif_avatar") || participant.vipPermissions?.canEditAdvancedProfile || participant.vipPermissions?.canUseGifAvatar)) && Boolean(participant.avatarUrl || safeUpdates.avatarUrl),
            banner: !podeBanner && Boolean(participant.bannerUrl || safeUpdates.bannerUrl),
            titulo: !(temPerk("custom_title") || vipAinda || participant.vipPermissions?.canEditAdvancedProfile) && Boolean((participant as any).customTitle || (safeUpdates as any).customTitle),
          };
          if (limpar.avatar) { participant.avatarUrl = undefined; delete safeUpdates.avatarUrl; }
          if (limpar.banner) { participant.bannerUrl = undefined; delete safeUpdates.bannerUrl; }
          if (limpar.titulo) { (participant as any).customTitle = undefined; delete (safeUpdates as any).customTitle; }
          socket.emit("loja:itens-removidos", { itens: itensRemovidosAgora, limpar, badges: participant.badges });
        }

        // Sem Master, VIP ou item comprado: não pode foto/GIF de avatar nem banner próprio
        if (!isAuthenticMaster && !podeAvatar) delete safeUpdates.avatarUrl;
        if (!isAuthenticMaster && !podeBanner) delete safeUpdates.bannerUrl;
        if (!isAuthenticMaster && !temPerk("custom_title") && !vipComprado && !participant.vipPermissions?.canEditAdvancedProfile) delete (safeUpdates as any).customTitle;
        if (typeof (safeUpdates as any).customTitle === "string") (safeUpdates as any).customTitle = (safeUpdates as any).customTitle.slice(0, 24);
        if (typeof safeUpdates.avatarUrl === "string" && safeUpdates.avatarUrl.length > 9_000_000) delete safeUpdates.avatarUrl;
        if (typeof safeUpdates.bannerUrl === "string" && safeUpdates.bannerUrl.length > 9_000_000) delete safeUpdates.bannerUrl;

        // Master always gets tag #0001
        if (isAuthenticMaster) {
          participant.tag = MASTER_TAG;
          safeUpdates.tag = MASTER_TAG;
        } else {
          // Regular users cannot set tag to 0001 or any reserved master tag
          if (safeUpdates.tag && isReservedTag(safeUpdates.tag)) {
            delete safeUpdates.tag;
          }
          // Insígnias são do servidor: o cliente não muda a lista (senão uma lista velha
          // do navegador apaga o que o Dono acabou de dar ou volta o que ele tirou).
          // Só acrescenta o "VIP" comprado na loja, se ainda estiver valendo.
          if (Array.isArray(safeUpdates.badges)) {
            const atuais = [...(participant.badges || [])];
            if (temPerk("vip_role") && safeUpdates.badges.includes("vip_role") && !atuais.includes("vip_role")) atuais.push("vip_role");
            safeUpdates.badges = atuais;
          }
        }

        if (safeUpdates.name) safeUpdates.name = safeUpdates.name.slice(0, 32);
        if (safeUpdates.customStatus) safeUpdates.customStatus = safeUpdates.customStatus.slice(0, 60);
        if (safeUpdates.bio) safeUpdates.bio = safeUpdates.bio.slice(0, 160);

        const chaveAntesPerfil = chaveVip(participant);
        Object.assign(participant, safeUpdates);
        registrarMembro(chaveVip(participant), participant, undefined, chaveAntesPerfil);
        aplicarDesdeECargo(participant);
        if ((participant as any).purchasedPerks) salvarPerksMembro(chaveVip(participant), (participant as any).purchasedPerks);
        // Dono mudou as próprias insígnias: salva pra não voltar ao entrar de novo
        if (isAuthenticMaster && Array.isArray(safeUpdates.badges)) insigniasPorPessoa.set(chaveVip(participant), [...safeUpdates.badges]);
        { const idA = ((socket.data as any)?.amigoId as string | undefined) || uidDoParticipante.get(participant); if (idA) atualizarPerfilAmigo(idA, participant); }
        io.to(targetRoomId).emit("room:user-updated", participant);
        broadcastRoomState(room);
      }
    });

    // 6. State updates (Audio/Video/Screen)
    // BUG antigo: normalizeRoomId(undefined) devolvia "main-lounge", então este evento nunca achava
    // a sala e o servidor nunca sabia quem estava com tela/câmera ligada. Qualquer room:user-updated
    // (Dono mexendo no perfil) mandava isScreenSharing:false e a tela sumia pra quem assistia.
    // Agora: usa a sala atual e só aceita os campos de mídia (nada de cargo, mute do Dono, perfil...).
    socket.on("room:state-update", (updates: Partial<ServerParticipant> & { roomId?: string; audioLevel?: number }) => {
      const targetRoomId = currentRoomId || (updates?.roomId ? normalizeRoomId(updates.roomId) : "");
      if (!targetRoomId) return;
      const room = rooms.get(targetRoomId);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant && updates && typeof updates === "object") {
        let mudou = false;
        for (const k of ["hasAudio", "hasVideo", "isScreenSharing", "isDeafened"] as const) {
          if (typeof (updates as any)[k] === "boolean" && (participant as any)[k] !== (updates as any)[k]) {
            (participant as any)[k] = (updates as any)[k];
            mudou = true;
          }
        }
        // Mutado pelo Dono não "liga" o mic sozinho
        if (participant.isMutedByHost && participant.hasAudio) { participant.hasAudio = false; mudou = true; }
        const moedas = Number((updates as any).kokiCoins);
        if (Number.isFinite(moedas) && moedas >= 0 && moedas <= 999999 && participant.kokiCoins !== Math.floor(moedas)) {
          participant.kokiCoins = Math.floor(moedas);
          mudou = true;
        }
        if (!mudou) return;
        io.to(targetRoomId).emit("room:user-updated", participant);
      }
    });

    // 6.1. Voice Channel Selection & VIP Access Control
    const handleVoiceSelectChannel = (data: { channelId?: string; voiceChannelId?: string; masterToken?: string; roomId?: string }, callback?: any) => {
      const targetRoomId = (data?.roomId ? normalizeRoomId(data.roomId) : "") || currentRoomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inativa" });
        return;
      }

      const participant = room.participants.get(socket.id);
      if (!participant) {
        // Invisível troca de canal em silêncio (ninguém recebe aviso); vale quando ele aparecer
        const g = fantasmas(room).get(socket.id);
        if (g) {
          const pedido = String(data?.channelId || data?.voiceChannelId || "voice-geral");
          const canal = /^[\w-]{1,60}$/.test(pedido) ? pedido : "voice-geral";
          if (canal === "voice-vip" && !(g.isMaster || validateServerMasterAuth(data.masterToken).isMaster)) {
            if (typeof callback === "function") callback({ success: false, message: "Canal restrito ao Dono Master" });
            return;
          }
          g.voiceChannelId = canal;
          emitirInvisiveis(room);
          if (typeof callback === "function") callback({ success: true, channelId: canal });
          return;
        }
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado" });
        return;
      }

      const targetChannelId = data.channelId || data.voiceChannelId || "voice-geral";

      // If user tries to join VIP channel
      if (targetChannelId === "voice-vip") {
        const isMaster = Boolean(participant.isMaster || validateServerMasterAuth(data.masterToken).isMaster);
        if (!isMaster) {
          if (typeof callback === "function") {
            callback({ success: false, message: "Canal restrito ao Dono Master" });
          }
          return;
        }
      }

      participant.voiceChannelId = targetChannelId;
      io.to(targetRoomId).emit("room:user-updated", participant);
      broadcastRoomState(room);

      if (typeof callback === "function") {
        callback({ success: true, channelId: targetChannelId });
      }
    };

    socket.on("voice:select-channel", handleVoiceSelectChannel);
    socket.on("voice:join", handleVoiceSelectChannel);

    // 6.2. Master Drag / Move Members between Voice Channels
    const handleMoveVoiceChannel = (data: {
      targetSocketId: string;
      targetChannelId: string;
      channelName?: string;
      masterToken?: string;
      roomId?: string;
    }, callback?: (res: { success: boolean; message?: string; targetChannelId?: string }) => void) => {
      const targetRoomId = (data?.roomId ? normalizeRoomId(data.roomId) : "") || currentRoomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inativa" });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = Boolean(requester?.isMaster || validateServerMasterAuth(data.masterToken).isMaster);

      if (!isMasterAuth) {
        if (typeof callback === "function") callback({ success: false, message: "Apenas o Dono Master pode mover membros entre canais." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Membro não encontrado na sala." });
        return;
      }

      // Aceita qualquer canal de voz da sala (inclusive os criados nas salas salvas), não só Geral/VIP
      const pedido = String(data.targetChannelId || "");
      const cleanTargetChannelId = /^[\w-]{1,60}$/.test(pedido) ? pedido : "voice-geral";
      target.voiceChannelId = cleanTargetChannelId;

      // Update room state
      io.to(targetRoomId).emit("room:user-updated", target);
      broadcastRoomState(room);

      // Directly notify target client
      const targetSocket = io.sockets.sockets.get(data.targetSocketId);
      if (targetSocket) {
        targetSocket.emit("voice:forced-channel-change", {
          channelId: cleanTargetChannelId,
          channelName: cleanTargetChannelId === "voice-vip" ? "Call VIP" : cleanTargetChannelId === "voice-geral" ? "Geral" : String(data.channelName || "outro canal").slice(0, 40),
          movedBy: requester?.name || "Dono Master",
        });
      }

      // System notification in chat
      const channelName = cleanTargetChannelId === "voice-vip" ? "👑 Call VIP" : cleanTargetChannelId === "voice-geral" ? "🔊 Geral" : `🔊 ${String(data.channelName || "outro canal").slice(0, 40)}`;
      const moveMsg: ServerChatMessage = {
        id: `sys-move-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channelId: "geral",
        senderId: "system",
        senderName: "eco Bot",
        senderAvatarEmoji: "👑",
        text: `👑 **${requester?.name || "Dono Master"}** moveu **${target.name}** para **${channelName}**!`,
        timestamp: Date.now(),
        isSystem: true,
      };

      const gMsgs = room.messagesByChannel.get("geral");
      if (gMsgs) {
        gMsgs.push(moveMsg);
        if (gMsgs.length > 100) gMsgs.shift();
      }
      io.to(targetRoomId).emit("room:chat-message", moveMsg);

      if (typeof callback === "function") {
        callback({
          success: true,
          targetChannelId: cleanTargetChannelId,
          message: `Membro movido para ${channelName} com sucesso!`,
        });
      }
    };

    socket.on("host:move-voice-channel", handleMoveVoiceChannel);
    socket.on("voice:move-member", handleMoveVoiceChannel);

    // 7. Channel Messages & Antivirus Filter
    // 20. Client State Synchronization / Reconnection Query
    socket.on("room:get-state", (payload: { roomId?: string }, callback) => {
      let targetRoomId = payload?.roomId ? normalizeRoomId(payload.roomId) : currentRoomId;
      if (!targetRoomId) {
        for (const [rId, r] of rooms.entries()) {
          if (r.participants.has(socket.id)) {
            targetRoomId = rId;
            currentRoomId = rId;
            break;
          }
        }
      }
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      if (typeof callback === "function") {
        callback({ success: true, room: formatRoomPayload(room) });
      }
    });

    socket.on("room:get-channel-messages", (channelId: string, callback) => {
      let targetRoomId = currentRoomId;
      if (!targetRoomId) {
        for (const [rId, r] of rooms.entries()) {
          if (r.participants.has(socket.id)) {
            targetRoomId = rId;
            currentRoomId = rId;
            break;
          }
        }
      }
      if (!targetRoomId) return;
      const room = rooms.get(targetRoomId);
      if (!room) return;

      const cleanChan = channelId || "geral";
      const msgs = room.messagesByChannel.get(cleanChan) || [];
      if (typeof callback === "function") {
        callback({ channelId: cleanChan, messages: msgs });
      }
    });

    socket.on("room:chat-message", (data: { channelId?: string; text: string; roomId?: string }, callback) => {
      let targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        for (const [rId, r] of rooms.entries()) {
          if (r.participants.has(socket.id)) {
            targetRoomId = rId;
            currentRoomId = rId;
            break;
          }
        }
      }
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala desconhecida" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }

      const participant = room.participants.get(socket.id);
      if (!participant) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não está na sala" });
        return;
      }

      if (!room.settings.allowGuestChat && !participant.isHost) {
        if (typeof callback === "function") callback({ success: false, message: "Chat de convidados desativado" });
        return;
      }

      // Anti-spam: 5 mensagens em 8 s, mesmo texto 3x em 30 s = 30 s sem chat. Máx. 1000 caracteres.
      // Dono Master e Co-fundador são isentos.
      {
        const isento = Boolean((participant as any).isMaster || (participant as any).isCofundador);
        const spam = checarSpam(`sala:${socket.id}`, typeof data?.text === "string" ? data.text : "", isento);
        if (!spam.ok) {
          if (spam.motivo === "spam") socket.emit("chat:timeout", { segundos: spam.segundos, escopo: "sala", mensagem: spam.mensagem });
          if (typeof callback === "function") callback({ success: false, message: spam.mensagem, segundos: spam.motivo === "spam" ? spam.segundos : undefined });
          return;
        }
      }

      const targetChannelId = data.channelId || "geral";
      const { cleanText, isSecurityWarning } = sanitizeAndInspectText(data.text);
      if (!cleanText) return;

      // Ensure socket is joined to the room
      socket.join(targetRoomId);

      // Slash commands
      if (cleanText.startsWith("/") && !isSecurityWarning) {
        const parts = cleanText.split(" ");
        const command = parts[0].toLowerCase();

        if (command === "/roll" || command === "/dado") {
          const maxSides = Math.min(1000, Math.max(2, parseInt(parts[1], 10) || 6));
          const rollResult = Math.floor(Math.random() * maxSides) + 1;
          
          const botMsg: ServerChatMessage = {
            id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            channelId: targetChannelId,
            senderId: "system",
            senderName: "eco Bot",
            senderAvatarEmoji: "🎲",
            text: `🎲 **${participant.name}** rolou um dado (d${maxSides}) e tirou **${rollResult}**!`,
            timestamp: Date.now(),
            isSystem: true,
          };

          const chMsgs = room.messagesByChannel.get(targetChannelId) || [];
          chMsgs.push(botMsg);
          room.messagesByChannel.set(targetChannelId, chMsgs);
          io.to(targetRoomId).emit("room:chat-message", botMsg);
          if (typeof callback === "function") callback({ success: true, message: botMsg });
          return;
        }

        if (command === "/coin" || command === "/moeda") {
          const isHeads = Math.random() > 0.5;
          const resultText = isHeads ? "Cara 👑" : "Coroa 🪙";
          
          const botMsg: ServerChatMessage = {
            id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            channelId: targetChannelId,
            senderId: "system",
            senderName: "eco Bot",
            senderAvatarEmoji: "🪙",
            text: `🪙 **${participant.name}** jogou a moeda: Deu **${resultText}**!`,
            timestamp: Date.now(),
            isSystem: true,
          };

          const chMsgs = room.messagesByChannel.get(targetChannelId) || [];
          chMsgs.push(botMsg);
          room.messagesByChannel.set(targetChannelId, chMsgs);
          io.to(targetRoomId).emit("room:chat-message", botMsg);
          if (typeof callback === "function") callback({ success: true, message: botMsg });
          return;
        }
      }

      // Broadcast sanitized chat message
      const message: ServerChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channelId: targetChannelId,
        senderId: socket.id,
        senderName: participant.name,
        senderAvatarEmoji: participant.avatarEmoji,
        senderAvatarColor: participant.avatarColor,
        senderAvatarUrl: participant.avatarUrl,
        senderIsHost: Boolean((participant as any).isMaster),
        text: cleanText,
        timestamp: Date.now(),
        isSecurityWarning,
      };

      const chMsgs = room.messagesByChannel.get(targetChannelId) || [];
      chMsgs.push(message);
      if (chMsgs.length > 100) chMsgs.shift();
      room.messagesByChannel.set(targetChannelId, chMsgs);

      io.to(targetRoomId).emit("room:chat-message", message);
      if (typeof callback === "function") {
        callback({ success: true, message });
      }
    });

    // Chat: enviar print, foto ou vídeo (até 4 por mensagem)
    socket.on(
      "room:chat-media",
      (
        data: {
          channelId?: string;
          text?: string;
          files?: { uploadId: string; name?: string; width?: number; height?: number; spoiler?: boolean }[];
        },
        callback
      ) => {
        const responder = (v: any) => typeof callback === "function" && callback(v);
        const targetRoomId = currentRoomId;
        const room = targetRoomId ? rooms.get(targetRoomId) : undefined;
        const participant = room?.participants.get(socket.id);
        if (!room || !participant || !targetRoomId) return responder({ success: false, message: "Você não está na sala." });
        if (!room.settings.allowGuestChat && !participant.isHost) {
          return responder({ success: false, message: "Chat de convidados desativado" });
        }
        const files = Array.isArray(data?.files) ? data.files.slice(0, midia.MAX_ANEXOS) : [];
        if (files.length === 0) return responder({ success: false, message: "Nenhum arquivo." });
        {
          const isento = Boolean((participant as any).isMaster || (participant as any).isCofundador);
          const spam = checarSpam(`sala:${socket.id}`, typeof data?.text === "string" ? data.text : "", isento);
          if (!spam.ok) {
            if (spam.motivo === "spam") socket.emit("chat:timeout", { segundos: spam.segundos, escopo: "sala", mensagem: spam.mensagem });
            return responder({ success: false, message: spam.mensagem, segundos: spam.motivo === "spam" ? spam.segundos : undefined });
          }
        }

        // Limite: 6 envios de mídia por minuto
        const agora = Date.now();
        const lim = mediaRateLimiter.get(socket.id) || { count: 0, resetAt: agora + 60000 };
        if (agora > lim.resetAt) {
          lim.count = 0;
          lim.resetAt = agora + 60000;
        }
        lim.count += 1;
        mediaRateLimiter.set(socket.id, lim);
        if (lim.count > 6) return responder({ success: false, message: "Muitos arquivos seguidos. Espere um pouco." });

        const attachments: midia.ChatAttachment[] = [];
        for (const f of files) {
          const m = midia.usarUpload(String(f?.uploadId || ""), socket.id, targetRoomId);
          if (!m) return responder({ success: false, message: "Arquivo expirou. Envie de novo." });
          const nome = String(f.name || (m.kind === "video" ? "video" : "imagem")).replace(/[<>"'`]/g, "").slice(0, 80);
          const id = String(f.uploadId);
          attachments.push({
            id,
            kind: m.kind,
            mime: m.mime,
            name: nome,
            size: m.size,
            url: `/api/media/${id}`,
            width: Number.isFinite(f.width) ? Math.min(10000, Math.max(1, Math.floor(f.width as number))) : undefined,
            height: Number.isFinite(f.height) ? Math.min(10000, Math.max(1, Math.floor(f.height as number))) : undefined,
            spoiler: Boolean(f.spoiler),
          });
        }

        const { cleanText, isSecurityWarning } = data.text ? sanitizeAndInspectText(String(data.text)) : { cleanText: "", isSecurityWarning: false };
        const targetChannelId = data.channelId || "geral";
        const message: ServerChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          channelId: targetChannelId,
          senderId: socket.id,
          senderName: participant.name,
          senderAvatarEmoji: participant.avatarEmoji,
          senderAvatarColor: participant.avatarColor,
          senderAvatarUrl: participant.avatarUrl,
          senderIsHost: Boolean((participant as any).isMaster),
          text: cleanText,
          timestamp: Date.now(),
          isSecurityWarning,
          attachments,
        };
        const chMsgs = room.messagesByChannel.get(targetChannelId) || [];
        chMsgs.push(message);
        if (chMsgs.length > 100) chMsgs.shift();
        room.messagesByChannel.set(targetChannelId, chMsgs);
        io.to(targetRoomId).emit("room:chat-message", message);
        responder({ success: true, message });
      }
    );

    // 8. Host Master Actions
    socket.on("host:action", (action: {
      type: "mute-user" | "unmute-user" | "kick-user" | "toggle-lock" | "update-settings" | "mute-all" | "claim-host" | "close-room";
      targetUserId?: string;
      settings?: Partial<ServerRoom["settings"]>;
      passcode?: string;
    }, callback) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const requester = room.participants.get(socket.id);
      if (!requester) return;

      if (action.type === "claim-host") {
        if (room.hostPasscodeHash && action.passcode && room.hostPasscodeHash === action.passcode.trim()) {
          if (room.hostSocketId && room.participants.has(room.hostSocketId)) {
            const prev = room.participants.get(room.hostSocketId)!;
            prev.isHost = false;
            io.to(currentRoomId).emit("room:user-updated", prev);
          }
          requester.isHost = true;
          room.hostSocketId = socket.id;
          io.to(currentRoomId).emit("room:user-updated", requester);
          if (typeof callback === "function") callback({ success: true, hostSecretToken: room.hostSecretToken, message: "Você assumiu o controle Master da sala!" });
          return;
        } else {
          if (typeof callback === "function") callback({ success: false, message: "Senha master incorreta." });
          return;
        }
      }

      // Cargo com poder: Moderador pode mutar/expulsar (nunca o Dono da sala nem o Dono Master)
      if ((action.type === "mute-user" || action.type === "unmute-user" || action.type === "kick-user") && action.targetUserId && !(requester as any).isMaster) {
        const poder = action.type === "kick-user" ? "expulsar" : "mutar";
        const alvo: any = room.participants.get(action.targetUserId);
        const ehCofReq = Boolean((requester as any).isCofundador);
        const protegido = !alvo || alvo.isMaster || (alvo.isCofundador && alvo !== requester) || (alvo.cargo && !(requester as any).isMaster && !ehCofReq);
        if (temPoder(room, socket.id, poder) && !protegido) {
          if (action.type === "unmute-user") {
            // Desmutar: só libera o mic (a pessoa liga quando quiser)
            alvo.isMutedByHost = false;
            io.to(action.targetUserId).emit("host:forced-unmute", { por: requester.name });
            io.to(currentRoomId).emit("room:user-updated", alvo);
          } else if (poder === "mutar") {
            alvo.isMutedByHost = true;
            alvo.hasAudio = false;
            io.to(action.targetUserId).emit("host:forced-mute");
            io.to(currentRoomId).emit("room:user-updated", alvo);
          } else {
            const ts = io.sockets.sockets.get(action.targetUserId);
            if (ts) { ts.emit("host:kicked", { reason: `Você foi removido da sala por ${requester.name}.` }); ts.leave(currentRoomId); }
            room.participants.delete(action.targetUserId);
            io.to(currentRoomId).emit("room:user-left", { id: action.targetUserId, name: alvo.name });
          }
          broadcastRoomState(room);
          if (typeof callback === "function") callback({ success: true });
          return;
        }
        if (temPoder(room, socket.id, poder) && protegido) {
          if (typeof callback === "function") callback({ success: false, message: "Você não pode fazer isso com essa pessoa." });
          return;
        }
      }

      // Fechar sala, trancar, configurar, mutar todos: só o Dono Master
      if (!(requester as any).isMaster) {
        if (typeof callback === "function") callback({ success: false, message: "Você não tem permissão pra isso." });
        return;
      }

      if (action.type === "close-room") {
        io.to(currentRoomId).emit("room:closed", {
          reason: "O Dono da chamada encerrou a sala para todos os participantes.",
        });
        // Disconnect room
        midia.apagarMidiasDaSala(currentRoomId);
        rooms.delete(currentRoomId);
        if (typeof callback === "function") {
          callback({ success: true, message: "Sala encerrada com sucesso." });
        }
        return;
      }

      if (action.type === "unmute-user" && action.targetUserId) {
        const target = room.participants.get(action.targetUserId);
        if (target) {
          target.isMutedByHost = false;
          io.to(action.targetUserId).emit("host:forced-unmute", { por: requester.name });
          io.to(currentRoomId).emit("room:user-updated", target);
        }
      } else if (action.type === "mute-user" && action.targetUserId) {
        const target = room.participants.get(action.targetUserId);
        if (target) {
          target.isMutedByHost = true;
          target.hasAudio = false;
          io.to(action.targetUserId).emit("host:forced-mute");
          io.to(currentRoomId).emit("room:user-updated", target);
          broadcastRoomState(room);
        }
      } else if (action.type === "mute-all") {
        room.participants.forEach((p) => {
          if (!p.isHost) {
            p.isMutedByHost = true;
            p.hasAudio = false;
            io.to(p.id).emit("host:forced-mute");
            io.to(currentRoomId).emit("room:user-updated", p);
          }
        });
        broadcastRoomState(room);
      } else if (action.type === "kick-user" && action.targetUserId) {
        const targetSocket = io.sockets.sockets.get(action.targetUserId);
        if (targetSocket) {
          targetSocket.emit("host:kicked", { reason: "Você foi desconectado pelo Dono da chamada." });
          targetSocket.leave(currentRoomId);
        }
        room.participants.delete(action.targetUserId);
        io.to(currentRoomId).emit("room:user-left", { id: action.targetUserId, name: "Participante" });
        broadcastRoomState(room);
      } else if (action.type === "toggle-lock") {
        room.isLocked = !room.isLocked;
        io.to(currentRoomId).emit("room:lock-changed", { isLocked: room.isLocked });
      } else if (action.type === "update-settings" && action.settings) {
        Object.assign(room.settings, action.settings);
        io.to(currentRoomId).emit("room:settings-changed", room.settings);
      }

      if (typeof callback === "function") {
        callback({ success: true });
      }
    });

    // 8.1 Punir — Dono Master e Co-fundador (validado aqui no servidor)
    //   acao "expulsar": tira da call agora (só quem está online)
    //   acao "sala":     bane do servidor/sala (escopo sala:<roomId>), com prazo ou permanente
    //   acao "app":      bane do Eco inteiro, com prazo ou permanente
    // alvo = socket id de quem está online, ou "membro:<chave>" (offline ou em outra sala)
    const quemPedeModeracao = () => {
      const r = currentRoomId ? rooms.get(currentRoomId) : undefined;
      return (r?.participants.get(socket.id) as any) || null;
    };
    const podeBanir = (masterToken?: string) => {
      const req = quemPedeModeracao();
      const ehMaster = validateServerMasterAuth(masterToken).isMaster || Boolean(req?.isMaster);
      const uidReq = (socket.data as any)?.uid as string | undefined;
      const ehCof = !ehMaster && Boolean(req?.isCofundador || (uidReq && coFundadores.has(`uid:${uidReq}`)));
      return { req, ehMaster, ehCof, ok: ehMaster || ehCof };
    };

    socket.on(
      "host:punir",
      (
        data: { alvo: string; acao?: "expulsar" | "sala" | "app"; tipo?: "suspensao" | "permanente"; permanente?: boolean; minutos?: number | null; motivo?: string; salaId?: string; masterToken?: string },
        callback?: any
      ) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const { req, ehCof, ok } = podeBanir(data?.masterToken);
      if (!ok) return responder({ success: false, message: "Só o Dono Master e o Co-fundador podem punir." });
      const acao: "expulsar" | "sala" | "app" = data?.acao === "expulsar" || data?.acao === "sala" ? data.acao : "app";
      const permanente = acao !== "expulsar" && (data?.permanente === true || data?.tipo === "permanente" || data?.minutos === null);
      const minutos = Math.floor(Number(data?.minutos));
      if (acao !== "expulsar" && !permanente && (!Number.isFinite(minutos) || minutos < 1 || minutos > 365 * 24 * 60)) {
        return responder({ success: false, message: "Escolha um tempo válido (de 1 minuto até 365 dias) ou Permanente." });
      }
      const salaId = (data?.salaId ? normalizeRoomId(data.salaId) : "") || currentRoomId || "";
      if (acao === "sala" && !salaId) return responder({ success: false, message: "Não sei de qual sala banir." });

      const alvoTxt = String(data?.alvo || "").slice(0, 800);
      // Acha o alvo: online (qualquer sala) ou registro de membro offline
      let alvoP: any = null;
      let alvoSid: string | null = null;
      let chave = "";
      if (alvoTxt.startsWith("membro:")) {
        chave = alvoTxt.slice(7);
        for (const r of rooms.values()) for (const [sid, p] of r.participants) if (!alvoP && chaveVip(p) === chave) { alvoP = p; alvoSid = sid; }
      } else {
        for (const r of rooms.values()) {
          const p: any = r.participants.get(alvoTxt);
          if (p) { alvoP = p; alvoSid = alvoTxt; chave = chaveVip(p); break; }
        }
      }
      if (!chave) return responder({ success: false, message: "Pessoa não encontrada (talvez já tenha saído)." });
      const membro = membroPorChave(chave);
      if (!alvoP && !membro) return responder({ success: false, message: "Pessoa não encontrada." });
      const uid = chave.startsWith("uid:") ? chave.slice(4) : (alvoP ? uidDoParticipante.get(alvoP) : undefined) || membro?.uid;
      const nomeTag = alvoP ? chaveNomeTag(alvoP) : membro ? chaveNomeTag({ name: membro.nome, tag: membro.tag }) : chave.startsWith("uid:") ? undefined : chave;
      // Ninguém pune o Dono Master; Co-fundador não pune outro Co-fundador (nem a si mesmo)
      if (alvoP?.isMaster || membro?.ehDono) return responder({ success: false, message: "Ninguém pode punir o Dono Master." });
      const alvoEhCof = Boolean(alvoP?.isCofundador || coFundadores.has(chave) || (uid && coFundadores.has(`uid:${uid}`)) || (nomeTag && coFundadores.has(nomeTag)));
      if (ehCof && alvoEhCof) return responder({ success: false, message: "O Co-fundador não pode punir outro Co-fundador." });
      if (alvoSid === socket.id || (req && chave === chaveVip(req)) || (uid && uid === (socket.data as any)?.uid)) return responder({ success: false, message: "Você não pode punir você mesmo." });

      const nome = String(alvoP?.name || membro?.nome || "Membro");

      // Tira alguém de uma sala (sem banir: pode voltar)
      const tirarDaSala = (sid: string, rid: string, evento: string, dados: any) => {
        const r = rooms.get(rid);
        const p: any = r?.participants.get(sid);
        if (!r || !p || p.isMaster) return;
        const ts = io.sockets.sockets.get(sid);
        if (ts) { ts.emit(evento, dados); ts.leave(rid); }
        marcarVisto(chaveVip(p), rid);
        r.participants.delete(sid);
        r.pendingKnocks.delete(sid);
        io.to(rid).emit("room:user-left", { id: sid, name: p.name });
        broadcastRoomState(r);
      };
      const mesmaPessoa = (sid: string, p: any) => sid === alvoSid || (uid && uidDoParticipante.get(p) === uid) || chaveVip(p) === chave;

      if (acao === "expulsar") {
        if (!alvoP) return responder({ success: false, message: `${nome} está offline. Para quem está offline use Banir.` });
        let n = 0;
        for (const [rid, r] of rooms) for (const [sid, p] of Array.from(r.participants.entries())) {
          if (mesmaPessoa(sid, p)) { tirarDaSala(sid, rid, "host:kicked", { reason: `Você foi removido da sala por ${req?.name || "Dono"}.` }); n++; }
        }
        return responder({ success: n > 0, message: n > 0 ? `${nome} foi expulso da call.` : "Não achei essa pessoa na call." });
      }

      const sockAlvo = alvoSid ? io.sockets.sockets.get(alvoSid) : undefined;
      const ip = (sockAlvo ? ipDoSocket(sockAlvo) : undefined) || membro?.lastIp;
      const salaNome = acao === "sala" ? String(rooms.get(salaId)?.roomName || getSalaSalva(salaId)?.roomName || salaId).slice(0, 40) : undefined;
      const b = criarBanimento({
        tipo: permanente ? "permanente" : "suspensao",
        escopo: acao === "sala" ? `sala:${salaId}` : "app",
        salaNome,
        ate: permanente ? null : Date.now() + minutos * 60_000,
        motivo: typeof data?.motivo === "string" ? data.motivo.trim().slice(0, 200) || undefined : undefined,
        uid: uid || undefined,
        // Guarda também nome#tag (convidado, ou conta que entrar deslogada) e o último IP
        chave: nomeTag,
        ip,
        nome,
        tag: String(alvoP?.tag || membro?.tag || ""),
        avatarUrl: typeof (alvoP?.avatarUrl || membro?.avatarUrl) === "string" && !(alvoP?.avatarUrl || membro?.avatarUrl || "").startsWith("data:") ? (alvoP?.avatarUrl || membro?.avatarUrl) : undefined,
        avatarColor: alvoP?.avatarColor || membro?.avatarColor,
        porNome: String(req?.name || "Dono"),
        porChave: req ? chaveVip(req) : undefined,
      });
      const aviso = avisoBanimento(b);

      // Se estiver online: tira agora (da sala banida, ou de todas se for do app)
      for (const [rid, r] of rooms) {
        if (acao === "sala" && rid !== salaId) continue;
        for (const [sid, p] of Array.from(r.participants.entries())) if (mesmaPessoa(sid, p)) tirarDaSala(sid, rid, "ban:bloqueado", aviso);
      }
      // Banido do app: sockets fora de sala mas logados na conta também recebem a tela
      if (acao === "app" && uid) for (const [, ts] of io.sockets.sockets) if ((ts.data as any)?.uid === uid) ts.emit("ban:bloqueado", aviso);
      io.emit("banimentos:mudou");
      const quanto = permanente ? "permanentemente" : "temporariamente";
      responder({
        success: true,
        message: acao === "sala" ? `${nome} foi banido ${quanto} da sala ${salaNome}.` : `${nome} foi banido ${quanto} do Eco.`,
        banimento: banimentoPublico(b),
      });
    });

    socket.on("host:banidos", (data: { masterToken?: string }, callback?: any) => {
      if (typeof callback !== "function") return;
      if (!podeBanir(data?.masterToken).ok) return callback({ success: false, lista: [] });
      callback({ success: true, lista: listarBanimentos().map(banimentoPublico) });
    });

    socket.on("host:desbanir", (data: { id: string; masterToken?: string }, callback?: any) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const { req, ok } = podeBanir(data?.masterToken);
      if (!ok) return responder({ success: false, message: "Só o Dono Master e o Co-fundador podem desbanir." });
      const b = removerBanimento(String(data?.id || ""), String(req?.name || "Dono"));
      if (!b) return responder({ success: false, message: "Banimento não encontrado (talvez já tenha acabado)." });
      io.emit("banimentos:mudou");
      responder({ success: true, message: `${b.nome} pode voltar ao Eco.` });
    });

    // Modo invisível → Aparecer: vira participante normal e só AGORA os outros ficam sabendo
    // Invisível liga/desliga a própria voz sem aparecer na lista
    socket.on("invisivel:voz", (d: { ligar?: boolean } | undefined, cb?: any) => {
      const f = acharFantasma(socket.id);
      if (!f) return typeof cb === "function" && cb({ ok: false });
      (f.g as any).vozInvisivel = d?.ligar === true;
      if (typeof cb === "function") cb({ ok: true });
    });

    socket.on("sala:revelar", (_data: { masterToken?: string } | undefined, callback?: any) => {
      const responder = (v: any) => typeof callback === "function" && callback(v);
      const room = currentRoomId ? rooms.get(currentRoomId) : undefined;
      const g = room ? fantasmas(room).get(socket.id) : undefined;
      // Só quem entrou pelo caminho invisível (já validado) tem registro aqui; pedido forjado é ignorado
      if (!room || !g || !currentRoomId) return responder({ success: false, message: "Você não está invisível nesta sala." });
      const rid = currentRoomId;
      fantasmas(room).delete(socket.id);
      delete g.invisivel;
      g.hasAudio = false; // mic começa desligado; a pessoa liga quando quiser
      g.hasVideo = false;
      g.isScreenSharing = false;
      g.joinedAt = Date.now();
      if (g.isHost && (!room.hostSocketId || !room.participants.has(room.hostSocketId))) room.hostSocketId = socket.id;
      room.participants.set(socket.id, g);
      anotarMembro(g, rid);
      // Fecha as conexões só-recebe antes da entrada normal (os cards nascem com conexão nova)
      socket.to(rid).emit("espectador:fim", { id: socket.id });
      responder({ success: true, self: g, room: formatRoomPayload(room) });
      const lista = Array.from(room.participants.values());
      io.to(rid).emit("room:participants", lista);
      io.to(rid).emit("room:user-joined", g);
      broadcastRoomState(room);
      emitirInvisiveis(room);
    });

    // 9. Leave & Cleanup
    const handleLeave = () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      // Invisível saindo: ninguém recebe aviso; quem abriu conexão só-recebe com ele fecha
      if (fantasmas(room).delete(socket.id)) {
        socket.to(currentRoomId).emit("espectador:fim", { id: socket.id });
        emitirInvisiveis(room);
      }

      const participant = room.participants.get(socket.id);
      const wasKnocking = room.pendingKnocks.has(socket.id);
      if (participant) marcarVisto(chaveVip(participant), currentRoomId);
      room.participants.delete(socket.id);
      room.pendingKnocks.delete(socket.id);

      if (wasKnocking && room.hostSocketId) {
        avisarPorta(room, "host:knock-cancelled", { socketId: socket.id });
      }

      if (participant) {
        const remainingParticipants = Array.from(room.participants.values());
        io.to(currentRoomId).emit("room:user-left", { id: socket.id, name: participant.name });
        io.to(currentRoomId).emit("room:participants", remainingParticipants);
        broadcastRoomState(room);
      }

      const roomIdToClean = currentRoomId;
      if (room.participants.size === 0 && fantasmas(room).size === 0 && roomIdToClean) {
        // Requirement 3: When the last user leaves a room, completely destroy/clean it immediately
        midia.apagarMidiasDaSala(roomIdToClean);
        rooms.delete(roomIdToClean);
        console.log(`[Room Cleanup] Sala destruída imediatamente após saída do último membro: ${roomIdToClean}`);
      }

      socket.leave(currentRoomId);
      currentRoomId = null;
    };

    socket.on("room:leave", handleLeave);
    socket.on("disconnect", handleLeave);
  });

  // SERVE_STATIC=false: só backend (front no Cloudflare Pages). Padrão: serve o front também (Render single-host).
  const servirFront = !/^(0|false|no|nao|não)$/i.test(String(process.env.SERVE_STATIC ?? "true").trim());
  if (!servirFront) {
    app.get("/", (_req, res) => res.type("text/plain").send("eco backend ok"));
    app.use((_req, res) => res.status(404).json({ error: "not found" }));
  } else if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Robust static dist directory resolution for Render / Node.js production deployments
    let distPath = path.resolve(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
      if (fs.existsSync(path.resolve(safeDirname, "dist"))) {
        distPath = path.resolve(safeDirname, "dist");
      } else if (fs.existsSync(path.resolve(safeDirname, "..", "dist"))) {
        distPath = path.resolve(safeDirname, "..", "dist");
      } else {
        distPath = safeDirname;
      }
    }
    // Nunca entregar o código do servidor (nem sourcemaps) pro navegador
    app.use((req, res, next) => {
      if (/^\/server\.(cjs|js)(\.map)?$/i.test(req.path) || /\.key$/i.test(req.path) || /\.map$/i.test(req.path) || req.path === "/_headers" || req.path === "/_redirects") return res.status(404).end();
      next();
    });
    app.use(
      express.static(distPath, {
        dotfiles: "allow",
        setHeaders: (res, arquivo) => {
          const nome = arquivo.replace(/\\/g, "/");
          // página, service worker e versão nunca ficam velhos no cache do navegador
          if (/(index\.html|sw\.js|version\.json|manifest\.webmanifest)$/.test(nome)) res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          // arquivos do vite têm hash no nome: cache de 1 ano (antes o navegador revalidava tudo a cada abertura)
          else if (/\/assets\//.test(nome)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          // ícones, fundo, insígnias
          else res.setHeader("Cache-Control", "public, max-age=86400");
        },
      })
    );
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[eco] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start eco server:", err);
  process.exit(1);
});
