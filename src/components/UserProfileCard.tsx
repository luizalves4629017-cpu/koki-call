import { BadgeIcon } from "./BadgeIcon";
import { tagVisivel } from "../utils/tagExibida";
import React, { useState, useEffect } from "react";
import {
  X,
  Volume2,
  VolumeX,
  MicOff,
  Gavel,
  Ghost,
  Clock,
  Sparkles,
  Shield,
  Edit3,
  MessageSquare,
  PhoneCall,
  Sliders,
  MoreHorizontal,
  Crown,
  UserPlus,
} from "lucide-react";
import { Participant } from "../types";
import { AnelBuracoNegro } from "./AnelBuracoNegro";
import { anelDoParticipante, perkAtivo, GRADIENTE_ANEL } from "../utils/perks";
import { isVideoMedia, isPerkActive, getPerkRemainingTime, getEcoCoins, isMasterIdentity, formatCoinDisplay, getMemberSince } from "../utils/storage";
import { EcoCoinIcon } from "./EcoCoinIcon";
import { BlackHoleBadge } from "./BlackHoleBadge";
import { ALL_BADGES } from "../data/badges";
import { AuraCard, AuraLojaBrilho, AuraEditor, AuraLojaEditor } from "./AuraCard";
import { AuraConfig, AURA_PADRAO, limparAura } from "../utils/auraCard";

interface UserProfileCardProps {
  participant: Participant;
  isSelf: boolean;
  isHostViewer: boolean;
  userVolume: number;
  onVolumeChange: (newVol: number) => void;
  onMuteParticipant?: (participantId: string) => void;
  onKickParticipant?: (participantId: string) => void;
  onOpenOwnerProfileEditor?: () => void;
  onOpenGrantVip?: (participant: Participant) => void;
  onOpenGrantBadges?: (participant: Participant) => void;
  onToggleCofundador?: (participant: Participant, ativo: boolean) => void;
  onGiveCoins?: (targetSocketId: string, amount: number) => void;
  onMoveToVoiceChannel?: (targetSocketId: string, targetChannelId: string) => void;
  /** Abre a janela de punição (expulsar da call / suspender / banir) */
  onPunirParticipant?: (participant: Participant) => void;
  /** Socket pra amizade (Adicionar amigo / Conversar) */
  socket?: any;
  /** Abre a conversa privada com esse amigo */
  onAbrirConversa?: (uid: string, nome: string) => void;
  /** Modo invisível: entrar na sala dessa pessoa sem aparecer (só Dono Master / Co-fundador) */
  onEntrarInvisivel?: () => void;
  onClose: () => void;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  participant,
  isSelf,
  isHostViewer,
  userVolume,
  onVolumeChange,
  onMuteParticipant,
  onKickParticipant,
  onOpenOwnerProfileEditor,
  onOpenGrantVip,
  onOpenGrantBadges,
  onToggleCofundador,
  onGiveCoins,
  onMoveToVoiceChannel,
  onPunirParticipant,
  socket,
  onAbrirConversa,
  onEntrarInvisivel,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"sobre" | "insignias" | "itens">("sobre");
  // Animação de saída: o card desliza pro lado e some numa névoa cinza/branca
  const [fechando, setFechando] = useState(false);
  const fecharComNevoa = () => {
    if (fechando) return;
    setFechando(true);
    window.setTimeout(() => onClose(), 520);
  };
  const [hoveredBadgeName, setHoveredBadgeName] = useState<string | null>(null);

  const isOwner = Boolean(
    participant.isMaster ||
    (isSelf && isMasterIdentity()) ||
    participant.tag === "0001"
  );

  const isCofundador = !isOwner && Boolean(participant.isCofundador || participant.badges?.includes("cofundador"));

  // ---------- Aura do card ----------
  // Dono Master (branca/prata) e Co-fundador ("Horizonte", aço/prata com anel duplo) têm aura fixa e exclusiva: ninguém troca.
  const auraFixa = isOwner || Boolean((participant as any).ehDono) || isCofundador;
  // Aura completa: só quem o Dono Master/Co-fundador liberou (o servidor manda auraLiberada)
  const auraLiberada = !auraFixa && Boolean(participant.auraLiberada);
  // Aura da loja: o servidor só manda a cor se o item estiver ativo; aqui confere de novo a validade quando dá
  const temItemAura = !auraFixa && perkAtivo(participant, "aura_card");
  const lojaConfiavel = temItemAura || String(participant.id).startsWith("membro:") || !participant.purchasedPerks;
  const [editorAura, setEditorAura] = useState<null | "completa" | "loja">(null);
  const [rascunhoAura, setRascunhoAura] = useState<AuraConfig>(AURA_PADRAO);
  const [rascunhoLoja, setRascunhoLoja] = useState<string | null>(null);
  const [auraSalvando, setAuraSalvando] = useState(false);
  const [auraMsg, setAuraMsg] = useState("");
  // Perdeu a permissão/o item enquanto editava: fecha o editor
  useEffect(() => {
    if (editorAura === "completa" && !auraLiberada) setEditorAura(null);
    if (editorAura === "loja" && !temItemAura) setEditorAura(null);
  }, [auraLiberada, temItemAura, editorAura]);
  const abrirEditorAura = () => {
    setAuraMsg("");
    if (auraLiberada) {
      setRascunhoAura(participant.auraCard ? limparAura(participant.auraCard) : { ...AURA_PADRAO });
      setEditorAura("completa");
    } else if (temItemAura) {
      setRascunhoLoja(participant.auraLoja || "azul");
      setEditorAura("loja");
    }
  };
  const emitirAura = (evento: string, dados: any) => {
    if (!socket) return setAuraMsg("Sem conexão com o servidor agora.");
    setAuraSalvando(true);
    setAuraMsg("");
    let respondeu = false;
    const t = window.setTimeout(() => {
      if (respondeu) return;
      setAuraSalvando(false);
      setAuraMsg("O servidor não respondeu. Tente de novo.");
    }, 8000);
    socket.emit(evento, dados, (r: any) => {
      respondeu = true;
      window.clearTimeout(t);
      setAuraSalvando(false);
      if (r?.success) setEditorAura(null);
      else setAuraMsg(r?.message || "Não deu pra salvar a aura.");
    });
  };
  // O que aparece agora (durante a edição o card mostra a prévia)
  const auraCompletaAtual: AuraConfig | null =
    editorAura === "completa" ? rascunhoAura : auraLiberada && participant.auraCard ? limparAura(participant.auraCard) : null;
  const auraLojaAtual: string | null =
    editorAura === "loja" ? rascunhoLoja : !auraCompletaAtual && lojaConfiavel && participant.auraLoja ? participant.auraLoja : null;

