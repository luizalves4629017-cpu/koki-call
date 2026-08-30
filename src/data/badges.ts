export interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "owner" | "vip" | "community";
  rarity: "mythic" | "legendary" | "epic" | "rare" | "common";
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  glow?: boolean;
}

export const ALL_BADGES: UserBadge[] = [
  // --- OWNER EXCLUSIVE BADGES ---
  {
    id: "owner_supreme",
    name: "Dono Supremo & Fundador",
    description: "Criador, anfitrião e autoridade máxima da chamada.",
    icon: "👑",
    category: "owner",
    rarity: "mythic",
    badgeBg: "bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-600/25",
    badgeBorder: "border-amber-400/70",
    textColor: "text-amber-300",
    glow: true,
  },
  {
    id: "koki_creator",
    name: "Criador do App",
    description: "Desenvolvedor e proprietário oficial da plataforma.",
    icon: "🌟",
    category: "owner",
    rarity: "mythic",
    badgeBg: "bg-gradient-to-r from-cyan-500/25 via-teal-500/20 to-indigo-600/25",
    badgeBorder: "border-cyan-400/70",
    textColor: "text-cyan-300",
    glow: true,
  },
  {
    id: "guardian_master",
    name: "Guardião Master",
    description: "Controle total de moderação, segurança e portaria.",
    icon: "🛡️",
    category: "owner",
    rarity: "legendary",
    badgeBg: "bg-gradient-to-r from-blue-500/25 to-indigo-600/25",
    badgeBorder: "border-blue-400/60",
    textColor: "text-blue-300",
    glow: true,
  },
  {
    id: "absolute_power",
    name: "Poder Absoluto",
    description: "Comando master de conexões, áudio e vídeo.",
    icon: "⚡",
    category: "owner",
    rarity: "legendary",
    badgeBg: "bg-gradient-to-r from-amber-600/25 to-rose-600/25",
    badgeBorder: "border-amber-400/60",
    textColor: "text-amber-300",
  },
  {
    id: "nitro_owner",
    name: "VIP Nitro Dono",
    description: "Acesso permanente a banners MP4 e avatares animados.",
    icon: "💎",
    category: "owner",
    rarity: "mythic",
    badgeBg: "bg-gradient-to-r from-fuchsia-600/25 to-pink-600/25",
    badgeBorder: "border-fuchsia-400/70",
    textColor: "text-fuchsia-300",
    glow: true,
  },

  // --- VIP TEMPORARY / GRANTED BADGES ---
  {
    id: "vip_granted",
    name: "VIP Autorizado pelo Dono",
    description: "Permissão VIP especial concedida temporariamente pelo Dono.",
    icon: "✨",
    category: "vip",
    rarity: "legendary",
    badgeBg: "bg-gradient-to-r from-purple-500/25 to-pink-500/25",
    badgeBorder: "border-purple-400/60",
    textColor: "text-purple-300",
    glow: true,
  },

  // --- COMMUNITY & MEMBER BADGES ---
  {
    id: "pioneer_member",
    name: "Membro Pioneiro",
    description: "Participante ativo das primeiras salas e chamadas.",
    icon: "🚀",
    category: "community",
    rarity: "epic",
    badgeBg: "bg-cyan-950/50",
    badgeBorder: "border-cyan-500/40",
    textColor: "text-cyan-300",
  },
  {
    id: "golden_voice",
    name: "Voz de Ouro",
    description: "Voz cristalina e excelente comunicação na chamada.",
    icon: "🎙️",
    category: "community",
    rarity: "rare",
    badgeBg: "bg-amber-950/50",
    badgeBorder: "border-amber-500/40",
    textColor: "text-amber-300",
  },
  {
    id: "call_dj",
    name: "DJ da Call",
    description: "Responsável pelas melhores músicas e trilhas sonoras.",
    icon: "🎧",
    category: "community",
    rarity: "epic",
    badgeBg: "bg-violet-950/50",
    badgeBorder: "border-violet-500/40",
    textColor: "text-violet-300",
  },
  {
    id: "night_owl",
    name: "Ativo na Madrugada",
    description: "Sempre presente nas conversas e jogatinas noturnas.",
    icon: "🔥",
    category: "community",
    rarity: "rare",
    badgeBg: "bg-rose-950/50",
    badgeBorder: "border-rose-500/40",
    textColor: "text-rose-300",
  },
  {
    id: "gamer_pro",
    name: "Gamer Lendário",
    description: "Foco em vitórias, gameplays ao vivo e estratégias.",
    icon: "🎮",
    category: "community",
    rarity: "rare",
    badgeBg: "bg-emerald-950/50",
    badgeBorder: "border-emerald-500/40",
    textColor: "text-emerald-300",
  },
  {
    id: "honor_guest",
    name: "Convidado de Honra",
    description: "Presença especial e muito bem-vinda em qualquer chamada.",
    icon: "🤝",
    category: "community",
    rarity: "epic",
    badgeBg: "bg-teal-950/50",
    badgeBorder: "border-teal-500/40",
    textColor: "text-teal-300",
  },
  {
    id: "coffee_break",
    name: "Café com Call",
    description: "Aprecia uma boa conversa relaxante e descontraída.",
    icon: "☕",
    category: "community",
    rarity: "common",
    badgeBg: "bg-amber-950/30",
    badgeBorder: "border-amber-700/40",
    textColor: "text-amber-200",
  },
  {
    id: "pixel_hero",
    name: "Pixel Hero",
    description: "Estilo retrô, amante de nostalgia e boas vibrações.",
    icon: "👾",
    category: "community",
    rarity: "rare",
    badgeBg: "bg-purple-950/50",
    badgeBorder: "border-purple-500/40",
    textColor: "text-purple-300",
  },
  {
    id: "chat_master",
    name: "Papeador Master",
    description: "Sempre interage nos canais de texto com stickers e memes.",
    icon: "💬",
    category: "community",
    rarity: "common",
    badgeBg: "bg-blue-950/40",
    badgeBorder: "border-blue-500/30",
    textColor: "text-blue-300",
  },
];

export function getBadgeById(id: string): UserBadge | undefined {
  return ALL_BADGES.find((b) => b.id === id);
}

export function getAvailableBadges(isHost: boolean, hasVip: boolean): UserBadge[] {
  return ALL_BADGES.filter((badge) => {
    if (badge.category === "owner") return isHost;
    if (badge.category === "vip") return isHost || hasVip;
    return true;
  });
}
