import { SavedUserProfile, UserPreferences, StorePerk, StorePerkId } from "../types";
import { aplicarAjustes } from "./lojaAjustes";
import { ehLinkBlobServidor } from "./backend";

const PROFILE_KEY = "eco_user_profile_v1";
const PROFILE_KEY_LEGACY = "koki_user_profile_v3";
const HOST_TOKENS_KEY = "eco_host_tokens_v1";
const PREFERENCES_KEY = "eco_user_preferences_v1";
const ECO_COINS_KEY = "eco_user_coins_v1";
const KOKI_COINS_KEY = "koki_user_coins_v1";
const PURCHASED_PERKS_KEY = "eco_purchased_perks_v1";
const LAST_DAILY_CLAIM_KEY = "eco_last_daily_claim_v1";

export const PERK_DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours in milliseconds
export const DEFAULT_INITIAL_COINS = 2000;
export const MASTER_COINS = 999999;
export const DAILY_BONUS_AMOUNT = 50; // Fixed drop / claim amount: 50 Eco Coins per click
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

const STORE_ITEMS_CUSTOM_KEY = "eco_custom_store_items_v1";
const STORE_PRICE_AUDIT_KEY = "eco_store_price_audit_v1";
const STORE_REWARD_SETTINGS_KEY = "eco_store_reward_settings_v1";

export interface StoreRewardSettings {
  coinsPerHour: number;
  dailyBonusAmount: number;
}

export const DEFAULT_REWARD_SETTINGS: StoreRewardSettings = {
  coinsPerHour: 100,
  dailyBonusAmount: 50,
};

