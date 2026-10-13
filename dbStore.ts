/**
 * dbStore — banco de dados permanente (Firebase / Firestore).
 *
 * Por que existe: o Render grátis apaga o disco quando a instância dorme/reinicia.
 * Com o Firebase configurado, preços da loja, salas fixas e contas ficam salvos de verdade.
 *
 * Variáveis no Render (Environment):
 *   FIREBASE_SERVICE_ACCOUNT  -> conteúdo inteiro do JSON da "conta de serviço" (Configurações do projeto > Contas de serviço > Gerar nova chave privada)
 *   FIREBASE_WEB_CONFIG       -> o bloco "firebaseConfig" do app Web (pode colar do jeito que o Firebase mostra)
 *
 * Sem essas variáveis o app continua funcionando como antes (salvando no disco local).
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let db: Firestore | null = null;
let ativo = false;

export function iniciarFirebase(): boolean {
  if (ativo) return true;
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) {
    console.log("[firebase] FIREBASE_SERVICE_ACCOUNT não definido: salvando só no disco local.");
    return false;
  }
  try {
    const texto = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const conta = JSON.parse(texto);
    if (conta.private_key && typeof conta.private_key === "string") {
      conta.private_key = conta.private_key.replace(/\\n/g, "\n");
    }
    const app = getApps()[0] || initializeApp({ credential: cert(conta) });
    db = getFirestore(app);
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // settings só pode ser chamado uma vez
    }
    ativo = true;
    console.log(`[firebase] conectado ao projeto ${conta.project_id}`);
    return true;
  } catch (e) {
    console.warn("[firebase] não consegui iniciar (confira FIREBASE_SERVICE_ACCOUNT):", (e as Error).message);
    return false;
  }
}

export const temFirebase = () => ativo;

export async function lerDoc<T = any>(colecao: string, id: string): Promise<T | null> {
  if (!db) return null;
  try {
    const snap = await db.collection(colecao).doc(id).get();
    return snap.exists ? (snap.data() as T) : null;
  } catch (e) {
    console.warn(`[firebase] erro lendo ${colecao}/${id}:`, (e as Error).message);
    return null;
  }
}

export async function lerColecao<T = any>(colecao: string, limite = 500): Promise<Array<{ id: string; dados: T }>> {
  if (!db) return [];
  try {
    const snap = await db.collection(colecao).limit(limite).get();
    return snap.docs.map((d) => ({ id: d.id, dados: d.data() as T }));
  } catch (e) {
    console.warn(`[firebase] erro lendo ${colecao}:`, (e as Error).message);
    return [];
  }
}

export async function salvarDoc(colecao: string, id: string, dados: Record<string, any>, merge = true): Promise<void> {
  if (!db) return;
  try {
    await db.collection(colecao).doc(id).set(dados, { merge });
  } catch (e) {
    console.warn(`[firebase] erro salvando ${colecao}/${id}:`, (e as Error).message);
  }
}

export interface ContaVerificada {
  uid: string;
  nome?: string;
  email?: string;
  foto?: string;
}

export async function verificarToken(idToken?: string): Promise<ContaVerificada | null> {
  if (!ativo || !idToken || typeof idToken !== "string") return null;
  try {
    const d = await getAuth().verifyIdToken(idToken);
    return { uid: d.uid, nome: (d as any).name, email: d.email, foto: (d as any).picture };
  } catch {
    return null;
  }
}

/** Config pública do app Web (vai pro navegador). Aceita JSON ou o bloco JS que o Firebase mostra. */
export function configWebFirebase(): Record<string, string> | null {
  const raw = (process.env.FIREBASE_WEB_CONFIG || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const cfg: Record<string, string> = {};
    const re = /(\w+)\s*:\s*["'`]([^"'`]+)["'`]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) cfg[m[1]] = m[2];
    return cfg.apiKey ? cfg : null;
  }
}
