import React, { useState, useEffect } from "react";
import {
  X,
  Crown,
  User,
  Volume2,
  VolumeX,
  MicOff,
  UserX,
  Clock,
  Sparkles,
  Shield,
  ShieldCheck,
  Edit3,
  Camera,
  Zap,
  Gem,
  Film,
  Image as ImageIcon,
  Coins,
  Award,
} from "lucide-react";
import { Participant } from "../types";
import { isVideoMedia, isPerkActive, getPerkRemainingTime, getKokiCoins, isMasterIdentity, formatCoinDisplay } from "../utils/storage";
import { BadgeList } from "./BadgeList";

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
  onGiveCoins?: (targetSocketId: string, amount: number) => void;
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
  onGiveCoins,
  onClose,
}) => {
  const minutesConnected = Math.max(1, Math.floor((Date.now() - participant.joinedAt) / 60000));
  const hasVip = Boolean(participant.vipPermissions) || Boolean(participant.badges?.includes("vip_role")) || Boolean(participant.badges?.includes("vip_granted"));
  const [vipCountdown, setVipCountdown] = useState<string>("");
  const isMasterUser = participant.tag === "0001" || Boolean(participant.badges?.includes("owner_supreme")) || isMasterIdentity(participant.name);
  const coins = isSelf ? (typeof participant.kokiCoins === "number" ? participant.kokiCoins : getKokiCoins()) : participant.kokiCoins;

  const [coinMode, setCoinMode] = useState<"add" | "deduct">("add");
  const [coinAmount, setCoinAmount] = useState<number | string>(50);
  const [coinSuccessMsg, setCoinSuccessMsg] = useState<string | null>(null);

  const handleGrantCoins = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = typeof coinAmount === "number" ? coinAmount : parseInt(coinAmount, 10);
    if (!raw || isNaN(raw) || raw <= 0) return;
    const amount = coinMode === "deduct" ? -raw : raw;
    if (onGiveCoins) {
      onGiveCoins(participant.id, amount);
      if (coinMode === "deduct") {
        setCoinSuccessMsg(`-${raw} Koki Coins removidos de ${participant.name}! 💸`);
      } else {
        setCoinSuccessMsg(`+${raw} Koki Coins enviados para ${participant.name}! 🪙`);
      }
      setTimeout(() => setCoinSuccessMsg(null), 3500);
    }
  };

  useEffect(() => {
    if (!participant.vipPermissions?.expiresAt) {
      if (hasVip) setVipCountdown("Permanente");
      return;
    }

    const updateTimer = () => {
      const diffMs = participant.vipPermissions!.expiresAt! - Date.now();
      if (diffMs <= 0) {
        setVipCountdown("Expirado");
      } else {
        const totalSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;

        if (hours > 0) {
          setVipCountdown(`${hours}h ${remMins}m ${secs}s`);
        } else {
          setVipCountdown(`${mins}m ${secs < 10 ? "0" : ""}${secs}s`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [participant.vipPermissions, hasVip]);

  const canHaveMediaBanner = participant.isHost || hasVip || Boolean(participant.bannerUrl);

  return (
    <div
      id={`user-profile-card-${participant.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div
        className={`w-full max-w-sm bg-[#0d1220] rounded-2xl shadow-2xl overflow-hidden text-slate-100 relative ${
          isMasterUser
            ? "border-2 border-[#FFD700] golden-neon-glow"
            : hasVip
            ? "border border-purple-500/40 shadow-purple-950/30"
            : "border border-[#223354]"
        }`}
      >
        {/* Close Button */}
        <button
          id="close-profile-card-btn"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Banner: Owner or VIP gets custom banner, Guests get subtle dark gradient */}
        {canHaveMediaBanner ? (
          <div
            className="h-28 w-full relative bg-cover bg-center overflow-hidden"
            style={{
              backgroundColor: participant.bannerColor || (participant.isHost ? "#1e293b" : "#3b0764"),
              backgroundImage:
                participant.bannerUrl && !isVideoMedia(participant.bannerUrl)
                  ? `url(${participant.bannerUrl})`
                  : !participant.bannerUrl
                  ? participant.isHost
                    ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
                    : "linear-gradient(135deg, #3b0764 0%, #1e1b4b 100%)"
                  : undefined,
            }}
          >
            {/* If video banner (MP4 / WebM) */}
            {participant.bannerUrl && isVideoMedia(participant.bannerUrl) && (
              <video
                src={participant.bannerUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover absolute inset-0 pointer-events-none"
              />
            )}

            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
              {participant.isHost ? (
                <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider text-amber-300 uppercase flex items-center gap-1.5 border border-amber-500/40 shadow-md">
                  <Crown className="w-3 h-3 text-amber-400 fill-amber-400/40" />
                  <span>Dono Master</span>
                </div>
              ) : (
                <div className="bg-purple-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider text-purple-200 uppercase flex items-center gap-1.5 border border-purple-500/40 shadow-md">
                  <Gem className="w-3 h-3 text-purple-400 fill-purple-400/40" />
                  <span>Membro VIP</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-16 w-full bg-gradient-to-r from-[#0b1324] to-[#111c34] relative border-b border-[#1b253b]">
            <div className="absolute top-3 left-3 bg-black/40 px-2 py-0.5 rounded-full text-[10px] font-medium text-cyan-300 uppercase flex items-center gap-1 border border-cyan-500/20">
              <User className="w-3 h-3 text-cyan-400" />
              <span>Convidado</span>
            </div>
          </div>
        )}

        {/* Profile Info Container */}
        <div className="px-5 pb-5 pt-0 relative">
          {/* Large Avatar */}
          <div className={`relative ${canHaveMediaBanner ? "-mt-12" : "-mt-8"} mb-2.5 inline-block`}>
            <div
              className={`rounded-full flex items-center justify-center font-bold shadow-2xl ring-4 ring-[#0d1220] overflow-hidden ${
                participant.isHost
                  ? "w-20 h-20 text-3xl ring-amber-500/50"
                  : hasVip
                  ? "w-20 h-20 text-2xl ring-purple-500/50"
                  : "w-16 h-16 text-xl bg-[#131c2e] text-slate-200 border border-[#202e48]"
              }`}
              style={{
                backgroundColor: participant.avatarColor || (participant.isHost ? "#f59e0b" : "#162032"),
              }}
            >
              {participant.avatarUrl ? (
                <img
                  src={participant.avatarUrl}
                  alt={participant.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : participant.avatarEmoji ? (
                <span>{participant.avatarEmoji}</span>
              ) : (
                <span className="font-mono">{participant.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>

            {/* Speaking / Audio Status Badge */}
            <div
              className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-[#0d1220] flex items-center justify-center ${
                participant.hasAudio && (participant.audioLevel || 0) > 15
                  ? "bg-emerald-400 animate-pulse"
                  : participant.isDeafened
                  ? "bg-rose-500"
                  : !participant.hasAudio
                  ? "bg-slate-500"
                  : "bg-emerald-500"
              }`}
              title={
                participant.isDeafened
                  ? "Ensurdecido"
                  : !participant.hasAudio
                  ? "Microfone desligado"
                  : "Conectado"
              }
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
            </div>
          </div>

          {/* User Display Name, Custom Title & Tag */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-lg font-black text-white tracking-tight truncate">
              {participant.name}
            </h2>
            {participant.tag === "0001" || participant.badges?.includes("owner_supreme") ? (
              <span className="text-[11px] font-bold font-mono text-amber-300 bg-amber-950/80 border border-amber-500/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                <Crown className="w-3 h-3 text-amber-400 fill-current" />
                <span>#0001</span>
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400 font-mono">
                #{participant.tag || "1024"}
              </span>
            )}

            {/* Custom Title Badge if active */}
            {participant.customTitle && (
              <span className="text-[10px] font-extrabold uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                <Award className="w-3 h-3 text-cyan-400" />
                <span>[{participant.customTitle}]</span>
              </span>
            )}
          </div>

          {/* Coins balance */}
          <div className="mt-1.5 inline-flex items-center gap-1.5 bg-[#0a101d] border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs">
            <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400/40" />
            <span className="font-mono font-bold text-amber-300">
              {isMasterUser ? "∞" : (typeof coins === "number" ? coins.toLocaleString() : "0")}
            </span>
            <span className="text-[10px] text-amber-400/80">Koki Coins</span>
          </div>

          {/* Role Badges & Equipped Insignias */}
          <div className="mt-2 space-y-2">
            {/* Equipped Badges */}
            <BadgeList
              badgeIds={participant.badges}
              isHost={participant.isHost}
              size="sm"
              showLabels={true}
              maxVisible={8}
            />

            {/* VIP Status countdown if active */}
            {hasVip && (
              <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-purple-300">
                  <Gem className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  <span>VIP Concedido pelo Dono</span>
                </div>
                {vipCountdown && (
                  <span className="font-mono text-[11px] text-amber-300 font-bold bg-purple-900/50 px-2 py-0.5 rounded-md border border-purple-500/40 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {vipCountdown}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Profile Edit Button for Self (Owner or VIP) */}
          {isSelf && (participant.isHost || hasVip) && onOpenOwnerProfileEditor && (
            <div className="mt-3">
              <button
                id="open-profile-editor-btn"
                onClick={() => {
                  onClose();
                  onOpenOwnerProfileEditor();
                }}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                  participant.isHost
                    ? "bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border border-amber-500/40"
                    : "bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-300 border border-purple-500/40"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>
                  {participant.isHost
                    ? "Editar Perfil do Dono (Foto, Vídeo MP4 & Insígnias)"
                    : "Personalizar Perfil VIP (GIF / MP4 / Insígnias)"}
                </span>
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-[#202e48] my-3" />

          {/* Custom Status */}
          <div className="mb-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Status Atual
            </div>
            <p className="text-xs text-slate-200 bg-[#121a2d] border border-[#202e48] rounded-xl px-3 py-1.5">
              {participant.customStatus || "🟢 Conectado na Call"}
            </p>
          </div>

          {/* About Me / Bio */}
          <div className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Biografia
            </div>
            <p className="text-xs text-slate-300 bg-[#121a2d] border border-[#202e48] rounded-xl px-3 py-1.5">
              {participant.bio || "Nenhuma descrição informada."}
            </p>
          </div>

          {/* Connected Time */}
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3 bg-[#121a2d]/60 px-3 py-1.5 rounded-xl border border-[#202e48]">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Na chamada há <strong>{minutesConnected} min</strong></span>
          </div>

          {/* Individual User Volume Control (for remote users) */}
          {!isSelf && (
            <div className="bg-[#121a2d] border border-[#202e48] rounded-xl p-2.5 mb-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  Volume do Participante
                </span>
                <span className="font-mono text-cyan-400 font-bold">{userVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={userVolume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-full h-1.5 bg-[#202e48] rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          )}

          {/* Host Master Actions & Grant VIP Button */}
          {isHostViewer && !isSelf && (
            <div className="pt-2 border-t border-[#202e48] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-400" />
                  <span>Moderação do Dono</span>
                </div>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded">
                  Moedas: ∞
                </span>
              </div>

              {/* Grant / Send / Deduct Koki Coins to Participant */}
              <div className={`border rounded-xl p-3 space-y-2 transition-all ${
                coinMode === "deduct"
                  ? "bg-[#180a10] border-rose-500/40"
                  : "bg-[#0b111e] border-amber-500/40"
              }`}>
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-bold flex items-center gap-1.5 ${
                    coinMode === "deduct" ? "text-rose-300" : "text-amber-300"
                  }`}>
                    <Coins className="w-3.5 h-3.5 fill-current" />
                    {coinMode === "deduct" ? "Tirar / Remover Moedas" : "Conceder Koki Coins"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCoinMode("add")}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                        coinMode === "add"
                          ? "bg-amber-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      + Dar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoinMode("deduct")}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                        coinMode === "deduct"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-rose-300"
                      }`}
                    >
                      - Tirar
                    </button>
                  </div>
                </div>

                {coinSuccessMsg && (
                  <div className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${
                    coinMode === "deduct"
                      ? "text-rose-300 bg-rose-950/70 border-rose-500/40"
                      : "text-emerald-400 bg-emerald-950/70 border-emerald-500/40"
                  }`}>
                    {coinSuccessMsg}
                  </div>
                )}

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[50, 100, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCoinAmount(preset)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        coinAmount === preset
                          ? coinMode === "deduct"
                            ? "bg-rose-600 text-white border-rose-400 shadow-sm font-black"
                            : "bg-amber-500 text-slate-950 border-amber-400 shadow-sm shadow-amber-500/30 font-black"
                          : "bg-[#141e33] text-slate-300 border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      {coinMode === "deduct" ? `-${preset}` : `+${preset}`}
                    </button>
                  ))}
                </div>

                {/* Amount Input & Send/Deduct Button */}
                <form onSubmit={handleGrantCoins} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Coins className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${
                      coinMode === "deduct" ? "text-rose-400" : "text-amber-400"
                    }`} />
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      value={coinAmount}
                      onChange={(e) => setCoinAmount(e.target.value)}
                      placeholder="Qtd (ex: 50)"
                      className={`w-full bg-[#080d18] text-xs pl-8 pr-2 py-1.5 rounded-lg focus:outline-none font-mono font-bold border ${
                        coinMode === "deduct"
                          ? "border-rose-500/40 text-rose-200 focus:border-rose-400"
                          : "border-amber-500/40 text-amber-200 focus:border-amber-400"
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    className={`font-black text-xs px-3 py-1.5 rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1 shrink-0 ${
                      coinMode === "deduct"
                        ? "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-950/60"
                        : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-950/60"
                    }`}
                  >
                    <span>{coinMode === "deduct" ? "Tirar" : "Enviar"}</span>
                    <Coins className="w-3 h-3 fill-current" />
                  </button>
                </form>
              </div>

              {/* Special VIP Grant / Manage Button for the Owner */}
              {onOpenGrantVip && (
                <button
                  id={`grant-vip-btn-${participant.id}`}
                  onClick={() => onOpenGrantVip(participant)}
                  className="w-full bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-purple-600/30 hover:from-purple-600/40 hover:to-indigo-600/40 text-purple-200 border border-purple-500/50 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span>{hasVip ? "Gerenciar / Estender VIP do Membro ⚡" : "Liberar Permissões VIP & Tempo ⚡"}</span>
                </button>
              )}

              {/* Master Insignias / Badges Assignment Button */}
              {onOpenGrantBadges && (
                <button
                  id={`grant-badges-btn-${participant.id}`}
                  onClick={() => onOpenGrantBadges(participant)}
                  className="w-full bg-gradient-to-r from-amber-600/25 via-yellow-600/25 to-amber-600/25 hover:from-amber-600/35 hover:to-yellow-600/35 text-amber-200 border border-amber-500/40 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Atribuir / Gerenciar Insígnias 🎖️</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onMuteParticipant?.(participant.id)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 px-3 rounded-xl font-medium flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                >
                  <MicOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mutar</span>
                </button>
                <button
                  onClick={() => onKickParticipant?.(participant.id)}
                  className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs py-2 px-3 rounded-xl font-medium flex items-center justify-center gap-1.5 border border-rose-800/50 transition-colors cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5 text-rose-400" />
                  <span>Expulsar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