export const INITIAL_STORE_ITEMS: StorePerk[] = [
  {
    id: "ring_nebulosa",
    name: "Anel Nebulosa",
    tagline: "Destaque da semana com anéis orbitais quádruplos",
    description: "Anel celestial degradê ciano e lilás com micro-satélites orbitando seu avatar.",
    price: 300,
    durationHours: 72,
    iconName: "Sparkles",
    themeColor: "from-teal-400 to-violet-500",
    badgeLabel: "DESTAQUE",
    category: "rings",
    previewType: "ring",
    previewValue: "nebulosa",
    isFeatured: true,
    featuredExpiresAt: Date.now() + 2 * 24 * 3600 * 1000 + 14 * 3600 * 1000,
    isActive: true,
    sortOrder: 1,
    benefits: [
      "Anel orbital quádruplo neon verde-água e lilás",
      "Micro-satélites orbitando suavemente seu avatar",
      "Visível no seu card de perfil e na lista de membros",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "gif_avatar",
    name: "Avatar animado",
    tagline: "Upload de fotos e GIFs animados para perfil",
    description: "Permite usar GIFs animados ou fotos personalizadas em movimento no perfil e na call.",
    price: 150,
    durationHours: 72,
    iconName: "Sparkles",
    themeColor: "from-teal-400 to-emerald-600",
    badgeLabel: "72h",
    category: "avatars",
    previewType: "avatar",
    isActive: true,
    sortOrder: 2,
    benefits: [
      "Upload ilimitado de GIFs animados para avatar",
      "Acesso a galeria de presets cósmicos exclusivos",
      "Animação contínua nas chamadas de voz e canais",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "vip_role",
    name: "Cargo VIP",
    tagline: "Cargo VIP com emblema lilás e prestígio",
    description: "Receba o cargo VIP com borda lilás suave, canal VIP liberado e prioridade de áudio.",
    price: 500,
    durationHours: 72,
    iconName: "Crown",
    themeColor: "from-violet-400 to-purple-600",
    badgeLabel: "72h",
    category: "vip",
    previewType: "vip",
    isActive: true,
    isVipOnly: false,
    sortOrder: 3,
    benefits: [
      "Emblema VIP lilás exclusivo no perfil e na call",
      "Acesso direto à Call VIP trancada",
      "Borda sutil iluminada nos cards e lista de membros",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "banner_nebulosa",
    name: "Banner Nebulosa",
    tagline: "Banner cinematográfico em degrade espacial",
    description: "Capa do perfil em loop cósmico de estrelas e nebulosa em alta definição.",
    price: 200,
    durationHours: 72,
    iconName: "Film",
    themeColor: "from-violet-500 to-cyan-500",
    badgeLabel: "72h",
    category: "banners",
    previewType: "banner",
    isActive: true,
    sortOrder: 4,
    benefits: [
      "Capa dinâmica com nebulosa espacial",
      "Transição suave de degradê no topo do perfil",
      "Compatível com dispositivos móveis e desktop",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "ring_aurora",
    name: "Anel Aurora",
    tagline: "Anel orbital com brilho suave e satélites",
    description: "Anel de órbita em tons de aurora boreal verde-água brilhante ao redor do avatar.",
    price: 250,
    durationHours: 72,
    iconName: "Sparkles",
    themeColor: "from-emerald-400 to-teal-500",
    badgeLabel: "72h",
    category: "rings",
    previewType: "ring",
    previewValue: "aurora",
    isActive: true,
    sortOrder: 5,
    benefits: [
      "Anel orbital vibrante no estilo Aurora",
      "Brilho suave pulsante nas chamadas",
      "Combina perfeitamente com qualquer avatar",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "custom_title",
    name: "Título personalizado",
    tagline: "Tag de status e título único",
    description: "Adicione uma tag personalizada exclusiva exibida ao lado do seu nome no perfil.",
    price: 100,
    durationHours: 72,
    iconName: "Award",
    themeColor: "from-teal-500 to-cyan-600",
    badgeLabel: "72h",
    category: "titles",
    previewType: "title",
    isActive: true,
    sortOrder: 6,
    benefits: [
      "Badge com título exclusivo ao lado do seu nome",
      "Exibição destacada na lista de participantes",
      "Cores customizadas para seu título",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "custom_banner",
    name: "Banner Personalizado (GIF/MP4)",
    tagline: "Banners dinâmicos em vídeo e GIF",
    description: "Desbloqueia a personalização de capa com loops em vídeo MP4, WebM ou GIFs no perfil.",
    price: 900,
    durationHours: 72,
    iconName: "Film",
    themeColor: "from-violet-500 to-purple-700",
    badgeLabel: "72h",
    category: "banners",
    previewType: "banner",
    isActive: true,
    sortOrder: 7,
    benefits: [
      "Upload de banners animados em MP4 ou GIF",
      "Presets cinematográficos de galáxias e neon",
      "Efeito dinâmico no card de perfil Órbita",
      "Duração de 72 horas por compra",
    ],
  },
  {
    id: "aura_card",
    name: "Aura do card",
    tagline: "Brilho suave em volta do seu card de perfil",
    description: "Um brilho que pulsa devagar na borda do seu card. Escolha a cor: Azul, Rosa, Verde, Roxo, Laranja ou Vermelho.",
    price: 400,
    durationHours: 72,
    iconName: "Sparkles",
    themeColor: "from-sky-400 to-pink-500",
    badgeLabel: "72h",
    category: "auras",
    previewType: "aura",
    isActive: true,
    sortOrder: 8,
    benefits: [
      "Brilho suave pulsando na borda do seu card",
      "6 cores pra escolher no botão Mudar aura",
      "Aparece pra todo mundo, até com você offline",
      "Duração de 72 horas por compra",
    ],
  },
];

export function getStoreItems(): StorePerk[] {
  try {
    const raw = localStorage.getItem(STORE_ITEMS_CUSTOM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Itens novos da loja (ex.: Aura do card) aparecem mesmo pra quem tem a lista antiga salva
        const ids = new Set(parsed.map((i: any) => i?.id));
        return aplicarAjustes([...parsed, ...INITIAL_STORE_ITEMS.filter((i) => !ids.has(i.id))]);
      }
    }
  } catch (e) {
    console.warn("Could not load custom store items:", e);
  }
  // Preços definidos pelo Dono Master no servidor valem para todo mundo
  return aplicarAjustes(INITIAL_STORE_ITEMS);
}

export function saveStoreItems(items: StorePerk[]): void {
  try {
    localStorage.setItem(STORE_ITEMS_CUSTOM_KEY, JSON.stringify(items));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("eco_store_items_updated", { detail: { items } }));
    }
  } catch (e) {
    console.warn("Could not save store items:", e);
  }
}

export function getStoreRewardSettings(): StoreRewardSettings {
  try {
    const raw = localStorage.getItem(STORE_REWARD_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_REWARD_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_REWARD_SETTINGS;
}

export function saveStoreRewardSettings(settings: StoreRewardSettings): void {
  try {
    localStorage.setItem(STORE_REWARD_SETTINGS_KEY, JSON.stringify(settings));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("eco_reward_settings_updated", { detail: { settings } }));
    }
  } catch {}
}

export interface StorePriceAuditItem {
  id: string;
  itemId: string;
  itemName: string;
  oldPrice: number;
  newPrice: number;
  timestamp: number;
}

export function getStorePriceAuditLogs(): StorePriceAuditItem[] {
  try {
    const raw = localStorage.getItem(STORE_PRICE_AUDIT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function addStorePriceAuditLog(entry: Omit<StorePriceAuditItem, "id" | "timestamp">): void {
  try {
    const logs = getStorePriceAuditLogs();
    const item: StorePriceAuditItem = {
      ...entry,
      id: Math.random().toString(36).slice(2, 8),
      timestamp: Date.now(),
    };
    logs.unshift(item);
    localStorage.setItem(STORE_PRICE_AUDIT_KEY, JSON.stringify(logs.slice(0, 50)));
  } catch {}
}

export const STORE_PERKS: StorePerk[] = INITIAL_STORE_ITEMS;

export const MASTER_DEFAULT_TAG = "0001";
export const MASTER_DEFAULT_USERNAME = "Luiz";
export const RESERVED_MASTER_TAGS = ["0001", "01", "1", "0000", "00", "001"];

export const DEFAULT_AVATAR_COLORS = [
  "#2DD4BF", // Teal
  "#818CF8", // Indigo
  "#A78BFA", // Lavender
  "#F472B6", // Pink
  "#FB7185", // Rose
  "#38BDF8", // Sky
  "#34D399", // Emerald
  "#60A5FA", // Blue
  "#C084FC", // Violet
  "#FBBF24"  // Amber
];

export const DEFAULT_BANNER_COLORS = [
  "#16171B", "#1E2026", "#1e1b4b", "#0f172a", "#164e63", "#2A2D35"
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
  if (typeof isMasterAuth === "boolean") {
    return isMasterAuth;
  }
  // Só vale depois que o servidor aceitou a senha do Dono (entrada escondida).
  // Mesmo que alguém mexa no navegador, o servidor confere o token em toda ação de Dono.
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const ok = localStorage.getItem("eco_master_ok") === "1";
      const token = localStorage.getItem("eco_master_token") || "";
      return ok && /^[a-f0-9]{64}$/.test(token.trim());
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

const MEMBER_SINCE_KEY = "eco_member_since_v1";

/** Data do primeiro acesso ao eco neste aparelho (criada uma vez e nunca muda). */
export function getMemberSince(): number {
  try {
    const raw = Number(localStorage.getItem(MEMBER_SINCE_KEY));
    if (Number.isFinite(raw) && raw > 1600000000000 && raw <= Date.now()) return raw;
    const agora = Date.now();
    localStorage.setItem(MEMBER_SINCE_KEY, String(agora));
    return agora;
  } catch {
    return Date.now();
  }
}

/** ∞ só para o Dono Master. Dono de sala e qualquer outro mostram o saldo real. */
export function formatCoinDisplay(amount?: number | null, isMaster?: boolean): string {
  if (isMaster) {
    return "∞";
  }
  if (typeof amount === "number") {
    if (!isFinite(amount)) return "0";
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
    const raw = localStorage.getItem(ECO_COINS_KEY) || localStorage.getItem(KOKI_COINS_KEY);
    if (raw !== null) {
      const num = parseInt(raw, 10);
      if (!isNaN(num)) return Math.max(0, num);
    }
  } catch (e) {
    console.warn("Could not load Eco Coins:", e);
  }
  // Initialize with default coins
  const initial = DEFAULT_INITIAL_COINS;
  try {
    localStorage.setItem(ECO_COINS_KEY, initial.toString());
  } catch {}
  return initial;
}

export const getEcoCoins = getKokiCoins;

export function setKokiCoins(amount: number): number {
  const isMaster = isMasterIdentity();
  const safeAmount = isMaster ? MASTER_COINS : Math.max(0, Math.floor(amount));
  try {
    localStorage.setItem(ECO_COINS_KEY, safeAmount.toString());
    localStorage.setItem(KOKI_COINS_KEY, safeAmount.toString());
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("eco_coins_updated", { detail: { coins: safeAmount } }));
      window.dispatchEvent(new CustomEvent("koki_coins_updated", { detail: { coins: safeAmount } }));
    }
  } catch (e) {
    console.warn("Could not save Eco Coins:", e);
  }
  return safeAmount;
}

export const setEcoCoins = setKokiCoins;
export const addEcoCoins = addKokiCoins;
export const deductEcoCoins = deductKokiCoins;

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
export function purchaseStorePerk(perkId: StorePerkId, opcoes?: { semCusto?: boolean }): {
  success: boolean;
  error?: string;
  newBalance: number;
  activeUntil: number;
  perk: StorePerk;
} {
  const currentItems = getStoreItems();
  const perk = currentItems.find((p) => p.id === perkId) || STORE_PERKS.find((p) => p.id === perkId);
  if (!perk) {
    return { success: false, error: "Item não encontrado na loja.", newBalance: getKokiCoins(), activeUntil: 0, perk: currentItems[0] || STORE_PERKS[0] };
  }

  const isMaster = isMasterIdentity();
  // Co-fundador compra de graça (moedas infinitas), igual ao Dono: não perde moedas nem falta saldo
  const semCusto = isMaster || Boolean(opcoes?.semCusto);
  const currentCoins = getKokiCoins();

  // If not master, verify sufficient balance and deduct coins based on persisted data price
  if (!semCusto) {
    if (currentCoins < perk.price) {
      return {
        success: false,
        error: `Saldo insuficiente! Você tem ${currentCoins} Eco Coins, mas o item custa ${perk.price} Eco Coins.`,
        newBalance: currentCoins,
        activeUntil: 0,
        perk,
      };
    }
  }

  // Deduct coins only for non-master accounts
  const remainingCoins = isMaster ? MASTER_COINS : semCusto ? currentCoins : currentCoins - perk.price;
  if (!semCusto) {
    setKokiCoins(remainingCoins);
  }

  // Extend or add perk duration
  const currentPerks = getPurchasedPerks();
  const currentUntil = currentPerks[perkId] || 0;
  const baseTime = currentUntil > Date.now() ? currentUntil : Date.now();
  const durationMs = (perk.durationHours || 72) * 3600 * 1000;
  const newActiveUntil = baseTime + durationMs;

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
 * Returns cooldown timing information for the 24h +50 Koki Coins daily bonus.
 * Master Owner bypasses all cooldowns and always has access.
 */
export function getDailyBonusCooldownInfo(): {
  canClaim: boolean;
  remainingMs: number;
  formatted: string;
  nextClaimAt: number;
} {
  const isMaster = isMasterIdentity();
  if (isMaster) {
    return {
      canClaim: true,
      remainingMs: 0,
      formatted: "∞ Ilimitado (Master)",
      nextClaimAt: 0,
    };
  }

  let lastClaim = 0;
  try {
    const raw = localStorage.getItem(LAST_DAILY_CLAIM_KEY);
    if (raw) lastClaim = parseInt(raw, 10) || 0;
  } catch {}

  const now = Date.now();
  const timePassed = now - lastClaim;

  if (lastClaim > 0 && timePassed < DAILY_BONUS_COOLDOWN_MS) {
    const remainingMs = DAILY_BONUS_COOLDOWN_MS - timePassed;
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let formatted = "";
    if (hours > 0) {
      formatted = `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
    } else if (minutes > 0) {
      formatted = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    } else {
      formatted = `${seconds}s`;
    }

    return {
      canClaim: false,
      remainingMs,
      formatted,
      nextClaimAt: lastClaim + DAILY_BONUS_COOLDOWN_MS,
    };
  }

  return {
    canClaim: true,
    remainingMs: 0,
    formatted: "Pronto para resgatar!",
    nextClaimAt: 0,
  };
}

/**
 * Claim daily free coin bonus (+50 Koki Coins once every 24 hours).
 * Master Owner bypasses cooldowns and maintains infinite coins.
 */
export function claimDailyBonus(): {
  success: boolean;
  reward: number;
  nextClaimAt: number;
  newBalance: number;
  error?: string;
} {
  const isMaster = isMasterIdentity();
  if (isMaster) {
    return {
      success: true,
      reward: DAILY_BONUS_AMOUNT,
      nextClaimAt: 0,
      newBalance: MASTER_COINS,
    };
  }

  const now = Date.now();
  let lastClaim = 0;
  try {
    const raw = localStorage.getItem(LAST_DAILY_CLAIM_KEY);
    if (raw) lastClaim = parseInt(raw, 10) || 0;
  } catch {}

  const timePassed = now - lastClaim;
  if (lastClaim > 0 && timePassed < DAILY_BONUS_COOLDOWN_MS) {
    const remainingMs = DAILY_BONUS_COOLDOWN_MS - timePassed;
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timeStr = `${hours}h ${minutes}m ${seconds}s`;

    return {
      success: false,
      reward: 0,
      nextClaimAt: lastClaim + DAILY_BONUS_COOLDOWN_MS,
      newBalance: getKokiCoins(),
      error: `Você já resgatou seu bônus diário! Disponível novamente em ${timeStr}.`,
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
    const raw = localStorage.getItem(PROFILE_KEY) || localStorage.getItem(PROFILE_KEY_LEGACY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const name = parsed.name || (isMaster ? MASTER_DEFAULT_USERNAME : "");
      let tag = resolveUserTag(name, isMaster, parsed.tag);

      // Clean badges for non-master accounts (guests start with badges: [])
      let badges: string[] = [];
      if (isMaster) {
        badges = Array.isArray(parsed.badges) && parsed.badges.length > 0
          ? parsed.badges
          : ["singularidade", "horizonte"];
      } else {
        // Non-master users must NEVER have owner badges or default pioneer badge
        badges = Array.isArray(parsed.badges)
          ? parsed.badges.filter((b: string) => !b.includes("owner") && b !== "singularidade" && b !== "koki_creator" && b !== "nitro_owner" && b !== "pioneer_member" && b !== "host_room")
          : [];
        if (tag === "0001" || isReservedMasterTag(tag)) {
          tag = generateStandardUserTag();
        }
      }

      return {
        name,
        tag,
        avatarEmoji: parsed.avatarEmoji || (isMaster ? "👑" : ""),
        avatarColor: parsed.avatarColor || DEFAULT_AVATAR_COLORS[0],
        avatarUrl: isMaster ? parsed.avatarUrl : (isPerkActive("gif_avatar", perks) || isPerkActive("vip_role", perks) || parsed.vipPermissions ? parsed.avatarUrl : undefined),
        bannerColor: parsed.bannerColor || DEFAULT_BANNER_COLORS[0],
        bannerUrl: isMaster ? parsed.bannerUrl : (isPerkActive("custom_banner", perks) || isPerkActive("vip_role", perks) || parsed.vipPermissions ? parsed.bannerUrl : undefined),
        customStatus: parsed.customStatus || (isMaster ? "👑 Dono Master do eco" : "🟢 Conectado ao eco"),
        bio: parsed.bio || (isMaster ? "Criador e moderador oficial do eco." : "Voz, vídeo e tela com seus amigos."),
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
    avatarEmoji: isMaster ? "👑" : "",
    avatarColor: DEFAULT_AVATAR_COLORS[0],
    bannerColor: DEFAULT_BANNER_COLORS[0],
    customStatus: isMaster ? "👑 Dono Master do eco" : "🟢 Conectado ao eco",
    bio: isMaster ? "Criador e moderador oficial do eco." : "Voz, vídeo e tela com seus amigos.",
    customTitle: undefined,
    kokiCoins: coins,
    purchasedPerks: perks,
    badges: isMaster ? ["singularidade", "horizonte"] : [],
    rememberLogin: true,
  };
}

export function saveUserProfile(profile: Partial<SavedUserProfile>): void {
  try {
    const current = getSavedUserProfile();
    const isMaster = isMasterIdentity(profile.name ?? current.name);
    const resolvedName = profile.name ?? current.name;
    const resolvedTag = resolveUserTag(resolvedName, isMaster, profile.tag ?? current.tag);

    let cleanBadges = profile.badges !== undefined ? profile.badges : current.badges;
    if (!isMaster && Array.isArray(cleanBadges)) {
      cleanBadges = cleanBadges.filter((b) => !b.includes("owner") && b !== "singularidade" && b !== "koki_creator" && b !== "nitro_owner" && b !== "pioneer_member" && b !== "host_room");
    } else if (isMaster && (!cleanBadges || cleanBadges.length === 0)) {
      cleanBadges = ["singularidade", "horizonte"];
    }

    const updated: SavedUserProfile = {
      ...current,
      ...profile,
      name: resolvedName,
      tag: resolvedTag,
      badges: cleanBadges || [],
    };

    // Link /api/m/... é só a cópia no servidor do data: que já está aqui: nunca troca o original salvo
    // (o link some se o servidor reiniciar).
    if (ehLinkBlobServidor(updated.avatarUrl) && current.avatarUrl && !ehLinkBlobServidor(current.avatarUrl)) updated.avatarUrl = current.avatarUrl;
    if (ehLinkBlobServidor(updated.bannerUrl) && current.bannerUrl && !ehLinkBlobServidor(current.bannerUrl)) updated.bannerUrl = current.bannerUrl;

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
    localStorage.setItem(PROFILE_KEY_LEGACY, JSON.stringify(updated));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("eco_profile_updated", { detail: { profile: updated } }));
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
        aiNoiseSuppression: parsed.aiNoiseSuppression !== false,
        autoSensitivity: parsed.autoSensitivity !== false,
        sensitivityDb:
          typeof parsed.sensitivityDb === "number" && isFinite(parsed.sensitivityDb)
            ? Math.max(-100, Math.min(0, parsed.sensitivityDb))
            : -50,
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
    aiNoiseSuppression: true,
    autoSensitivity: true,
    sensitivityDb: -50,
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
