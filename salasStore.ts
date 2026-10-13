/**
 * salasStore — salas fixas (tipo servidor do Discord).
 * A sala some da memória quando todo mundo sai, mas o nome, os canais e o dono ficam salvos.
 * Quem entrar de novo com o mesmo código encontra a mesma sala.
 * Salva no Firebase (permanente) e no disco local (reserva).
 */
import fs from "fs";
import path from "path";
import { temFirebase, lerColecao, salvarDoc } from "./dbStore";

export interface SalaSalva {
  roomName: string;
  hostSecretToken: string;
  hostPasscodeHash?: string;
  channels?: Array<{ id: string; name: string; description?: string }>;
  createdAt: number;
  ultimoUso?: number;
}

const DATA_DIR = process.env.ECO_DATA_DIR || path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "salas.json");

let salas: Record<string, SalaSalva> = {};
let carregado = false;
let timer: NodeJS.Timeout | null = null;

function load() {
  if (carregado) return;
  carregado = true;
  try {
    if (fs.existsSync(FILE)) salas = JSON.parse(fs.readFileSync(FILE, "utf8")) || {};
  } catch {
    salas = {};
  }
}

function persistDisco() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(salas));
    } catch {
      // disco do Render pode não aceitar; o Firebase é o principal
    }
  }, 500);
}

export async function carregarSalasDoBanco(): Promise<void> {
  load();
  if (!temFirebase()) return;
  const docs = await lerColecao<SalaSalva>("salas", 1000);
  for (const d of docs) salas[d.id] = { ...(salas[d.id] || {}), ...d.dados };
  if (docs.length) console.log(`[salas] ${docs.length} salas fixas carregadas do Firebase`);
}

export function getSalaSalva(roomId: string): SalaSalva | null {
  load();
  return salas[roomId] || null;
}

export function salvarSala(roomId: string, dados: Partial<SalaSalva>): void {
  load();
  if (!roomId) return;
  const atual = salas[roomId];
  const nova: SalaSalva = {
    roomName: String(dados.roomName ?? atual?.roomName ?? `Sala ${roomId.toUpperCase()}`).slice(0, 80),
    hostSecretToken: String(dados.hostSecretToken ?? atual?.hostSecretToken ?? ""),
    hostPasscodeHash: dados.hostPasscodeHash ?? atual?.hostPasscodeHash,
    channels: (dados.channels ?? atual?.channels)?.slice(0, 30).map((c) => ({
      id: String(c.id).slice(0, 60),
      name: String(c.name).slice(0, 60),
      description: c.description ? String(c.description).slice(0, 200) : "",
    })),
    createdAt: atual?.createdAt ?? dados.createdAt ?? Date.now(),
    ultimoUso: Date.now(),
  };
  salas[roomId] = nova;
  persistDisco();
  if (temFirebase()) void salvarDoc("salas", roomId, JSON.parse(JSON.stringify(nova)), true);
}
