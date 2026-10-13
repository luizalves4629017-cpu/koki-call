import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, ArrowLeft, MessageSquare, UserMinus, Check, SendHorizontal, UserPlus, Users } from "lucide-react";
import { aoMudarConta } from "../utils/conta";
import { useContagem, textoCalma } from "../utils/useContagem";
import { notify } from "./Toast";

interface Pessoa {
  uid: string;
  nome: string;
  avatarUrl?: string;
  avatarColor?: string;
  online?: boolean;
  em?: number;
}
interface MensagemDM {
  id: string;
  de: string;
  texto: string;
  em: number;
}
interface Estado {
  logado: boolean;
  eu?: string;
  amigos: Pessoa[];
  recebidos: Pessoa[];
  enviados: Pessoa[];
  naoLidas: Record<string, number>;
}

interface AmigosPainelProps {
  socket: any;
  aberto: boolean;
  onFechar: () => void;
  /** Abre direto a conversa com esse amigo (ex.: botão "Conversar" do perfil) */
  conversaInicial?: { uid: string; nome: string } | null;
  /** Pedidos recebidos + mensagens não lidas (pro número no botão Amigos) */
  onPendentes?: (n: number) => void;
}

const VAZIO: Estado = { logado: false, amigos: [], recebidos: [], enviados: [], naoLidas: {} };

// O texto vem do servidor com < e > trocados (segurança). Aqui volta ao normal pra exibir como texto.
const desfazerEscape = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const hora = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const Avatar = ({ p, size = 36 }: { p: Pessoa; size?: number }) => (
  <div className="relative shrink-0" style={{ width: size, height: size }}>
    <div
      className="w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold text-white"
      style={{ backgroundColor: p.avatarColor || "#2A2D35", fontSize: size * 0.36 }}
    >
      {p.avatarUrl ? <img src={p.avatarUrl} alt={p.nome} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <span>{(p.nome || "?").slice(0, 1).toUpperCase()}</span>}
    </div>
    {typeof p.online === "boolean" && (
      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#16171B] ${p.online ? "bg-emerald-400" : "bg-[#5C606A]"}`} />
    )}
  </div>
);

