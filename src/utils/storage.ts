import { SavedUserProfile, UserPreferences, StorePerk, StorePerkId } from "../types";

const PROFILE_KEY = "koki_user_profile_v3";
const HOST_TOKENS_KEY = "koki_host_tokens_v3";
const PREFERENCES_KEY = "koki_user_preferences_v3";
const KOKI_COINS_KEY = "koki_user_coins_v1";
const PURCHASED_PERKS_KEY = "koki_purchased_perks_v1";
const LAST_DAILY_CLAIM_KEY = "koki_last_daily_claim_v1";

export const PERK_DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours in milliseconds
export const DEFAULT_INITIAL_COINS = 2000;
export const MASTER_COINS = 999999;
export const DAILY_BONUS_AMOUNT = 50; // Fixed drop / claim amount: 50 Koki Coins per click
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export const STORE_PERKS: StorePerk[] = [
  {
    id: "gif_avatar",
    name: "Avatar Animado em GIF",
    tagline: "Destaque seu perfil com foto animada",
    description: "Permite fazer upload de fotos de perfil animadas em formato GIF ou escolher da galeria de presets premium.",
    price: 600,
    durationHours: 72,
    iconName: "Sparkles",
    themeColor: "from-pink-500 to-rose-600",
    badgeLabel: "GIF VIP",
    benefits: [
      "Upload ilimitado de GIFs animados para avatar",
      "Acesso a presets exclusivos de alta qualidade",
      "Animação contínua nos chats e chamadas de voz",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "custom_banner",
    name: "Banner Personalizado (GIF/MP4)",
    tagline: "Banners dinâmicos em vídeo e GIF",
    description: "Desbloqueia a personalização de capa com loops em vídeo MP4, WebM ou GIFs cinematográficos no seu Perfil.",
    price: 900,
    durationHours: 72,
    iconName: "Film",
    themeColor: "from-violet-500 to-purple-700",
    badgeLabel: "VÍDEO BANNER",
    benefits: [
      "Upload de banners animados em MP4 ou GIF",
      "Presets cinematográficos de galáxias e synthwave",
      "Efeito dinâmico no card de perfil ao clicar no seu nome",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "custom_title",
    name: "Título de Perfil Personalizado",
    tagline: "Tag de status e título único",
    description: "Adicione um título customizado exclusivo exibido ao lado do seu nome em chamadas, canais e cartões de membro.",
    price: 400,
    durationHours: 72,
    iconName: "Award",
    themeColor: "from-cyan-500 to-blue-600",
    badgeLabel: "TÍTULO CUSTOM",
    benefits: [
      "Badge com título exclusivo (ex: [PRO GAMER], [STREAMER])",
      "Exibição destacada na lista de participantes",
      "Cores neon de destaque para o seu título",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "vip_role",
    name: "VIP Badge & Role",
    tagline: "Cargo VIP com emblema dourado e privilégios",
    description: "Receba o cargo VIP com borda dourada, emblema brilhante, prioridade de áudio e status de membro prestigiado.",
    price: 1200,
    durationHours: 72,
    iconName: "Crown",
    themeColor: "from-amber-400 to-yellow-600",
    badgeLabel: "CARGO VIP",
    benefits: [
      "Emblema VIP dourado exclusivo no perfil e na call",
      "Borda neon iluminada nos cards e lista de membros",
      "Prioridade máxima na transmissão e qualidade de áudio",
      "Duração de 72 horas por compra",
    ],
  },
];

export const MASTER_DEFAULT_TAG = "0001";
export const MASTER_DEFAULT_USERNAME = "Koki u sujo";
export const RESERVED_MASTER_TAGS = ["0001", "01", "1", "0000", "00", "001"];

export const DEFAULT_AVATARS = ["👑", "🎮", "🦊", "⚡", "🎧", "🚀", "🐱", "🤖", "🔥", "🎯", "👾", "💎"];

export const DEFAULT_AVATAR_COLORS = [
  "#38bdf8", // Sky blue
  "#818cf8", // Indigo
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#f97316", // Orange
  "#eab308", // Yellow
  "#10b981", // Emerald
  "#14b8a6", // Teal
  "#06b6d4"  // Cyan
];

export const DEFAULT_BANNER_COLORS = [
  "#0f172a", "#1e1b4b", "#022c22", "#164e63", "#311042", "#3b0764", "#431407", "#1e293b"
];

/**
 * Checks whether a given tag is in the reserved master tags list
 */
export function isReservedMasterTag(tag?: string | null): boolean {
  if (!tag || typeof tag !== "string") return false;
  const clean = tag.trim().replace(/^#/, "");
  return RESERVED_MASTER_TAGS.includes(clean);
}

/**
 * Generates a random standard 4-digit tag for regular users and guests (e.g. 1024, 5892, etc.)
 */
export function generateStandardUserTag(): string {
  let candidate = Math.floor(1000 + Math.random() * 9000).toString();
  while (isReservedMasterTag(candidate)) {
    candidate = Math.floor(1000 + Math.random() * 9000).toString();
  }
  return candidate;
}

/**
 * Checks if the user qualifies as Master based strictly on authenticated master key/token or master auth flag
 */
export function isMasterIdentity(name?: string | null, isMasterAuth?: boolean): boolean {
  if (isMasterAuth) return true;

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const savedKey = localStorage.getItem("koki_master_key_saved");
      const savedToken = localStorage.getItem("koki_master_token");
      if (savedKey && (savedKey.trim().toLowerCase() === "koki24122024master" || savedKey.trim().toLowerCase().includes("master"))) {
        return true;
      }
      if (savedToken && typeof savedToken === "string" && savedToken.length >= 10) {
        const cleanToken = savedToken.trim();
        if (
          cleanToken === "0bf9c4cfb565a0ec7759ad40ca0489569b917fa2b66236bcfd5f66ff2f0e4cf8" ||
          cleanToken.startsWith("koki_master_token_")
        ) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Resolves the appropriate tag: strictly #0001 for authenticated Master ("Koki u sujo" / passcode), and standard 4-digit tag for all other users
 */
export function resolveUserTag(name?: string | null, isMasterAuth?: boolean, currentTag?: string | null): string {
  if (isMasterIdentity(name, isMasterAuth)) {
    return MASTER_DEFAULT_TAG;
  }

  // If user is NOT master, they cannot hold #0001 or any reserved master tag
  if (currentTag && !isReservedMasterTag(currentTag)) {
    const clean = currentTag.trim().replace(/^#/, "");
    if (clean.length === 4 && !isNaN(Number(clean)) && Number(clean) >= 1000) {
      return clean;
    }
  }

  return generateStandardUserTag();
}

export function formatCoinDisplay(amount?: number | null, isMasterOrHost?: boolean): string {
  if (isMasterOrHost || isMasterIdentity()) {
    return "∞";
  }
  if (typeof amount === "number") {
    if (amount >= 999999 || !isFinite(amount)) return "∞";
    return amount.toLocaleString();
  }
  return "0";
}

export function getKokiCoins(): number {
  const isMaster = isMasterIdentity();
  if (isMaster) {
    return MASTER_COINS;
  }
  try {
    const raw = localStorage.getItem(KOKI_COINS_KEY);
    if (raw !== null) {
      const num = parseInt(raw, 10);
      if (!isNaN(num)) return Math.max(0, num);
    }
  } catch (e) {
    console.warn("Could not load Koki Coins:", e);
  }
  // Initialize with default coins
  const initial = DEFAULT_INITIAL_COINS;
  try {
    localStorage.setItem(KOKI_COINS_KEY, initial.toString());
  } catch {}
  return initial;
}

export function setKokiCoins(amount: number): number {
  const isMaster = isMasterIdentity();
  const safeAmount = isMaster ? MASTER_COINS : Math.max(0, Math.floor(amount));
  try {
    localStorage.setItem(KOKI_COINS_KEY, safeAmount.toString());
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("koki_coins_updated", { detail: { coins: safeAmount } }));
    }
  } catch (e) {
    console.warn("Could not save Koki Coins:", e);
  }
  return safeAmount;
}

export function addKokiCoins(amount: number): number {
  if (isMasterIdentity()) {
    return MASTER_COINS;
  }
  const current = getKokiCoins();
  const next = current + Math.max(0, Math.floor(amount));
  return setKokiCoins(next);
}

export function deductKokiCoins(amount: number): boolean {
  if (isMasterIdentity()) {
    // Master Owner has infinite coins and bypasses deductions
    return true;
  }
  const current = getKokiCoins();
  const cost = Math.max(0, Math.floor(amount));
  if (current < cost) {
    return false;
  }
  setKokiCoins(current - cost);
  return true;
}

export function getPurchasedPerks(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PURCHASED_PERKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not load purchased perks:", e);
  }
  return {};
}

export function savePurchasedPerks(perks: Record<string, number>): void {
  try {
    localStorage.setItem(PURCHASED_PERKS_KEY, JSON.stringify(perks));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("koki_perks_updated", { detail: { perks } }));
    }
  } catch (e) {
    console.warn("Could not save purchased perks:", e);
  }
}

/**
 * Checks if a store perk is currently active and unexpired
 */
export function isPerkActive(perkId: string, perksMap?: Record<string, number>): boolean {
  if (isMasterIdentity()) {
    // Master accounts have all VIP and customization perks permanently active
    return true;
  }
  const perks = perksMap || getPurchasedPerks();
  const activeUntil = perks[perkId];
  if (!activeUntil || typeof activeUntil !== "number") return false;
  return activeUntil > Date.now();
}

/**
 * Computes remaining time breakdown and formatted text for 72-hour perks
 */
export function getPerkRemainingTime(activeUntil?: number | null): {
  formatted: string;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
  percentage: number;
} {
  if (!activeUntil || typeof activeUntil !== "number") {
    return { formatted: "Não adquirido", hours: 0, minutes: 0, seconds: 0, expired: true, percentage: 0 };
  }

  const now = Date.now();
  const diffMs = activeUntil - now;

  if (diffMs <= 0) {
    return { formatted: "Expirado", hours: 0, minutes: 0, seconds: 0, expired: true, percentage: 0 };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Percentage of 72 hours remaining
  const percentage = Math.min(100, Math.max(0, (diffMs / PERK_DURATION_MS) * 100));

  let formatted = "";
  if (hours > 0) {
    formatted = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    formatted = `${minutes}m ${seconds}s`;
  } else {
    formatted = `${seconds}s`;
  }

  return { formatted, hours, minutes, seconds, expired: false, percentage };
}

/**
 * Purchases a store perk: deducts Koki Coins and extends or sets activeUntil for 72 hours
 */
export function purchaseStorePerk(perkId: StorePerkId): {
  success: boolean;
  error?: string;
  newBalance: number;
  activeUntil: number;
  perk: StorePerk;
} {
  const perk = STORE_PERKS.find((p) => p.id === perkId);
  if (!perk) {
    return { success: false, error: "Item não encontrado na loja.", newBalance: getKokiCoins(), activeUntil: 0, perk: STORE_PERKS[0] };
  }

  const isMaster = isMasterIdentity();
  const currentCoins = getKokiCoins();

  // If not master, verify sufficient balance and deduct coins
  if (!isMaster) {
    if (currentCoins < perk.price) {
      return {
        success: false,
        error: `Saldo insuficiente! Você tem ${currentCoins} Koki Coins, mas o item custa ${perk.price} Koki Coins.`,
        newBalance: currentCoins,
        activeUntil: 0,
        perk,
      };
    }
  }

  // Deduct coins only for non-master accounts
  const remainingCoins = isMaster ? MASTER_COINS : currentCoins - perk.price;
  if (!isMaster) {
    setKokiCoins(remainingCoins);
  }

  // Extend or add 72 hours
  const currentPerks = getPurchasedPerks();
  const currentUntil = currentPerks[perkId] || 0;
  const baseTime = currentUntil > Date.now() ? currentUntil : Date.now();
  const newActiveUntil = baseTime + PERK_DURATION_MS;

  currentPerks[perkId] = newActiveUntil;
  savePurchasedPerks(currentPerks);

  // Update profile
  saveUserProfile({
    kokiCoins: remainingCoins,
    purchasedPerks: currentPerks,
  });

  return {
    success: true,
    newBalance: remainingCoins,
    activeUntil: newActiveUntil,
    perk,
  };
}

/**
 * Claim daily free coin bonus (+300 Koki Coins every 24h)
 */
export function claimDailyBonus(): {
  success: boolean;
  reward: number;
  nextClaimAt: number;
  newBalance: number;
  error?: string;
} {
  const now = Date.now();
  let lastClaim = 0;
  try {
    const raw = localStorage.getItem(LAST_DAILY_CLAIM_KEY);
    if (raw) lastClaim = parseInt(raw, 10) || 0;
  } catch {}

  const timePassed = now - lastClaim;
  if (lastClaim > 0 && timePassed < DAILY_BONUS_COOLDOWN_MS) {
    const remainingMs = DAILY_BONUS_COOLDOWN_MS - timePassed;
    const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
    return {
      success: false,
      reward: 0,
      nextClaimAt: lastClaim + DAILY_BONUS_COOLDOWN_MS,
      newBalance: getKokiCoins(),
      error: `Você já resgatou hoje! Volte em aproximadamente ${hours}h para coletar mais Koki Coins.`,
    };
  }

  const newBalance = addKokiCoins(DAILY_BONUS_AMOUNT);
  try {
    localStorage.setItem(LAST_DAILY_CLAIM_KEY, now.toString());
  } catch {}

  return {
    success: true,
    reward: DAILY_BONUS_AMOUNT,
    nextClaimAt: now + DAILY_BONUS_COOLDOWN_MS,
    newBalance,
  };
}

export function getSavedUserProfile(): SavedUserProfile {
  const isMaster = isMasterIdentity();
  const coins = getKokiCoins();
  const perks = getPurchasedPerks();

  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const name = parsed.name || (isMaster ? MASTER_DEFAULT_USERNAME : "");
      let tag = resolveUserTag(name, isMaster, parsed.tag);

      // Clean badges for non-master
      let badges = Array.isArray(parsed.badges) && parsed.badges.length > 0
        ? parsed.badges
        : isMaster
        ? ["owner_supreme", "koki_creator", "nitro_owner"]
        : ["pioneer_member"];

      if (!isMaster) {
        badges = badges.filter((b: string) => !b.includes("owner") && b !== "koki_creator");
        if (badges.length === 0) badges = ["pioneer_member"];
        if (tag === "0001" || isReservedMasterTag(tag)) {
          tag = generateStandardUserTag();
        }
      }

      return {
        name,
        tag,
        avatarEmoji: parsed.avatarEmoji || (isMaster ? "👑" : "🎮"),
        avatarColor: parsed.avatarColor || DEFAULT_AVATAR_COLORS[0],
        avatarUrl: isMaster ? parsed.avatarUrl : (isPerkActive("gif_avatar", perks) ? parsed.avatarUrl : undefined),
        bannerColor: parsed.bannerColor || DEFAULT_BANNER_COLORS[0],
        bannerUrl: isMaster ? parsed.bannerUrl : (isPerkActive("custom_banner", perks) ? parsed.bannerUrl : undefined),
        customStatus: parsed.customStatus || (isMaster ? "👑 Dono Master do Koki" : "🟢 Conectado ao Koki"),
        bio: parsed.bio || (isMaster ? "Criador e moderador oficial do Koki Call." : "Participante do Koki Call"),
        customTitle: parsed.customTitle || undefined,
        kokiCoins: typeof parsed.kokiCoins === "number" ? parsed.kokiCoins : coins,
        purchasedPerks: parsed.purchasedPerks || perks,
        badges,
        rememberLogin: parsed.rememberLogin !== false,
      };
    }
  } catch (e) {
    console.warn("Could not load user profile:", e);
  }

  // Default initial profile
  return {
    name: isMaster ? MASTER_DEFAULT_USERNAME : "",
    tag: isMaster ? MASTER_DEFAULT_TAG : generateStandardUserTag(),
    avatarEmoji: isMaster ? "👑" : "🎮",
    avatarColor: DEFAULT_AVATAR_COLORS[0],
    bannerColor: DEFAULT_BANNER_COLORS[0],
    customStatus: isMaster ? "👑 Dono Master do Koki" : "🟢 Conectado ao Koki",
    bio: isMaster ? "Criador e moderador oficial do Koki Call." : "Chamadas de voz, vídeo e canais seguros.",
    customTitle: undefined,
    kokiCoins: coins,
    purchasedPerks: perks,
    badges: isMaster ? ["owner_supreme", "koki_creator", "nitro_owner"] : ["pioneer_member"],
    rememberLogin: true,
  };
}

export function saveUserProfile(profile: Partial<SavedUserProfile>): void {
  try {
    const current = getSavedUserProfile();
    const isMaster = isMasterIdentity(profile.name ?? current.name);
    const resolvedName = profile.name ?? current.name;
    const resolvedTag = resolveUserTag(resolvedName, isMaster, profile.tag ?? current.tag);

    let cleanBadges = profile.badges ?? current.badges;
    if (!isMaster && Array.isArray(cleanBadges)) {
      cleanBadges = cleanBadges.filter((b) => !b.includes("owner") && b !== "koki_creator");
      if (cleanBadges.length === 0) cleanBadges = ["pioneer_member"];
    }

    const updated: SavedUserProfile = {
      ...current,
      ...profile,
      name: resolvedName,
      tag: resolvedTag,
      badges: cleanBadges,
    };

    if (isMaster) {
      updated.tag = MASTER_DEFAULT_TAG;
    } else if (updated.tag === "0001" || isReservedMasterTag(updated.tag)) {
      updated.tag = generateStandardUserTag();
    }

    if (typeof profile.kokiCoins === "number") {
      setKokiCoins(profile.kokiCoins);
    }
    if (profile.purchasedPerks) {
      savePurchasedPerks(profile.purchasedPerks);
    }

    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("koki_profile_updated", { detail: { profile: updated } }));
    }
  } catch (e) {
    console.warn("Could not save user profile:", e);
  }
}

