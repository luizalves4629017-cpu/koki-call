import { BadgeIcon } from "./BadgeIcon";
import React, { useEffect, useState } from "react";
import { X, Plus, Coins, Gavel } from "lucide-react";
import { tagVisivel } from "../utils/tagExibida";
import { perkAtivo } from "../utils/perks";
import { limparAura } from "../utils/auraCard";
import { AuraCard, AuraLojaBrilho } from "./AuraCard";
import { AuraCriador } from "./UserProfileCard";
import { EcoCoinIcon } from "./EcoCoinIcon";
import { Participant } from "../types";
import { ALL_BADGES } from "../data/badges";
import { INITIAL_STORE_ITEMS, getStoreItems, isVideoMedia, formatCoinDisplay } from "../utils/storage";

interface GrantBadgesModalProps {
  isOpen: boolean;
  targetParticipant: Participant;
  onClose: () => void;
  onAssignBadges: (targetSocketId: string, badges: string[]) => void;
  /** Dono Master e Co-fundador podem dar E tirar insígnias */
  podeRemover?: boolean;
  /** Quem está mexendo é o Dono Master (vê e mexe nas insígnias exclusivas do Dono, como Co-fundador) */
  ehDono?: boolean;
  /** Só o Dono Master: remove um item comprado na loja */
  onRemoverItem?: (targetSocketId: string, itemId: string) => void;
  /** Só o Dono Master: dá ou tira o cargo (vazio = Membro) */
  onDefinirCargo?: (targetSocketId: string, cargo: string, poderes: string[]) => void;
  /** Só o Dono Master: histórico de tudo que a pessoa comprou */
  buscarCompras?: (targetSocketId: string) => Promise<Record<string, { primeira?: number; ultima?: number; ate: number; vezes: number; removido?: boolean }>>;
  /** Dono Master e Co-fundador: libera (ou tira) a troca de aura do card. Vale na hora (não espera o Salvar). */
  onLiberarAura?: (targetSocketId: string, liberado: boolean) => Promise<{ success: boolean; message?: string; auraLiberadaPor?: "dono" | "cofundador" }>;
  /** Quem está liberando agora */
  quemLiberaAura?: "dono" | "cofundador";
  /** Dar moedas direto daqui (mesmo handler do painel: host:give-coins) */
  onDarMoedas?: (targetSocketId: string, amount: number) => void;
  /** Abre a janela Punir (só vem quando as regras deixam punir esse alvo) */
  onPunir?: (alvo: Participant) => void;
}

// Insígnias que só o Dono Master entrega/tira (Criador nunca é entregue). O Co-fundador nem vê.
const SO_DO_DONO = ["singularidade", "cofundador", "koki_creator"];

