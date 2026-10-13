import React, { useEffect, useState } from "react";
import { Ban, Clock } from "lucide-react";
import { dataHoraCurta } from "../utils/tagExibida";

interface Banido {
  id: string;
  tipo: "suspensao" | "permanente";
  ate: number | null;
  escopo?: string;
  salaNome?: string;
  motivo?: string;
  nome: string;
  tag?: string;
  avatarUrl?: string;
  avatarColor?: string;
  porNome: string;
  criadoEm: number;
}

/** Lista de suspensos/banidos com o botão "Desbanir" (Painel do Dono e Painel Co-fundador). */
export const BanidosPainel: React.FC<{ socket: any; masterToken?: string | null }> = ({ socket, masterToken }) => {
  const [lista, setLista] = useState<Banido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!socket) return;
    let vivo = true;
    const buscar = () =>
      socket.emit("host:banidos", { masterToken: masterToken || undefined }, (r: any) => {
        if (!vivo) return;
        setCarregando(false);
        if (r?.success) setLista(Array.isArray(r.lista) ? r.lista : []);
      });
    buscar();
    socket.on("banimentos:mudou", buscar);
    // Suspensão vencida some sozinha da lista
    const t = setInterval(buscar, 60_000);
    return () => {
      vivo = false;
      socket.off("banimentos:mudou", buscar);
      clearInterval(t);
    };
  }, [socket, masterToken]);

  const desbanir = (b: Banido) => {
    socket.emit("host:desbanir", { id: b.id, masterToken: masterToken || undefined }, (r: any) => {
      setAviso(r?.message || (r?.success ? "Desbanido." : "Não deu pra desbanir."));
      if (r?.success) setLista((l) => l.filter((x) => x.id !== b.id));
      setTimeout(() => setAviso(""), 3500);
    });
  };

  return (
    <div className="space-y-2.5">
      <span className="text-[13px] font-bold text-[#ECECEC] flex items-center gap-2">
        Banidos
        <span className="text-[#8B8E98] font-semibold">{lista.length}</span>
      </span>
      {carregando ? (
        <div className="text-[11px] text-[#8B8E98]">Carregando...</div>
      ) : lista.length === 0 ? (
        <div className="text-[11px] text-[#8B8E98] bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-3 text-center">
          Ninguém suspenso ou banido.
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((b) => (
            <div key={b.id} className="flex items-center gap-3 bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0"
                style={{ backgroundColor: b.avatarColor || "#2A2D35" }}
              >
                {b.avatarUrl ? <img src={b.avatarUrl} alt={b.nome} className="w-full h-full object-cover" /> : <span>{b.nome.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#ECECEC] truncate">
                  {b.nome}
                  {b.tag ? <span className="text-[#5C606A] font-normal"> #{b.tag}</span> : null}
                </div>
                <div className={`text-[11px] flex items-center gap-1 ${b.tipo === "permanente" ? "text-[#FB7185]" : "text-[#5EEAD4]"}`}>
                  {b.tipo === "permanente" ? <Ban className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  <span>{b.tipo === "permanente" || !b.ate ? "Permanente" : `Até ${dataHoraCurta(b.ate)}`}</span>
                </div>
                <div className="text-[10px] font-semibold truncate">
                  {(b.escopo || "app").startsWith("sala:") ? (
                    <span className="text-[#C4B5FD]">Sala: {b.salaNome || (b.escopo || "").slice(5)}</span>
                  ) : (
                    <span className="text-[#FB7185]">App inteiro</span>
                  )}
                </div>
                <div className="text-[10px] text-[#8B8E98] truncate" title={b.motivo || ""}>
                  por {b.porNome}
                  {b.motivo ? ` · ${b.motivo}` : ""}
                </div>
              </div>
              <button
                onClick={() => desbanir(b)}
                className="px-2.5 py-1.5 rounded-lg bg-[#5EEAD4] text-[#16171B] text-[11px] font-black hover:bg-[#2DD4BF] cursor-pointer shrink-0"
              >
                Desbanir
              </button>
            </div>
          ))}
        </div>
      )}
      {aviso && <div className="text-[11px] text-[#5EEAD4]">{aviso}</div>}
    </div>
  );
};
