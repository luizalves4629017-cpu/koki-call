/**
 * conta — login salvo (Google ou e-mail/senha) + "Minhas salas".
 * Usa Firebase Auth no navegador; o servidor confere o login e guarda os dados no Firestore.
 * Se o Firebase não estiver configurado no Render, só "Minhas salas" funciona (salvo neste aparelho).
 */
import { BACKEND_URL } from "./backend";
import type { Socket } from "socket.io-client";
import type { FirebaseApp } from "firebase/app";
import type { Auth, User } from "firebase/auth";
import {
  getSavedUserProfile,
  saveUserProfile,
  getMemberSince,
  getKokiCoins,
  setKokiCoins,
  getPurchasedPerks,
  savePurchasedPerks,
  getHostToken,
  saveHostToken,
  isMasterIdentity,
} from "./storage";

// ---------------- Minhas salas (sempre funciona, mesmo sem login) ----------------
export interface MinhaSala {
  roomId: string;
  nome: string;
  ultimaVez: number;
  emoji?: string;
}
const SALAS_KEY = "eco_minhas_salas_v1";
const EVENTO_SALAS = "eco_minhas_salas_mudou";

export function getMinhasSalas(): MinhaSala[] {
  try {
    const lista = JSON.parse(localStorage.getItem(SALAS_KEY) || "[]");
    return Array.isArray(lista) ? lista.filter((s) => s && s.roomId).sort((a, b) => b.ultimaVez - a.ultimaVez) : [];
  } catch {
    return [];
  }
}

function salvarMinhasSalas(lista: MinhaSala[]) {
  try {
    localStorage.setItem(SALAS_KEY, JSON.stringify(lista.slice(0, 100)));
    window.dispatchEvent(new CustomEvent(EVENTO_SALAS));
  } catch {
    // ignore
  }
  agendarSync();
}

export function lembrarSala(roomId: string, nome?: string) {
  if (!roomId) return;
  const lista = getMinhasSalas().filter((s) => s.roomId !== roomId);
  const antiga = getMinhasSalas().find((s) => s.roomId === roomId);
  lista.unshift({ roomId, nome: (nome || antiga?.nome || roomId).slice(0, 80), ultimaVez: Date.now(), emoji: antiga?.emoji });
  salvarMinhasSalas(lista);
}

/** Troca o emoji da capa da sala (só na lista da pessoa). */
export function definirEmojiSala(roomId: string, emoji: string) {
  salvarMinhasSalas(getMinhasSalas().map((s) => (s.roomId === roomId ? { ...s, emoji } : s)));
}

export function esquecerSala(roomId: string) {
  salvarMinhasSalas(getMinhasSalas().filter((s) => s.roomId !== roomId));
}

export function aoMudarMinhasSalas(fn: () => void) {
  window.addEventListener(EVENTO_SALAS, fn);
  return () => window.removeEventListener(EVENTO_SALAS, fn);
}

// ---------------- Login (Firebase) ----------------
let socketRef: Socket | null = null;
let baseUrl = "";
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let iniciando: Promise<boolean> | null = null;
let usuarioAtual: User | null = null;
let contaVinculada = false;
const ouvintes = new Set<(u: ContaInfo | null) => void>();

export interface ContaInfo {
  uid: string;
  nome: string;
  email: string;
  foto?: string;
}

function info(u: User | null): ContaInfo | null {
  if (!u) return null;
  return { uid: u.uid, nome: u.displayName || (u.email || "").split("@")[0], email: u.email || "", foto: u.photoURL || undefined };
}

const LOGADO_KEY = "eco_logado_v1";
/** Lembra se tinha login neste aparelho, pra abrir direto nas salas sem piscar o Lobby. */
export function provavelmenteLogado(): boolean {
  try {
    return localStorage.getItem(LOGADO_KEY) === "1";
  } catch {
    return false;
  }
}

function avisar() {
  const i = info(usuarioAtual);
  try {
    if (i) localStorage.setItem(LOGADO_KEY, "1");
    else localStorage.removeItem(LOGADO_KEY);
  } catch {
    // ignore
  }
  ouvintes.forEach((fn) => fn(i));
}

export function aoMudarConta(fn: (u: ContaInfo | null) => void) {
  ouvintes.add(fn);
  fn(info(usuarioAtual));
  return () => ouvintes.delete(fn);
}

export function contaAtual(): ContaInfo | null {
  return info(usuarioAtual);
}

/** Chamado pelo App quando o socket conecta. */
export function definirSocketConta(s: Socket, urlBase: string) {
  socketRef = s;
  baseUrl = urlBase.replace(/\/$/, "");
  s.on("connect", () => {
    contaVinculada = false;
    if (usuarioAtual) void vincularNoServidor(false);
  });
  void iniciarLogin();
}

