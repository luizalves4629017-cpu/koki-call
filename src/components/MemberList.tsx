import { useFecharComNevoa, NevoaSaida } from "./NevoaSaida";
import { TAG_COFUNDADOR } from "../utils/tagExibida";
import React, { useEffect, useMemo, useState } from "react";
import { Socket } from "socket.io-client";
import { Search, Award, DoorOpen, ChevronLeft, ChevronRight, Gavel, Ghost } from "lucide-react";
import { BadgeIcon } from "./BadgeIcon";
import { ALL_BADGES } from "../data/badges";
import {
  X,
  MicOff,
  Headphones,
  Video,
  Monitor,
  Check,
  UserX,
  ShieldCheck,
} from "lucide-react";
import { Participant, KnockRequest } from "../types";
import { AnelPerk } from "./AnelPerk";
import { anelDoParticipante } from "../utils/perks";
import { BlackHoleBadge } from "./BlackHoleBadge";

interface MemberListProps {
  participants: Participant[];
  selfId: string;
  selfIsHost?: boolean;
  pendingKnocks?: KnockRequest[];
  isDarkTheme?: boolean;
  onApproveKnock?: (socketId: string) => void;
  onRejectKnock?: (socketId: string) => void;
  onSelectParticipant: (participant: Participant) => void;
  onClose?: () => void;
  /** Lista com quem está offline (vem do servidor) */
  socket?: Socket;
  roomId?: string;
  podeGerenciar?: boolean;
  /** muda quando o Dono altera insígnias de alguém offline (recarrega a lista) */
  versao?: number;
  /** só o Dono Master vê offline e "Todo o eco" */
  mostrarOffline?: boolean;
  masterToken?: string;
  onAbrirInsignias?: (participant: Participant) => void;
  /** Portinha: sair deste servidor/sala (some da lista de membros) */
  onSairServidor?: () => void;
  /** barra recolhida pro lado (só fotos) */
  recolhida?: boolean;
  onAlternarRecolhida?: () => void;
  /** Botão Punir/Banir em cada linha (Dono Master e Co-fundador) */
  onPunir?: (participant: Participant) => void;
  /** Regras de quem pode ser punido (nunca o Dono; Co-fundador não pune outro Co-fundador) */
  podePunir?: (participant: Participant) => boolean;
  /** Modo invisível: quem mais está invisível nesta sala (só chega pro Dono Master / Co-fundador) */
  invisiveis?: Participant[];
  /** Eu estou invisível nesta sala */
  souInvisivel?: boolean;
  /** Entrar invisível na sala de alguém (só Dono Master / Co-fundador recebem) */
  onEntrarInvisivel?: (roomId: string) => void;
}

/** Membro salvo no servidor (pode estar offline ou em outra sala) */
interface MembroSalvo {
  purchasedPerks?: Record<string, number>;
  bannerUrl?: string;
  bannerColor?: string;
  customStatus?: string;
  customTitle?: string;
  bio?: string;
  memberSince?: number;
  cargo?: string;
  poderes?: string[];
  auraLiberada?: boolean;
  auraLiberadaPor?: "dono" | "cofundador";
  auraCard?: any;
  auraLoja?: string;
  chave: string;
  nome: string;
  tag: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  badges: string[];
  isCofundador?: boolean;
  ehDono?: boolean;
  vistoEm: number;
  online: boolean;
  salaId?: string;
  salaNome?: string;
  socketId?: string;
  /** Só pro Dono Master / Co-fundador */
  invisivel?: boolean;
  invisivelSalaId?: string;
  invisivelSalaNome?: string;
  ultimaSalaId?: string;
  ultimaSalaNome?: string;
}

function vistoHa(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 2) return "visto agora";
  if (min < 60) return `visto há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `visto há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "visto ontem";
  if (d < 7) return `visto há ${d} dias`;
  const sem = Math.floor(d / 7);
  if (sem < 5) return sem === 1 ? "visto há 1 semana" : `visto há ${sem} semanas`;
  const mes = Math.floor(d / 30);
  return mes <= 1 ? "visto há 1 mês" : `visto há ${mes} meses`;
}

