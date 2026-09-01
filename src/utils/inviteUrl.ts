export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    window.location.protocol === "file:" ||
    host.endsWith(".local")
  );
}

export function getCustomPublicBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const saved = localStorage.getItem("koki_public_app_url");
  if (saved && saved.trim().startsWith("http")) {
    return saved.trim().replace(/\/+$/, "");
  }

  // Check Vite environment variable if available
  const envUrl = (import.meta as any).env?.VITE_APP_URL || (import.meta as any).env?.VITE_PUBLIC_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.startsWith("http")) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // Default to window.location.origin
  return window.location.origin.replace(/\/+$/, "");
}

export function setCustomPublicBaseUrl(url: string): void {
  if (typeof window === "undefined") return;
  if (!url || url.trim().length === 0) {
    localStorage.removeItem("koki_public_app_url");
  } else {
    let clean = url.trim();
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = `https://${clean}`;
    }
    localStorage.setItem("koki_public_app_url", clean.replace(/\/+$/, ""));
  }
}

export function getEffectiveInviteUrl(roomId: string, role?: string): string {
  const base = getCustomPublicBaseUrl();
  const cleanId = (roomId || "main-lounge").trim();
  return `${base}/?room=${encodeURIComponent(cleanId)}`;
}

export function generateInviteMessage(roomId: string, roomName?: string): string {
  const url = getEffectiveInviteUrl(roomId);
  const title = roomName ? `para a sala "${roomName}"` : "para a chamada";
  return `🎧 Convite ${title} no Koki Call!\n\n🔗 Link direto da sala:\n${url}\n\n🔑 Código da sala: ${roomId}\n\n✨ (Abre direto no navegador do celular ou PC - sem precisar de cadastro ou downloads!)`;
}