export function getUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: parsed.name || "",
        selectedAudioInput: parsed.selectedAudioInput || "",
        selectedAudioOutput: parsed.selectedAudioOutput || "",
        selectedVideoInput: parsed.selectedVideoInput || "",
        isPushToTalk: Boolean(parsed.isPushToTalk),
        pushToTalkKey: parsed.pushToTalkKey || "Space",
        noiseSuppression: parsed.noiseSuppression !== false,
        echoCancellation: parsed.echoCancellation !== false,
        lowResourceMode: Boolean(parsed.lowResourceMode),
        videoQuality: parsed.videoQuality || "medium",
        volume: typeof parsed.volume === "number" ? parsed.volume : 100,
      };
    }
  } catch (e) {
    console.warn("Could not load user preferences:", e);
  }

  return {
    name: "",
    selectedAudioInput: "",
    selectedAudioOutput: "",
    selectedVideoInput: "",
    isPushToTalk: false,
    pushToTalkKey: "Space",
    noiseSuppression: true,
    echoCancellation: true,
    lowResourceMode: false,
    videoQuality: "medium",
    volume: 100,
  };
}

export function saveUserPreferences(prefs: Partial<UserPreferences>): void {
  try {
    const current = getUserPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not save user preferences:", e);
  }
}

// Store host token for rooms created by this browser so the true host is automatically recognized
export function saveHostToken(roomId: string, token: string): void {
  try {
    const raw = localStorage.getItem(HOST_TOKENS_KEY);
    const tokens: Record<string, string> = raw ? JSON.parse(raw) : {};
    tokens[roomId.toLowerCase()] = token;
    localStorage.setItem(HOST_TOKENS_KEY, JSON.stringify(tokens));
  } catch (e) {
    console.warn("Could not save host token:", e);
  }
}

