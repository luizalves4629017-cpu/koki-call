import React, { useEffect, useState } from "react";
import { getStoredMasterInfo } from "../utils/masterAuth";
import { EditorLoja } from "./EditorLoja";
import { BanidosPainel } from "./BanidosPainel";
import {
  Crown,
  X,
  Lock,
  Unlock,
  MicOff,
  Monitor,
  Video,
  UserX,
  Shield,
  Key,
  Users,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  Coins,
  Send,
  Sparkles,
  Award,
  Mic,
  UserPlus,
  DoorOpen,
  Gavel,
  Megaphone,
} from "lucide-react";
import { Participant, RoomState, KnockRequest } from "../types";

interface HostPanelModalProps {
  isCofundador?: boolean;
  isOpen: boolean;
  room: RoomState;
  self: Participant;
  socket?: any;
  pendingKnocks?: KnockRequest[];
  onClose: () => void;
  onToggleLock: () => void;
  onMuteAll: () => void;
  onMuteUser: (userId: string) => void;
  /** Tira o mute do Dono (a pessoa pode ligar o mic de novo) */
  onUnmuteUser?: (userId: string) => void;
  onKickUser: (userId: string) => void;
  /** Abre a janela Expulsar da call / Suspender / Banir */
  onPunirUser?: (participant: Participant) => void;
  /** Regras de quem pode ser punido (vale também pra offline) */
  podePunir?: (participant: Participant) => boolean;
  onUpdateSettings: (settings: Partial<RoomState["settings"]>) => void;
  onClaimHost?: (passcode: string) => void;
  onApproveKnock?: (socketId: string) => void;
  onRejectKnock?: (socketId: string) => void;
  onOpenAdmissionModal?: () => void;
  onCloseRoomForAll?: () => void;
  onGiveCoins?: (targetSocketId: string, amount: number) => void;
  onOpenGrantBadges?: (participant: Participant) => void;
  isMaster?: boolean;
  masterToken?: string | null;
}

// Fora do componente: senão são recriados a cada atualização da call e o clique se perde
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
      checked ? "bg-[#5EEAD4]" : "bg-[#2A2D35]"
    }`}
  >
    <span
      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-1"}`}
    />
  </button>
);

const Avatar = ({ p, size = 40 }: { p: { name: string; avatarUrl?: string; avatarEmoji?: string; avatarColor?: string }; size?: number }) => (
  <div
    className="rounded-full flex items-center justify-center font-bold text-white shrink-0 overflow-hidden"
    style={{ width: size, height: size, backgroundColor: p.avatarColor || "#2A2D35", fontSize: size * 0.32 }}
  >
    {p.avatarUrl ? (
      <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
    ) : p.avatarEmoji ? (
      <span>{p.avatarEmoji}</span>
    ) : (
      <span>{p.name.slice(0, 2).toUpperCase()}</span>
    )}
  </div>
);