  // Amizade: status da relação com essa pessoa (online ou offline — "membro:<chave>" o servidor resolve pela conta salva)
  // status: "nenhum" | "enviado" | "recebido" | "amigos" | "sem-conta" (alvo convidado) | "sem-login" (eu sem conta) | "voce"
  const [relacao, setRelacao] = useState<{ status: string; uid?: string } | null>(null);
  const [amizadeMsg, setAmizadeMsg] = useState("");
  const [amizadeEnviando, setAmizadeEnviando] = useState(false);
  const mostrarAmizade = !isSelf;
  useEffect(() => {
    setRelacao(null);
    setAmizadeMsg("");
    if (!socket || isSelf) return;
    let vivo = true;
    const buscar = () =>
      socket.emit("amigos:relacao", { alvo: participant.id, socketId: participant.id }, (r: any) => {
        if (!vivo) return;
        // Servidor com erro: fica no padrão ("Adicionar amigo") e o erro aparece no clique
        if (r?.ok && r.status) setRelacao({ status: r.status, uid: r.uid });
      });
    buscar();
    socket.on("amigos:mudou", buscar);
    return () => {
      vivo = false;
      socket.off("amigos:mudou", buscar);
    };
  }, [socket, isSelf, participant.id, participant.temConta]); // eslint-disable-line react-hooks/exhaustive-deps
  const pedirAmizade = () => {
    setAmizadeMsg("");
    if (relacao?.status === "sem-login") {
      setAmizadeMsg("Entre com sua conta para adicionar amigos");
      return;
    }
    if (!socket) {
      setAmizadeMsg("Sem conexão com o servidor agora. Tente de novo em instantes.");
      return;
    }
    setAmizadeEnviando(true);
    let respondeu = false;
    const timer = window.setTimeout(() => {
      if (respondeu) return;
      setAmizadeEnviando(false);
      setAmizadeMsg("O servidor não respondeu. Tente de novo.");
    }, 8000);
    socket.emit("amigos:pedir", { alvo: participant.id, socketId: participant.id }, (r: any) => {
      respondeu = true;
      window.clearTimeout(timer);
      setAmizadeEnviando(false);
      if (r?.ok) setRelacao((x) => ({ ...(x || {}), status: r.status || "enviado" }));
      else {
        if (r?.semConta) setRelacao((x) => ({ ...(x || {}), status: "sem-login" }));
        setAmizadeMsg(r?.mensagem || "Não deu pra enviar o pedido.");
      }
    });
  };
  const aceitarAmizade = () => {
    if (!socket || !relacao?.uid) return;
    setAmizadeMsg("");
    socket.emit("amigos:responder", { uid: relacao.uid, aceitar: true }, (r: any) => {
      if (r?.ok) setRelacao((x) => ({ ...(x || {}), status: "amigos" }));
      else setAmizadeMsg(r?.mensagem || "Não deu pra aceitar agora.");
    });
  };

  const isVip = Boolean(
    participant.isVip ||
    participant.vipPermissions?.hasVipBadge ||
    participant.badges?.includes("vip_role")
  );

  const coins = isOwner || isCofundador
    ? "∞"
    : formatCoinDisplay(
        isSelf ? (typeof participant.kokiCoins === "number" ? participant.kokiCoins : getEcoCoins()) : participant.kokiCoins,
        false
      );

  const badgeCount = (participant.badges?.length || 0) + (isOwner ? 1 : 0);
  const minutesInCall = Math.max(1, Math.floor((Date.now() - participant.joinedAt) / 60000));
  const hoursInCall = Math.max(1, Math.floor(minutesInCall / 60));

  // Audio level speaking wave animation
  const isSpeaking = participant.hasAudio && (participant.audioLevel || 0) > 15;

  // Orbit badge planets (up to 5)
  const orbitBadges = (participant.badges || []).slice(0, 4);

  // Status dot color
  const statusColor = participant.isDeafened
    ? "#F43F5E"
    : !participant.hasAudio
    ? "#8B8F98"
    : "#10B981"; // green online

