import React from "react";

/** Ícone de insígnia: emoji vira texto, caminho de arquivo (/insignias/x.svg) vira imagem. */
export const BadgeIcon: React.FC<{ icon?: string; size?: number; alt?: string }> = ({ icon, size = 16, alt = "" }) => {
  if (!icon) return null;
  const ehImagem = icon.startsWith("/") || icon.startsWith("http") || icon.startsWith("data:");
  if (!ehImagem) return <>{icon}</>;
  return (
    <img
      src={icon}
      alt={alt}
      width={size}
      height={size}
      className="inline-block shrink-0 object-contain align-middle select-none"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
};
