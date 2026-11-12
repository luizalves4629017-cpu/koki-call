import React, { useEffect } from "react";
import { ArrowLeft, ChevronRight, X } from "lucide-react";

// Gaveta lateral padrão do eco: desliza da direita, ocupa a altura toda
// e deixa a call visível (escurecida) do lado.
export const Gaveta: React.FC<{
  aberta: boolean;
  titulo: React.ReactNode;
  onFechar: () => void;
  onVoltar?: () => void; // quando está numa subpágina
  rodape?: React.ReactNode;
  largura?: string;
  children: React.ReactNode;
}> = ({ aberta, titulo, onFechar, onVoltar, rodape, largura = "sm:w-[420px]", children }) => {
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (onVoltar) onVoltar();
      else onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta, onVoltar, onFechar]);

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50 select-none">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] eco-gaveta-fundo" onClick={onFechar} />
      <aside
        className={`absolute right-0 top-0 h-full w-full ${largura} bg-[#1A1B20] border-l-2 border-[#5EEAD4] shadow-2xl flex flex-col text-[#ECECEC] eco-gaveta-entrar`}
      >
        <header className="h-14 px-3 flex items-center gap-2 border-b border-[#2A2D35] shrink-0">
          <button
            type="button"
            onClick={onVoltar || onFechar}
            className={`p-2 rounded-lg hover:bg-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC] cursor-pointer ${onVoltar ? "" : "invisible"}`}
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h3 className="flex-1 text-center font-bold text-[15px] truncate">{titulo}</h3>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg hover:bg-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC] cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {rodape && <footer className="p-4 border-t border-[#2A2D35] bg-[#16171B] shrink-0">{rodape}</footer>}
      </aside>
    </div>
  );
};

// Linha de lista estilo configurações do celular
export const GavetaLinha: React.FC<{
  rotulo: React.ReactNode;
  valor?: React.ReactNode;
  direita?: React.ReactNode;
  icone?: React.ReactNode;
  onClick?: () => void;
  bloqueada?: boolean;
}> = ({ rotulo, valor, direita, icone, onClick, bloqueada }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`w-full flex items-center gap-3 px-5 py-3.5 border-b border-[#2A2D35] text-left transition-colors ${
      onClick ? "hover:bg-[#22242B] cursor-pointer" : "cursor-default"
    } ${bloqueada ? "opacity-70" : ""}`}
  >
    {icone && <span className="shrink-0 text-[#5EEAD4]">{icone}</span>}
    <span className="flex-1 min-w-0">
      <span className="block text-[14px] text-[#ECECEC]">{rotulo}</span>
      {valor !== undefined && valor !== "" && (
        <span className="block text-[12.5px] text-[#8B8F98] truncate mt-0.5">{valor}</span>
      )}
    </span>
    {direita && <span className="shrink-0 text-[12px] text-[#8B8F98]">{direita}</span>}
    {onClick && <ChevronRight className="w-4 h-4 text-[#8B8F98] shrink-0" />}
  </button>
);

export const GavetaSecao: React.FC<{ titulo?: string; children: React.ReactNode; className?: string }> = ({
  titulo,
  children,
  className = "",
}) => (
  <div className={`px-5 py-4 space-y-3 ${className}`}>
    {titulo && (
      <span className="block text-[10.5px] font-bold uppercase tracking-wider text-[#8B8F98]">{titulo}</span>
    )}
    {children}
  </div>
);

export const gavetaInput =
  "w-full bg-[#16171B] border border-[#2A2D35] text-[#ECECEC] rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#5EEAD4]";
