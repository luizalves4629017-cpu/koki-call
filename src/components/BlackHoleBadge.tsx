import React from "react";

interface BlackHoleBadgeProps {
  type: "singularidade" | "horizonte";
  size?: number;
  className?: string;
  title?: string;
}

export const BlackHoleBadge: React.FC<BlackHoleBadgeProps> = ({
  type,
  size = 18,
  className = "",
  title,
}) => {
  const isSingularity = type === "singularidade";
  const defaultTitle = isSingularity
    ? "Singularidade · Criador do eco"
    : "Horizonte · Concedida pelo criador";
  const effectiveTitle = title || defaultTitle;
  const src = isSingularity ? "/insignias/singularidade.svg" : "/insignias/horizonte.svg";

  return (
    <img
      src={src}
      alt={effectiveTitle}
      title={effectiveTitle}
      width={size}
      height={size}
      className={`inline-block shrink-0 object-contain select-none align-middle pointer-events-auto ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      loading="eager"
    />
  );
};
