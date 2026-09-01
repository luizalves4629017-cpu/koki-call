import React, { useState } from "react";
import { ALL_BADGES, getBadgeById, UserBadge } from "../data/badges";
import { Sparkles, Crown, Shield, Zap, Gem } from "lucide-react";

interface BadgeListProps {
  badgeIds?: string[];
  isHost?: boolean;
  size?: "sm" | "md" | "lg";
  maxVisible?: number;
  showLabels?: boolean;
}

export const BadgeList: React.FC<BadgeListProps> = ({
  badgeIds = [],
  isHost = false,
  size = "md",
  maxVisible = 6,
  showLabels = false,
}) => {
  const [hoveredBadge, setHoveredBadge] = useState<UserBadge | null>(null);

  // Render the participant's explicit badges only
  const effectiveBadgeIds = Array.isArray(badgeIds) ? badgeIds : [];

  const badges = effectiveBadgeIds
    .map((id) => getBadgeById(id))
    .filter((b): b is UserBadge => Boolean(b));

  if (badges.length === 0) return null;

  const visibleBadges = badges.slice(0, maxVisible);
  const remainingCount = badges.length - maxVisible;

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs gap-1",
    md: "px-2 py-1 text-xs gap-1.5",
    lg: "px-2.5 py-1.5 text-sm gap-2",
  };

  const iconSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className="relative inline-flex items-center flex-wrap gap-1.5">
      {visibleBadges.map((badge) => (
        <div
          key={badge.id}
          id={`badge-${badge.id}`}
          onMouseEnter={() => setHoveredBadge(badge)}
          onMouseLeave={() => setHoveredBadge(null)}
          className={`relative group inline-flex items-center rounded-lg border backdrop-blur-sm cursor-help transition-all duration-200 select-none shadow-sm ${
            badge.badgeBg
          } ${badge.badgeBorder} ${badge.textColor} ${sizeClasses[size]} ${
            badge.glow ? "ring-1 ring-amber-400/40 shadow-amber-500/10" : ""
          }`}
        >
          <span className={iconSizes[size]}>{badge.icon}</span>
          {showLabels && (
            <span className="font-semibold tracking-wide truncate max-w-[120px]">
              {badge.name}
            </span>
          )}

          {/* Special animated sparkle for mythic owner badges */}
          {badge.glow && (
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          )}

          {/* Floating Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none w-52">
            <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl p-2.5 border border-slate-700 shadow-2xl text-center w-full">
              <div className="flex items-center justify-center gap-1.5 font-bold mb-1">
                <span>{badge.icon}</span>
                <span className={badge.textColor}>{badge.name}</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {badge.description}
              </p>
              <div className="mt-1.5 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                <span>Raridade: {badge.rarity}</span>
                <span>{badge.category === "owner" ? "👑 Exclusivo Dono" : badge.category === "vip" ? "💎 VIP" : "🌐 Comunidade"}</span>
              </div>
            </div>
            <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 transform rotate-45 -mt-1"></div>
          </div>
        </div>
      ))}

      {remainingCount > 0 && (
        <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold">
          +{remainingCount}
        </span>
      )}
    </div>
  );
};
