/**
 * Extracts 1 or 2 uppercase initials from a user's name.
 * e.g. "João Silva" -> "JS", "Luiz" -> "L", "Dono Master" -> "DM"
 */
export function getInitials(name?: string | null): string {
  if (!name || typeof name !== "string") return "?";
  const clean = name.trim().replace(/^[@#]/, "");
  if (!clean) return "?";

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Curated palette of muted, elegant dark-slate friendly avatar colors.
 */
export const AVATAR_PALETTE = [
  "#2DD4BF", // Teal
  "#818CF8", // Indigo
  "#A78BFA", // Lavender/Purple
  "#F472B6", // Pink
  "#FB7185", // Rose
  "#38BDF8", // Sky
  "#34D399", // Emerald
  "#60A5FA", // Blue
  "#C084FC", // Violet
  "#FBBF24", // Amber
];

/**
 * Deterministically generates an avatar background color from a string.
 */
export function getAvatarColor(name?: string | null, fallbackColor?: string): string {
  if (fallbackColor && fallbackColor.startsWith("#")) {
    return fallbackColor;
  }
  if (!name || typeof name !== "string") {
    return AVATAR_PALETTE[0];
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}
