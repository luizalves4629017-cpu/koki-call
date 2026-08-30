import React, { useEffect } from "react";
import { KnockRequest } from "../types";
import { ShieldCheck, Check, UserX, Users, BellRing } from "lucide-react";

interface FloatingAdmissionBannerProps {
  pendingKnocks: KnockRequest[];
  onApprove: (socketId: string) => void;
  onReject: (socketId: string) => void;
  onOpenAdmissionModal: () => void;
}

export const FloatingAdmissionBanner: React.FC<FloatingAdmissionBannerProps> = ({
  pendingKnocks,
  onApprove,
  onReject,
  onOpenAdmissionModal,
}) => {
  // Play subtle chime sound when a new knock appears
  useEffect(() => {
    if (pendingKnocks.length > 0) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch {
        // audio context could be blocked if no user gesture
      }
    }
  }, [pendingKnocks.length]);

  if (pendingKnocks.length === 0) return null;

  const currentKnock = pendingKnocks[0];
  const otherKnocksCount = pendingKnocks.length - 1;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 pointer-events-none select-none animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="bg-[#0b1120]/95 border-2 border-amber-500/80 rounded-2xl shadow-2xl shadow-amber-950/60 p-3 pointer-events-auto backdrop-blur-md flex items-center justify-between gap-3 ring-4 ring-amber-500/20">
        {/* Left: Avatar + Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white overflow-hidden shadow-sm"
              style={{ backgroundColor: currentKnock.avatarColor || "#0284c7" }}
            >
              {currentKnock.avatarUrl ? (
                <img
                  src={currentKnock.avatarUrl}
                  alt={currentKnock.name}
                  className="w-full h-full object-cover"
                />
              ) : currentKnock.avatarEmoji ? (
                <span className="text-base">{currentKnock.avatarEmoji}</span>
              ) : (
                currentKnock.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-[#0b1120] rounded-full animate-ping" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-mono">
                Portaria
              </span>
              <span className="text-xs font-bold text-white truncate">
                {currentKnock.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                #{currentKnock.tag}
              </span>
            </div>
            <p className="text-[11px] text-amber-200/90 truncate flex items-center gap-1">
              <BellRing className="w-3 h-3 text-amber-400 shrink-0" />
              Solicitando permissão para entrar na chamada
            </p>
          </div>
        </div>

        {/* Right: Decision Buttons (For Owner) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {otherKnocksCount > 0 && (
            <button
              type="button"
              onClick={onOpenAdmissionModal}
              className="bg-[#141f36] hover:bg-[#1a2947] text-amber-300 border border-amber-500/40 text-[11px] font-bold px-2 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              title="Ver todas as solicitações pendentes"
            >
              <Users className="w-3 h-3" />
              <span>+{otherKnocksCount}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onReject(currentKnock.socketId)}
            className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600/50 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
            title="Recusar entrada"
          >
            <UserX className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Recusar</span>
          </button>

          <button
            type="button"
            onClick={() => onApprove(currentKnock.socketId)}
            className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-black px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/50 cursor-pointer animate-pulse"
            title="Permitir entrada agora"
          >
            <Check className="w-4 h-4 text-white font-bold" />
            <span>Permitir Entrada</span>
          </button>
        </div>
      </div>
    </div>
  );
};
