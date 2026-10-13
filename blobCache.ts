/**
 * blobCache — corta a banda do servidor.
 *
 * Antes: foto/GIF/banner de perfil (data: base64, até ~9 MB) ia DENTRO de cada evento do socket
 * (room:sync, room:participants, room:user-updated, chat, membros:listar...). Cada mudança de mic,
 * entrada/saída ou mensagem mandava o base64 de novo pra todo mundo da sala.
 *
 * Agora: toda string "data:..." grande que sai pelo socket vira um link curto
 * `<servidor>/api/m/<hash>.<ext>` (conteúdo fixo -> cache "immutable": cada aparelho baixa uma vez só).
 * O que chega dos clientes com esse link volta a ser o data: original antes de qualquer handler,
 * então o resto do servidor (Firebase, membros, permissões) continua vendo exatamente o que via antes.
 */
import type { Express, Request } from "express";
import { createHash } from "crypto";
import * as parser from "socket.io-parser";

const MIN_CHARS = 2048; // data: menores que isso continuam inline (ícones pequenos)
const MAX_TOTAL_CHARS = (Number(process.env.ECO_BLOB_CACHE_MB) || 200) * 1024 * 1024;
const MAX_BUF_BYTES = 64 * 1024 * 1024;

interface Entrada {
  id: string;
  str: string;
  mime: string;
  ext: string;
  usado: number;
  buf?: Buffer;
}

const porId = new Map<string, Entrada>();
const porStr = new Map<string, Entrada>();
let totalChars = 0;
let totalBuf = 0;
const naoConverter = new WeakSet<object>();

/** Marca um objeto pra sair com os data: originais (ex.: dados da própria conta que o cliente salva). */
export function manterDataUrl<T>(o: T): T {
  if (o && typeof o === "object") naoConverter.add(o as any);
  return o;
}

// ---------- endereço público deste servidor ----------
let baseAprendida = "";
function baseEnv(): string {
  const e = process.env.PUBLIC_URL || process.env.ECO_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (e) return e.replace(/\/+$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return "";
}
/** Aprende o endereço pelo handshake de um cliente de verdade (Host + x-forwarded-proto). */
export function aprenderBase(req: { headers: Record<string, any> }) {
  if (baseEnv() || baseAprendida) return;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host) || /healthcheck/.test(host)) return;
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  baseAprendida = `${proto}://${host}`;
}
export function baseServidor(): string {
  return baseEnv() || baseAprendida;
}

// ---------- registro ----------
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/gif": "gif", "image/webp": "webp",
  "image/svg+xml": "svg", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};

function liberar() {
  if (totalChars <= MAX_TOTAL_CHARS) return;
  const velhas = [...porId.values()].sort((a, b) => a.usado - b.usado);
  for (const e of velhas) {
    if (totalChars <= MAX_TOTAL_CHARS * 0.8) break;
    porId.delete(e.id);
    porStr.delete(e.str);
    totalChars -= e.str.length;
    if (e.buf) totalBuf -= e.buf.length;
  }
}

function registrar(str: string): Entrada | null {
  const ja = porStr.get(str);
  if (ja) { ja.usado = Date.now(); return ja; }
  const m = /^data:([a-z0-9.+\-]+\/[a-z0-9.+\-]+)[;,]/i.exec(str.slice(0, 120));
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const id = createHash("sha1").update(str).digest("hex").slice(0, 24);
  const e: Entrada = { id, str, mime, ext: EXT[mime] || "bin", usado: Date.now() };
  const outra = porId.get(id);
  if (outra) { porStr.delete(outra.str); totalChars -= outra.str.length; if (outra.buf) totalBuf -= outra.buf.length; }
  porId.set(id, e);
  porStr.set(str, e);
  totalChars += str.length;
  liberar();
  return e;
}

function urlDe(e: Entrada) {
  return `${baseServidor()}/api/m/${e.id}.${e.ext}`;
}