  // Ring styling
  const anelComprado = anelDoParticipante(participant);
  const bannerNebulosa = !participant.bannerUrl && perkAtivo(participant, "banner_nebulosa");
  const ringGradient = anelComprado
    ? GRADIENTE_ANEL[anelComprado]
    : isOwner
    ? "linear-gradient(135deg, #5EEAD4 0%, #C4B5FD 100%)"
    : isVip
    ? "linear-gradient(135deg, #C4B5FD 0%, #A78BFA 100%)"
    : "#2A2D35";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center lg:gap-8 p-4 bg-[#16171B]/80 backdrop-blur-md animate-in fade-in select-none ${editorAura ? "max-lg:items-start max-lg:pt-6" : ""} ${fechando ? "eco-fundo-sumir" : ""}`}>
      <div className={`relative w-full max-w-sm sm:max-w-md ${fechando ? "eco-card-sair" : ""}`}>
      {/* névoa cinza/branca que fica pra trás quando o card sai */}
      {fechando && (
        <div className="pointer-events-none absolute inset-0 z-40" aria-hidden>
          <span className="eco-nevoa-puff" style={{ left: "-10%", top: "10%", animationDelay: "0ms" }} />
          <span className="eco-nevoa-puff" style={{ left: "20%", top: "45%", animationDelay: "60ms" }} />
          <span className="eco-nevoa-puff" style={{ left: "-5%", top: "70%", animationDelay: "120ms" }} />
          <span className="eco-nevoa-puff eco-nevoa-clara" style={{ left: "35%", top: "20%", animationDelay: "40ms" }} />
          <span className="eco-nevoa-puff eco-nevoa-clara" style={{ left: "10%", top: "55%", animationDelay: "100ms" }} />
        </div>
      )}
      {/* AURA DO CRIADOR: luz branca/prata girando em volta do card (só Dono Master) */}
      {(isOwner || (!isCofundador && Boolean((participant as any).ehDono))) && <AuraCriador />}
      {isCofundador && <AuraCriador cofundador />}
      {/* Aura personalizada (liberada pelo Dono/Co-fundador) ou a simples da loja */}
      {!auraFixa && auraCompletaAtual && <AuraCard config={auraCompletaAtual} />}
      {!auraFixa && !auraCompletaAtual && auraLojaAtual && <AuraLojaBrilho cor={auraLojaAtual} />}
      <div className={`relative w-full bg-[#1E2026] border ${isOwner ? "border-white/20" : isCofundador ? "border-slate-300/25" : "border-[#2A2D35]"} rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] max-h-[92dvh] ${editorAura ? "max-lg:max-h-[42vh]" : ""}`}>
        
        {/* BOTÃO FECHAR */}
        <button
          onClick={fecharComNevoa}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-[#16171B]/70 hover:bg-[#16171B] text-[#8B8F98] hover:text-[#ECECEC] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Corpo do card: tudo em altura natural. Só rola (o card inteiro, não uma caixinha) se passar de ~92% da tela. */}
        <div className="eco-perfil-corpo min-h-0 shrink overflow-y-auto overscroll-contain">
        {/* 1. TOPO: BANNER QUE SE DISSOLVE COM DEGRADÊ SUAVE (Sem corte reto) */}
        <div className="relative w-full h-40 sm:h-48 [@media(max-height:800px)]:h-32 overflow-hidden shrink-0">
          {participant.bannerUrl ? (
            isVideoMedia(participant.bannerUrl) ? (
              <video
                src={participant.bannerUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={participant.bannerUrl}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            )
          ) : (
            bannerNebulosa ? (
              /* Banner Nebulosa comprado na loja: nebulosa animada com estrelas */
              <div className="w-full h-full relative overflow-hidden bg-[#0b0c10]">
                <div
                  className="absolute -inset-1/2 opacity-90"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 40%, #5EEAD455 0, transparent 35%), radial-gradient(circle at 70% 60%, #C4B5FD66 0, transparent 40%), radial-gradient(circle at 50% 20%, #8B5CF633 0, transparent 30%)",
                    animation: "spin 40s linear infinite",
                  }}
                />
                <div
                  className="absolute inset-0 animate-pulse"
                  style={{
                    backgroundImage:
                      "radial-gradient(1px 1px at 10% 20%, #fff, transparent), radial-gradient(1px 1px at 80% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 70%, #fff, transparent), radial-gradient(1px 1px at 65% 85%, #fff, transparent), radial-gradient(1px 1px at 25% 55%, #fff, transparent), radial-gradient(1.5px 1.5px at 90% 65%, #fff, transparent)",
                  }}
                />
              </div>
            ) : (
              /* Nebulosa escura verde-água e lilás sem banner */
              <div className="w-full h-full bg-gradient-to-br from-[#16171B] via-[#0d2825] to-[#201736]" />
            )
          )}

          {/* Dissolvência suave no fundo do cartão com degradê */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1E2026]/40 to-[#1E2026]" />
        </div>

        {/* 2. A ÓRBITA: AVATAR CENTRALIZADO COM ANEL ORBITAL FINO E PLANETAS GIRATÓRIOS */}
        <div className="relative -mt-20 flex flex-col items-center justify-center shrink-0 z-20">
          <div className="relative w-36 h-36 flex items-center justify-center">
            
            {/* Dono Master e Co-fundador: anel exclusivo de buraco negro */}
            {(isOwner || isCofundador) && <AnelBuracoNegro variante={isOwner ? "dono" : "cofundador"} />}

            {/* ANEL ORBITAL INCLINADO COM DEGRADÊ (demais pessoas) */}
            {!(isOwner || isCofundador) && <div
              className={`absolute inset-0 rounded-full border-[2.2px] pointer-events-none transition-transform ${
                isOwner || anelComprado ? "animate-[spin_20s_linear_infinite]" : ""
              }`}
              style={{
                borderColor: typeof ringGradient === "string" && !ringGradient.includes("gradient") ? ringGradient : "transparent",
                backgroundImage: ringGradient.includes("gradient") ? ringGradient : undefined,
                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                padding: "2px",
                transform: "rotate(-20deg) scale(1.15, 0.45)",
              }}
            />}

            {/* PLANETAS / INSÍGNIAS PRINCIPAIS SOBRE O ANEL */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {isOwner ? (
                /* Planeta Principal: Singularidade maior no anel */
                <div
                  className="absolute pointer-events-auto transition-transform hover:scale-125 cursor-pointer -top-1 right-2"
                  title="Singularidade · Criador do eco"
                >
                  <BlackHoleBadge type="singularidade" size={24} />
                </div>
              ) : null}

              {orbitBadges.map((badgeId, idx) => {
                const badge = ALL_BADGES.find((b) => b.id === badgeId);
                if (!badge) return null;
                // Distribute around ring
                const positions = [
                  "-bottom-1 left-2",
                  "top-6 -left-2",
                  "bottom-6 -right-2",
                  "-top-2 left-8",
                ];
                const pos = positions[idx % positions.length];
                return (
                  <div
                    key={badgeId}
                    className={`absolute pointer-events-auto transition-transform hover:scale-125 cursor-pointer ${pos}`}
                    title={badge.name}
                    onMouseEnter={() => setHoveredBadgeName(badge.name)}
                    onMouseLeave={() => setHoveredBadgeName(null)}
                  >
                    {badge.id === "horizonte" ? (
                      <BlackHoleBadge type="horizonte" size={18} />
                    ) : (
                      <span className="text-base select-none"><BadgeIcon icon={badge.icon} alt={badge.name} /></span>
                    )}
                  </div>
                );
              })}

              {/* Bolinha de Status presa no anel */}
              <div
                className="absolute bottom-2 right-4 w-3.5 h-3.5 rounded-full border-2 border-[#1E2026] shadow-md z-30"
                style={{ backgroundColor: statusColor }}
                title={participant.hasAudio ? "Disponível na chamada" : "Mutado"}
              />
            </div>

            {/* AVATAR GRANDE CENTRALIZADO */}
            <div
              className="w-24 h-24 rounded-full overflow-hidden shadow-2xl border border-[#2A2D35] flex items-center justify-center text-3xl font-extrabold text-white z-10"
              style={{ backgroundColor: participant.avatarColor || "#2DD4BF" }}
            >
              {participant.avatarUrl ? (
                <img
                  src={participant.avatarUrl}
                  alt={participant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{participant.name ? participant.name.slice(0, 1).toUpperCase() : "E"}</span>
              )}
            </div>
          </div>

          {/* 3. IDENTIDADE: NOME EM NEGRITO, @USUÁRIO E ETIQUETA DONO/VIP */}
          <div className="text-center mt-2 space-y-0.5 px-4">
            <div className="flex items-center justify-center gap-1.5">
              <h3 className="font-extrabold text-lg sm:text-xl text-[#ECECEC] tracking-tight">
                {participant.name}
              </h3>
              {isOwner && <BlackHoleBadge type="singularidade" size={20} />}
            </div>

            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="text-[#8B8F98]">
                @{participant.name.toLowerCase().replace(/\s+/g, "")}#{tagVisivel(participant)}
              </span>
              {isOwner ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded-full bg-[#C4B5FD]/20 text-[#C4B5FD] border border-[#C4B5FD]/40">
                  DONO
                </span>
              ) : isVip ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded-full bg-[#C4B5FD]/15 text-[#C4B5FD] border border-[#C4B5FD]/30">
                  VIP
                </span>
              ) : null}
            </div>

            {hoveredBadgeName && (
              <div className="text-[11px] font-bold text-[#5EEAD4] animate-in fade-in">
                {hoveredBadgeName}
              </div>
            )}
          </div>

          {/* 4. ONDA DE ECO (pulsa com volume real) */}
          <div className="mt-3 flex flex-col items-center gap-1">
            <div className="flex items-center gap-0.5 h-4 px-4">
              {[8, 14, 22, 10, 18, 26, 12, 16, 28, 20, 10, 24, 16, 12, 6].map((baseH, idx) => {
                const height = isSpeaking ? Math.min(26, baseH * 1.3) : Math.max(3, baseH * 0.25);
                return (
                  <span
                    key={idx}
                    className="w-[2px] rounded-full bg-[#5EEAD4] transition-all duration-100"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-[#8B8F98] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5EEAD4] inline-block animate-pulse" />
              <span>Em call · Geral · {minutesInCall} min</span>
            </span>
          </div>

          {/* 5. BIO: centralizada, itálico, como citação */}
          {participant.bio && (
            <p className="mt-2 text-xs text-[#8B8F98] italic text-center px-6 line-clamp-3">
              “{participant.bio}”
            </p>
          )}

          {/* 6. NÚMEROS: Eco Coins, Insígnias e Horas em call */}
          <div className="w-full px-6 mt-4">
            <div className="grid grid-cols-3 divide-x divide-[#2A2D35] py-2 border-y border-[#2A2D35] text-center">
              <div>
                <div className="text-base sm:text-lg font-extrabold text-[#ECECEC] flex items-center justify-center gap-1">
                  <span>{coins}</span>
                </div>
                <div className="text-[10px] text-[#8B8F98] uppercase tracking-wider font-semibold">
                  Eco Coins
                </div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-extrabold text-[#ECECEC]">
                  {badgeCount}
                </div>
                <div className="text-[10px] text-[#8B8F98] uppercase tracking-wider font-semibold">
                  Insígnias
                </div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-extrabold text-[#ECECEC]">
                  {hoursInCall}h
                </div>
                <div className="text-[10px] text-[#8B8F98] uppercase tracking-wider font-semibold">
                  Em call
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7. ABAS: Sobre, Insígnias, Itens */}
        <div className="px-6 py-3 space-y-3">
          <div className="flex items-center gap-4 border-b border-[#2A2D35] text-xs font-bold text-[#8B8F98]">
            <button
              onClick={() => setActiveTab("sobre")}
              className={`pb-2 transition-colors cursor-pointer ${
                activeTab === "sobre"
                  ? "text-[#5EEAD4] border-b-2 border-[#5EEAD4]"
                  : "hover:text-[#ECECEC]"
              }`}
            >
              Sobre
            </button>
            <button
              onClick={() => setActiveTab("insignias")}
              className={`pb-2 transition-colors cursor-pointer ${
                activeTab === "insignias"
                  ? "text-[#5EEAD4] border-b-2 border-[#5EEAD4]"
                  : "hover:text-[#ECECEC]"
              }`}
            >
              Insígnias
            </button>
            <button
              onClick={() => setActiveTab("itens")}
              className={`pb-2 transition-colors cursor-pointer ${
                activeTab === "itens"
                  ? "text-[#5EEAD4] border-b-2 border-[#5EEAD4]"
                  : "hover:text-[#ECECEC]"
              }`}
            >
              Itens
            </button>
          </div>

          {/* CONTEÚDO DAS ABAS */}
          {activeTab === "sobre" && (
            <div className="text-xs text-[#8B8F98] space-y-2 py-1">
              {participant.customTitle && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#ECECEC]">Título:</span>
                  <span className="text-[#5EEAD4] font-bold">{participant.customTitle}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#ECECEC]">Membro desde:</span>
                {isOwner || isCofundador ? (
                  <span
                    title="Desde sempre"
                    className="text-lg leading-none font-black bg-gradient-to-r from-[#C4B5FD] via-[#A78BFA] to-[#5EEAD4] bg-clip-text text-transparent"
                  >
                    ∞
                  </span>
                ) : (
                  <span>{new Date(participant.memberSince || (isSelf ? getMemberSince() : participant.joinedAt)).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#ECECEC]">Cargo:</span>
                <span className={isOwner ? "text-[#C4B5FD] font-bold" : isCofundador ? "text-[#CBD5E1] font-bold" : participant.cargo ? "text-[#C4B5FD]" : "text-[#ECECEC]"}>
                  {isOwner ? "Dono Master & Criador" : isCofundador ? "Co-fundador" : participant.cargo || "Membro"}
                </span>
              </div>
            </div>
          )}

          {activeTab === "insignias" && (
            <div className="grid grid-cols-2 gap-2 py-1">
              {isOwner && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#16171B] border border-[#C4B5FD]/30">
                  <BlackHoleBadge type="singularidade" size={20} />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#C4B5FD] block truncate">
                      Singularidade
                    </span>
                    <span className="text-[10px] text-[#8B8F98] block">Criador do eco</span>
                  </div>
                </div>
              )}
              {participant.badges?.map((bid) => {
                const b = ALL_BADGES.find((x) => x.id === bid);
                if (!b) return null;
                return (
                  <div
                    key={bid}
                    className="flex items-center gap-2 p-2 rounded-xl bg-[#16171B] border border-[#2A2D35]"
                  >
                    {b.id === "horizonte" ? (
                      <BlackHoleBadge type="horizonte" size={18} />
                    ) : (
                      <span className="text-base select-none"><BadgeIcon icon={b.icon} alt={b.name} /></span>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[#ECECEC] block truncate">
                        {b.name}
                      </span>
                      <span className="text-[10px] text-[#8B8F98] block truncate">
                        {b.id === "horizonte" ? "Concedida pelo criador" : b.rarity}
                      </span>
                    </div>
                  </div>
                );
              })}
              {badgeCount === 0 && (
                <div className="col-span-2 text-center text-xs text-[#8B8F98] py-4">
                  Nenhuma insígnia ainda.
                </div>
              )}
            </div>
          )}

          {activeTab === "itens" && (
            <div className="space-y-2 py-1">
              {isOwner ? (
                <div className="p-3 rounded-xl bg-[#C4B5FD]/10 border border-[#C4B5FD]/30 text-xs text-[#C4B5FD]">
                  ✨ Acesso total: todos os itens ativos e moedas ilimitadas.
                </div>
              ) : participant.purchasedPerks && Object.keys(participant.purchasedPerks).length > 0 ? (
                Object.entries(participant.purchasedPerks).map(([perkId, activeUntil]) => {
                  const rem = getPerkRemainingTime(typeof activeUntil === "number" ? activeUntil : 0);
                  if (rem.expired) return null;
                  return (
                    <div
                      key={perkId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#16171B] border border-[#2A2D35] text-xs"
                    >
                      <span className="font-semibold text-[#ECECEC]">{perkId}</span>
                      <span className="text-[#5EEAD4] font-mono">{rem.formatted} restantes</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-xs text-[#8B8F98] py-4">
                  Nenhum item da Loja ativo no momento.
                </div>
              )}
            </div>
          )}
        </div>

        {/* AMIZADE + MODERAÇÃO (perfil de outra pessoa) */}
        {!isSelf && (mostrarAmizade || onMuteParticipant || onPunirParticipant || onEntrarInvisivel) && (
          <div className="px-4 pt-2 flex flex-col gap-2 shrink-0">
            {(participant as any).invisivel && (
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#C4B5FD] py-1.5 rounded-xl bg-[#C4B5FD]/10 border border-[#C4B5FD]/30">
                <Ghost className="w-3.5 h-3.5" />
                <span>Está invisível (só Dono Master e Co-fundador veem)</span>
              </div>
            )}
            {onEntrarInvisivel && (
              <button
                onClick={onEntrarInvisivel}
                className="w-full py-2 rounded-xl border border-[#C4B5FD]/50 text-[#C4B5FD] hover:bg-[#C4B5FD]/10 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                title="Entrar na sala dessa pessoa sem aparecer: você vê e ouve tudo, ninguém sabe que você está lá"
              >
                <Ghost className="w-3.5 h-3.5" />
                <span>Entrar invisível</span>
              </button>
            )}
            {mostrarAmizade && relacao?.status !== "voce" && (
              <div className="flex items-center gap-2">
                {relacao?.status === "sem-conta" ? (
                  <span
                    className="flex-1 text-center text-[11px] font-semibold text-[#8B8F98] py-2 rounded-xl bg-[#16171B] border border-[#2A2D35] opacity-70 cursor-not-allowed"
                    title="Essa pessoa entrou como convidada"
                  >
                    Convidado(a) — sem conta para amizade
                  </span>
                ) : relacao?.status === "amigos" ? (
                  <>
                    <span className="flex-1 text-center text-[11px] font-bold text-[#5EEAD4] py-2 rounded-xl bg-[#5EEAD4]/10 border border-[#5EEAD4]/30">
                      Amigos ✓
                    </span>
                    {onAbrirConversa && relacao.uid && (
                      <button
                        onClick={() => onAbrirConversa(relacao.uid!, participant.name)}
                        className="flex-1 py-2 rounded-xl bg-[#C4B5FD]/15 hover:bg-[#C4B5FD]/25 text-[#C4B5FD] border border-[#C4B5FD]/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Conversar</span>
                      </button>
                    )}
                  </>
                ) : relacao?.status === "enviado" ? (
                  <span className="flex-1 text-center text-[11px] font-semibold text-[#8B8F98] py-2 rounded-xl bg-[#16171B] border border-[#2A2D35]">
                    Pedido enviado
                  </span>
                ) : relacao?.status === "recebido" ? (
                  <button
                    onClick={aceitarAmizade}
                    className="flex-1 py-2 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-xs font-black cursor-pointer"
                  >
                    Aceitar
                  </button>
                ) : (
                  <button
                    onClick={pedirAmizade}
                    disabled={amizadeEnviando}
                    className="flex-1 py-2 rounded-xl bg-[#5EEAD4]/15 hover:bg-[#5EEAD4]/25 text-[#5EEAD4] border border-[#5EEAD4]/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{amizadeEnviando ? "Enviando..." : "Adicionar amigo"}</span>
                  </button>
                )}
              </div>
            )}
            {amizadeMsg && <div className="text-[11px] text-[#FB7185] text-center">{amizadeMsg}</div>}
            {(onMuteParticipant || onPunirParticipant) && (
              <div className="flex items-center gap-2">
                {onMuteParticipant && (
                  <button
                    onClick={() => onMuteParticipant(participant.id)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      participant.isMutedByHost
                        ? "border-[#5EEAD4]/40 text-[#5EEAD4] hover:bg-[#5EEAD4]/10"
                        : "border-[#2A2D35] text-[#ECECEC] hover:bg-[#252830]"
                    }`}
                    title={participant.isMutedByHost ? "Liberar o microfone dessa pessoa" : "Silenciar o microfone dessa pessoa"}
                  >
                    {participant.isMutedByHost ? <Volume2 className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    <span>{participant.isMutedByHost ? "Desmutar" : "Mutar"}</span>
                  </button>
                )}
                {onPunirParticipant && (
                  <button
                    onClick={() => onPunirParticipant(participant)}
                    className="flex-1 py-2 rounded-xl border border-[#F43F5E]/50 text-[#FB7185] hover:bg-[#F43F5E]/10 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Expulsar da call, banir da sala ou do app"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>Punir/Banir</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        </div>
        {/* fim do corpo */}

        {/* 8. DOCK DE AÇÕES (Pílula flutuante embaixo) — some quando não há nenhum botão */}
        {(isSelf || isHostViewer || onToggleCofundador) && (
        <div className="p-4 pt-2 border-t border-[#2A2D35] bg-[#1E2026] shrink-0">
          <div className="flex items-center justify-center gap-2">
            {/* Se for o PRÓPRIO PERFIL: Editar, Status, Itens e Painel (se for Dono) */}
            {isSelf ? (
              <>
                <button
                  onClick={onOpenOwnerProfileEditor}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#2A2D35] hover:bg-[#383C47] text-[#ECECEC] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Editar meu perfil"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#5EEAD4]" />
                  <span>Editar</span>
                </button>

                {!auraFixa && (auraLiberada || temItemAura) && (
                  <button
                    onClick={abrirEditorAura}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border ${
                      editorAura ? "bg-[#C4B5FD]/25 text-[#C4B5FD] border-[#C4B5FD]/50" : "bg-[#2A2D35] hover:bg-[#383C47] text-[#ECECEC] border-transparent"
                    }`}
                    title="Mudar a aura do seu card"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#C4B5FD]" />
                    <span>Mudar aura</span>
                  </button>
                )}

                {isOwner && (
                  <button
                    onClick={onOpenOwnerProfileEditor}
                    className="py-2 px-4 rounded-xl bg-[#C4B5FD]/20 hover:bg-[#C4B5FD]/30 text-[#C4B5FD] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#C4B5FD]/40"
                    title="Painel Master do Dono"
                  >
                    <BlackHoleBadge type="singularidade" size={15} />
                    <span>Painel</span>
                  </button>
                )}
              </>
            ) : (
              /* Se for perfil de OUTRA PESSOA */
              <>
                {/* Se o viewer for o Dono Master, ele vê também o botão "Gerenciar" */}
                {isHostViewer && (
                  <button
                    onClick={() => {
                      // Gerenciar OUTRA pessoa: abre as insígnias dela (antes abria o seu próprio perfil)
                      if (onOpenGrantBadges) onOpenGrantBadges(participant);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#C4B5FD]/20 hover:bg-[#C4B5FD]/30 text-[#C4B5FD] border border-[#C4B5FD]/40 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Gerenciar insígnias, VIP e perfil do membro"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Gerenciar</span>
                  </button>
                )}

                {onOpenGrantBadges && isHostViewer && (
                  <button
                    onClick={() => onOpenGrantBadges(participant)}
                    className="py-2 px-3 rounded-xl bg-[#2A2D35] hover:bg-[#383C47] text-[#ECECEC] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Dar ou tirar insígnias deste membro"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#5EEAD4]" />
                    <span>Insígnias</span>
                  </button>
                )}

                {onToggleCofundador && (
                  <button
                    onClick={() => onToggleCofundador(participant, !isCofundador)}
                    className="py-2 px-3 rounded-xl bg-[#2A2D35] hover:bg-[#383C47] text-[#ECECEC] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title={isCofundador ? "Tirar o cargo de Co-fundador" : "Dar o cargo de Co-fundador"}
                  >
                    <span>{isCofundador ? "Tirar Co-fundador" : "Tornar Co-fundador"}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        )}
        {!(isSelf || isHostViewer || onToggleCofundador) && <div className="h-3 shrink-0" />}
      </div>
    </div>
      {/* Painel de edição da aura (só no próprio card) */}
      {isSelf && editorAura === "completa" && (
        <AuraEditor
          config={rascunhoAura}
          onChange={setRascunhoAura}
          liberadoPor={participant.auraLiberadaPor}
          salvando={auraSalvando}
          mensagem={auraMsg}
          onFechar={() => setEditorAura(null)}
          onSalvar={() => emitirAura("user:aura-salvar", { config: rascunhoAura })}
          onRemover={() => emitirAura("user:aura-salvar", { remover: true })}
        />
      )}
      {isSelf && editorAura === "loja" && (
        <AuraLojaEditor
          cor={rascunhoLoja}
          onChange={setRascunhoLoja}
          salvando={auraSalvando}
          mensagem={auraMsg}
          onFechar={() => setEditorAura(null)}
          onSalvar={() => emitirAura("user:aura-loja", { cor: rascunhoLoja })}
        />
      )}
    </div>
  );
};

/** Aura de buraco negro em volta do card do criador: anel de luz branca/prata girando + névoa + partículas. */
export const AuraCriador: React.FC<{ cofundador?: boolean }> = ({ cofundador = false }) => {
  // Co-fundador tem a aura própria "Horizonte" (aço/prata, anel duplo com faixa escura), exclusiva do cargo
  if (cofundador) return <AuraHorizonte />;
  // Criador: prata. Co-fundador: verde-água e lilás, mais suave (abaixo do Dono)
  const luz = cofundador
    ? "conic-gradient(from 0deg, transparent 0deg, rgba(94,234,212,0.85) 40deg, rgba(196,181,253,0.45) 90deg, transparent 140deg, transparent 180deg, rgba(196,181,253,0.75) 220deg, rgba(94,234,212,0.35) 270deg, transparent 320deg)"
    : "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.95) 40deg, rgba(160,160,170,0.5) 90deg, transparent 140deg, transparent 180deg, rgba(255,255,255,0.85) 220deg, rgba(120,120,130,0.4) 270deg, transparent 320deg)";
  const particulas = [
    { l: "4%", t: "12%", d: "0s" },
    { l: "96%", t: "22%", d: "1.2s" },
    { l: "-2%", t: "58%", d: "2.1s" },
    { l: "101%", t: "70%", d: "0.6s" },
    { l: "30%", t: "-1.5%", d: "1.7s" },
    { l: "72%", t: "101%", d: "2.6s" },
    { l: "12%", t: "99%", d: "3.1s" },
    { l: "88%", t: "-1%", d: "0.9s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {/* névoa larga, gira ao contrário */}
      <div className="absolute -inset-5 rounded-[40px] overflow-hidden opacity-40" style={{ filter: "blur(22px)" }}>
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar-rev" style={{ background: luz }} />
      </div>
      {/* brilho colado na borda */}
      <div className="absolute -inset-2 rounded-[32px] overflow-hidden opacity-80" style={{ filter: "blur(9px)" }}>
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar" style={{ background: luz }} />
      </div>
      {/* fio de luz nítido contornando o card */}
      <div className="absolute -inset-[1.5px] rounded-[25.5px] overflow-hidden">
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar" style={{ background: luz }} />
      </div>
      {/* partículas sendo puxadas */}
      {particulas.map((p, i) => (
        <span
          key={i}
          className={`absolute w-1 h-1 rounded-full eco-aura-particula ${cofundador ? "bg-[#5EEAD4]" : "bg-white"}`}
          style={{ left: p.l, top: p.t, animationDelay: p.d, boxShadow: cofundador ? "0 0 6px 1px rgba(94,234,212,0.7)" : "0 0 6px 1px rgba(255,255,255,0.8)" }}
        />
      ))}
    </div>
  );
};

/**
 * Aura "Horizonte" — exclusiva do Co-fundador (combina com a insígnia Horizonte).
 * Buraco negro em tons de aço/prata com um toque gelo: dois fios de luz girando em sentidos
 * opostos com uma faixa escura entre eles (o "horizonte de eventos"), só em volta da borda do card.
 * Diferente da aura do Dono (branca/prata, fio único) e de qualquer aura de membro
 * (membros só conseguem auras coloridas: o servidor limita o tom, sem branco/prata/cinza).
 */
export const AuraHorizonte: React.FC = () => {
  // Base de aço sempre visível (anel contínuo) + brilhos prata/gelo que giram por cima
  const aco =
    "conic-gradient(from 0deg, rgba(148,163,184,0.85) 0deg, rgba(248,250,252,1) 30deg, rgba(186,230,253,0.95) 60deg, rgba(148,163,184,0.85) 110deg, rgba(100,116,139,0.8) 160deg, rgba(226,232,240,1) 210deg, rgba(186,230,253,0.85) 250deg, rgba(100,116,139,0.8) 300deg, rgba(148,163,184,0.85) 360deg)";
  const acoInv =
    "conic-gradient(from 90deg, rgba(100,116,139,0.85) 0deg, rgba(186,230,253,1) 40deg, rgba(248,250,252,1) 70deg, rgba(148,163,184,0.85) 130deg, rgba(100,116,139,0.8) 190deg, rgba(226,232,240,1) 240deg, rgba(100,116,139,0.85) 320deg, rgba(100,116,139,0.85) 360deg)";
  const particulas = [
    { l: "6%", t: "-1.2%", d: "0.3s" },
    { l: "94%", t: "16%", d: "1.5s" },
    { l: "-1.6%", t: "40%", d: "2.4s" },
    { l: "101.2%", t: "62%", d: "0.9s" },
    { l: "48%", t: "-1.4%", d: "2.0s" },
    { l: "60%", t: "101%", d: "2.9s" },
    { l: "-1%", t: "86%", d: "1.1s" },
    { l: "100.8%", t: "92%", d: "3.3s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {/* névoa de aço, larga e lenta, ao contrário */}
      <div className="absolute -inset-5 rounded-[40px] overflow-hidden opacity-35" style={{ filter: "blur(22px)" }}>
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar-rev" style={{ background: aco, animationDuration: "20s" }} />
      </div>
      {/* brilho do anel externo */}
      <div className="absolute -inset-[11px] rounded-[35px] overflow-hidden opacity-80" style={{ filter: "blur(7px)" }}>
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar" style={{ background: aco, animationDuration: "10s" }} />
      </div>
      {/* fio externo nítido */}
      <div className="absolute -inset-[7.5px] rounded-[31.5px] overflow-hidden">
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar" style={{ background: aco, animationDuration: "10s" }} />
      </div>
      {/* horizonte de eventos: faixa escura entre os dois fios */}
      <div className="absolute -inset-[5.5px] rounded-[29.5px] bg-[#050507]/90" style={{ boxShadow: "inset 0 0 4px 1px rgba(148,163,184,0.25)" }} />
      {/* fio interno, gira ao contrário */}
      <div className="absolute -inset-[2px] rounded-[26px] overflow-hidden">
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar-rev" style={{ background: acoInv, animationDuration: "7s" }} />
      </div>
      {particulas.map((p, i) => (
        <span
          key={i}
          className="absolute w-1 h-1 rounded-full eco-aura-particula bg-[#E2E8F0]"
          style={{ left: p.l, top: p.t, animationDelay: p.d, boxShadow: "0 0 6px 1px rgba(186,230,253,0.75)" }}
        />
      ))}
    </div>
  );
};
