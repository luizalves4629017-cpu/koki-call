import React from "react";

/**
 * Anel "buraco negro" exclusivo do Dono Master e do Co-fundador, desenhado em volta do avatar do perfil.
 * - Horizonte de eventos: faixa preta colada no avatar + halo cinza (lente gravitacional).
 * - Disco de acreção inclinado: a metade de trás fica atrás do avatar e a da frente passa por cima.
 * Dono: disco branco/prata brilhante. Co-fundador: dois anéis cinza-aço/gelo, um pouco mais apagados.
 */
export const AnelBuracoNegro: React.FC<{ variante: "dono" | "cofundador" }> = ({ variante }) => {
  const dono = variante === "dono";
  const inclinacao = -16;

  const gradiente = dono
    ? "conic-gradient(from 0deg, #FFFFFF, #D1D5DB 18%, #6B7280 32%, #F9FAFB 50%, #9CA3AF 68%, #FFFFFF 85%, #FFFFFF)"
    : "conic-gradient(from 0deg, #E2E8F0, #94A3B8 20%, #475569 35%, #F1F5F9 52%, #64748B 70%, #CBD5E1 86%, #E2E8F0)";
  const brilho = dono ? "rgba(255,255,255,0.75)" : "rgba(203,213,225,0.55)";

  const disco = (escala: number, espessura: number, opacidade: number, duracao: number) => (
    <div className="absolute inset-0" style={{ transform: `scale(${escala}, ${escala * 0.3})` }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundImage: gradiente,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          // espessura visível igual nas laterais e na frente (o disco é achatado em 0.3 no eixo vertical)
          padding: `${(espessura * 0.8) / (escala * 0.3)}px ${espessura / escala}px`,
          opacity: opacidade,
          filter: `drop-shadow(0 0 5px ${brilho})`,
          animation: `spin ${duracao}s linear infinite`,
        }}
      />
    </div>
  );

  const discos = (
    <>
      {disco(1.62, dono ? 5 : 3, 1, dono ? 10 : 14)}
      {!dono && disco(1.82, 2.5, 0.6, 22)}
      {dono && disco(1.8, 1.5, 0.45, 18)}
    </>
  );

  // metade = "tras" (fica atrás do avatar) ou "frente" (passa por cima do avatar)
  const metade = (lado: "tras" | "frente") => (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        transform: `rotate(${inclinacao}deg)`,
        clipPath: lado === "tras" ? "inset(-60% -60% 50% -60%)" : "inset(50% -60% -60% -60%)",
        zIndex: lado === "tras" ? 4 : 15,
      }}
    >
      {discos}
    </div>
  );

  return (
    <>
      {/* Halo cinza da lente gravitacional */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[132px] h-[132px] rounded-full pointer-events-none"
        style={{
          zIndex: 3,
          background: dono
            ? "radial-gradient(circle, rgba(255,255,255,0) 52%, rgba(229,231,235,0.28) 62%, rgba(156,163,175,0.12) 72%, rgba(0,0,0,0) 80%)"
            : "radial-gradient(circle, rgba(255,255,255,0) 52%, rgba(148,163,184,0.25) 62%, rgba(71,85,105,0.12) 72%, rgba(0,0,0,0) 80%)",
        }}
      />
      {metade("tras")}
      {/* Horizonte de eventos: faixa preta colada no avatar */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[108px] h-[108px] rounded-full bg-black pointer-events-none"
        style={{ zIndex: 5, boxShadow: `0 0 14px 2px ${dono ? "rgba(255,255,255,0.35)" : "rgba(148,163,184,0.3)"}` }}
      />
      {metade("frente")}
    </>
  );
};