export const AmigosPainel: React.FC<AmigosPainelProps> = ({ socket, aberto, onFechar, conversaInicial, onPendentes }) => {
  const [estado, setEstado] = useState<Estado>(VAZIO);
  const [carregado, setCarregado] = useState(false);
  const [aba, setAba] = useState<"amigos" | "pedidos">("amigos");
  const [conversa, setConversa] = useState<{ uid: string; nome: string } | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDM[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [bloqueadoAte, setBloqueadoAte] = useState(0);
  const segBloqueado = useContagem(bloqueadoAte);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const conversaRef = useRef(conversa);
  conversaRef.current = conversa;
  const abertoRef = useRef(aberto);
  abertoRef.current = aberto;

  const buscar = useCallback(() => {
    if (!socket) return;
    socket.emit("amigos:estado", {}, (r: any) => {
      setCarregado(true);
      if (!r?.ok) return;
      setEstado({
        logado: Boolean(r.logado),
        eu: r.eu,
        amigos: r.amigos || [],
        recebidos: r.recebidos || [],
        enviados: r.enviados || [],
        naoLidas: r.naoLidas || {},
      });
    });
  }, [socket]);

  // Busca ao montar, quando a conta muda e quando o servidor avisa
  useEffect(() => {
    if (!socket) return;
    buscar();
    const desligarConta = aoMudarConta(() => setTimeout(buscar, 1500));
    const mudou = (d?: { novoPedido?: string }) => {
      buscar();
      if (d?.novoPedido) notify(`${d.novoPedido} quer ser seu amigo no Eco.`, "info");
    };
    const novaMensagem = (d: { com: string; nome?: string; msg: MensagemDM }) => {
      if (!d?.msg) return;
      const atual = conversaRef.current;
      if (atual && atual.uid === d.com && abertoRef.current) {
        setMensagens((l) => (l.some((m) => m.id === d.msg.id) ? l : [...l, d.msg]));
        if (d.msg.de !== atual.uid) return;
        socket.emit("dm:lido", { uid: d.com });
        return;
      }
      if (d.msg.de === d.com) {
        setEstado((e) => ({ ...e, naoLidas: { ...e.naoLidas, [d.com]: (e.naoLidas[d.com] || 0) + 1 } }));
        notify(`Nova mensagem de ${d.nome || "um amigo"}`, "info");
      }
    };
    const timeout = (d: { segundos?: number; escopo?: string }) => {
      if (d?.escopo === "dm") setBloqueadoAte(Date.now() + Math.max(1, Number(d.segundos) || 30) * 1000);
    };
    socket.on("amigos:mudou", mudou);
    socket.on("dm:mensagem", novaMensagem);
    socket.on("chat:timeout", timeout);
    socket.on("connect", buscar);
    return () => {
      desligarConta();
      socket.off("amigos:mudou", mudou);
      socket.off("dm:mensagem", novaMensagem);
      socket.off("chat:timeout", timeout);
      socket.off("connect", buscar);
    };
  }, [socket, buscar]);

  const totalNaoLidas = useMemo(() => Object.values(estado.naoLidas).reduce((a: number, b) => a + (Number(b) || 0), 0), [estado.naoLidas]);
  useEffect(() => {
    onPendentes?.(estado.recebidos.length + totalNaoLidas);
  }, [estado.recebidos.length, totalNaoLidas]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirConversa = useCallback(
    (uid: string, nome: string) => {
      setConversa({ uid, nome });
      setMensagens([]);
      setErro("");
      socket.emit("dm:historico", { uid }, (r: any) => {
        if (r?.ok) setMensagens(r.mensagens || []);
        else setErro(r?.mensagem || "Não deu pra abrir a conversa.");
      });
      setEstado((e) => {
        const n = { ...e.naoLidas };
        delete n[uid];
        return { ...e, naoLidas: n };
      });
    },
    [socket]
  );

  // "Conversar" vindo do perfil
  useEffect(() => {
    if (aberto && conversaInicial?.uid) abrirConversa(conversaInicial.uid, conversaInicial.nome);
  }, [aberto, conversaInicial?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (aberto && conversa) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length, aberto, conversa]);

  const enviar = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!conversa) return;
    const t = texto.trim();
    if (!t) return;
    if (segBloqueado > 0) {
      setErro(textoCalma(segBloqueado));
      return;
    }
    socket.emit("dm:enviar", { uid: conversa.uid, texto: t }, (r: any) => {
      if (r?.ok && r.msg) {
        setMensagens((l) => (l.some((m) => m.id === r.msg.id) ? l : [...l, r.msg]));
        setTexto("");
        setErro("");
      } else {
        if (typeof r?.segundos === "number") setBloqueadoAte(Date.now() + r.segundos * 1000);
        setErro(r?.mensagem || "Não deu pra enviar.");
      }
    });
  };

  const responder = (uid: string, aceitar: boolean) => socket.emit("amigos:responder", { uid, aceitar }, () => buscar());
  const cancelar = (uid: string) => socket.emit("amigos:cancelar", { uid }, () => buscar());
  const remover = (p: Pessoa) => {
    if (!window.confirm(`Remover ${p.nome} dos seus amigos?`)) return;
    socket.emit("amigos:remover", { uid: p.uid }, () => {
      if (conversa?.uid === p.uid) setConversa(null);
      buscar();
    });
  };

  if (!aberto) return null;

  const fechar = () => {
    setConversa(null);
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-[60] select-none" onClick={fechar}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full sm:w-[400px] bg-[#16171B] border-l border-[#2A2D35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-[#ECECEC]"
      >
        {/* Cabeçalho */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          {conversa ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => setConversa(null)} className="p-1.5 rounded-lg text-[#8B8E98] hover:text-[#ECECEC] hover:bg-[#1E2026] cursor-pointer" title="Voltar">
                <ArrowLeft className="w-4 h-4" />
              </button>
              {(() => {
                const p = estado.amigos.find((a) => a.uid === conversa.uid) || { uid: conversa.uid, nome: conversa.nome };
                return (
                  <>
                    <Avatar p={p} size={32} />
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold truncate">{p.nome}</div>
                      <div className="text-[11px] text-[#8B8E98]">{p.online ? "Online" : "Offline"}</div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-[#5EEAD4]" /> Amigos
            </h3>
          )}
          <button onClick={fechar} className="p-2 rounded-xl text-[#8B8E98] hover:text-[#ECECEC] hover:bg-[#1E2026] cursor-pointer" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!carregado ? (
          <div className="flex-1 flex items-center justify-center text-xs text-[#8B8E98]">Carregando...</div>
        ) : !estado.logado ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <UserPlus className="w-10 h-10 text-[#C4B5FD]" />
            <p className="text-sm font-bold">Entre com sua conta para adicionar amigos</p>
            <p className="text-[11px] text-[#8B8E98]">Com a conta logada você manda pedidos de amizade e conversa no privado com seus amigos.</p>
          </div>
        ) : conversa ? (
          /* Conversa privada */
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 select-text">
              {mensagens.length === 0 && !erro && (
                <div className="text-center text-[11px] text-[#8B8E98] py-8">Diga oi pra {conversa.nome}! As mensagens ficam salvas aqui.</div>
              )}
              {mensagens.map((m) => {
                const minha = m.de !== conversa.uid;
                return (
                  <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug break-words whitespace-pre-wrap ${
                        minha ? "bg-[#5EEAD4]/15 border border-[#5EEAD4]/30 rounded-br-md" : "bg-[#1E2026] border border-[#2A2D35] rounded-bl-md"
                      }`}
                    >
                      <div>{desfazerEscape(m.texto)}</div>
                      <div className="text-[10px] text-[#8B8E98] text-right mt-0.5">{hora(m.em)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={fimRef} />
            </div>
            <form onSubmit={enviar} className="px-4 pb-4 pt-2 border-t border-[#2A2D35] space-y-2 shrink-0">
              {segBloqueado > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-3 py-2 text-[12px] font-semibold text-[#FECDD3]">
                  <span>{textoCalma(segBloqueado)}</span>
                  <span className="font-mono text-[#F43F5E]">{segBloqueado}s</span>
                </div>
              )}
              {erro && segBloqueado === 0 && <div className="text-[11px] text-[#FB7185]">{erro}</div>}
              <div className="flex items-center rounded-xl border border-[#2A2D35] bg-[#1E2026] pl-3 pr-1 py-1 focus-within:border-[#5EEAD4]/60">
                <input
                  type="text"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  maxLength={1000}
                  disabled={segBloqueado > 0}
                  placeholder={segBloqueado > 0 ? textoCalma(segBloqueado) : `Mensagem para ${conversa.nome}`}
                  className="flex-1 min-w-0 text-[13px] bg-transparent focus:outline-none py-1.5 text-[#ECECEC]"
                />
                <button
                  type="submit"
                  disabled={!texto.trim() || segBloqueado > 0}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#5EEAD4] disabled:opacity-30 cursor-pointer"
                  title="Enviar"
                >
                  <SendHorizontal className="w-4 h-4 text-[#16171B]" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            {/* Abas */}
            <div className="px-5 pb-3 shrink-0">
              <div className="flex gap-1 bg-[#1E2026] border border-[#2A2D35] rounded-xl p-1">
                {(
                  [
                    { id: "amigos", rotulo: "Amigos", n: totalNaoLidas },
                    { id: "pedidos", rotulo: "Pedidos", n: estado.recebidos.length },
                  ] as const
                ).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAba(a.id)}
                    className={`relative flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      aba === a.id ? "bg-[#5EEAD4]/15 text-[#5EEAD4]" : "text-[#8B8E98] hover:text-[#ECECEC]"
                    }`}
                  >
                    {a.rotulo}
                    {a.n > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center bg-[#F43F5E] text-white text-[10px] font-black min-w-[16px] h-[16px] px-1 rounded-full">
                        {a.n}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
              {aba === "amigos" ? (
                estado.amigos.length === 0 ? (
                  <div className="text-center text-[12px] text-[#8B8E98] py-10">
                    Você ainda não tem amigos aqui. Abra o perfil de alguém na call e toque em <span className="text-[#5EEAD4] font-semibold">Adicionar amigo</span>.
                  </div>
                ) : (
                  estado.amigos.map((p) => (
                    <div key={p.uid} className="flex items-center gap-3 bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-2.5">
                      <Avatar p={p} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold truncate">{p.nome}</div>
                        <div className={`text-[11px] ${p.online ? "text-emerald-400" : "text-[#8B8E98]"}`}>{p.online ? "Online" : "Offline"}</div>
                      </div>
                      <button
                        onClick={() => abrirConversa(p.uid, p.nome)}
                        className="relative px-2.5 py-1.5 rounded-lg bg-[#C4B5FD]/15 hover:bg-[#C4B5FD]/25 border border-[#C4B5FD]/40 text-[#C4B5FD] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Conversar
                        {estado.naoLidas[p.uid] > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-[#F43F5E] text-white text-[10px] font-black min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center">
                            {estado.naoLidas[p.uid]}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => remover(p)}
                        className="p-1.5 rounded-lg border border-[#2A2D35] text-[#8B8E98] hover:text-[#FB7185] hover:border-[#F43F5E]/50 cursor-pointer"
                        title="Remover amigo"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )
              ) : (
                <>
                  <div className="text-[12px] font-bold text-[#ECECEC] pt-1">Recebidos</div>
                  {estado.recebidos.length === 0 ? (
                    <div className="text-[11px] text-[#8B8E98]">Nenhum pedido novo.</div>
                  ) : (
                    estado.recebidos.map((p) => (
                      <div key={p.uid} className="flex items-center gap-3 bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-2.5">
                        <Avatar p={p} />
                        <div className="min-w-0 flex-1 text-[13px] font-bold truncate">{p.nome}</div>
                        <button
                          onClick={() => responder(p.uid, false)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#F43F5E]/50 text-[#FB7185] text-[11px] font-bold hover:bg-[#F43F5E]/10 cursor-pointer"
                        >
                          Recusar
                        </button>
                        <button
                          onClick={() => responder(p.uid, true)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#5EEAD4] text-[#16171B] text-[11px] font-black hover:bg-[#2DD4BF] flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Aceitar
                        </button>
                      </div>
                    ))
                  )}
                  <div className="text-[12px] font-bold text-[#ECECEC] pt-3">Enviados</div>
                  {estado.enviados.length === 0 ? (
                    <div className="text-[11px] text-[#8B8E98]">Nenhum pedido esperando resposta.</div>
                  ) : (
                    estado.enviados.map((p) => (
                      <div key={p.uid} className="flex items-center gap-3 bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-2.5">
                        <Avatar p={p} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold truncate">{p.nome}</div>
                          <div className="text-[11px] text-[#8B8E98]">Esperando resposta</div>
                        </div>
                        <button
                          onClick={() => cancelar(p.uid)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#2A2D35] text-[#8B8E98] text-[11px] font-bold hover:text-[#ECECEC] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
};