/** Transforma o membro salvo num "participante" pra abrir perfil e insígnias */
function membroComoParticipante(m: MembroSalvo, salaInvisivel?: string): Participant {
  return {
    salaInvisivel,
    invisivel: m.invisivel,
    id: `membro:${m.chave}`,
    name: m.nome,
    tag: m.tag,
    tagExibida: m.isCofundador ? TAG_COFUNDADOR : undefined,
    avatarUrl: m.avatarUrl,
    avatarEmoji: m.avatarEmoji,
    avatarColor: m.avatarColor,
    badges: m.badges,
    isCofundador: m.isCofundador,
    ehDono: m.ehDono,
    purchasedPerks: m.purchasedPerks || {},
    memberSince: m.memberSince,
    cargo: m.cargo,
    poderes: m.poderes || [],
    auraLiberada: m.auraLiberada,
    auraLiberadaPor: m.auraLiberadaPor,
    auraCard: m.auraCard,
    auraLoja: m.auraLoja,
    bannerUrl: m.bannerUrl,
    bannerColor: m.bannerColor,
    customTitle: m.customTitle,
    bio: m.bio,
    customStatus: m.customStatus || (m.online ? `🟢 Em ${m.salaNome || "outra sala"}` : `⚫ ${vistoHa(m.vistoEm)}`),
    vistoTexto: m.online ? undefined : vistoHa(m.vistoEm),
    hasAudio: false,
    hasVideo: false,
    isScreenSharing: false,
    isHost: false,
    isOffline: !m.online,
  } as any;
}

