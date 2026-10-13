import React, { useCallback, useEffect, useState } from "react";
import { X, Activity, Megaphone, CloudRain, RefreshCw } from "lucide-react";
import type { Socket } from "socket.io-client";
import { EcoCoinIcon } from "./EcoCoinIcon";

export type AbaExtras = "raiox" | "anuncio" | "chuva";

interface Props {
  socket: Socket;
  masterToken?: string | null;
  abaInicial?: AbaExtras;
  onClose: () => void;
}

interface RaioX {
  salas: Array<{ roomId: string; nome: string; pessoas: number; nomes: string[] }>;
  online: number;
  moedasCirculando: number;
  comprasHoje: number;
  ultimasCompras: Array<{ nome: string; item: string; quando: number }>;
  historico: Array<{ t: number; online: number }>;
}

const hora = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const Grafico: React.FC<{ dados: Array<{ t: number; online: number }> }> = ({ dados }) => {
  if (dados.length < 2) {
    return <p className="text-xs text-[#8B8F98] py-6 text-center">O gráfico enche sozinho: um ponto a cada 10 minutos.</p>;
  }
  const W = 320;
  const H = 110;
  const max = Math.max(1, ...dados.map((d) => d.online));
  const pts = dados.map((d, i) => [(i / (dados.length - 1)) * W, H - (d.online / max) * (H - 10) - 4]);
  const linha = pts.map((p) => p.join(",")).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[110px]">
        <polygon points={`0,${H} ${linha} ${W},${H}`} fill="#5EEAD422" />
        <polyline points={linha} fill="none" stroke="#5EEAD4" strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-[#8B8F98]">
        <span>{hora(dados[0].t)}</span>
        <span>pico: {max}</span>
        <span>{hora(dados[dados.length - 1].t)}</span>
      </div>
    </div>
  );
};

