import React from "react";

interface EcoLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number | string;
  showWordmark?: boolean;
  showText?: boolean;
  wordmarkClassName?: string;
  className?: string;
  iconOnly?: boolean;
}

export const EcoLogo: React.FC<EcoLogoProps> = ({
  size = "md",
  showWordmark,
  showText,
  wordmarkClassName = "",
  className = "",
  iconOnly = false,
}) => {
  // Support either showWordmark or showText prop
  const shouldShowWordmark = showWordmark !== undefined ? showWordmark : (showText !== undefined ? showText : true);

  const sizeMap: Record<string, { box: string; icon: number; text: string; gap: string }> = {
    xs: { box: "w-6 h-6", icon: 24, text: "text-xs", gap: "gap-1.5" },
    sm: { box: "w-7 h-7", icon: 28, text: "text-sm", gap: "gap-2" },
    md: { box: "w-9 h-9", icon: 36, text: "text-lg", gap: "gap-2.5" },
    lg: { box: "w-14 h-14", icon: 56, text: "text-2xl", gap: "gap-3" },
    xl: { box: "w-20 h-20", icon: 80, text: "text-3xl", gap: "gap-3.5" },
  };

  const isNumeric = typeof size === "number" || (!isNaN(Number(size)) && typeof size === "string" && !sizeMap[size]);
  const numSize = isNumeric ? Number(size) : null;
  const dim = (!isNumeric && typeof size === "string" && sizeMap[size]) ? sizeMap[size] : sizeMap.md;

  const customStyle: React.CSSProperties = numSize
    ? { width: `${numSize}px`, height: `${numSize}px` }
    : {};

  const svgIcon = (
    <div
      style={customStyle}
      className={`relative rounded-2xl bg-[#0F1014] border border-[#2A2D35] flex items-center justify-center overflow-hidden shrink-0 shadow-lg ${numSize ? "" : dim.box} ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full p-1"
      >
        <defs>
          {/* Glowing Accretion Ring Gradient: Teal #5EEAD4 on left to Lavender #C4B5FD on right */}
          <linearGradient id="ecoRingGrad" x1="10%" y1="70%" x2="90%" y2="30%">
            <stop offset="0%" stopColor="#5EEAD4" />
            <stop offset="50%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#C4B5FD" />
          </linearGradient>

          {/* Outer Ring Glow */}
          <linearGradient id="ecoRingGlow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C4B5FD" stopOpacity="0.8" />
          </linearGradient>

          {/* Core Deep Space Shadow */}
          <radialGradient id="ecoCoreShadow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#0B0C10" />
            <stop offset="90%" stopColor="#16171B" />
            <stop offset="100%" stopColor="#1E2026" />
          </radialGradient>

          {/* Soft Blur Filter for Ring Glow */}
          <filter id="ecoGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>

        {/* Back part of accretion ring */}
        <g transform="rotate(-26 50 50)">
          {/* Subtle soft glow behind */}
          <ellipse
            cx="50"
            cy="50"
            rx="40"
            ry="14"
            stroke="url(#ecoRingGlow)"
            strokeWidth="5"
            opacity="0.45"
            filter="url(#ecoGlowFilter)"
          />
          {/* Upper/Back Arc */}
          <path
            d="M 12 50 A 38 13 0 0 1 88 50"
            stroke="url(#ecoRingGrad)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </g>

        {/* Center Black Hole Event Horizon */}
        <circle cx="50" cy="50" r="23" fill="url(#ecoCoreShadow)" />
        <circle
          cx="50"
          cy="50"
          r="23"
          stroke="#2A2D35"
          strokeWidth="1.2"
        />

        {/* Inner subtle gravitational photon sphere rim */}
        <circle
          cx="50"
          cy="50"
          r="21.5"
          stroke="url(#ecoRingGrad)"
          strokeWidth="0.8"
          strokeOpacity="0.4"
        />

        {/* Front part of accretion disk wrapping in front of event horizon */}
        <g transform="rotate(-26 50 50)">
          <path
            d="M 12 50 A 38 13 0 0 0 88 50"
            stroke="url(#ecoRingGrad)"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );

  if (iconOnly || !shouldShowWordmark) {
    return svgIcon;
  }

  return (
    <div className={`inline-flex items-center ${dim.gap} select-none`}>
      {svgIcon}
      <span
        className={`font-black lowercase tracking-tight text-[#ECECEC] font-sans ${dim.text} ${wordmarkClassName}`}
      >
        eco
      </span>
    </div>
  );
};
