import React from "react";
import { Crown } from "lucide-react";
import { getInitials, getAvatarColor } from "../utils/avatar";

interface EcoAvatarProps {
  name?: string;
  avatarUrl?: string;
  avatarColor?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isMaster?: boolean;
  hasVipBadge?: boolean;
  speaking?: boolean;
  status?: "online" | "speaking" | "muted" | "idle" | "offline";
  showStatus?: boolean;
  className?: string;
}

export const EcoAvatar: React.FC<EcoAvatarProps> = ({
  name = "Usuário",
  avatarUrl,
  avatarColor,
  size = "md",
  isMaster = false,
  speaking = false,
  status,
  showStatus = false,
  className = "",
}) => {
  const sizeMap = {
    xs: { box: "w-6 h-6", text: "text-[10px]", crownBox: "w-2.5 h-2.5", crownIcon: 10, status: "w-2 h-2 -bottom-0.5 -right-0.5" },
    sm: { box: "w-8 h-8", text: "text-xs", crownBox: "w-3 h-3", crownIcon: 11, status: "w-2.5 h-2.5 -bottom-0.5 -right-0.5" },
    md: { box: "w-10 h-10", text: "text-sm", crownBox: "w-4 h-4", crownIcon: 13, status: "w-3 h-3 -bottom-0.5 -right-0.5" },
    lg: { box: "w-14 h-14", text: "text-lg", crownBox: "w-5 h-5", crownIcon: 15, status: "w-3.5 h-3.5 -bottom-0.5 -right-0.5" },
    xl: { box: "w-20 h-20", text: "text-2xl", crownBox: "w-6 h-6", crownIcon: 18, status: "w-4 h-4 bottom-0 right-0" },
  };

  const dim = sizeMap[size];
  const initials = getInitials(name);
  const bgColor = getAvatarColor(name, avatarColor);

  return (
    <div className={`relative inline-flex shrink-0 select-none ${className}`}>
      {/* Avatar Container */}
      <div
        className={`${dim.box} rounded-full flex items-center justify-center font-bold text-white overflow-hidden transition-all duration-150 ${
          speaking
            ? "ring-2 ring-[#5EEAD4] shadow-[0_0_12px_rgba(94,234,212,0.45)]"
            : isMaster
            ? "ring-1 ring-[#C4B5FD]/50"
            : "ring-1 ring-[#2A2D35]"
        }`}
        style={{
          backgroundColor: avatarUrl ? "#1E2026" : bgColor,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={`font-semibold tracking-wider ${dim.text}`}>
            {initials}
          </span>
        )}
      </div>

      {/* Owner Crown Badge (Lavender #C4B5FD) */}
      {isMaster && (
        <div
          className={`absolute -top-1 -right-1 rounded-full bg-[#1E2026] border border-[#C4B5FD] text-[#C4B5FD] flex items-center justify-center p-0.5 shadow-md z-10`}
          title="Dono Master"
        >
          <Crown className={`${dim.crownBox} fill-current text-[#C4B5FD]`} />
        </div>
      )}

      {/* Status Dot */}
      {showStatus && status && (
        <span
          className={`absolute ${dim.status} rounded-full border-2 border-[#16171B] ${
            status === "online" || status === "speaking"
              ? "bg-[#5EEAD4]"
              : status === "muted"
              ? "bg-[#F43F5E]"
              : status === "idle"
              ? "bg-[#FBBF24]"
              : "bg-[#8B8F98]"
          }`}
        />
      )}
    </div>
  );
};