export const PainelExtrasMaster: React.FC<Props> = ({ socket, masterToken, abaInicial = "raiox", onClose }) => {
  const [aba, setAba] = useState<AbaExtras>(abaInicial);
  const [dados, setDados] = useState<RaioX | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // anúncio
  const [texto, setTexto] = useState("");
  const [todasSalas, setTodasSalas] = useState(true);
  const [minutos, setMinutos] = useState(10);

  // chuva
  const [quantidade, setQuantidade] = useState(30);
  const [valor, setValor] = useState(25);
  const [segundos, setSegundos] = useState(15);

  const carregar = useCallback(() => {
    socket.emit("master:raiox", { masterToken }, (r: any) => {
      if (r?.ok) {
        setDados(r);
        setErro(null);
      } else setErro(r?.mensagem || "Não consegui carregar.");
    });
  }, [socket, masterToken]);

  useEffect(() => {
    if (aba !== "raiox") return;
    carregar();
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, [aba, carregar]);

  const mostrarAviso = (m: string) => {
    setAviso(m);
    setTimeout(() => setAviso(null), 3000);
  };

  const publicar = () => {
    socket.emit("anuncio:publicar", { masterToken, texto, todasSalas, minutos }, (r: any) => {
      if (r?.ok) {
        setTexto("");
        mostrarAviso("Aviso publicado!");
      } else mostrarAviso(r?.mensagem || "Não deu pra publicar.");
    });
  };

  const removerAnuncio = () => {
    socket.emit("anuncio:remover", { masterToken }, () => mostrarAviso("Aviso removido."));
  };

  const soltarChuva = () => {
    socket.emit("chuva:iniciar", { masterToken, quantidade, valor, segundos }, (r: any) => {
      if (r?.ok) onClose();
      else mostrarAviso(r?.mensagem || "Não deu pra soltar a chuva.");
    });
  };

  const abas: Array<{ id: AbaExtras; rotulo: string; icone: React.ReactNode }> = [
    { id: "raiox", rotulo: "Raio-X ao vivo", icone: <Activity className="w-4 h-4" /> },
    { id: "anuncio", rotulo: "Anúncio global", icone: <Megaphone className="w-4 h-4" /> },
    { id: "chuva", rotulo: "Chuva de moedas", icone: <CloudRain className="w-4 h-4" /> },
  ];

  const campo = "w-full bg-[#16171B] border border-[#2A2D35] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none focus:border-[#5EEAD4]/60";

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-[860px] max-h-[90vh] overflow-y-auto bg-[#1E2026] border border-[#2A2D35] rounded-2xl shadow-2xl p-5 text-[#ECECEC]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="text-2xl text-[#C4B5FD] leading-none">∞</span> Painel Master
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#2A2D35] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-1 rounded-xl bg-[#16171B] border border-[#2A2D35] flex gap-1 mb-4">
          {abas.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                aba === a.id ? "bg-[#C4B5FD]/20 text-[#C4B5FD]" : "text-[#8B8F98] hover:text-[#ECECEC]"
              }`}
            >
              {a.icone}
              {a.rotulo}
            </button>
          ))}
        </div>

        {aviso && <div className="mb-3 px-3 py-2 rounded-lg bg-[#5EEAD4]/10 border border-[#5EEAD4]/30 text-[#5EEAD4] text-xs">{aviso}</div>}

        {aba === "raiox" && (
          <div>
            {erro && <p className="text-sm text-[#F43F5E]">{erro}</p>}
            {dados && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                  {[
                    { r: "Salas ativas", v: dados.salas.length },
                    { r: "Pessoas online", v: dados.online },
                    { r: "Moedas em circulação", v: dados.moedasCirculando.toLocaleString("pt-BR"), moeda: true },
                    { r: "Compras hoje", v: dados.comprasHoje },
                  ].map((c) => (
                    <div key={c.r} className="rounded-xl bg-[#16171B] border border-[#2A2D35] p-3">
                      <p className="text-[11px] text-[#8B8F98]">{c.r}</p>
                      <p className="text-2xl font-black mt-1 flex items-center gap-1.5">
                        {c.v} {c.moeda && <EcoCoinIcon size={18} />}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#16171B] border border-[#2A2D35] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Salas agora</h3>
                      <button onClick={carregar} className="p-1 rounded hover:bg-[#2A2D35] cursor-pointer" title="Atualizar">
                        <RefreshCw className="w-3.5 h-3.5 text-[#8B8F98]" />
                      </button>
                    </div>
                    {dados.salas.length === 0 ? (
                      <p className="text-xs text-[#8B8F98]">Nenhuma sala aberta.</p>
                    ) : (
                      <ul className="space-y-2">
                        {dados.salas.map((s) => (
                          <li key={s.roomId} className="flex items-center justify-between gap-2 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{s.nome}</p>
                              <p className="text-[11px] text-[#8B8F98] truncate">{s.nomes.join(", ") || "vazia"}</p>
                            </div>
                            <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-[#5EEAD4]/15 text-[#5EEAD4]">{s.pessoas}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl bg-[#16171B] border border-[#2A2D35] p-3">
                      <h3 className="text-sm font-semibold mb-2">Pessoas online (24h)</h3>
                      <Grafico dados={dados.historico} />
                    </div>
                    <div className="rounded-xl bg-[#16171B] border border-[#2A2D35] p-3">
                      <h3 className="text-sm font-semibold mb-2">Últimas compras</h3>
                      {dados.ultimasCompras.length === 0 ? (
                        <p className="text-xs text-[#8B8F98]">Nenhuma compra desde que o servidor ligou.</p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {dados.ultimasCompras.slice(0, 6).map((c, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span className="truncate">
                                <b>{c.nome}</b> · {c.item}
                              </span>
                              <span className="text-[#8B8F98] shrink-0">{hora(c.quando)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {aba === "anuncio" && (
          <div className="space-y-3 max-w-[480px]">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 200))}
              placeholder="Ex.: Evento hoje às 21h — moedas em dobro!"
              rows={3}
              className={campo + " resize-none"}
            />
            <label className="flex items-center justify-between text-sm">
              <span>Enviar para todas as salas</span>
              <input type="checkbox" checked={todasSalas} onChange={(e) => setTodasSalas(e.target.checked)} className="w-4 h-4 accent-[#5EEAD4]" />
            </label>
            <label className="flex items-center justify-between text-sm gap-3">
              <span>Duração</span>
              <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} className={campo + " max-w-[160px]"}>
                {[5, 10, 30, 60, 180, 720, 1440].map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                onClick={publicar}
                disabled={!texto.trim()}
                className="flex-1 py-2.5 rounded-lg bg-[#5EEAD4] text-[#16171B] font-bold text-sm cursor-pointer disabled:opacity-50"
              >
                Publicar
              </button>
              <button onClick={removerAnuncio} className="px-4 py-2.5 rounded-lg bg-[#2A2D35] text-sm cursor-pointer hover:bg-[#353943]">
                Tirar aviso
              </button>
            </div>
          </div>
        )}

        {aba === "chuva" && (
          <div className="space-y-3 max-w-[480px]">
            <p className="text-xs text-[#8B8F98]">Cai na sala em que você está. Quem clicar primeiro em cada moeda ganha.</p>
            {[
              { r: "Quantidade de moedas", v: quantidade, set: setQuantidade, min: 5, max: 80 },
              { r: "Valor de cada moeda", v: valor, set: setValor, min: 1, max: 1000 },
              { r: "Duração (segundos)", v: segundos, set: setSegundos, min: 5, max: 60 },
            ].map((c) => (
              <label key={c.r} className="flex items-center justify-between gap-3 text-sm">
                <span>{c.r}</span>
                <input
                  type="number"
                  min={c.min}
                  max={c.max}
                  value={c.v}
                  onChange={(e) => c.set(Math.max(c.min, Math.min(c.max, Number(e.target.value) || c.min)))}
                  className={campo + " max-w-[120px] text-right"}
                />
              </label>
            ))}
            <p className="text-xs text-[#C4B5FD]">Total possível: {(quantidade * valor).toLocaleString("pt-BR")} Eco Coins</p>
            <button onClick={soltarChuva} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#5EEAD4] to-[#C4B5FD] text-[#16171B] font-bold text-sm cursor-pointer active:scale-[0.98]">
              Soltar chuva agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
