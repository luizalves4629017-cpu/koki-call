import React from "react";
import { ALL_BADGES, UserBadge, getAvailableBadges } from "../data/badges";
import { Sparkles, Check, Crown, Zap, Shield, Gem } from "lucide-react";

interface BadgeSelectorProps {
  selectedBadgeIds: string[];
  onChange: (badgeIds: string[]) => void;
  isHost: boolean;
  hasVip: boolean;
  maxSelectable?: number;
}

export const BadgeSelector: React.FC<BadgeSelectorProps> = ({
  selectedBadgeIds,
  onChange,
  isHost,
  hasVip,
  maxSelectable = 6,
}) => {
  const availableBadges = getAvailableBadges(isHost, hasVip);

  const handleToggleBadge = (badgeId: string) => {
    if (selectedBadgeIds.includes(badgeId)) {
      onChange(selectedBadgeIds.filter((id) => id !== badgeId));
    } else {
      if (selectedBadgeIds.length >= maxSelectable) {
        // Replace oldest or limit
        return;
      }
      onChange([...selectedBadgeIds, badgeId]);
    }
  };

  const ownerBadges = availableBadges.filter((b) => b.category === "owner");
  const vipBadges = availableBadges.filter((b) => b.category === "vip");
  const communityBadges = availableBadges.filter((b) => b.category === "community");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Insígnias do Perfil ({selectedBadgeIds.length}/{maxSelectable})
        </label>
        <span className="text-[11px] text-slate-400">
          Selecione até {maxSelectable} para exibir
        </span>
      </div>

      {/* 1. Exclusivas do Dono */}
      {isHost && (
        <div className="space-y-1.5 p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 uppercase tracking-wider">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Exclusivas do Dono & Criador</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {ownerBadges.map((badge) => {
              const isSelected = selectedBadgeIds.includes(badge.id);
              return (
                <button
                  type="button"
                  key={badge.id}
                  id={`badge-select-${badge.id}`}
                  onClick={() => handleToggleBadge(badge.id)}
                  className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? `${badge.badgeBg} ${badge.badgeBorder} ring-1 ring-amber-400/50 shadow-sm`
                      : "bg-slate-900/60 border-slate-800 hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-base">{badge.icon}</span>
                    <div className="truncate">
                      <p className={`font-bold text-xs truncate ${isSelected ? badge.textColor : "text-slate-200"}`}>
                        {badge.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{badge.description}</p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Insígnias VIP Autorizadas */}
      {(isHost || hasVip) && vipBadges.length > 0 && (
        <div className="space-y-1.5 p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/30">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-300 uppercase tracking-wider">
            <Gem className="w-3.5 h-3.5 text-purple-400" />
            <span>Insígnias VIP Autorizadas</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {vipBadges.map((badge) => {
              const isSelected = selectedBadgeIds.includes(badge.id);
              return (
                <button
                  type="button"
                  key={badge.id}
                  id={`badge-select-${badge.id}`}
                  onClick={() => handleToggleBadge(badge.id)}
                  className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? `${badge.badgeBg} ${badge.badgeBorder} ring-1 ring-purple-400/50 shadow-sm`
                      : "bg-slate-900/60 border-slate-800 hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-base">{badge.icon}</span>
                    <div className="truncate">
                      <p className={`font-bold text-xs truncate ${isSelected ? badge.textColor : "text-slate-200"}`}>
                        {badge.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{badge.description}</p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Insígnias da Comunidade */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Insígnias da Comunidade & Membros
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {communityBadges.map((badge) => {
            const isSelected = selectedBadgeIds.includes(badge.id);
            return (
              <button
                type="button"
                key={badge.id}
                id={`badge-select-${badge.id}`}
                onClick={() => handleToggleBadge(badge.id)}
                className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all ${
                  isSelected
                    ? `${badge.badgeBg} ${badge.badgeBorder} ring-1 ring-cyan-500/40 shadow-sm`
                    : "bg-slate-900/60 border-slate-800 hover:bg-slate-800 text-slate-400"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-base">{badge.icon}</span>
                  <div className="truncate">
                    <p className={`font-bold text-xs truncate ${isSelected ? badge.textColor : "text-slate-200"}`}>
                      {badge.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{badge.description}</p>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