// ---------- transformação saída / entrada ----------
function paraFora(v: any, prof: number, vendo: Set<any>): any {
  if (typeof v === "string") {
    if (v.length >= MIN_CHARS && v.charCodeAt(0) === 100 /* d */ && v.startsWith("data:")) {
      const e = registrar(v);
      return e ? urlDe(e) : v;
    }
    return v;
  }
  if (!v || typeof v !== "object" || prof > 14) return v;
  if (naoConverter.has(v) || vendo.has(v)) return v;
  if (Buffer.isBuffer(v) || ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return v;
  vendo.add(v);
  try {
    if (Array.isArray(v)) {
      let copia: any[] | null = null;
      for (let i = 0; i < v.length; i++) {
        const n = paraFora(v[i], prof + 1, vendo);
        if (n !== v[i]) { if (!copia) copia = v.slice(); copia[i] = n; }
      }
      return copia || v;
    }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) {
      if (typeof v.toJSON === "function") return v; // Date etc.
      if (v instanceof Map || v instanceof Set) return v;
    }
    let copia: any = null;
    for (const k of Object.keys(v)) {
      const atual = v[k];
      const n = paraFora(atual, prof + 1, vendo);
      if (n !== atual) { if (!copia) copia = { ...v }; copia[k] = n; }
    }
    return copia || v;
  } finally {
    vendo.delete(v);
  }
}
export function paraEnvio<T>(v: T): T {
  return paraFora(v, 0, new Set());
}

const RE_LINK = /\/api\/m\/([a-f0-9]{24})\.[a-z0-9]+(?:\?.*)?$/;
function paraDentro(v: any, prof: number): any {
  if (typeof v === "string") {
    if (v.length < 300 && v.includes("/api/m/")) {
      const m = RE_LINK.exec(v);
      const e = m ? porId.get(m[1]) : undefined;
      if (e) { e.usado = Date.now(); return e.str; }
    }
    return v;
  }
  if (!v || typeof v !== "object" || prof > 14) return v;
  if (Buffer.isBuffer(v) || ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return v;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) v[i] = paraDentro(v[i], prof + 1);
    return v;
  }
  for (const k of Object.keys(v)) v[k] = paraDentro(v[k], prof + 1);
  return v;
}
/** Converte (no lugar) links /api/m/... que chegam do cliente de volta pro data: original. */
export function paraServidor<T>(v: T): T {
  return paraDentro(v, 0);
}

// ---------- parser do socket.io: aplica em TODO pacote que sai (emit, broadcast e ack) ----------
class EncoderEco extends parser.Encoder {
  encode(obj: any) {
    if (obj && Array.isArray(obj.data)) {
      try {
        obj = { ...obj, data: paraEnvio(obj.data) };
      } catch (err) {
        console.warn("[blob] falha ao converter pacote:", (err as Error).message);
      }
    }
    return super.encode(obj);
  }
}
export const parserEco: any = { ...parser, Encoder: EncoderEco };

// ---------- rota HTTP ----------
function bufferDe(e: Entrada): Buffer {
  if (e.buf) return e.buf;
  const virgula = e.str.indexOf(",");
  const cab = e.str.slice(0, virgula);
  const corpo = e.str.slice(virgula + 1);
  const buf = /;base64/i.test(cab) ? Buffer.from(corpo, "base64") : Buffer.from(decodeURIComponent(corpo), "utf8");
  if (buf.length < MAX_BUF_BYTES / 4) {
    // guarda decodificado (LRU simples)
    if (totalBuf + buf.length > MAX_BUF_BYTES) {
      for (const x of [...porId.values()].sort((a, b) => a.usado - b.usado)) {
        if (totalBuf + buf.length <= MAX_BUF_BYTES) break;
        if (x.buf) { totalBuf -= x.buf.length; x.buf = undefined; }
      }
    }
    e.buf = buf;
    totalBuf += buf.length;
  }
  return buf;
}

export function registrarRotaBlob(app: Express) {
  app.get("/api/m/:arquivo", (req: Request, res) => {
    const id = String(req.params.arquivo || "").split(".")[0];
    const e = porId.get(id);
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    if (!e) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).send("Mídia não encontrada.");
    }
    e.usado = Date.now();
    const etag = `"${e.id}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", e.mime);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    const buf = bufferDe(e);
    // vídeo (banner mp4): suporte a Range pro <video> não baixar tudo de novo
    const range = req.headers.range;
    res.setHeader("Accept-Ranges", "bytes");
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const ini = m[1] ? Number(m[1]) : Math.max(0, buf.length - Number(m[2] || 0));
        const fim = m[1] && m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
        if (ini <= fim && ini < buf.length) {
          res.status(206);
          res.setHeader("Content-Range", `bytes ${ini}-${fim}/${buf.length}`);
          res.setHeader("Content-Length", String(fim - ini + 1));
          return res.end(buf.subarray(ini, fim + 1));
        }
      }
    }
    res.setHeader("Content-Length", String(buf.length));
    res.end(buf);
  });
}