export function loginDisponivel(): Promise<boolean> {
  return iniciarLogin();
}

function iniciarLogin(): Promise<boolean> {
  if (iniciando) return iniciando;
  iniciando = (async () => {
    try {
      const r = await fetch(`${baseUrl || BACKEND_URL}/api/firebase-config`);
      const j = await r.json();
      if (!j?.ativo || !j.config?.apiKey) {
        localStorage.removeItem(LOGADO_KEY);
        avisar();
        return false;
      }
      const { initializeApp, getApps } = await import("firebase/app");
      const fbAuth = await import("firebase/auth");
      app = getApps()[0] || initializeApp(j.config);
      auth = fbAuth.getAuth(app);
      await fbAuth.setPersistence(auth, fbAuth.browserLocalPersistence);
      try {
        await fbAuth.getRedirectResult(auth);
      } catch {
        // ignore
      }
      fbAuth.onAuthStateChanged(auth, (u) => {
        usuarioAtual = u;
        contaVinculada = false;
        avisar();
        if (u) void vincularNoServidor(sessionStorage.getItem("eco_login_novo") === "1");
      });
      return true;
    } catch (e) {
      console.warn("[conta] login indisponível:", e);
      return false;
    }
  })();
  return iniciando;
}

async function emitir<T = any>(evento: string, dados: any): Promise<T | null> {
  const s = socketRef;
  if (!s) return null;
  if (!s.connected) {
    await new Promise<void>((ok) => {
      const t = setTimeout(ok, 4000);
      s.once("connect", () => {
        clearTimeout(t);
        ok();
      });
    });
  }
  return new Promise((ok) => {
    const t = setTimeout(() => ok(null), 8000);
    s.emit(evento, dados, (res: T) => {
      clearTimeout(t);
      ok(res);
    });
  });
}

/** Liga a conta ao servidor. Se acabou de entrar neste aparelho, puxa os dados da nuvem. */
async function vincularNoServidor(acabouDeEntrar: boolean) {
  if (!usuarioAtual) return;
  const idToken = await usuarioAtual.getIdToken();
  const res = await emitir<any>("conta:entrar", { idToken });
  if (!res?.ok) return;
  contaVinculada = true;

  if (acabouDeEntrar) {
    sessionStorage.removeItem("eco_login_novo");
    if (res.dados && !res.novo) {
      aplicarDadosDaNuvem(res.dados);
      // recarrega pra todas as telas lerem o perfil novo
      window.location.reload();
      return;
    }
    // conta nova: primeiro nome vem do Google
    const p = getSavedUserProfile();
    if ((!p.name || p.name.startsWith("Convidado")) && usuarioAtual.displayName) {
      saveUserProfile({ name: usuarioAtual.displayName.slice(0, 32) });
    }
  }
  await enviarParaNuvem();
}

function aplicarDadosDaNuvem(d: any) {
  try {
    if (d.perfil && typeof d.perfil === "object") {
      const limpo: any = {};
      for (const [k, v] of Object.entries(d.perfil)) if (v !== undefined && v !== null && v !== "") limpo[k] = v;
      saveUserProfile(limpo);
    }
    if (Number.isFinite(Number(d.memberSince))) {
      const atual = getMemberSince();
      localStorage.setItem("eco_member_since_v1", String(Math.min(atual, Number(d.memberSince))));
    }
    if (Number.isFinite(Number(d.moedas)) && !isMasterIdentity()) setKokiCoins(Number(d.moedas));
    if (d.perks && typeof d.perks === "object") {
      const local = getPurchasedPerks();
      const junto: Record<string, number> = { ...local };
      for (const [k, v] of Object.entries(d.perks)) junto[k] = Math.max(Number(v) || 0, local[k] || 0);
      savePurchasedPerks(junto);
    }
    if (Array.isArray(d.salas)) {
      const mapa = new Map<string, MinhaSala>();
      [...getMinhasSalas(), ...d.salas].forEach((s: any) => {
        if (!s?.roomId) return;
        const atual = mapa.get(s.roomId);
        if (!atual || (s.ultimaVez || 0) > atual.ultimaVez) mapa.set(s.roomId, { roomId: s.roomId, nome: s.nome || s.roomId, ultimaVez: s.ultimaVez || 0, emoji: s.emoji || atual?.emoji });
        if (s.hostToken && !getHostToken(s.roomId)) saveHostToken(s.roomId, s.hostToken);
      });
      localStorage.setItem(SALAS_KEY, JSON.stringify(Array.from(mapa.values()).slice(0, 100)));
    }
    if (d.missoes) localStorage.setItem("eco_missoes_v1", JSON.stringify(d.missoes));
  } catch (e) {
    console.warn("[conta] erro aplicando dados:", e);
  }
}

