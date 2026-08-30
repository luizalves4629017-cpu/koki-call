import React, { useState, useEffect } from "react";
import { Participant, VipPermissions } from "../types";
import {
  ShieldAlert,
  Sparkles,
  Clock,
  CheckCircle2,
  X,
  Lock,
  Zap,
  Image,
  Film,
  UserCheck,
  AlertCircle,
  Crown,
} from "lucide-react";

interface GrantVipModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetParticipant: Participant | null;
  onGrantVip: (
    targetSocketId: string,
    permissions: {
      canUseGifAvatar: boolean;
      canUseVideoMp4Banner: boolean;
      canEditAdvancedProfile: boolean;
      hasVipBadge: boolean;
    },
    durationMinutes: number | null
  ) => void;
  onRevokeVip: (targetSocketId: string) => void;
}

const DURATION_OPTIONS = [
  { label: "5 Minutos (Teste Rápido)", value: 5 },
  { label: "15 Minutos", value: 15 },
  { label: "30 Minutos", value: 30 },
  { label: "1 Hora", value: 60 },
  { label: "6 Horas", value: 360 },
  { label: "24 Horas (1 Dia)", value: 1440 },
  { label: "Permanente (Até a sala encerrar)", value: null },
];

export const GrantVipModal: React.FC<GrantVipModalProps> = ({
  isOpen,
  onClose,
  targetParticipant,
  onGrantVip,
  onRevokeVip,
}) => {
  const [canUseGifAvatar, setCanUseGifAvatar] = useState(true);
  const [canUseVideoMp4Banner, setCanUseVideoMp4Banner] = useState(true);
  const [canEditAdvancedProfile, setCanEditAdvancedProfile] = useState(true);
  const [hasVipBadge, setHasVipBadge] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(30);
  const [remainingTimeText, setRemainingTimeText] = useState<string>("");

  useEffect(() => {
    if (targetParticipant?.vipPermissions) {
      setCanUseGifAvatar(targetParticipant.vipPermissions.canUseGifAvatar);
      setCanUseVideoMp4Banner(targetParticipant.vipPermissions.canUseVideoMp4Banner);
      setCanEditAdvancedProfile(targetParticipant.vipPermissions.canEditAdvancedProfile);
      setHasVipBadge(targetParticipant.vipPermissions.hasVipBadge);
    }
  }, [targetParticipant]);

  // Live countdown timer calculation
  useEffect(() => {
    if (!targetParticipant?.vipPermissions?.expiresAt) {
      setRemainingTimeText(
        targetParticipant?.vipPermissions ? "Permanente (sem expiração)" : ""
      );
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const expiresAt = targetParticipant.vipPermissions!.expiresAt!;
      const diffMs = expiresAt - now;

      if (diffMs <= 0) {
        setRemainingTimeText("Expirado");
      } else {
        const totalSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;

        if (hours > 0) {
          setRemainingTimeText(`${hours}h ${remMins}m ${secs}s`);
        } else {
          setRemainingTimeText(`${mins}m ${secs < 10 ? "0" : ""}${secs}s`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetParticipant?.vipPermissions]);

  if (!isOpen || !targetParticipant) return null;

  const isAlreadyVip = Boolean(targetParticipant.vipPermissions);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGrantVip(
      targetParticipant.id,
      {
        canUseGifAvatar,
        canUseVideoMp4Banner,
        canEditAdvancedProfile,
        hasVipBadge,
      },
      selectedDuration
    );
    onClose();
  };

  const handleRevoke = () => {
    if (window.confirm(`Deseja revogar as permissões VIP de ${targetParticipant.name}?`)) {
      onRevokeVip(targetParticipant.id);
      onClose();
    }
  };

  return (
    <div
      id="grant-vip-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header with decorative gradient */}
        <div className="relative p-5 bg-gradient-to-r from-purple-900/50 via-indigo-900/40 to-slate-900 border-b border-purple-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-inner">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Liberar Permissões VIP
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Exclusivo Dono
                </span>
              </div>
              <p className="text-xs text-purple-200/70">
                Conceda privilégios de GIF, MP4 e customização ao membro
              </p>
            </div>
          </div>

          <button
            id="close-grant-vip-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member preview & Current Status */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold shadow-md relative overflow-hidden"
                style={{ backgroundColor: targetParticipant.avatarColor || "#38bdf8" }}
              >
                {targetParticipant.avatarUrl ? (
                  <img
                    src={targetParticipant.avatarUrl}
                    alt={targetParticipant.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{targetParticipant.avatarEmoji || "🎮"}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">{targetParticipant.name}</span>
                  {targetParticipant.tag && (
                    <span className="text-xs text-slate-400 font-mono">
                      #{targetParticipant.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate max-w-[220px]">
                  {targetParticipant.customStatus || "Membro na chamada"}
                </p>
              </div>
            </div>

            {isAlreadyVip && (
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> VIP Ativo
                </span>
                {remainingTimeText && (
                  <p className="text-[11px] text-amber-400 font-mono mt-1 font-semibold flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" /> {remainingTimeText}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Permission Toggles */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-purple-400" /> Permissões a Liberar
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: GIF Photo */}
              <label
                id="toggle-vip-gif"
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  canUseGifAvatar
                    ? "bg-purple-950/40 border-purple-500/50 shadow-sm"
                    : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70"
                }`}
              >
                <input
                  type="checkbox"
                  checked={canUseGifAvatar}
                  onChange={(e) => setCanUseGifAvatar(e.target.checked)}
                  className="mt-1 rounded bg-slate-900 border-slate-600 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <Image className="w-3.5 h-3.5 text-purple-400" />
                    <span>Foto em GIF / Imagem</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Pode usar avatares animados em GIF ou fotos personalizadas.
                  </p>
                </div>
              </label>

              {/* Option 2: MP4 Video Banner */}
              <label
                id="toggle-vip-mp4"
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  canUseVideoMp4Banner
                    ? "bg-purple-950/40 border-purple-500/50 shadow-sm"
                    : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70"
                }`}
              >
                <input
                  type="checkbox"
                  checked={canUseVideoMp4Banner}
                  onChange={(e) => setCanUseVideoMp4Banner(e.target.checked)}
                  className="mt-1 rounded bg-slate-900 border-slate-600 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <Film className="w-3.5 h-3.5 text-pink-400" />
                    <span>Banner em Vídeo MP4</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Pode colocar banner em loop de vídeo MP4 ou GIF animado.
                  </p>
                </div>
              </label>

              {/* Option 3: Advanced Profile Edit */}
              <label
                id="toggle-vip-profile"
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  canEditAdvancedProfile
                    ? "bg-purple-950/40 border-purple-500/50 shadow-sm"
                    : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70"
                }`}
              >
                <input
                  type="checkbox"
                  checked={canEditAdvancedProfile}
                  onChange={(e) => setCanEditAdvancedProfile(e.target.checked)}
                  className="mt-1 rounded bg-slate-900 border-slate-600 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Editar Perfil Completo</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Libera edição de bio, status personalizado e cores do perfil.
                  </p>
                </div>
              </label>

              {/* Option 4: VIP Badge */}
              <label
                id="toggle-vip-badge"
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  hasVipBadge
                    ? "bg-purple-950/40 border-purple-500/50 shadow-sm"
                    : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70"
                }`}
              >
                <input
                  type="checkbox"
                  checked={hasVipBadge}
                  onChange={(e) => setHasVipBadge(e.target.checked)}
                  className="mt-1 rounded bg-slate-900 border-slate-600 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Insígnia VIP Nitro</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Exibe a insígnia oficial de VIP autorizada pelo Dono no perfil.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Time Duration Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Tempo de Duração (Expiração Automática)
            </label>
            <p className="text-xs text-slate-400">
              Quando o tempo acabar, as permissões serão revogadas automaticamente pelo sistema.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.label}
                  id={`duration-${opt.value ?? "perm"}`}
                  onClick={() => setSelectedDuration(opt.value)}
                  className={`px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                    selectedDuration === opt.value
                      ? "bg-purple-600 text-white border-purple-400 shadow-md font-bold"
                      : "bg-slate-800/60 text-slate-300 border-slate-700/60 hover:bg-slate-800"
                  }`}
                >
                  <span>{opt.label}</span>
                  {selectedDuration === opt.value && (
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            {isAlreadyVip ? (
              <button
                type="button"
                id="revoke-vip-btn"
                onClick={handleRevoke}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-colors"
              >
                Revogar VIP Agora
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="confirm-grant-vip-btn"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                {isAlreadyVip ? "Atualizar Permissões VIP" : "Conceder Permissões VIP ⚡"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
