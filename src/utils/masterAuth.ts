import { apiUrl } from "./backend";
/**
 * Master Authentication & Owner Verification for eco
 * Client-side token storage and server verification.
 * NO plaintext passwords or owner master keys are exposed in the client-side code.
 */

const TOKEN_KEY = "eco_master_token";
const TOKEN_KEY_LEGACY = "koki_master_token";

/**
 * Validates owner credentials through the secure backend API.
 */
export async function authenticateMasterOnServer(masterKey: string): Promise<{
  success: boolean;
  masterToken?: string;
  error?: string;
}> {
  try {
    const res = await fetch(apiUrl("/api/auth/master-login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masterKey: masterKey.trim() }),
    });
    const data = await res.json();
    if (res.ok && data.success && data.masterToken) {
      return { success: true, masterToken: data.masterToken };
    }
    return { success: false, error: data.error || "Chave de dono incorreta ou não autorizada." };
  } catch (err: any) {
    return { success: false, error: "Falha de conexão com o servidor de autenticação." };
  }
}

/**
 * Checks with the server if a stored token is still valid.
 */
export async function verifyMasterTokenOnServer(token: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("/api/auth/master-check"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masterToken: token }),
    });
    const data = await res.json();
    return Boolean(data.isMaster);
  } catch {
    return false;
  }
}

export function saveMasterAuthLocally(token: string, remember: boolean = true): void {
  try {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_KEY_LEGACY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
    localStorage.setItem("eco_master_ok", "1");
    localStorage.removeItem("koki_master_key_saved");

    // Automatically enforce tag #0001 and Master Identity in stored profile
    const profileRaw = localStorage.getItem("eco_user_profile_v1") || localStorage.getItem("koki_user_profile_v3");
    let profileData: any = {};
    if (profileRaw) {
      try {
        profileData = JSON.parse(profileRaw);
      } catch {
        profileData = {};
      }
    }

    profileData.tag = "0001";
    if (!profileData.name || profileData.name.startsWith("Convidado") || profileData.name.trim() === "") {
      profileData.name = "Luiz";
    }
    profileData.customStatus = profileData.customStatus || "👑 Dono Master do eco";
    profileData.badges = Array.isArray(profileData.badges) && profileData.badges.length > 0
      ? Array.from(new Set([...profileData.badges, "owner_supreme", "eco_creator", "vip_nitro"]))
      : ["owner_supreme", "eco_creator", "vip_nitro"];

    localStorage.setItem("eco_user_profile_v1", JSON.stringify(profileData));
    localStorage.setItem("koki_user_profile_v3", JSON.stringify(profileData));
  } catch {
    // ignore
  }
}

export function clearMasterAuthLocally(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY_LEGACY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("eco_master_ok");
    localStorage.removeItem("koki_master_key_saved");

    // Reset profile tag away from #0001 to standard random tag
    const profileRaw = localStorage.getItem("eco_user_profile_v1") || localStorage.getItem("koki_user_profile_v3");
    if (profileRaw) {
      try {
        const profileData = JSON.parse(profileRaw);
        if (profileData.tag === "0001" || profileData.tag === "01" || profileData.tag === "1") {
          profileData.tag = Math.floor(1000 + Math.random() * 9000).toString();
          if (profileData.badges) {
            profileData.badges = profileData.badges.filter((b: string) => !b.includes("owner"));
          }
          localStorage.setItem("eco_user_profile_v1", JSON.stringify(profileData));
          localStorage.setItem("koki_user_profile_v3", JSON.stringify(profileData));
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

export function getStoredMasterInfo(): { isMaster: boolean; token: string | null; key: string | null } {
  try {
    const token =
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(TOKEN_KEY_LEGACY) ||
      sessionStorage.getItem(TOKEN_KEY);

    if (token && typeof token === "string" && token.trim().length >= 8) {
      return { isMaster: true, token: token.trim(), key: null };
    }
  } catch {
    // ignore
  }
  return { isMaster: false, token: null, key: null };
}

export function getMasterTokenSync(_rawKey?: string): string {
  // Só o token assinado pelo servidor vale; senha nunca vira token no navegador
  return getStoredMasterInfo().token || "";
}

export function isMasterKeyValid(_rawKey?: string | null): boolean {
  // Chave salva no navegador não dá mais acesso de Dono: só o login validado pelo servidor
  return false;
}
