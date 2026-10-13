/**
 * antiSpam — limita mensagens no chat da sala e nas conversas privadas (DM).
 *
 * Regras (por pessoa):
 *  - no máximo 5 mensagens em 8 segundos;
 *  - o mesmo texto 3 vezes seguidas em 30 segundos = spam;
 *  - quem passa do limite fica 30 segundos sem poder mandar mensagem;
 *  - mensagem com mais de 1000 caracteres é recusada.
 * Dono Master e Co-fundador não passam por aqui (são isentos).
 */

export const LIMITE_CARACTERES = 1000;
const JANELA_MS = 8_000;
const MAX_NA_JANELA = 5;
const REPETIDA_JANELA_MS = 30_000;
const MAX_REPETIDAS = 3;
const CASTIGO_MS = 30_000;

interface Estado {
  envios: number[];
  ultimoTexto: string;
  repeticoes: number;
  primeiraRepeticaoEm: number;
  bloqueadoAte: number;
}

export interface ResultadoSpam {
  ok: boolean;
  motivo?: "longa" | "spam";
  segundos?: number;
  mensagem?: string;
}

const estados = new Map<string, Estado>();

const normalizar = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

export function mensagemCalma(segundos: number) {
  return `Calma! Aguarde ${segundos}s para mandar mensagem.`;
}

/** Confere se a mensagem pode passar. `chave` identifica quem manda (ex.: "sala:<socket>" ou "dm:<uid>"). */
export function checarSpam(chave: string, texto: string, isento = false): ResultadoSpam {
  if (typeof texto === "string" && texto.length > LIMITE_CARACTERES) {
    return { ok: false, motivo: "longa", mensagem: `Mensagem grande demais (máximo ${LIMITE_CARACTERES} caracteres).` };
  }
  if (isento) return { ok: true };
  const agora = Date.now();
  let e = estados.get(chave);
  if (!e) {
    e = { envios: [], ultimoTexto: "", repeticoes: 0, primeiraRepeticaoEm: 0, bloqueadoAte: 0 };
    estados.set(chave, e);
  }
  if (e.bloqueadoAte > agora) {
    const segundos = Math.max(1, Math.ceil((e.bloqueadoAte - agora) / 1000));
    return { ok: false, motivo: "spam", segundos, mensagem: mensagemCalma(segundos) };
  }

  const castigar = (): ResultadoSpam => {
    e!.bloqueadoAte = agora + CASTIGO_MS;
    e!.envios = [];
    e!.repeticoes = 0;
    const segundos = Math.ceil(CASTIGO_MS / 1000);
    return { ok: false, motivo: "spam", segundos, mensagem: mensagemCalma(segundos) };
  };

  // Rajada: mais de 5 mensagens em 8 s
  e.envios = e.envios.filter((t) => agora - t < JANELA_MS);
  if (e.envios.length >= MAX_NA_JANELA) return castigar();

  // Mesmo texto repetido
  const n = normalizar(String(texto || ""));
  if (n && n === e.ultimoTexto && agora - e.primeiraRepeticaoEm < REPETIDA_JANELA_MS) {
    e.repeticoes += 1;
  } else {
    e.ultimoTexto = n;
    e.repeticoes = 1;
    e.primeiraRepeticaoEm = agora;
  }
  if (n && e.repeticoes >= MAX_REPETIDAS) return castigar();

  e.envios.push(agora);
  return { ok: true };
}

/** Esquece a pessoa (ex.: desconectou). Mantém o castigo se ainda estiver valendo. */
export function limparSpam(chave: string) {
  const e = estados.get(chave);
  if (e && e.bloqueadoAte <= Date.now()) estados.delete(chave);
}
