import React, { useState, useEffect } from "react";
import {
  Mic,
  MicOff,
  Headphones,
  Settings,
  Edit3,
  Check,
  Crown,
  Coins,
} from "lucide-react";
import { Participant, SavedUserProfile } from "../types";
import { getKokiCoins, formatCoinDisplay } from "../utils/storage";

interface SelfProfileBarProps {
  self: Participant;
  isAudioMuted: boolean;
  isDeafened: boolean;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onOpenSettings: () => void;
  onOpenSelfProfile: () => void;
  onOpenStore?: () => void;
}

export const SelfProfileBar: React.FC<SelfProfileBarProps> = ({
  self,
  isAudioMuted,
  isDeafened,
  onToggleMic,
  onToggleDeafen,
  onOpenSettings,
  onOpenSelfProfile,
  onOpenStore,
}) => {
  const isSpeaking = !isAudioMuted && (self.audioLevel || 0) > 15;
  const [coins, setCoins] = useState<number>(() => getKokiCoins());

  useEffect(() => {
    const handleCoins = (e: any) => {
      if (e?.detail?.coins !== undefined) setCoins(e.detail.coins);
    };
    window.addEventListener("koki_coins_updated", handleCoins);
    return () => window.removeEventListener("koki_coins_updated", handleCoins);
  }, []);

  return (
    <div className="h-14 bg-[#070b14] border-t border-[#1b253b] px-3 flex items-center justify-between select-none">
      {/* Clickable Profile Area */}
      <button
        onClick={onOpenSelfProfile}
        className="flex items-center gap-2.5 p-1 -ml-1 rounded-xl hover:bg-[#121a2d] transition-all text-left max-w-[180px] sm:max-w-[200px]"
        title="Clique para ver ou editar seu perfil"
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow-md transition-all ${
              isSpeaking
                ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#070b14]"
                : "ring-1 ring-white/10"
            }`}
            style={{ backgroundColor: self.avatarColor || "#38bdf8" }}
          >
            {self.avatarEmoji || (self.isHost ? "👑" : "🎮")}
          </div>

          {/* Status Dot */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#070b14] ${
              isSpeaking
                ? "bg-emerald-400"
                : isDeafened
                ? "bg-rose-500"
                : isAudioMuted
                ? "bg-slate-500"
                : "bg-emerald-500"
            }`}
          />
        </div>

        {/* Name & Tag / Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-white truncate">
              {self.name}
            </span>
            {self.tag === "0001" || self.badges?.includes("owner_supreme") ? (
              <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-500/40 px-1 rounded flex items-center gap-0.5 shrink-0">
                <Crown className="w-2.5 h-2.5 text-amber-400 fill-current" />
                <span>#0001</span>
              </span>
            ) : (
              <span className="text-[9px] font-mono text-slate-500 shrink-0">
                #{self.tag || "1024"}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 truncate">
            {self.customTitle ? `[${self.customTitle}]` : (self.customStatus || "🟢 Conectado")}
          </p>
        </div>
      </button>

      {/* Quick Audio / Deafen / Store / Settings Controls */}
      <div className="flex items-center gap-1 text-slate-400">
        {onOpenStore && (
          <button
            onClick={onOpenStore}
            className="p-2 rounded-lg text-amber-400 hover:bg-amber-950/40 hover:text-amber-300 transition-colors"
            title={`Loja Koki Coins (${formatCoinDisplay(coins, self.isHost)} Coins)`}
          >
            <Coins className="w-4 h-4 fill-amber-400/20" />
          </button>
        )}

        <button
          onClick={onToggleMic}
          className={`p-2 rounded-lg transition-colors ${
            isAudioMuted
              ? "bg-rose-950/50 text-rose-400 border border-rose-800/40 hover:bg-rose-900/60"
              : "hover:bg-[#151f33] hover:text-white"
          }`}
          title={isAudioMuted ? "Desmutar microfone (Ctrl+M)" : "Mutar microfone (Ctrl+M)"}
        >
          {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <button
          onClick={onToggleDeafen}
          className={`p-2 rounded-lg transition-colors ${
            isDeafened
              ? "bg-rose-950/50 text-rose-400 border border-rose-800/40 hover:bg-rose-900/60"
              : "hover:bg-[#151f33] hover:text-white"
          }`}
          title={isDeafened ? "Ativar áudio de todos" : "Ensurdecer (Desativar áudio da chamada)"}
        >
          <Headphones className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg hover:bg-[#151f33] hover:text-white transition-colors"
          title="Configurações de Áudio & Vídeo"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
