/**
 * Endereço único do backend (socket.io + /api/* + /version + mídia).
 * - Front no Cloudflare Pages: defina VITE_BACKEND_URL=https://<seu-app>.up.railway.app no build.
 * - Sem VITE_BACKEND_URL: mesmo domínio da página (Render single-host continua igual).
 */
const envUrl: string = ((import.meta as any).env?.VITE_BACKEND_URL || "").trim();

function origemDaPagina(): string {
  if (typeof window === "undefined" || !window.location) return "";
  const o = window.location.origin;
  if (!o || o === "null" || o.startsWith("file:")) return "";
  return o;
}

export const BACKEND_URL: string = (envUrl || origemDaPagina() || "https://eco-m3cf.onrender.com").replace(/\/+$/, "");

/** true quando o front está num domínio e o backend em outro (Cloudflare Pages + Railway). */
export const BACKEND_OUTRA_ORIGEM: boolean = (() => {
  try {
    return new URL(BACKEND_URL).origin !== origemDaPagina();
  } catch {
    return false;
  }
})();

/** "/api/x" -> "https://backend/api/x". URLs absolutas, data: e blob: passam direto. */
export function apiUrl(caminho: string): string {
  if (!caminho) return caminho;
  if (/^(https?:|data:|blob:)/i.test(caminho)) return caminho;
  return `${BACKEND_URL}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

/** Mídia que o servidor manda com caminho relativo (/api/media/..., /api/m/...) aponta pro backend. */
export function midiaUrl(url?: string): string | undefined {
  if (!url) return url;
  return url.startsWith("/api/") ? apiUrl(url) : url;
}

/** Link de mídia de perfil gerado pelo servidor (cópia do data: que está no aparelho). */
export function ehLinkBlobServidor(url?: string): boolean {
  return typeof url === "string" && /\/api\/m\/[a-f0-9]{24}\.[a-z0-9]+(\?.*)?$/i.test(url);
}
