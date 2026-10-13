/**
 * mediaStore — fotos, prints e vídeos do chat da call.
 * O arquivo vai direto pro DISCO do servidor (sem passar pela memória), então aguenta até 512 MB.
 * Some quando a sala fecha ou o servidor reinicia (sem Firebase por enquanto).
 * Para trocar por Firebase Storage/R2 depois, basta manter as mesmas funções.
 */
import type { Express, Request, Response } from "express";
import fs from "fs";
import os from "os";
import path from "path";

export type MediaKind = "image" | "video";

export interface ChatAttachment {
  id: string;
  kind: MediaKind;
  mime: string;
  name: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
  spoiler?: boolean;
}

interface StoredMedia {
  file: string;
  mime: string;
  kind: MediaKind;
  size: number;
  roomId: string;
  owner: string; // socket que enviou
  at: number;
  usado: boolean; // já foi postado no chat
}

export const LIMITE_IMAGEM = 25 * 1024 * 1024; // 25 MB
export const LIMITE_VIDEO = 512 * 1024 * 1024; // 512 MB
export const MAX_ANEXOS = 4;
const LIMITE_TOTAL_DISCO = Number(process.env.ECO_MEDIA_MAX_BYTES) || 6 * 1024 * 1024 * 1024; // 6 GB
const NAO_USADO_EXPIRA_MS = 15 * 60 * 1000;

const DIR = process.env.ECO_MEDIA_DIR || path.join(os.tmpdir(), "eco-media");
try {
  fs.rmSync(DIR, { recursive: true, force: true });
} catch {}
fs.mkdirSync(DIR, { recursive: true });

const store = new Map<string, StoredMedia>();
let totalBytes = 0;
let enviosEmAndamento = 0;

/** Descobre o tipo real pelo conteúdo (não confia no que o navegador diz) */
export function detectarTipo(b: Buffer): { mime: string; kind: MediaKind } | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", kind: "image" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", kind: "image" };
  if (b.toString("ascii", 0, 3) === "GIF") return { mime: "image/gif", kind: "image" };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", kind: "image" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: "video/webm", kind: "video" };
  if (b.toString("ascii", 4, 8) === "ftyp") {
    const marca = b.toString("ascii", 8, 12);
    if (marca === "qt  ") return { mime: "video/quicktime", kind: "video" };
    if (/^(heic|heix|mif1|avif)/.test(marca)) return null;
    return { mime: "video/mp4", kind: "video" };
  }
  return null;
}

function apagar(id: string) {
  const m = store.get(id);
  if (!m) return;
  store.delete(id);
  totalBytes -= m.size;
  fs.unlink(m.file, () => {});
}

function liberarEspaco(precisa: number) {
  const ordenadas = [...store.entries()].sort((a, b) => a[1].at - b[1].at);
  for (const [id] of ordenadas) {
    if (totalBytes + precisa <= LIMITE_TOTAL_DISCO) break;
    apagar(id);
  }
}

export function apagarMidiasDaSala(roomId: string) {
  for (const [id, m] of store.entries()) if (m.roomId === roomId) apagar(id);
}

/** Pega um upload já feito para postar no chat (só quem enviou, na mesma sala) */
export function usarUpload(id: string, owner: string, roomId: string): StoredMedia | null {
  const m = store.get(String(id));
  if (!m || m.owner !== owner || m.roomId !== roomId || m.usado) return null;
  m.usado = true;
  return m;
}

// Uploads que ninguém postou somem depois de 15 min
setInterval(() => {
  const agora = Date.now();
  for (const [id, m] of store.entries()) if (!m.usado && agora - m.at > NAO_USADO_EXPIRA_MS) apagar(id);
}, 60 * 1000).unref();

export function registrarRotaMidia(app: Express, podeEnviar: (socketId: string, roomId: string) => boolean) {
  // Envio: o navegador manda o arquivo cru e ele é gravado direto no disco
  app.post("/api/media/upload", (req: Request, res: Response) => {
    const socketId = String(req.header("x-eco-socket") || "");
    const roomId = String(req.header("x-eco-room") || "");
    if (!podeEnviar(socketId, roomId)) return res.status(403).json({ ok: false, message: "Você não está na sala." });
    if (enviosEmAndamento >= 6) return res.status(429).json({ ok: false, message: "Servidor ocupado com outros envios. Tente já já." });

    const declarado = Number(req.header("content-length") || 0);
    if (declarado > LIMITE_VIDEO) return res.status(413).json({ ok: false, message: "Arquivo passa de 512 MB." });
    liberarEspaco(declarado || 0);

    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const file = path.join(DIR, id);
    const out = fs.createWriteStream(file);
    let recebidos = 0;
    let inicio = Buffer.alloc(0);
    let encerrado = false;
    enviosEmAndamento++;

    const falhar = (status: number, message: string) => {
      if (encerrado) return;
      encerrado = true;
      enviosEmAndamento--;
      out.destroy();
      fs.unlink(file, () => {});
      req.unpipe?.();
      if (!res.headersSent) res.status(status).json({ ok: false, message });
      req.resume();
    };

    req.on("data", (chunk: Buffer) => {
      if (encerrado) return;
      recebidos += chunk.length;
      if (inicio.length < 16) {
        inicio = Buffer.concat([inicio, chunk.subarray(0, 16)]);
        if (inicio.length >= 16 && !detectarTipo(inicio)) {
          return falhar(415, "Formato não suportado. Use PNG, JPG, WEBP, GIF, MP4, WEBM ou MOV.");
        }
      }
      if (recebidos > LIMITE_VIDEO) return falhar(413, "Arquivo passa de 512 MB.");
      if (!out.write(chunk)) {
        req.pause();
        out.once("drain", () => req.resume());
      }
    });
    req.on("aborted", () => falhar(400, "Envio cancelado."));
    req.on("error", () => falhar(400, "Falha no envio."));
    req.on("end", () => {
      if (encerrado) return;
      out.end(() => {
        if (encerrado) return;
        const tipo = detectarTipo(inicio);
        if (!tipo) return falhar(415, "Formato não suportado.");
        if (tipo.kind === "image" && recebidos > LIMITE_IMAGEM) return falhar(413, "Imagem passa de 25 MB.");
        encerrado = true;
        enviosEmAndamento--;
        store.set(id, { file, mime: tipo.mime, kind: tipo.kind, size: recebidos, roomId, owner: socketId, at: Date.now(), usado: false });
        totalBytes += recebidos;
        res.json({ ok: true, id, kind: tipo.kind, mime: tipo.mime, size: recebidos });
      });
    });
  });

  // Ver/baixar (com suporte a pular no vídeo)
  app.get("/api/media/:id", (req, res) => {
    const m = store.get(String(req.params.id));
    if (!m || !m.usado) return res.status(404).send("Mídia expirada (a sala foi fechada).");
    res.sendFile(m.file, {
      headers: {
        "Content-Type": m.mime,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=86400",
      },
    });
  });
}