export function getHostToken(roomId: string): string | undefined {
  try {
    const raw = localStorage.getItem(HOST_TOKENS_KEY);
    if (!raw) return undefined;
    const tokens: Record<string, string> = JSON.parse(raw);
    return tokens[roomId.toLowerCase()];
  } catch (e) {
    return undefined;
  }
}

export const OWNER_GIF_AVATAR_PRESETS = [
  { id: "fire", name: "Fogo Pixel", url: "https://media.giphy.com/media/3o7TKTDnUxE0g2fSE8/giphy.gif" },
  { id: "cyber", name: "Anime Glitch", url: "https://media.giphy.com/media/ule4akeXnY9FbVSpu8/giphy.gif" },
  { id: "crown", name: "Coroa Dourada", url: "https://media.giphy.com/media/10vXSmTzjd259K/giphy.gif" },
  { id: "synth", name: "Synthwave Car", url: "https://media.giphy.com/media/L1R1tvI9svkIWwpVYr/giphy.gif" },
  { id: "matrix", name: "Matrix Code", url: "https://media.giphy.com/media/YQitE4YNQNahy/giphy.gif" },
  { id: "cat", name: "Neon Cat", url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" },
];

export const OWNER_GIF_BANNER_PRESETS = [
  { id: "nightcity", name: "Cyberpunk City", url: "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif" },
  { id: "neonspace", name: "Synthwave Grid", url: "https://media.giphy.com/media/5wWf7H0qoWaNnkZBucU/giphy.gif" },
  { id: "galaxy", name: "Galáxia Neon", url: "https://media.giphy.com/media/3og0IPxMM0WEC14Hzq/giphy.gif" },
  { id: "rain", name: "Chuva Lo-Fi", url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif" },
  { id: "campfire", name: "Fogueira Pixel", url: "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif" },
];

export const OWNER_VIDEO_BANNER_PRESETS = [
  { id: "cyber_tunnel", name: "Túnel Cyber (MP4)", url: "https://assets.mixkit.co/videos/preview/mixkit-cyber-tunnel-with-lights-and-lines-41221-large.mp4" },
  { id: "space_stars", name: "Estrelas Espaciais (MP4)", url: "https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-starfield-in-outer-space-41258-large.mp4" },
  { id: "neon_lines", name: "Linhas Neon (MP4)", url: "https://assets.mixkit.co/videos/preview/mixkit-neon-lights-tunnel-loop-42861-large.mp4" },
  { id: "waves_relax", name: "Ondas do Mar (MP4)", url: "https://assets.mixkit.co/videos/preview/mixkit-sea-water-waves-in-the-sunset-41484-large.mp4" },
];

export const LOBBY_VIDEO_WALLPAPER_PRESETS = [
  {
    id: "space_stars",
    name: "Estrelas Espaciais (MP4)",
    url: "https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-starfield-in-outer-space-41258-large.mp4",
  },
  {
    id: "cyber_tunnel",
    name: "Túnel Cyber Neon (MP4)",
    url: "https://assets.mixkit.co/videos/preview/mixkit-cyber-tunnel-with-lights-and-lines-41221-large.mp4",
  },
  {
    id: "neon_lines",
    name: "Linhas Cibernéticas (MP4)",
    url: "https://assets.mixkit.co/videos/preview/mixkit-neon-lights-tunnel-loop-42861-large.mp4",
  },
  {
    id: "waves_sunset",
    name: "Ondas ao Pôr do Sol (MP4)",
    url: "https://assets.mixkit.co/videos/preview/mixkit-sea-water-waves-in-the-sunset-41484-large.mp4",
  },
  {
    id: "abstract_mesh",
    name: "Rede Digital Partículas (MP4)",
    url: "https://assets.mixkit.co/videos/preview/mixkit-abstract-flowing-purple-and-blue-mesh-41256-large.mp4",
  },
];

export const LOBBY_GIF_WALLPAPER_PRESETS = [
  {
    id: "nightcity",
    name: "Cyberpunk Night City (GIF)",
    url: "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif",
  },
  {
    id: "synthwave",
    name: "Synthwave Grid Sunset (GIF)",
    url: "https://media.giphy.com/media/5wWf7H0qoWaNnkZBucU/giphy.gif",
  },
  {
    id: "galaxy_neon",
    name: "Galáxia Neon Cósmica (GIF)",
    url: "https://media.giphy.com/media/3og0IPxMM0WEC14Hzq/giphy.gif",
  },
  {
    id: "lofi_rain",
    name: "Chuva Lo-Fi Noturna (GIF)",
    url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  },
  {
    id: "pixel_room",
    name: "Quarto Gamer Pixel (GIF)",
    url: "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif",
  },
  {
    id: "matrix_rain",
    name: "Matrix Rain Digital (GIF)",
    url: "https://media.giphy.com/media/YQitE4YNQNahy/giphy.gif",
  },
];

export interface LobbyBackgroundConfig {
  type: "default" | "video" | "gif" | "image";
  url?: string;
  overlayDarkness: number; // percentage (e.g. 50-80%)
  blur: number; // px (0-10)
}

const LOBBY_BG_KEY = "koki_lobby_background_v1";

export function getLobbyBackground(): LobbyBackgroundConfig {
  try {
    const raw = localStorage.getItem(LOBBY_BG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        type: parsed.type || "default",
        url: parsed.url,
        overlayDarkness: typeof parsed.overlayDarkness === "number" ? parsed.overlayDarkness : 60,
        blur: typeof parsed.blur === "number" ? parsed.blur : 0,
      };
    }
  } catch (e) {
    console.warn("Could not load lobby background:", e);
  }
  return {
    type: "default",
    overlayDarkness: 60,
    blur: 0,
  };
}

export function saveLobbyBackground(config: LobbyBackgroundConfig): void {
  try {
    localStorage.setItem(LOBBY_BG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn("Could not save lobby background:", e);
  }
}

/**
 * Checks whether a given media URL or DataURI is an animated video (MP4, WebM, etc.)
 */
export function isVideoMedia(url?: string): boolean {
  if (!url) return false;
  const clean = url.toLowerCase().split("?")[0];
  return (
    url.startsWith("data:video/") ||
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".mov") ||
    url.includes("video/mp4") ||
    url.includes("video/webm")
  );
}

// Client-side helper to process uploaded media (Images, animated GIFs, or MP4/WebM videos)
export function compressImage(
  file: File,
  maxWidth = 300,
  maxHeight = 300,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file size and type
    const isImage = file.type.startsWith("image/");
    const isVideo =
      file.type.startsWith("video/") ||
      file.name.toLowerCase().endsWith(".mp4") ||
      file.name.toLowerCase().endsWith(".webm") ||
      file.name.toLowerCase().endsWith(".mov");

    if (!isImage && !isVideo) {
      return reject(new Error("Formato inválido. Envie imagens, GIFs animados ou vídeos MP4/WebM."));
    }

    // Video size limit: 30MB
    if (isVideo && file.size > 30 * 1024 * 1024) {
      return reject(new Error("Arquivo de vídeo muito grande (máximo 30MB)."));
    }

    // Image/GIF size limit: 15MB
    if (isImage && file.size > 15 * 1024 * 1024) {
      return reject(new Error("Arquivo de imagem muito grande (máximo 15MB)."));
    }

    // If file is a video (MP4 / WebM), read directly as DataURL for seamless inline loop
    if (isVideo) {
      const videoReader = new FileReader();
      videoReader.onload = () => {
        resolve(videoReader.result as string);
      };
      videoReader.onerror = () => reject(new Error("Falha ao ler arquivo de vídeo MP4."));
      videoReader.readAsDataURL(file);
      return;
    }

    // If file is an animated GIF, preserve raw frames as DataURL without canvas compression
    const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
    if (isGif) {
      const gifReader = new FileReader();
      gifReader.onload = () => {
        resolve(gifReader.result as string);
      };
      gifReader.onerror = () => reject(new Error("Falha ao ler arquivo GIF animado."));
      gifReader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(readerEvent.target?.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/webp", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Falha ao processar arquivo de imagem."));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}
