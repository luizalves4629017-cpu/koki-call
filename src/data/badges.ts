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
  // --- CRIADOR E EQUIPE ---
  {
    id: "singularidade",
    name: "Criador",
    description: "Quem criou o eco.",
    icon: "/insignias/singularidade.svg",
    category: "owner",
    rarity: "mythic",
    badgeBg: "bg-white/10",
    badgeBorder: "border-white/40",
    textColor: "text-white",
    glow: true,
  },
  {
    id: "cofundador",
    name: "Co-fundador",
    description: "Ajudou a construir o eco desde o começo.",
    icon: "/insignias/cofundador.svg",
    category: "owner",
    rarity: "mythic",
    badgeBg: "bg-[#5EEAD4]/10",
    badgeBorder: "border-[#5EEAD4]/50",
    textColor: "text-[#5EEAD4]",
    glow: true,
  },
  {
    id: "horizonte",
    name: "Horizonte",
    description: "Presente especial do criador.",
    icon: "/insignias/horizonte.svg",
    category: "community",
    rarity: "legendary",
    badgeBg: "bg-slate-400/10",
    badgeBorder: "border-slate-300/40",
    textColor: "text-slate-200",
  },
  // --- VIP (liberam editar o perfil) ---
  {
    id: "nitro_owner",
    name: "VIP Nitro",
    description: "Libera foto/GIF, banner (vídeo ou foto) e título no perfil.",
    icon: "💎",
    category: "vip",
    rarity: "legendary",
    badgeBg: "bg-[#C4B5FD]/10",
    badgeBorder: "border-[#C4B5FD]/50",
    textColor: "text-[#C4B5FD]",
    glow: true,
  },
  {
    id: "vip_granted",
    name: "VIP",
    description: "VIP dado pelo Dono. Libera trocar a foto de perfil.",
    icon: "✨",
    category: "vip",
    rarity: "epic",
    badgeBg: "bg-[#C4B5FD]/10",
    badgeBorder: "border-[#C4B5FD]/40",
    textColor: "text-[#C4B5FD]",
  },
  // --- COMUNIDADE ---
  { id: "pioneer_member", name: "Pioneiro", description: "Esteve nas primeiras salas do eco.", icon: "🚀", category: "community", rarity: "rare", badgeBg: "bg-[#2A2D35]", badgeBorder: "border-[#383C47]", textColor: "text-[#ECECEC]" },
  { id: "golden_voice", name: "Voz da Call", description: "Sempre animando a conversa.", icon: "🎙️", category: "community", rarity: "common", badgeBg: "bg-[#2A2D35]", badgeBorder: "border-[#383C47]", textColor: "text-[#ECECEC]" },
  { id: "night_owl", name: "Madrugada", description: "Presente nas calls de madrugada.", icon: "🌙", category: "community", rarity: "common", badgeBg: "bg-[#2A2D35]", badgeBorder: "border-[#383C47]", textColor: "text-[#ECECEC]" },
  { id: "gamer_pro", name: "Gamer", description: "Joga com a galera.", icon: "🎮", category: "community", rarity: "common", badgeBg: "bg-[#2A2D35]", badgeBorder: "border-[#383C47]", textColor: "text-[#ECECEC]" },
  { id: "chat_master", name: "Papeador", description: "Não para de mandar mensagem no chat.", icon: "💬", category: "community", rarity: "common", badgeBg: "bg-[#2A2D35]", badgeBorder: "border-[#383C47]", textColor: "text-[#ECECEC]" },
];

export function getBadgeById(id: string): UserBadge | undefined {
  return ALL_BADGES.find((b) => b.id === id);
}

export function getAvailableBadges(isHost: boolean, hasVip: boolean): UserBadge[] {
  return ALL_BADGES.filter((badge) => {
    // Singularidade is the creator-only non-grantable badge
    if (badge.id === "singularidade" || badge.id === "cofundador") return false;
    if (badge.category === "owner") return isHost;
    if (badge.category === "vip") return isHost || hasVip;
    return true;
  });
}