export const GrantBadgesModal: React.FC<GrantBadgesModalProps> = ({
  isOpen,
  targetParticipant,
  onClose,
  onAssignBadges,
  podeRemover = false,
  ehDono = false,
  onRemoverItem,
  onDefinirCargo,
  buscarCompras,
  onLiberarAura,
  quemLiberaAura = "dono",
  onDarMoedas,
  onPunir,
}) => {
  const [moedasAberto, setMoedasAberto] = useState(false);
  const [moedasQtd, setMoedasQtd] = useState("");
  const [moedasEnviadas, setMoedasEnviadas] = useState(false);
  // Aura do card: Dono Master e Co-fundadores têm aura fixa, então o interruptor não aparece pra eles
  const alvoAuraFixa = Boolean(
    targetParticipant.isMaster || (targetParticipant as any).ehDono || targetParticipant.isCofundador || targetParticipant.tag === "0001" || (targetParticipant.badges || []).includes("cofundador")
  );
  const [auraLib, setAuraLib] = useState<boolean>(Boolean(targetParticipant.auraLiberada));
  const [auraPor, setAuraPor] = useState<"dono" | "cofundador" | undefined>(targetParticipant.auraLiberadaPor);
  const [auraEnviando, setAuraEnviando] = useState(false);
  const [auraErro, setAuraErro] = useState("");
  useEffect(() => {
    setAuraLib(Boolean(targetParticipant.auraLiberada));
    setAuraPor(targetParticipant.auraLiberadaPor);
  }, [targetParticipant.id, targetParticipant.auraLiberada, targetParticipant.auraLiberadaPor]);
  const alternarAura = async () => {
    if (!onLiberarAura || auraEnviando) return;
    const novo = !auraLib;
    if (!novo && !window.confirm(`Tirar a permissão de ${targetParticipant.name}? A aura personalizada dele(a) some.`)) return;
    setAuraEnviando(true);
    setAuraErro("");
    const r = await onLiberarAura(targetParticipant.id, novo).catch(() => ({ success: false, message: "O servidor não respondeu." }) as any);
    setAuraEnviando(false);
    if (r?.success) {
      setAuraLib(novo);
      setAuraPor(novo ? r.auraLiberadaPor || quemLiberaAura : undefined);
    } else setAuraErro(r?.message || "Não deu pra mudar agora.");
  };
  const originais = Array.isArray(targetParticipant.badges) ? targetParticipant.badges : [];
  const [selecionadas, setSelecionadas] = useState<string[]>([...originais]);
  const [salvo, setSalvo] = useState(false);
  const cargoOriginal = String((targetParticipant as any).cargo || "");
  const [cargo, setCargo] = useState(cargoOriginal);
  const poderesOriginais: string[] = Array.isArray((targetParticipant as any).poderes) ? (targetParticipant as any).poderes : [];
  const [poderes, setPoderes] = useState<string[]>([...poderesOriginais]);
  const alternarPoder = (id: string) => setPoderes((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const PRESETS: Record<string, string[]> = { Moderador: ["mutar", "expulsar", "porta"], Admin: ["mutar", "expulsar", "porta"], Staff: ["porta"], Parceiro: [] };
  const [perks, setPerks] = useState<Record<string, number>>({ ...((targetParticipant as any).purchasedPerks || {}) });
  const [compras, setCompras] = useState<Record<string, { primeira?: number; ultima?: number; ate: number; vezes: number; removido?: boolean }>>({});
  useEffect(() => {
    if (!buscarCompras) return;
    let vivo = true;
    buscarCompras(targetParticipant.id).then((c) => vivo && setCompras(c || {})).catch(() => {});
    return () => { vivo = false; };
  }, [targetParticipant.id]);
  // Tudo que a pessoa já comprou: ativos primeiro, depois os vencidos/removidos
  const todasCompras = (() => {
    const mapa: Record<string, { ate: number; vezes: number; ultima?: number; removido?: boolean }> = {};
    for (const [id, c] of Object.entries(compras) as [string, any][]) mapa[id] = { ate: Number(c.ate) || 0, vezes: c.vezes || 1, ultima: c.ultima, removido: c.removido };
    for (const [id, ate] of Object.entries(perks)) {
      if (!mapa[id] || Number(ate) > mapa[id].ate) mapa[id] = { ...(mapa[id] || { vezes: 1 }), ate: Number(ate), removido: false };
    }
    return Object.entries(mapa)
      .map(([id, c]) => ({ id, ...c, ativo: !c.removido && c.ate > Date.now() && (id in perks || !Object.keys(perks).length || c.ate > Date.now()) }))
      .sort((a, b) => Number(b.ativo) - Number(a.ativo) || b.ate - a.ate);
  })();
  const itensAtivos = todasCompras.filter((c) => c.ativo).map((c) => [c.id, c.ate] as [string, number]);
  const nomeItem = (id: string) => getStoreItems().find((i) => i.id === id)?.name || INITIAL_STORE_ITEMS.find((i) => i.id === id)?.name || id;
  const dataCurta = (t: number) => new Date(Number(t)).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const removerItem = (id: string) => {
    if (!onRemoverItem) return;
    if (!window.confirm(`Remover "${nomeItem(id)}" de ${targetParticipant.name}? O que esse item libera também sai.`)) return;
    onRemoverItem(targetParticipant.id, id);
    setPerks((p) => { const n = { ...p }; delete n[id]; return n; });
    setCompras((c) => (c[id] ? { ...c, [id]: { ...c[id], ate: Math.min(c[id].ate, Date.now()), removido: true } } : c));
  };

  if (!isOpen) return null;

  const visiveis = ALL_BADGES.filter((b) => b.id !== "singularidade" && (ehDono || (!SO_DO_DONO.includes(b.id) && !(b.id.includes("owner") && b.id !== "nitro_owner"))));
  const dadas = visiveis.filter((b) => selecionadas.includes(b.id));
  const disponiveis = visiveis.filter((b) => !selecionadas.includes(b.id));

  const dar = (id: string) => setSelecionadas((l) => [...l, id]);
  const tirar = (id: string) => {
    if (!podeRemover && originais.includes(id)) return; // só o Dono tira o que já foi dado
    setSelecionadas((l) => l.filter((x) => x !== id));
  };

  const salvar = () => {
    onAssignBadges(targetParticipant.id, selecionadas);
    const mudouPoderes = [...poderes].sort().join() !== [...poderesOriginais].sort().join();
    if (podeRemover && onDefinirCargo && (cargo.trim() !== cargoOriginal || mudouPoderes)) onDefinirCargo(targetParticipant.id, cargo.trim(), cargo.trim() ? poderes : []);
    setSalvo(true);
    setTimeout(() => {
      setSalvo(false);
      onClose();
    }, 900);
  };

  // Chamado como função (não <Pilula/>): senão o React recria o botão a cada atualização da call
  // (alguém falando) e o clique se perde quando tem gente na sala.
  const Pilula = ({ id, nome, icone, descricao, dada }: { id: string; nome: string; icone: string; descricao: string; dada: boolean }) => {
    const travada = dada && !podeRemover && originais.includes(id);
    return (
      <button
        type="button"
        title={descricao}
        onClick={() => (dada ? tirar(id) : dar(id))}
        disabled={travada}
        className={`group inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer disabled:cursor-default ${
          dada
            ? "bg-[#16171B] text-white border border-white/70"
            : "bg-[#23252B] text-[#B5B9C2] border border-transparent hover:bg-[#2C2F36] hover:text-white"
        }`}
      >
        <BadgeIcon icon={icone} size={14} />
        <span>{nome}</span>
        {dada ? (
          !travada && <X className="w-3 h-3 opacity-60 group-hover:opacity-100" />
        ) : (
          <Plus className="w-3 h-3 opacity-60 group-hover:opacity-100" />
        )}
      </button>
    );
  };

  // ---------- Prévia do card (coluna da esquerda) ----------
  const alvoOffline = String(targetParticipant.id).startsWith("membro:");
  const alvoEhDono = Boolean(targetParticipant.isMaster || (targetParticipant as any).ehDono || targetParticipant.tag === "0001");
  const alvoEhCof = !alvoEhDono && Boolean(targetParticipant.isCofundador || (targetParticipant.badges || []).includes("cofundador"));
  const moedasAlvo = alvoEhDono || alvoEhCof ? "∞" : formatCoinDisplay(targetParticipant.kokiCoins, false);
  const desdeAlvo = targetParticipant.memberSince || targetParticipant.joinedAt;
  const cargoPreview = alvoEhDono ? "Dono Master" : alvoEhCof ? "Co-fundador" : (podeRemover && onDefinirCargo ? cargo.trim() : cargoOriginal) || "Membro";
  const auraPreviewCompleta = !alvoAuraFixa && auraLib && targetParticipant.auraCard ? limparAura(targetParticipant.auraCard) : null;
  const auraPreviewLoja =
    !alvoAuraFixa && !auraPreviewCompleta && targetParticipant.auraLoja && (alvoOffline || !targetParticipant.purchasedPerks || perkAtivo(targetParticipant, "aura_card"))
      ? targetParticipant.auraLoja
      : null;
  // Dar moedas: só pra quem está na call (o servidor só acha quem está online), nunca no Dono e, pro Co-fundador, nunca em outro Co-fundador
  const podeDarMoedas = Boolean(onDarMoedas && !alvoOffline && !alvoEhDono && (ehDono || !alvoEhCof));
  const enviarMoedas = () => {
    const n = parseInt(moedasQtd, 10);
    if (!onDarMoedas || isNaN(n) || n <= 0) return;
    onDarMoedas(targetParticipant.id, n);
    setMoedasQtd("");
    setMoedasEnviadas(true);
    setTimeout(() => setMoedasEnviadas(false), 1500);
  };

  const cartao = "rounded-2xl bg-[#1E2026] border border-[#2A2D35] p-4";
  const rotulo = "text-xs font-semibold text-[#ECECEC] mb-2.5";

  return (
    <div className="fixed inset-0 z-[120] flex items-stretch md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4" onClick={onClose}>
      <div
        className="w-full h-full md:h-auto md:max-w-[1100px] md:max-h-[85vh] flex flex-col bg-[#16171B] md:rounded-2xl md:border md:border-[#2A2D35] shadow-2xl text-[#ECECEC]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#2A2D35] shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">Gerenciar {targetParticipant.name}</h2>
            {!podeRemover && <p className="text-[11px] text-[#8B8F98] mt-0.5">Você pode dar insígnias. Só o Dono pode tirar.</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[#8B8F98] hover:text-white hover:bg-[#2A2D35] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo: 3 colunas no computador, uma coluna rolando no celular */}
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden p-4 md:p-5 grid grid-cols-1 md:grid-cols-[280px_1fr_1fr] md:grid-rows-[minmax(0,1fr)] gap-4">
          {/* ESQUERDA: prévia do card + ações rápidas */}
          <div className="md:min-h-0 md:overflow-y-auto flex flex-col gap-4 md:p-3 md:-m-3">
            <div className="relative">
              {alvoEhDono && <AuraCriador />}
              {alvoEhCof && <AuraCriador cofundador />}
              {auraPreviewCompleta && <AuraCard config={auraPreviewCompleta} />}
              {!auraPreviewCompleta && auraPreviewLoja && <AuraLojaBrilho cor={auraPreviewLoja} />}
              <div className="relative z-10 rounded-3xl bg-[#1E2026] border border-[#2A2D35] overflow-hidden">
                <div className="relative h-24 overflow-hidden">
                  {targetParticipant.bannerUrl ? (
                    isVideoMedia(targetParticipant.bannerUrl) ? (
                      <video src={targetParticipant.bannerUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                    ) : (
                      <img src={targetParticipant.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#16171B] via-[#0d2825] to-[#201736]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1E2026]/30 to-[#1E2026]" />
                </div>
                <div className="relative -mt-10 flex flex-col items-center px-4 pb-4">
                  <div
                    className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-[#1E2026] flex items-center justify-center text-2xl font-extrabold text-white"
                    style={{ backgroundColor: targetParticipant.avatarColor || "#2DD4BF" }}
                  >
                    {targetParticipant.avatarUrl ? (
                      <img src={targetParticipant.avatarUrl} alt={targetParticipant.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{targetParticipant.name ? targetParticipant.name.slice(0, 1).toUpperCase() : "E"}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-extrabold text-white text-center break-all">
                    {targetParticipant.name} <span className="font-medium text-[#8B8F98]">#{tagVisivel(targetParticipant)}</span>
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C4B5FD]/15 text-[#C4B5FD] border border-[#C4B5FD]/30">{cargoPreview}</span>
                    {alvoOffline && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2A2D35] text-[#8B8F98]">Offline</span>}
                  </div>
                  <div className="w-full mt-3 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between rounded-lg bg-[#16171B] px-3 py-2">
                      <span className="text-[#8B8F98]">Membro desde</span>
                      {alvoEhDono || alvoEhCof ? (
                        <span className="text-base leading-none font-black bg-gradient-to-r from-[#C4B5FD] to-[#5EEAD4] bg-clip-text text-transparent">∞</span>
                      ) : (
                        <span className="text-white">{desdeAlvo ? new Date(desdeAlvo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[#16171B] px-3 py-2">
                      <span className="text-[#8B8F98]">Moedas</span>
                      <span className="flex items-center gap-1 font-bold text-[#5EEAD4]">
                        <EcoCoinIcon size={13} />
                        {moedasAlvo}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(podeDarMoedas || onPunir) && (
              <div className="flex flex-col gap-2 mt-auto">
                {podeDarMoedas && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMoedasAberto((v) => !v)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-[#5EEAD4]/15 text-[#5EEAD4] border border-[#5EEAD4]/30 hover:bg-[#5EEAD4]/25 cursor-pointer"
                    >
                      <Coins className="w-4 h-4" /> Dar moedas
                    </button>
                    {moedasAberto && (
                      <div className={`${cartao} !p-3`}>
                        <div className="flex gap-1.5 mb-2">
                          {[100, 500, 1000].map((v) => (
                            <button key={v} type="button" onClick={() => setMoedasQtd(String(v))} className="flex-1 px-2 py-1 rounded-full text-[11px] bg-[#23252B] text-[#B5B9C2] hover:text-white hover:bg-[#2C2F36] cursor-pointer">
                              +{v}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={1}
                            value={moedasQtd}
                            onChange={(e) => setMoedasQtd(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && enviarMoedas()}
                            placeholder="Quantidade"
                            className="flex-1 min-w-0 rounded-lg bg-[#16171B] border border-[#2A2D35] px-3 py-2 text-xs text-white placeholder-[#5C606A] outline-none focus:border-[#5EEAD4]/60"
                          />
                          <button
                            type="button"
                            onClick={enviarMoedas}
                            disabled={!(parseInt(moedasQtd, 10) > 0)}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-[#5EEAD4] text-[#16171B] hover:bg-[#7FF0DF] disabled:opacity-40 cursor-pointer disabled:cursor-default"
                          >
                            {moedasEnviadas ? "✓" : "Enviar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {onPunir && (
                  <button
                    type="button"
                    onClick={() => onPunir(targetParticipant)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-red-300 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 cursor-pointer"
                  >
                    <Gavel className="w-4 h-4" /> Punir/Banir
                  </button>
                )}
              </div>
            )}
          </div>

          {/* MEIO: cargo + aura */}
          <div className="md:min-h-0 md:overflow-y-auto flex flex-col gap-4">
            {podeRemover && onDefinirCargo && (
              <div className={cartao}>
                <p className={rotulo}>Cargo</p>
                <div className="flex items-center gap-2">
                  <input
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value.slice(0, 30))}
                    placeholder="Membro"
                    className="flex-1 rounded-lg bg-[#16171B] border border-[#2A2D35] px-3 py-2 text-xs text-white placeholder-[#5C606A] outline-none focus:border-[#5EEAD4]/60"
                  />
                  {cargo && (
                    <button type="button" onClick={() => { setCargo(""); setPoderes([]); }} className="px-2.5 py-2 rounded-lg text-[11px] font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 cursor-pointer">
                      Tirar
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["Moderador", "Admin", "Staff", "Parceiro"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setCargo(c); setPoderes(PRESETS[c] || []); }}
                      className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer ${cargo.trim() === c ? "bg-[#5EEAD4]/15 text-[#5EEAD4] border border-[#5EEAD4]/40" : "bg-[#23252B] text-[#B5B9C2] border border-transparent hover:text-white hover:bg-[#2C2F36]"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="text-[11px] text-[#8B8F98] mb-1.5">Poderes do cargo</p>
                  {!cargo.trim() && <p className="text-[10px] text-[#C4B5FD] mb-1.5">Escreva um cargo ou toque em Moderador/Admin pra liberar os poderes.</p>}
                  <div className="flex flex-col gap-1">
                    {[
                      { id: "mutar", nome: "Mutar pessoas", desc: "silencia o microfone de alguém" },
                      { id: "expulsar", nome: "Expulsar da sala", desc: "tira alguém da call" },
                      { id: "porta", nome: "Aprovar entrada", desc: "aceita ou recusa quem bate na porta" },
                    ].map((pd) => {
                      const ligado = poderes.includes(pd.id);
                      const livre = Boolean(cargo.trim());
                      return (
                        <button
                          key={pd.id}
                          type="button"
                          disabled={!livre}
                          onClick={() => alternarPoder(pd.id)}
                          className={`w-full flex items-center gap-3 rounded-lg bg-[#16171B] px-3 py-2 text-left ${livre ? "cursor-pointer hover:bg-[#1A1C21]" : "opacity-40 cursor-not-allowed"}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs text-white">{pd.nome}</span>
                            <span className="block text-[10px] text-[#5C606A]">{pd.desc}</span>
                          </span>
                          <span className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${ligado ? "bg-[#5EEAD4]" : "bg-[#2A2D35]"}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${ligado ? "left-[18px]" : "left-0.5"}`} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[#5C606A] mt-1.5">Ninguém com cargo consegue mutar ou expulsar você, o dono da sala ou outro cargo.</p>
                </div>
              </div>
            )}

            {onLiberarAura && !alvoAuraFixa && (
              <div className={cartao}>
                <p className={rotulo}>Aura do card</p>
                <button
                  type="button"
                  onClick={alternarAura}
                  disabled={auraEnviando}
                  className="w-full flex items-center justify-between rounded-lg bg-[#16171B] px-3 py-2.5 hover:bg-[#1A1C21] cursor-pointer disabled:opacity-60"
                >
                  <span className="text-left">
                    <span className="block text-xs text-white font-medium">Pode trocar a aura</span>
                    <span className={`block text-[10px] mt-0.5 ${auraLib ? "text-[#5EEAD4]" : "text-[#5C606A]"}`}>
                      {auraLib ? (auraPor === "cofundador" ? "Liberado por Co-fundador" : "Liberado por Dono Master") : "Bloqueado · só o Dono Master ou o Co-fundador liberam"}
                    </span>
                  </span>
                  <span className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${auraLib ? "bg-[#5EEAD4]" : "bg-[#2A2D35]"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${auraLib ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                </button>
                {auraErro && <p className="text-[10px] text-[#FB7185] mt-1.5">{auraErro}</p>}
                <p className="text-[10px] text-[#5C606A] mt-1.5">Desligar remove a aura personalizada. A aura comprada na loja continua enquanto o item valer.</p>
              </div>
            )}

            {!(podeRemover && onDefinirCargo) && !(onLiberarAura && !alvoAuraFixa) && (
              <div className={`${cartao} text-[11px] text-[#5C606A]`}>
                {alvoAuraFixa ? "A aura deste card é fixa. " : ""}Cargo e poderes: só o Dono Master muda.
              </div>
            )}
          </div>

          {/* DIREITA: insígnias + itens da loja */}
          <div className="md:min-h-0 md:overflow-y-auto flex flex-col gap-4">
            <div className={cartao}>
              <p className={rotulo}>Insígnias</p>
              <p className="text-[11px] text-[#8B8F98] mb-2">Dadas ({dadas.length})</p>
              <div className="flex flex-wrap gap-2 min-h-[34px]">
                {dadas.length === 0 ? (
                  <span className="text-xs text-[#5C606A]">Nenhuma ainda.</span>
                ) : (
                  dadas.map((b) => <React.Fragment key={b.id}>{Pilula({ id: b.id, nome: b.name, icone: b.icon, descricao: b.description, dada: true })}</React.Fragment>)
                )}
              </div>
              <div className="h-px bg-[#2A2D35] my-3" />
              <p className="text-[11px] text-[#8B8F98] mb-2">Disponíveis</p>
              <div className="flex flex-wrap gap-2">
                {disponiveis.map((b) => (
                  <React.Fragment key={b.id}>{Pilula({ id: b.id, nome: b.name, icone: b.icon, descricao: b.description, dada: false })}</React.Fragment>
                ))}
              </div>
            </div>

            {podeRemover && onRemoverItem && (
              <div className={cartao}>
                <p className={rotulo}>
                  Itens da loja <span className="font-normal text-[#8B8F98]">({todasCompras.length} comprados · {itensAtivos.length} ativos)</span>
                </p>
                {todasCompras.length === 0 ? (
                  <span className="text-xs text-[#5C606A]">Nunca comprou nada.</span>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {todasCompras.map((c) => (
                      <div key={c.id} className={`flex items-center justify-between gap-2 rounded-lg bg-[#16171B] px-3 py-2 ${c.ativo ? "" : "opacity-55"}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">
                            {nomeItem(c.id)}
                            {c.vezes > 1 && <span className="ml-1.5 text-[10px] text-[#8B8F98]">comprou {c.vezes}x</span>}
                          </p>
                          <p className="text-[10px] text-[#5C606A]">
                            {c.ativo ? `ativo até ${dataCurta(c.ate)}` : c.removido ? "removido pelo Dono" : c.ate ? `venceu em ${dataCurta(c.ate)}` : "vencido"}
                          </p>
                        </div>
                        {c.ativo ? (
                          <button
                            type="button"
                            onClick={() => removerItem(c.id)}
                            className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 cursor-pointer"
                          >
                            Remover
                          </button>
                        ) : (
                          <span className="shrink-0 text-[10px] text-[#5C606A]">{c.removido ? "removido" : "vencido"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-[#5C606A] px-1">💎 VIP Nitro libera foto, banner e título. ✨ VIP libera só a foto.</p>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#2A2D35] shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-[#B5B9C2] hover:text-white hover:bg-[#2A2D35] cursor-pointer">
            Cancelar
          </button>
          <button onClick={salvar} className="px-5 py-2 rounded-lg bg-[#5EEAD4] text-[#16171B] text-xs font-bold hover:bg-[#7FF0DF] cursor-pointer">
            {salvo ? "Salvo ✓" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
};
