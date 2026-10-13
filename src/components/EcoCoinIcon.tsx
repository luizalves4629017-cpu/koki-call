import React from "react";

interface EcoCoinIconProps {
  className?: string;
  size?: number | string;
  isSpinning?: boolean;
}

export const EcoCoinIcon: React.FC<EcoCoinIconProps> = ({
  className = "w-4 h-4",
  size,
  isSpinning = false,
}) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none ${isSpinning ? "animate-[spin_4s_linear_infinite]" : ""} ${className}`}
      style={style}
    >
      <defs>
        <linearGradient id="ecoCoinRingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="100%" stopColor="#C4B5FD" />
        </linearGradient>
        <radialGradient id="ecoCoinAmbientGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.4" />
          <stop offset="65%" stopColor="#C4B5FD" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#16171B" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ecoCoinCoreGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#2A2D35" />
          <stop offset="70%" stopColor="#16171B" />
          <stop offset="100%" stopColor="#050507" />
        </radialGradient>
        <clipPath id="frontClipArc" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="32" width="64" height="32" />
        </clipPath>
      </defs>
      {/* Ambient Glow */}
      <circle cx="32" cy="32" r="22" fill="url(#ecoCoinAmbientGlow)" />
      {/* Back arc of planetary ring */}
      <g transform="rotate(-22 32 32)">
        <ellipse
          cx="32"
          cy="32"
          rx="27"
          ry="9"
          fill="none"
          stroke="url(#ecoCoinRingGrad)"
          strokeWidth="2.8"
          opacity="0.95"
        />
        <circle cx="59" cy="32" r="1.8" fill="#5EEAD4" />
      </g>
      {/* Central dark core with border */}
      <circle
        cx="32"
        cy="32"
        r="13"
        fill="url(#ecoCoinCoreGrad)"
        stroke="#5EEAD4"
        strokeOpacity="0.5"
        strokeWidth="1.2"
      />
      {/* Front arc passing over core */}
      <g transform="rotate(-22 32 32)" clipPath="url(#frontClipArc)">
        <ellipse
          cx="32"
          cy="32"
          rx="27"
          ry="9"
          fill="none"
          stroke="url(#ecoCoinRingGrad)"
          strokeWidth="2.8"
        />
      </g>
    </svg>
  );
};