export const HostPanelModal: React.FC<HostPanelModalProps> = ({
  isOpen,
  room,
  self,
  socket,
  pendingKnocks = [],
  onClose,
  onToggleLock,
  onMuteAll,
  onMuteUser,
  onUnmuteUser,
  onKickUser,
  onPunirUser,
  podePunir,
  onUpdateSettings,
  onClaimHost,
  onApproveKnock,
  onRejectKnock,
  onOpenAdmissionModal,
  onCloseRoomForAll,
  onGiveCoins,
  onOpenGrantBadges,
  isMaster = false,
  masterToken = null,
  isCofundador = false,
}) => {
  const ehCof = Boolean(isCofundador && !isMaster);
  const podePainel = Boolean(isMaster || ehCof);
  // Co-fundador só mexe nos membros: nunca no Dono Master nem em outro Co-fundador
  const alvoLivre = (p: any) => !ehCof || p.id === self.id || (!p.isMaster && !p.isCofundador);
  const [aba, setAba] = useState<"sala" | "loja">("sala");
  const [avisoAtualizacao, setAvisoAtualizacao] = useState<string | null>(null);

  // Membros offline desta sala (pra punir/banir quem não está na call agora)
  const [offline, setOffline] = useState<any[]>([]);
  useEffect(() => {
    if (!isOpen || !socket || !podePainel || !onPunirUser) return;
    let vivo = true;
    socket.emit("membros:listar", { roomId: room.roomId, escopo: "sala", masterToken: masterToken || undefined }, (res: any) => {
      if (vivo && res?.success && Array.isArray(res.membros)) setOffline(res.membros.filter((m: any) => !m.online));
    });
    return () => {
      vivo = false;
    };
  }, [isOpen, socket, podePainel, room.roomId, room.participants.length, masterToken]); // eslint-disable-line react-hooks/exhaustive-deps
  const offlineComoParticipante = (m: any): Participant =>
    ({
      id: `membro:${m.chave}`,
      name: m.nome,
      tag: m.tag,
      avatarUrl: m.avatarUrl,
      avatarEmoji: m.avatarEmoji,
      avatarColor: m.avatarColor,
      badges: m.badges || [],
      isCofundador: m.isCofundador,
      ehDono: m.ehDono,
      cargo: m.cargo,
      poderes: m.poderes || [],
      auraLiberada: m.auraLiberada,
      auraLiberadaPor: m.auraLiberadaPor,
      auraCard: m.auraCard,
      auraLoja: m.auraLoja,
      purchasedPerks: m.purchasedPerks || {},
      hasAudio: false,
      hasVideo: false,
      isScreenSharing: false,
      isHost: false,
      isOffline: true,
    }) as any;

  const [claimPin, setClaimPin] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmCloseRoom, setConfirmCloseRoom] = useState(false);

  // Koki Coins direct transfer & moderation states
  const otherParticipants = room.participants.filter((p) => p.id !== self.id && alvoLivre(p));
  const [selectedCoinTarget, setSelectedCoinTarget] = useState<string>(
    otherParticipants.length > 0 ? otherParticipants[0].id : (room.participants[0]?.id || "")
  );
  const [coinMode, setCoinMode] = useState<"add" | "deduct">("add");
  const [coinAmount, setCoinAmount] = useState<string>("100");
  const [isSendingCoins, setIsSendingCoins] = useState<boolean>(false);
  const [coinFeedback, setCoinFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?room=${encodeURIComponent(room.roomId)}&role=guest`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (claimPin && onClaimHost) {
      onClaimHost(claimPin);
      setClaimPin("");
    }
  };

  const handleManageCoins = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCoinFeedback(null);

    const targetId = selectedCoinTarget || (otherParticipants[0]?.id) || (room.participants[0]?.id);
    if (!targetId) {
      setCoinFeedback({ type: "error", message: "Selecione um participante para a ação." });
      return;
    }

    const rawNum = parseInt(coinAmount, 10);
    if (isNaN(rawNum) || rawNum <= 0) {
      setCoinFeedback({ type: "error", message: "Informe uma quantidade válida de moedas (mínimo 1)." });
      return;
    }

    const amount = coinMode === "deduct" ? -rawNum : rawNum;
    const targetParticipant = room.participants.find((p) => p.id === targetId);
    const targetName = targetParticipant?.name || "participante";

    setIsSendingCoins(true);

    // Envia uma única vez (antes ia pelo prop E pelo socket = moedas em dobro)
    if (socket) {
      socket.emit(
        "host:give-coins",
        {
          targetSocketId: targetId,
          amount,
          action: coinMode,
          roomId: room.roomId,
          masterToken: getStoredMasterInfo().token || undefined,
        },
        (res: { success: boolean; message?: string; newBalance?: number }) => {
          setIsSendingCoins(false);
          if (res && res.success) {
            setCoinFeedback({
              type: "success",
              message: res.message || (coinMode === "deduct"
                ? `-${rawNum.toLocaleString()} Eco Coins removidas de ${targetName}!`
                : `+${rawNum.toLocaleString()} Eco Coins enviadas para ${targetName}!`),
            });
            setTimeout(() => setCoinFeedback(null), 4000);
          } else {
            setCoinFeedback({
              type: "error",
              message: res?.message || `Erro ao ${coinMode === "deduct" ? "remover" : "enviar"} moedas.`,
            });
          }
        }
      );
    } else {
      setIsSendingCoins(false);
      setCoinFeedback({
        type: "success",
        message: coinMode === "deduct"
          ? `-${rawNum.toLocaleString()} Eco Coins removidas de ${targetName}!`
          : `+${rawNum.toLocaleString()} Eco Coins enviadas para ${targetName}!`,
      });
      setTimeout(() => setCoinFeedback(null), 4000);
    }
  };

  const sectionTitle = "text-[13px] font-bold text-[#ECECEC] flex items-center gap-2";

  return (
    <div className="fixed inset-0 z-50 select-none" onClick={onClose}>
      {/* Fundo escurecido (a call continua visível atrás) */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150" />

      {/* Gaveta lateral */}
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-[#16171B] border-l border-[#2A2D35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Cabeçalho */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-extrabold text-[#ECECEC] tracking-tight">{ehCof ? "Painel Co-fundador" : "Painel do Dono"}</h3>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#C4B5FD]/20 text-[#C4B5FD] border border-[#C4B5FD]/40 shadow-[0_0_12px_rgba(196,181,253,0.35)]">
              PRO
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8B8E98] hover:text-[#ECECEC] hover:bg-[#1E2026] transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex gap-1 bg-[#1E2026] border border-[#2A2D35] rounded-xl p-1">
            {[
              { id: "sala", rotulo: "Sala", mostrar: true },
              { id: "loja", rotulo: "Loja (preços)", mostrar: isMaster },
            ]
              .filter((a) => a.mostrar)
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id as any)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    aba === a.id ? "bg-[#5EEAD4]/15 text-[#5EEAD4]" : "text-[#8B8E98] hover:text-[#ECECEC]"
                  }`}
                >
                  {a.rotulo}
                </button>
              ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-6 text-xs text-[#B5B8C0]">
          {aba === "loja" && socket && isMaster && <EditorLoja socket={socket} masterToken={masterToken} />}
          {aba === "sala" && (!podePainel ? (
            <div className="bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-[#C4B5FD] font-bold text-sm">
                <Key className="w-4 h-4" />
                <span>Assumir como Dono</span>
              </div>
              <p className="text-[#8B8E98]">Digite a senha da sala para recuperar os controles de anfitrião.</p>
              <form onSubmit={handleClaim} className="flex gap-2">
                <input
                  type="password"
                  placeholder="Senha / PIN"
                  value={claimPin}
                  onChange={(e) => setClaimPin(e.target.value)}
                  className="bg-[#16171B] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-[#ECECEC] text-xs w-full focus:outline-none focus:border-[#C4B5FD]"
                />
                <button
                  type="submit"
                  disabled={!claimPin}
                  className="bg-[#C4B5FD] hover:bg-[#B4A3FB] disabled:opacity-50 text-[#16171B] font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                >
                  Entrar
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Ações rápidas */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  {
                    key: "lock",
                    label: room.isLocked ? "Trancada" : "Trancar",
                    icon: room.isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />,
                    active: room.isLocked,
                    onClick: onToggleLock,
                  },
                  { key: "mute", label: "Mutar todos", icon: <MicOff className="w-5 h-5" />, active: false, onClick: onMuteAll },
                  {
                    key: "invite",
                    label: copiedLink ? "Copiado!" : "Convidar",
                    icon: copiedLink ? <Check className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />,
                    active: copiedLink,
                    onClick: handleCopyLink,
                  },
                  {
                    key: "door",
                    label: "Portaria",
                    icon: <DoorOpen className="w-5 h-5" />,
                    active: room.settings.requireKnockApproval,
                    badge: pendingKnocks.length,
                    onClick: () => {
                      if (onOpenAdmissionModal) {
                        onClose();
                        onOpenAdmissionModal();
                      } else {
                        onUpdateSettings({ requireKnockApproval: !room.settings.requireKnockApproval });
                      }
                    },
                  },
                ].map((a) => (
                  <button
                    key={a.key}
                    onClick={a.onClick}
                    className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-1.5 text-[11px] font-semibold transition-all cursor-pointer active:scale-95 ${
                      a.active
                        ? "bg-[#C4B5FD]/20 border-[#C4B5FD]/60 text-[#ECECEC]"
                        : "bg-[#1E2026] border-[#2A2D35] text-[#B5B8C0] hover:border-[#3A3E48] hover:text-[#ECECEC]"
                    }`}
                  >
                    <span className={a.active ? "text-[#C4B5FD]" : ""}>{a.icon}</span>
                    <span className="leading-tight text-center">{a.label}</span>
                    {!!a.badge && a.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#F43F5E] text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                        {a.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Portaria: pedidos pendentes */}
              {pendingKnocks.length > 0 && (
                <div className="space-y-2">
                  <span className={sectionTitle}>
                    Esperando para entrar
                    <span className="text-[#8B8E98] font-semibold">{pendingKnocks.length}</span>
                  </span>
                  {pendingKnocks.map((knock) => (
                    <div key={knock.socketId} className="flex items-center gap-3 bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-2.5">
                      <Avatar p={knock as any} size={32} />
                      <span className="flex-1 font-bold text-[#ECECEC] text-xs truncate">{knock.name}</span>
                      {onRejectKnock && (
                        <button
                          onClick={() => onRejectKnock(knock.socketId)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#F43F5E]/50 text-[#FB7185] text-[11px] font-bold hover:bg-[#F43F5E]/10 cursor-pointer"
                        >
                          Recusar
                        </button>
                      )}
                      {onApproveKnock && (
                        <button
                          onClick={() => onApproveKnock(knock.socketId)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#5EEAD4] text-[#16171B] text-[11px] font-black hover:bg-[#2DD4BF] cursor-pointer"
                        >
                          Deixar entrar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pessoas na sala */}
              <div className="space-y-2.5">
                <span className={sectionTitle}>
                  Pessoas na sala
                  <span className="text-[#8B8E98] font-semibold">{room.participants.length}</span>
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {room.participants.map((p) => {
                    const micOn = p.hasAudio && !p.isMutedByHost;
                    const isMe = p.id === self.id;
                    return (
                      <div key={p.id} className="bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-3 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative">
                            <Avatar p={p} size={38} />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#1E2026] ${
                                micOn ? "bg-[#5EEAD4]" : "bg-[#3A3E48]"
                              }`}
                            >
                              {micOn ? <Mic className="w-2 h-2 text-[#16171B]" /> : <MicOff className="w-2 h-2 text-[#B5B8C0]" />}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[#ECECEC] text-[13px] truncate flex items-center gap-1">
                              {p.name}
                              {p.isMaster && <Crown className="w-3 h-3 text-[#C4B5FD] shrink-0" />}
                
                            </div>
                            <div className={`text-[11px] ${micOn ? "text-[#5EEAD4]" : "text-[#8B8E98]"}`}>
                              {isMe ? "Você" : micOn ? "Mic ligado" : "Mutado"}
                            </div>
                          </div>
                        </div>
                        {!isMe && alvoLivre(p) && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => (p.isMutedByHost && onUnmuteUser ? onUnmuteUser(p.id) : onMuteUser(p.id))}
                              className={`flex-1 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                                p.isMutedByHost
                                  ? "border-[#5EEAD4]/50 text-[#5EEAD4] hover:bg-[#5EEAD4]/10"
                                  : "border-[#2A2D35] text-[#ECECEC] hover:bg-[#252830]"
                              }`}
                            >
                              {p.isMutedByHost ? "Desmutar" : "Mutar"}
                            </button>
                            <button
                              onClick={() => (onPunirUser ? onPunirUser(p) : onKickUser(p.id))}
                              className="flex-1 py-1.5 rounded-lg border border-[#F43F5E]/50 text-[#FB7185] text-[11px] font-semibold hover:bg-[#F43F5E]/10 cursor-pointer flex items-center justify-center gap-1"
                              title="Expulsar da call, banir da sala ou do app"
                            >
                              <Gavel className="w-3 h-3" />
                              Punir
                            </button>
                            {onOpenGrantBadges && (
                              <button
                                onClick={() => onOpenGrantBadges(p)}
                                className="p-1.5 rounded-lg border border-[#2A2D35] text-[#C4B5FD] hover:bg-[#252830] cursor-pointer"
                                title="Insígnias"
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Offline nesta sala: punir/banir quem não está na call */}
              {onPunirUser && offline.length > 0 && (
                <div className="space-y-2">
                  <span className={sectionTitle}>
                    Offline nesta sala
                    <span className="text-[#8B8E98] font-semibold">{offline.length}</span>
                  </span>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {offline.map((m) => {
                      const p = offlineComoParticipante(m);
                      const pode = podePunir ? podePunir(p) : alvoLivre(p) && !m.ehDono;
                      return (
                        <div key={m.chave} className="flex items-center gap-2.5 bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-2">
                          <Avatar p={p} size={30} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[#ECECEC] truncate">
                              {m.nome} <span className="text-[#5C606A] font-normal">#{m.tag}</span>
                            </div>
                            <div className="text-[10px] text-[#8B8E98]">offline</div>
                          </div>
                          {pode && (
                            <button
                              onClick={() => onPunirUser(p)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#F43F5E]/50 text-[#FB7185] text-[11px] font-semibold hover:bg-[#F43F5E]/10 cursor-pointer flex items-center gap-1"
                              title="Banir da sala ou do app"
                            >
                              <Gavel className="w-3 h-3" />
                              Punir
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Eco Coins */}
              <form onSubmit={handleManageCoins} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={sectionTitle}>Eco Coins</span>
                  <div className="flex bg-[#1E2026] border border-[#2A2D35] rounded-full p-0.5">
                    <button
                      type="button"
                      onClick={() => { setCoinMode("add"); setCoinFeedback(null); }}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                        coinMode === "add" ? "bg-[#5EEAD4] text-[#16171B]" : "text-[#8B8E98] hover:text-[#ECECEC]"
                      }`}
                    >
                      Dar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCoinMode("deduct"); setCoinFeedback(null); }}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                        coinMode === "deduct" ? "bg-[#F43F5E] text-white" : "text-[#8B8E98] hover:text-[#ECECEC]"
                      }`}
                    >
                      Tirar
                    </button>
                  </div>
                </div>
                <select
                  value={selectedCoinTarget}
                  onChange={(e) => { setSelectedCoinTarget(e.target.value); setCoinFeedback(null); }}
                  className="w-full bg-[#1E2026] border border-[#2A2D35] text-[#ECECEC] text-xs rounded-full px-4 py-2.5 focus:outline-none focus:border-[#C4B5FD] cursor-pointer"
                >
                  {room.participants.length === 0 ? (
                    <option value="">Ninguém na sala</option>
                  ) : (
                    room.participants.filter(alvoLivre).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.id === self.id ? " (você)" : ""}{p.kokiCoins !== undefined ? ` · ${p.kokiCoins} coins` : ""}
                      </option>
                    ))
                  )}
                </select>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Coins className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#8B8E98]" />
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      value={coinAmount}
                      onChange={(e) => setCoinAmount(e.target.value)}
                      placeholder="Quantidade"
                      className="w-full bg-[#1E2026] border border-[#2A2D35] text-[#ECECEC] text-sm rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#C4B5FD] font-semibold"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingCoins || !selectedCoinTarget || !coinAmount}
                    className={`px-5 rounded-full text-sm font-bold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                      coinMode === "deduct" ? "bg-[#F43F5E] hover:bg-[#E11D48] text-white" : "bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B]"
                    }`}
                  >
                    {isSendingCoins ? "..." : coinMode === "deduct" ? "Tirar" : (<><span>Enviar</span><Send className="w-3.5 h-3.5" /></>)}
                  </button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["50", "100", "250", "500", "1000"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCoinAmount(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold cursor-pointer transition-colors ${
                        coinAmount === preset
                          ? "bg-[#C4B5FD]/20 border-[#C4B5FD]/60 text-[#ECECEC]"
                          : "bg-transparent border-[#2A2D35] text-[#8B8E98] hover:text-[#ECECEC]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                {coinFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-2 ${
                      coinFeedback.type === "success" ? "bg-[#5EEAD4]/10 text-[#5EEAD4]" : "bg-[#F43F5E]/10 text-[#FB7185]"
                    }`}
                  >
                    {coinFeedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <UserX className="w-4 h-4 shrink-0" />}
                    <span>{coinFeedback.message}</span>
                  </div>
                )}
              </form>

              {/* Suspensos e banidos (Dono Master e Co-fundador) */}
              {socket && <BanidosPainel socket={socket} masterToken={masterToken} />}

              {/* Configurações */}
              {!ehCof && <div className="space-y-2.5">
                <span className={sectionTitle}>Configurações</span>
                <div className="bg-[#1E2026] border border-[#2A2D35] rounded-2xl divide-y divide-[#2A2D35]">
                  {[
                    {
                      icon: <ShieldCheck className="w-4 h-4 text-[#C4B5FD]" />,
                      title: "Portaria",
                      desc: "Quem chega espera você liberar",
                      checked: room.settings.requireKnockApproval,
                      onChange: (v: boolean) => onUpdateSettings({ requireKnockApproval: v }),
                    },
                    {
                      icon: <Monitor className="w-4 h-4 text-[#5EEAD4]" />,
                      title: "Compartilhar tela",
                      desc: "Convidados podem mostrar a tela",
                      checked: room.settings.allowScreenShare,
                      onChange: (v: boolean) => onUpdateSettings({ allowScreenShare: v }),
                    },
                    {
                      icon: <Video className="w-4 h-4 text-[#5EEAD4]" />,
                      title: "Câmera",
                      desc: "Convidados podem ligar a webcam",
                      checked: room.settings.allowVideo,
                      onChange: (v: boolean) => onUpdateSettings({ allowVideo: v }),
                    },
                  ].map((row) => (
                    <div key={row.title} className="flex items-center gap-3 px-4 py-3">
                      {row.icon}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#ECECEC]">{row.title}</div>
                        <div className="text-[11px] text-[#8B8E98]">{row.desc}</div>
                      </div>
                      <Toggle checked={row.checked} onChange={row.onChange} />
                    </div>
                  ))}
                </div>
              </div>}

              {/* Avisar todo mundo que vai sair atualização (só Dono Master; o servidor confere) */}
              {isMaster && socket && (
                <div className="rounded-2xl bg-[#1E2026] border border-[#2A2D35] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Megaphone className="w-4 h-4 text-[#C4B5FD] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#ECECEC]">Avisar atualização</div>
                      <div className="text-[11px] text-[#8B8E98]">Manda pra todo mundo conectado: "O Eco vai atualizar em instantes…"</div>
                    </div>
                    <button
                      type="button"
                      disabled={avisoAtualizacao === "enviando"}
                      onClick={() => {
                        if (!window.confirm("Avisar todo mundo conectado que o Eco vai atualizar?")) return;
                        setAvisoAtualizacao("enviando");
                        socket.emit("master:avisar-atualizacao", { masterToken: masterToken || undefined }, (r: any) => {
                          setAvisoAtualizacao(r?.success ? `Aviso enviado (${r.conectados ?? "?"} conectados)` : r?.message || "Não deu pra avisar.");
                          window.setTimeout(() => setAvisoAtualizacao(null), 5000);
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#C4B5FD]/20 hover:bg-[#C4B5FD]/30 text-[#C4B5FD] border border-[#C4B5FD]/40 text-xs font-bold cursor-pointer disabled:opacity-60 shrink-0"
                    >
                      {avisoAtualizacao === "enviando" ? "Enviando…" : "Avisar"}
                    </button>
                  </div>
                  {avisoAtualizacao && avisoAtualizacao !== "enviando" && <p className="text-[11px] text-[#5EEAD4] mt-2">{avisoAtualizacao}</p>}
                </div>
              )}

              {/* Encerrar sala */}
              {onCloseRoomForAll && (
                <div>
                  {!confirmCloseRoom ? (
                    <button
                      type="button"
                      onClick={() => setConfirmCloseRoom(true)}
                      className="w-full py-3 rounded-2xl border border-[#F43F5E]/40 text-[#FB7185] text-xs font-bold hover:bg-[#F43F5E]/10 transition-colors cursor-pointer"
                    >
                      Encerrar sala para todos
                    </button>
                  ) : (
                    <div className="bg-[#F43F5E]/10 border border-[#F43F5E]/50 rounded-2xl p-3 space-y-2 text-center">
                      <p className="text-xs font-bold text-[#FECDD3]">Encerrar a sala e desconectar todo mundo?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmCloseRoom(false)}
                          className="flex-1 bg-[#2A2D35] hover:bg-[#383C47] text-[#ECECEC] text-xs py-2 rounded-xl cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => { onClose(); onCloseRoomForAll(); }}
                          className="flex-1 bg-[#F43F5E] hover:bg-[#E11D48] text-white font-bold text-xs py-2 rounded-xl cursor-pointer"
                        >
                          Sim, encerrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ))}
        </div>
      </aside>
    </div>
  );
};