function coletarDados() {
  const p = getSavedUserProfile();
  let missoes: any = undefined;
  try {
    missoes = JSON.parse(localStorage.getItem("eco_missoes_v1") || "null") || undefined;
  } catch {
    // ignore
  }
  return {
    perfil: {
      name: p.name,
      avatarColor: p.avatarColor,
      avatarUrl: p.avatarUrl,
      bannerColor: p.bannerColor,
      bannerUrl: p.bannerUrl,
      customStatus: p.customStatus,
      bio: p.bio,
      tag: p.tag,
    },
    memberSince: getMemberSince(),
    moedas: isMasterIdentity() ? undefined : getKokiCoins(),
    perks: getPurchasedPerks(),
    salas: getMinhasSalas().map((s) => ({ ...s, hostToken: getHostToken(s.roomId) })),
    missoes,
  };
}

// Só manda quando algo mudou (antes subia o perfil inteiro, com foto/banner base64, a cada 30 s)
let ultimoEnviado = "";
async function enviarParaNuvem() {
  if (!usuarioAtual || !contaVinculada) return;
  const dados = coletarDados();
  let assinatura = "";
  try { assinatura = `${usuarioAtual.uid || ""}|${JSON.stringify(dados)}`; } catch {}
  if (assinatura && assinatura === ultimoEnviado) return;
  const r: any = await emitir("conta:salvar", { dados });
  if (r && r.ok !== false) ultimoEnviado = assinatura;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
export function agendarSync() {
  if (!usuarioAtual) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void enviarParaNuvem(), 3000);
}

// Salva sozinho a cada 30s e quando fecha a aba
if (typeof window !== "undefined") {
  setInterval(() => void enviarParaNuvem(), 30000);
  window.addEventListener("koki_coins_updated", () => agendarSync());
  window.addEventListener("beforeunload", () => void enviarParaNuvem());
}

export async function entrarComGoogle(): Promise<string | null> {
  if (!(await iniciarLogin()) || !auth) return "Login ainda não configurado.";
  const fbAuth = await import("firebase/auth");
  const provedor = new fbAuth.GoogleAuthProvider();
  provedor.setCustomParameters({ prompt: "select_account" });
  sessionStorage.setItem("eco_login_novo", "1");
  try {
    await fbAuth.signInWithPopup(auth, provedor);
    return null;
  } catch (e: any) {
    if (String(e?.code || "").includes("popup")) {
      await fbAuth.signInWithRedirect(auth, provedor);
      return null;
    }
    sessionStorage.removeItem("eco_login_novo");
    return traduzirErro(e?.code);
  }
}

export async function entrarComEmail(email: string, senha: string, criar: boolean): Promise<string | null> {
  if (!(await iniciarLogin()) || !auth) return "Login ainda não configurado.";
  const fbAuth = await import("firebase/auth");
  sessionStorage.setItem("eco_login_novo", "1");
  try {
    if (criar) await fbAuth.createUserWithEmailAndPassword(auth, email.trim(), senha);
    else await fbAuth.signInWithEmailAndPassword(auth, email.trim(), senha);
    return null;
  } catch (e: any) {
    sessionStorage.removeItem("eco_login_novo");
    return traduzirErro(e?.code);
  }
}

export async function sairDaConta() {
  await enviarParaNuvem();
  socketRef?.emit("conta:sair", {});
  if (auth) {
    const fbAuth = await import("firebase/auth");
    await fbAuth.signOut(auth);
  }
}

function traduzirErro(code?: string): string {
  const c = String(code || "");
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "E-mail ou senha incorretos.";
  if (c.includes("email-already-in-use")) return "Esse e-mail já tem conta. Use Entrar.";
  if (c.includes("weak-password")) return "Senha fraca: use pelo menos 6 caracteres.";
  if (c.includes("invalid-email")) return "E-mail inválido.";
  if (c.includes("unauthorized-domain")) return "Domínio não autorizado no Firebase (adicione o site em Authentication > Settings > Domínios autorizados).";
  if (c.includes("operation-not-allowed")) return "Esse tipo de login não está ativado no Firebase.";
  if (c.includes("network")) return "Sem conexão. Tente de novo.";
  if (c.includes("cancelled") || c.includes("closed-by-user")) return "Login cancelado.";
  return "Não deu pra entrar agora. Tente de novo.";
}
