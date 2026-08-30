export const DEFAULT_MASTER_KEYS = [
  "koki24122024master",
  "koki2026master",
  "kokidonomaster2026",
  "adminmasterkoki",
];

export const MASTER_SIGNING_SALT = "koki_master_voice_platform_supreme_2026";

/**
 * Checks if a provided key matches the authorized owner master key (case-insensitive, trimmed)
 */
export function isMasterKeyValid(rawKey?: string | null): boolean {
  if (!rawKey || typeof rawKey !== "string") return false;
  const clean = rawKey.trim().toLowerCase();
  if (clean.length < 4) return false;
  return DEFAULT_MASTER_KEYS.some((k) => k.toLowerCase() === clean);
}

/**
 * Computes deterministic master token matching server HMAC or local fallback
 */
export async function getMasterToken(rawKey: string): Promise<string> {
  const clean = rawKey.trim().toLowerCase();

  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const keyData = enc.encode(MASTER_SIGNING_SALT);
      const msgData = enc.encode(`owner_key:${clean}`);

      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, msgData);
      const hashArray = Array.from(new Uint8Array(signature));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // fallback
    }
  }

  return getMasterTokenSync(clean);
}

/**
 * Synchronous token generation for instant local resolution
 */
export function getMasterTokenSync(rawKey: string): string {
  const clean = rawKey.trim().toLowerCase();
  // Known pre-computed HMAC hash for "koki24122024master" with MASTER_SIGNING_SALT
  if (clean === "koki24122024master") {
    return "0bf9c4cfb565a0ec7759ad40ca0489569b917fa2b66236bcfd5f66ff2f0e4cf8";
  }
  return `koki_master_token_${clean}`;
}

export function saveMasterAuthLocally(token: string, rawKey?: string): void {
  try {
    localStorage.setItem("koki_master_token", token);
    if (rawKey) {
      localStorage.setItem("koki_master_key_saved", rawKey.trim());
    }

    // Automatically enforce tag #0001 and Master Identity in stored profile
    const profileRaw = localStorage.getItem("koki_user_profile_v3");
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
      profileData.name = "Koki u sujo";
    }
    profileData.avatarEmoji = profileData.avatarEmoji || "👑";
    profileData.customStatus = profileData.customStatus || "👑 Dono Master do Koki";
    profileData.badges = Array.isArray(profileData.badges) && profileData.badges.length > 0
      ? Array.from(new Set([...profileData.badges, "owner_supreme", "koki_creator", "nitro_owner"]))
      : ["owner_supreme", "koki_creator", "nitro_owner"];

    localStorage.setItem("koki_user_profile_v3", JSON.stringify(profileData));
  } catch {
    // ignore
  }
}

export function clearMasterAuthLocally(): void {
  try {
    localStorage.removeItem("koki_master_token");
    localStorage.removeItem("koki_master_key_saved");

    // Reset profile tag away from #0001 to standard random tag
    const profileRaw = localStorage.getItem("koki_user_profile_v3");
    if (profileRaw) {
      try {
        const profileData = JSON.parse(profileRaw);
        if (profileData.tag === "0001" || profileData.tag === "01" || profileData.tag === "1") {
          profileData.tag = Math.floor(1000 + Math.random() * 9000).toString();
          if (profileData.badges) {
            profileData.badges = profileData.badges.filter((b: string) => !b.includes("owner"));
          }
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
    const token = localStorage.getItem("koki_master_token");
    const key = localStorage.getItem("koki_master_key_saved");
    if (isMasterKeyValid(key)) {
      return { isMaster: true, token: token || getMasterTokenSync(key!), key };
    }
    if (token && typeof token === "string" && token.trim().length >= 10) {
      // Validate that the token matches a known valid master token hash
      const cleanToken = token.trim();
      const isKnownToken = DEFAULT_MASTER_KEYS.some(
        (k) => getMasterTokenSync(k) === cleanToken || cleanToken === `koki_master_token_${k.toLowerCase()}`
      ) || cleanToken === "0bf9c4cfb565a0ec7759ad40ca0489569b917fa2b66236bcfd5f66ff2f0e4cf8";

      if (isKnownToken) {
        return { isMaster: true, token: cleanToken, key: key || "koki24122024master" };
      }
    }
  } catch {
    // ignore
  }
  return { isMaster: false, token: null, key: null };
}