export const MemberList: React.FC<MemberListProps> = ({
  participants,
  selfId,
  selfIsHost,
  pendingKnocks = [],
  onApproveKnock,
  onRejectKnock,
  onSelectParticipant,
  onClose,
  socket,
  roomId,
  podeGerenciar,
  onAbrirInsignias,
  versao = 0,
  mostrarOffline = false,
  masterToken,
  onSairServidor,
  recolhida = false,
  onAlternarRecolhida,
  onPunir,
  podePunir,
  invisiveis,
  souInvisivel = false,
  onEntrarInvisivel,
}) => {
  // Botão fantasma: entrar invisível na sala dessa pessoa (Dono Master / Co-fundador)
  const botaoInvisivel = (sala?: string, nome?: string) =>
    onEntrarInvisivel && sala && !(souInvisivel && sala === roomId) ? (
      <button
        type="button"
        title={nome ? `Entrar invisível na sala de ${nome}` : "Entrar invisível"}
        onClick={(e) => {
          e.stopPropagation();
          onEntrarInvisivel(sala);
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#8B8F98] hover:text-[#C4B5FD] hover:bg-[#C4B5FD]/10 transition-all cursor-pointer shrink-0"
      >
        <Ghost className="w-3.5 h-3.5" />
      </button>
    ) : null;
  /** Sala pra entrar invisível a partir de um membro salvo */
  const salaDoMembro = (m: MembroSalvo): string | undefined =>
    m.online ? m.salaId : m.invisivel ? m.invisivelSalaId : aba === "sala" ? roomId : m.ultimaSalaId || undefined;
  const botaoPunir = (p: Participant) =>
    onPunir && (!podePunir || podePunir(p)) ? (
      <button
        type="button"
        title="Punir/Banir"
        onClick={(e) => {
          e.stopPropagation();
          onPunir(p);
        }}
        className="p-1.5 rounded-lg text-[#8B8F98] hover:text-[#FB7185] hover:bg-[#F43F5E]/10 transition-colors cursor-pointer shrink-0"
      >
        <Gavel className="w-3.5 h-3.5" />
      </button>
    ) : null;
  const { fechando, fechar } = useFecharComNevoa(onClose);
  const [aba, setAba] = useState<"sala" | "eco">("sala");
  const [salvos, setSalvos] = useState<MembroSalvo[]>([]);
  const [busca, setBusca] = useState("");

  // Busca a lista no servidor ao abrir, ao trocar de aba, quando alguém entra/sai e a cada 30 s
  useEffect(() => {
    if (!socket) return;
    let vivo = true;
    const buscar = () =>
      // aba em segundo plano não precisa da lista a cada 30 s
      typeof document !== "undefined" && document.visibilityState === "hidden" ? undefined :
      socket.emit("membros:listar", { roomId, escopo: mostrarOffline ? aba : "sala", masterToken }, (res: { success: boolean; membros?: MembroSalvo[] }) => {
        if (vivo && res?.success && Array.isArray(res.membros)) setSalvos(res.membros);
      });
    buscar();
    const t = setInterval(buscar, 30000);
    socket.on("membros:mudou", buscar);
    return () => {
      vivo = false;
      clearInterval(t);
      socket.off("membros:mudou", buscar);
    };
  }, [socket, roomId, aba, participants.length, versao, mostrarOffline, masterToken]);

  // Na aba "Esta sala": offline = quem já passou aqui e não está online agora
  // (invisíveis desta sala aparecem na seção própria, não como offline)
  const offlineSala = useMemo(
    () => salvos.filter((m) => !m.online && !(invisiveis && m.invisivel && m.invisivelSalaId === roomId)),
    [salvos, invisiveis, roomId]
  );
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? salvos.filter((m) => `${m.nome}#${m.tag}`.toLowerCase().includes(q)) : salvos;
  }, [salvos, busca]);
  const onlineEco = filtrados.filter((m) => m.online);
  const offlineEco = filtrados.filter((m) => !m.online);

  const renderSalvo = (m: MembroSalvo) => {
    const p = membroComoParticipante(m, salaDoMembro(m));
    const icones = (m.badges || [])
      .map((id) => ALL_BADGES.find((b) => b.id === id))
      .filter(Boolean)
      .slice(0, 3) as typeof ALL_BADGES;
    return (
      <div
        key={m.chave}
        onClick={() => onSelectParticipant(p)}
        className={`w-full group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer hover:bg-[#252830] ${m.online ? "" : "opacity-80 hover:opacity-100"}`}
      >
        <div className="relative shrink-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
            style={{ backgroundColor: m.avatarColor || "#2DD4BF" }}
          >
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.nome} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <span>{m.avatarEmoji || (m.nome || "E").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1E2026] ${m.online ? "bg-emerald-400" : "bg-[#5C606A]"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[13px] text-[#ECECEC] truncate">
            <span className="truncate">{m.nome}</span>
            <span className="text-[#5C606A] text-[11px]">#{m.isCofundador ? TAG_COFUNDADOR : m.tag}</span>
            {icones.map((b) => (
              <span key={b.id} title={b.name} className="shrink-0"><BadgeIcon icon={b.icon} size={12} alt={b.name} /></span>
            ))}
          </div>
          <div className="text-[11px] text-[#8B8F98] truncate">
            {m.online ? (
              m.salaNome || "Online"
            ) : m.invisivel ? (
              <span className="inline-flex items-center gap-1 text-[#C4B5FD]">
                <Ghost className="w-3 h-3" /> invisível{m.invisivelSalaNome ? ` · ${m.invisivelSalaNome}` : ""}
              </span>
            ) : (
              vistoHa(m.vistoEm)
            )}
          </div>
        </div>
        {botaoInvisivel(salaDoMembro(m), m.nome)}
        {mostrarOffline && podeGerenciar && onAbrirInsignias && (
          <button
            type="button"
            title="Insígnias"
            onClick={(e) => {
              e.stopPropagation();
              onAbrirInsignias(p);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#8B8F98] hover:text-[#5EEAD4] hover:bg-[#2A2D35] transition-all cursor-pointer shrink-0"
          >
            <Award className="w-3.5 h-3.5" />
          </button>
        )}
        {botaoPunir(p)}
      </div>
    );
  };
  const hosts = participants.filter((p) => p.isMaster || p.tag === "0001");
  const members = participants.filter((p) => !p.isMaster && p.tag !== "0001");

  const renderMemberRow = (participant: Participant) => {
    const isSelf = participant.id === selfId;
    const isSpeaking = participant.hasAudio && (participant.audioLevel || 0) > 15;
    const isOwner = Boolean(participant.isMaster || participant.tag === "0001");
    const isVip = Boolean(participant.isVip || participant.vipPermissions?.hasVipBadge);
    const hasHorizonteBadge = Boolean(participant.badges?.includes("horizonte"));

    return (
      <div
        key={participant.id}
        role="button"
        tabIndex={0}
        onClick={() => onSelectParticipant(participant)}
        className={`w-full group flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
          isSpeaking
            ? "bg-[#2A2D35] text-[#ECECEC]"
            : "hover:bg-[#252830] text-[#ECECEC]"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar com Mini Anel */}
          <div className="relative shrink-0">
            {anelDoParticipante(participant) && <AnelPerk tipo={anelDoParticipante(participant)!} escala={1.5} satelites={false} />}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all text-white ${
                isSpeaking
                  ? "ring-2 ring-[#5EEAD4] scale-105"
                  : isOwner
                  ? "ring-1 ring-[#C4B5FD]"
                  : isVip
                  ? "ring-1 ring-[#C4B5FD]"
                  : "ring-1 ring-[#2A2D35]"
              }`}
              style={{ backgroundColor: participant.avatarColor || "#2DD4BF" }}
            >
              {participant.avatarUrl ? (
                <img
                  src={participant.avatarUrl}
                  alt={participant.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{participant.name ? participant.name.slice(0, 1).toUpperCase() : "E"}</span>
              )}
            </div>

            {/* Bolinha de status */}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1E2026] ${
                isSpeaking
                  ? "bg-[#5EEAD4] animate-pulse"
                  : participant.isDeafened
                  ? "bg-[#F43F5E]"
                  : !participant.hasAudio
                  ? "bg-[#8B8F98]"
                  : "bg-emerald-400"
              }`}
            />
          </div>

          {/* Nome e badges */}
          <div className="min-w-0 truncate">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-semibold truncate ${
                  isOwner ? "text-[#C4B5FD]" : "text-[#ECECEC] group-hover:text-[#5EEAD4]"
                }`}
              >
                {participant.name} {isSelf && "(Você)"}
              </span>

              {/* Insígnia Singularidade ao lado do nome do Dono */}
              {isOwner && (
                <BlackHoleBadge type="singularidade" size={15} />
              )}

              {/* Insígnia Horizonte */}
              {hasHorizonteBadge && !isOwner && (
                <BlackHoleBadge type="horizonte" size={15} />
              )}
            </div>
          </div>
        </div>

        {/* Ícone de tela ao lado de quem estiver transmitindo */}
        <div className="flex items-center gap-1.5 shrink-0 text-[#8B8F98]">
          {participant.isScreenSharing && (
            <div
              title="Compartilhando tela"
              className="p-1 rounded-md bg-[#5EEAD4]/15 text-[#5EEAD4] border border-[#5EEAD4]/30"
            >
              <Monitor className="w-3 h-3" />
            </div>
          )}

          {participant.hasVideo && (
            <div title="Câmera ligada" className="p-1 rounded-md text-[#8B8F98]">
              <Video className="w-3 h-3" />
            </div>
          )}

          {participant.isDeafened && (
            <div title="Fone desativado" className="p-1 rounded-md text-[#F43F5E]">
              <Headphones className="w-3 h-3" />
            </div>
          )}

          {!participant.hasAudio && !participant.isDeafened && (
            <div title="Microfone mutado" className="p-1 rounded-md text-[#F43F5E]">
              <MicOff className="w-3 h-3" />
            </div>
          )}
          {!isSelf && botaoInvisivel(roomId, participant.name)}
          {!isSelf && botaoPunir(participant)}
        </div>
      </div>
    );
  };

  if (recolhida) {
    const bolinha = (key: string, nome: string, cor: string | undefined, url: string | undefined, emoji: string | undefined, on: boolean, onClick: () => void) => (
      <button key={key} type="button" onClick={onClick} title={nome} className={`relative shrink-0 cursor-pointer ${on ? "" : "opacity-80 hover:opacity-100"}`}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white overflow-hidden" style={{ backgroundColor: cor || "#2DD4BF" }}>
          {url ? <img src={url} alt={nome} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <span>{emoji || (nome || "E").slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1E2026] ${on ? "bg-emerald-400" : "bg-[#5C606A]"}`} />
      </button>
    );
    return (
      <div className="relative w-[58px] border-l border-[#2A2D35] flex flex-col items-center h-full select-none bg-[#1E2026] shrink-0 py-3">
        <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-2.5 [scrollbar-width:none]">
          {participants.map((p) => bolinha(p.id, p.name, p.avatarColor, p.avatarUrl, undefined, true, () => onSelectParticipant(p)))}
          {offlineSala.length > 0 && <div className="w-6 h-px bg-[#2A2D35] my-0.5" />}
          {offlineSala.map((m) => bolinha(m.chave, m.nome, m.avatarColor, m.avatarUrl, m.avatarEmoji, false, () => onSelectParticipant(membroComoParticipante(m, salaDoMembro(m)))))}
        </div>
        {onAlternarRecolhida && (
          <button type="button" onClick={onAlternarRecolhida} className="absolute top-1/2 -left-4 -translate-y-1/2 w-4 h-10 rounded-l-md bg-[#252830] border border-r-0 border-[#2A2D35] text-[#ECECEC] flex items-center justify-center cursor-pointer hover:bg-[#2c303a] z-30" title="Abrir lista de membros">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-60 border-l border-[#2A2D35] flex flex-col h-full select-none bg-[#1E2026] text-[#ECECEC] transition-colors shrink-0 ${fechando ? "eco-painel-sair" : "eco-painel-entrar"}`}>
      <NevoaSaida ativo={fechando} />
      {/* Header com botão para recolher lateral */}
      <div className="h-14 px-4 border-b border-[#2A2D35] flex items-center justify-between">
        {!mostrarOffline ? (
          <span className="text-xs font-medium text-[#8B8F98]">Na call — {participants.length}</span>
        ) : (
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-[#16171B] text-[11px] font-semibold">
          {(["sala", "eco"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAba(k)}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${aba === k ? "bg-[#5EEAD4] text-[#16171B]" : "text-[#8B8F98] hover:text-[#ECECEC]"}`}
            >
              {k === "sala" ? "Esta sala" : "Todo o eco"}
            </button>
          ))}
        </div>
        )}
        <div className="flex items-center gap-0.5">
        {onSairServidor && (
          <button
            onClick={() => {
              if (window.confirm("Sair deste servidor? Você some da lista de membros e da sua lista de salas. Pode voltar depois pelo link.")) onSairServidor();
            }}
            className="p-1 rounded-lg text-[#8B8F98] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 transition-colors cursor-pointer"
            title="Sair do servidor"
          >
            <DoorOpen className="w-4 h-4" />
          </button>
        )}
        {onAlternarRecolhida && (
          <button
            onClick={onAlternarRecolhida}
            className="p-1 rounded-lg text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#2A2D35] transition-colors cursor-pointer"
            title="Recolher pro lado"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {onClose && (
          <button
            onClick={fechar}
            className="p-1 rounded-lg text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#2A2D35] transition-colors cursor-pointer"
            title="Recolher lateral"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        </div>
      </div>

      {/* Lista de Membros */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {/* Portaria / Pedidos de entrada para o Dono */}
        {selfIsHost && pendingKnocks.length > 0 && (
          <div className="border border-[#C4B5FD]/30 bg-[#C4B5FD]/10 rounded-xl p-2.5 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C4B5FD]" />
                Portaria ({pendingKnocks.length})
              </span>
              <span className="w-2 h-2 rounded-full bg-[#C4B5FD] animate-ping" />
            </div>

            <div className="space-y-1.5">
              {pendingKnocks.map((knock) => (
                <div
                  key={knock.socketId}
                  className="border border-[#2A2D35] bg-[#16171B] rounded-lg p-2 flex flex-col gap-1.5"
                >
                  <div className="text-xs font-bold text-[#ECECEC] truncate">
                    {knock.name}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    {onRejectKnock && (
                      <button
                        onClick={() => onRejectKnock(knock.socketId)}
                        className="flex-1 bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25 text-[#F43F5E] border border-[#F43F5E]/30 text-[10px] font-bold py-1 rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <UserX className="w-3 h-3" />
                        <span>Recusar</span>
                      </button>
                    )}
                    {onApproveKnock && (
                      <button
                        onClick={() => onApproveKnock(knock.socketId)}
                        className="flex-1 bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-[10px] font-bold py-1 rounded flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                      >
                        <Check className="w-3 h-3 font-bold" />
                        <span>Permitir</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mostrarOffline && aba === "eco" ? (
          <>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5C606A]" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar membro"
                className="w-full bg-[#16171B] rounded-lg pl-8 pr-2 py-1.5 text-xs text-[#ECECEC] placeholder-[#5C606A] outline-none focus:ring-1 focus:ring-[#5EEAD4]/40"
              />
            </div>
            <div>
              <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8B8F98]">Online — {onlineEco.length}</div>
              <div className="space-y-0.5">{onlineEco.map(renderSalvo)}</div>
            </div>
            {offlineEco.length > 0 && (
              <div>
                <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5C606A]">Offline — {offlineEco.length}</div>
                <div className="space-y-0.5">{offlineEco.map(renderSalvo)}</div>
              </div>
            )}
          </>
        ) : (
        <>
        {/* Seção Dono */}
        {hosts.length > 0 && (
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD] flex items-center gap-1.5">
              <BlackHoleBadge type="singularidade" size={13} />
              <span>Dono</span>
            </div>
            <div className="space-y-0.5">{hosts.map(renderMemberRow)}</div>
          </div>
        )}

        {/* Seção Membros */}
        {members.length > 0 && (
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8B8F98]">
              <span>Membros — {members.length}</span>
            </div>
            <div className="space-y-0.5">{members.map(renderMemberRow)}</div>
          </div>
        )}

        {/* Seção Invisíveis: só o Dono Master / Co-fundador veem */}
        {invisiveis && invisiveis.length > 0 && (
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD] flex items-center gap-1.5">
              <Ghost className="w-3.5 h-3.5" />
              <span>Invisíveis — {invisiveis.length}</span>
            </div>
            <div className="space-y-0.5">
              {invisiveis.map((g) => (
                <div
                  key={g.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectParticipant({ ...g, invisivel: true })}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left cursor-pointer hover:bg-[#252830] opacity-80 hover:opacity-100"
                  title="Está nesta sala no modo invisível. Membros comuns não veem."
                >
                  <div className="relative shrink-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden ring-1 ring-dashed ring-[#C4B5FD]/60"
                      style={{ backgroundColor: g.avatarColor || "#2A2D35" }}
                    >
                      {g.avatarUrl ? (
                        <img src={g.avatarUrl} alt={g.name} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-70" />
                      ) : (
                        <span>{(g.name || "E").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1E2026] border border-[#C4B5FD]/60 flex items-center justify-center text-[#C4B5FD]">
                      <Ghost className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#ECECEC] truncate">{g.name}</div>
                    <div className="text-[10px] text-[#C4B5FD]">invisível</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seção Offline: quem já entrou nesta sala e não está agora */}
        {offlineSala.length > 0 && (
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5C606A]">
              <span>Offline — {offlineSala.length}</span>
            </div>
            <div className="space-y-0.5">{offlineSala.map(renderSalvo)}</div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};
