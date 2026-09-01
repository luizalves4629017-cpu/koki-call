import React, { useState } from "react";
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
} from "lucide-react";
import { Participant, RoomState, KnockRequest } from "../types";

interface HostPanelModalProps {
  isOpen: boolean;
  room: RoomState;
  self: Participant;
  socket?: any;
  pendingKnocks?: KnockRequest[];
  onClose: () => void;
  onToggleLock: () => void;
  onMuteAll: () => void;
  onMuteUser: (userId: string) => void;
  onKickUser: (userId: string) => void;
  onUpdateSettings: (settings: Partial<RoomState["settings"]>) => void;
  onClaimHost?: (passcode: string) => void;
  onApproveKnock?: (socketId: string) => void;
  onRejectKnock?: (socketId: string) => void;
  onOpenAdmissionModal?: () => void;
  onCloseRoomForAll?: () => void;
  onGiveCoins?: (targetSocketId: string, amount: number) => void;
  onOpenGrantBadges?: (participant: Participant) => void;
}

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
  onKickUser,
  onUpdateSettings,
  onClaimHost,
  onApproveKnock,
  onRejectKnock,
  onOpenAdmissionModal,
  onCloseRoomForAll,
  onGiveCoins,
  onOpenGrantBadges,
}) => {
  const [claimPin, setClaimPin] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmCloseRoom, setConfirmCloseRoom] = useState(false);

  // Koki Coins direct transfer & moderation states
  const otherParticipants = room.participants.filter((p) => p.id !== self.id);
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

    // Call prop handler if supplied
    if (onGiveCoins) {
      onGiveCoins(targetId, amount);
    }

    // Direct socket emission
    if (socket) {
      socket.emit(
        "host:give-coins",
        {
          targetSocketId: targetId,
          amount,
          action: coinMode,
          roomId: room.roomId,
        },
        (res: { success: boolean; message?: string; newBalance?: number }) => {
          setIsSendingCoins(false);
          if (res && res.success) {
            setCoinFeedback({
              type: "success",
              message: res.message || (coinMode === "deduct"
                ? `-${rawNum.toLocaleString()} Koki Coins removidas de ${targetName}!`
                : `+${rawNum.toLocaleString()} Koki Coins enviadas para ${targetName}!`),
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
          ? `-${rawNum.toLocaleString()} Koki Coins removidas de ${targetName}!`
          : `+${rawNum.toLocaleString()} Koki Coins enviadas para ${targetName}!`,
      });
      setTimeout(() => setCoinFeedback(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0b101e] border border-[#22304c] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1b253b] bg-gradient-to-r from-amber-500/10 via-transparent to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Crown className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                Painel Master do Dono
              </h3>
              <p className="text-xs text-slate-400">
                Controle centralizado de sala e participantes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* If current user is not host, allow claiming with PIN */}
          {!self.isHost ? (
            <div className="bg-[#121a2d] border border-[#253550] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-medium">
                <Key className="w-4 h-4" />
                <span>Assumir como Dono / Master</span>
              </div>
              <p className="text-slate-400">
                Digite a senha master configurada na criação da sala para recuperar privilégios de anfitrião.
              </p>
              <form onSubmit={handleClaim} className="flex gap-2">
                <input
                  type="password"
                  placeholder="Senha / PIN Master"
                  value={claimPin}
                  onChange={(e) => setClaimPin(e.target.value)}
                  className="bg-[#090e1a] border border-[#253550] rounded-lg px-3 py-2 text-white text-xs w-full focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!claimPin}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors shrink-0"
                >
                  Entrar como Dono
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Quick Actions Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Lock Room Toggle */}
                <button
                  onClick={onToggleLock}
                  className={`p-3.5 rounded-xl border flex flex-col gap-1.5 text-left transition-all ${
                    room.isLocked
                      ? "bg-amber-950/40 border-amber-600/60 text-amber-200"
                      : "bg-[#121a2d] border-[#253550] text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      {room.isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
                      Trancar Sala
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${room.isLocked ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"}`}>
                      {room.isLocked ? "TRANCADA" : "ABERTA"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {room.isLocked ? "Nenhum novo participante pode entrar sem sua senha." : "Qualquer pessoa com o link pode entrar."}
                  </span>
                </button>

                {/* Mute All Button */}
                <button
                  onClick={onMuteAll}
                  className="p-3.5 rounded-xl bg-[#121a2d] border border-[#253550] hover:border-rose-500/50 hover:bg-rose-950/20 text-left transition-all group flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs flex items-center gap-1.5 text-slate-200 group-hover:text-rose-300">
                      <MicOff className="w-4 h-4 text-rose-400" />
                      Silenciar Todos
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Muta o microfone de todos os convidados de uma vez só.
                  </span>
                </button>
              </div>

              {/* Portaria / Knock Approval Settings */}
              <div className="bg-[#121a2d] border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="font-semibold text-white text-xs block">
                        Portaria: Exigir Permissão do Dono para Entrar
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {room.settings.requireKnockApproval
                          ? "Convidados aguardam na sala de espera até você autorizar"
                          : "Qualquer pessoa com o link entra imediatamente"}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={room.settings.requireKnockApproval}
                    onChange={(e) => onUpdateSettings({ requireKnockApproval: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                {pendingKnocks.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#1f2d47] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Aguardando Sua Liberação ({pendingKnocks.length})
                      </span>
                      {onOpenAdmissionModal && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenAdmissionModal();
                          }}
                          className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                        >
                          Ver Portaria Completa →
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {pendingKnocks.map((knock) => (
                        <div
                          key={knock.socketId}
                          className="flex items-center justify-between bg-[#0b101e] border border-[#1b253b] p-2 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shrink-0 overflow-hidden"
                              style={{ backgroundColor: knock.avatarColor || "#0284c7" }}
                            >
                              {knock.avatarUrl ? (
                                <img src={knock.avatarUrl} alt={knock.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{knock.avatarEmoji || "🎮"}</span>
                              )}
                            </div>
                            <span className="font-bold text-white text-xs truncate">
                              {knock.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {onRejectKnock && (
                              <button
                                onClick={() => onRejectKnock(knock.socketId)}
                                className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600/50 text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                              >
                                Recusar
                              </button>
                            )}
                            {onApproveKnock && (
                              <button
                                onClick={() => onApproveKnock(knock.socketId)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded transition-colors cursor-pointer"
                              >
                                Permitir Entrada
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Room Permissions */}
              <div className="bg-[#121a2d] border border-[#253550] rounded-xl p-4 space-y-3">
                <span className="font-semibold text-white text-xs block">
                  Permissões dos Convidados
                </span>

                <div className="flex items-center justify-between py-1.5 border-b border-[#1f2d47]">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="font-medium text-slate-200 block">Compartilhar Tela</span>
                      <span className="text-[10px] text-slate-400">Permitir transmissão de vídeo/janela</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={room.settings.allowScreenShare}
                    onChange={(e) => onUpdateSettings({ allowScreenShare: e.target.checked })}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#1f2d47]">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="font-medium text-slate-200 block">Câmera de Vídeo</span>
                      <span className="text-[10px] text-slate-400">Permitir webcam dos convidados</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={room.settings.allowVideo}
                    onChange={(e) => onUpdateSettings({ allowVideo: e.target.checked })}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Participant Moderation List */}
              <div className="bg-[#121a2d] border border-[#253550] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    Gerenciar Participantes ({room.participants.length})
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {room.participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-[#0b101e] border border-[#1b253b] p-2.5 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white"
                          style={{ backgroundColor: p.avatarColor }}
                        >
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-200">
                          {p.name} {p.id === self.id && "(Você)"}
                        </span>
                        {p.isHost && (
                          <span className="text-[10px] text-amber-400 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-800">
                            Host
                          </span>
                        )}
                      </div>

                      {p.id !== self.id && (
                        <div className="flex items-center gap-1">
                          {onOpenGrantBadges && (
                            <button
                              onClick={() => onOpenGrantBadges(p)}
                              className="p-1.5 rounded hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-colors"
                              title="Gerenciar Insígnias do participante"
                            >
                              <Award className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedCoinTarget(p.id);
                              setCoinFeedback(null);
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              selectedCoinTarget === p.id
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "hover:bg-slate-800 text-slate-300 hover:text-amber-300"
                            }`}
                            title="Selecionar para enviar Koki Coins"
                          >
                            <Coins className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onMuteUser(p.id)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
                            title="Silenciar participante"
                          >
                            <MicOff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onKickUser(p.id)}
                            className="p-1.5 rounded hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 transition-colors"
                            title="Desconectar da sala"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Send or Deduct Koki Coins (Master Moderation) */}
              <div className={`border rounded-xl p-4 space-y-3 shadow-lg transition-all ${
                coinMode === "deduct"
                  ? "bg-gradient-to-br from-[#201017] to-[#0c0810] border-rose-500/40"
                  : "bg-gradient-to-br from-[#131b2e] to-[#0c1322] border-amber-500/30"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${
                      coinMode === "deduct"
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    }`}>
                      <Coins className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-xs block">
                        Moderação de Koki Coins (Conceder ou Tirar)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {coinMode === "deduct"
                          ? "Remova moedas do participante selecionado instantaneamente"
                          : "Transfira moedas instantaneamente para qualquer membro da call"}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    coinMode === "deduct"
                      ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                      : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                  }`}>
                    Host Master
                  </span>
                </div>

                {/* Mode Selector Toggle: Adicionar vs Tirar Moedas */}
                <div className="grid grid-cols-2 gap-1.5 bg-[#080d18] p-1 rounded-xl border border-[#1b263b]">
                  <button
                    type="button"
                    onClick={() => {
                      setCoinMode("add");
                      setCoinFeedback(null);
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      coinMode === "add"
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-950/40"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>+ Conceder Moedas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCoinMode("deduct");
                      setCoinFeedback(null);
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      coinMode === "deduct"
                        ? "bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-md shadow-rose-950/40"
                        : "text-slate-400 hover:text-rose-300"
                    }`}
                  >
                    <span>- Tirar Moedas</span>
                  </button>
                </div>

                <form onSubmit={handleManageCoins} className="space-y-3 pt-1">
                  {/* Select Target Participant */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Participante Alvo:
                    </label>
                    <select
                      value={selectedCoinTarget}
                      onChange={(e) => {
                        setSelectedCoinTarget(e.target.value);
                        setCoinFeedback(null);
                      }}
                      className="w-full bg-[#080d1a] border border-[#22334f] text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
                    >
                      {room.participants.length === 0 ? (
                        <option value="">Nenhum participante na sala</option>
                      ) : (
                        room.participants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.id === self.id ? "(Você)" : ""} {p.isHost ? "👑" : ""} #{p.tag || "1024"} {p.kokiCoins !== undefined ? `(${p.kokiCoins} coins)` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Coin Amount Input & Quick Preset Buttons */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      {coinMode === "deduct" ? "Quantidade a Remover:" : "Quantidade a Conceder:"}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Coins className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                          coinMode === "deduct" ? "text-rose-400" : "text-amber-400"
                        }`} />
                        <input
                          type="number"
                          min="1"
                          max="1000000"
                          value={coinAmount}
                          onChange={(e) => setCoinAmount(e.target.value)}
                          placeholder="Ex: 500"
                          className={`w-full bg-[#080d1a] border text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none font-mono font-bold transition-colors ${
                            coinMode === "deduct"
                              ? "border-rose-500/40 text-rose-200 focus:border-rose-400"
                              : "border-[#22334f] text-amber-300 focus:border-amber-400"
                          }`}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSendingCoins || !selectedCoinTarget || !coinAmount}
                        className={`font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 ${
                          coinMode === "deduct"
                            ? "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white"
                            : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950"
                        }`}
                      >
                        {isSendingCoins ? (
                          <span>Processando...</span>
                        ) : coinMode === "deduct" ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Tirar Moedas</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Conceder Moedas</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] text-slate-400 mr-1">Atalhos:</span>
                      {["50", "100", "250", "500", "1000", "2500"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCoinAmount(preset)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer font-mono font-medium ${
                            coinAmount === preset
                              ? coinMode === "deduct"
                                ? "bg-rose-600 text-white border-rose-400 font-bold shadow-sm"
                                : "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm"
                              : "bg-[#090e1a] text-slate-300 border-[#22334f] hover:border-slate-500 hover:text-white"
                          }`}
                        >
                          {coinMode === "deduct" ? `-${preset}` : `+${preset}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback Status Alert */}
                  {coinFeedback && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
                        coinFeedback.type === "success"
                          ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
                          : "bg-rose-950/60 border-rose-500/50 text-rose-200"
                      }`}
                    >
                      {coinFeedback.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <UserX className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="font-medium text-[11px]">{coinFeedback.message}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* Quick Invite Link */}
              <div className="flex items-center justify-between bg-[#080d1a] border border-[#1f2d47] p-3 rounded-xl">
                <div className="truncate pr-2">
                  <span className="text-[10px] text-slate-400 block">Link de Convite para Convidados</span>
                  <span className="font-mono text-cyan-400 text-xs truncate block">
                    {window.location.origin}/?room={room.roomId}&role=guest
                  </span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? "Copiado!" : "Copiar"}
                </button>
              </div>

              {/* Danger Zone: End Call for Everyone (Host Only) */}
              {onCloseRoomForAll && (
                <div className="pt-3 border-t border-rose-950/60 space-y-2">
                  {!confirmCloseRoom ? (
                    <button
                      type="button"
                      onClick={() => setConfirmCloseRoom(true)}
                      className="w-full bg-rose-950/40 hover:bg-rose-900/60 border border-rose-600/50 text-rose-300 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserX className="w-4 h-4 text-rose-400" />
                      <span>Encerrar Sala para Todos os Participantes</span>
                    </button>
                  ) : (
                    <div className="bg-rose-950/80 border border-rose-500 rounded-xl p-3 space-y-2 text-center">
                      <p className="text-xs font-bold text-rose-200">
                        Tem certeza que deseja encerrar a sala e desconectar todos?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmCloseRoom(false)}
                          className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onCloseRoomForAll();
                          }}
                          className="w-1/2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Sim, Encerrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
