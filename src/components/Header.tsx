import React, { useState } from "react";
import { 
  Users, 
  Crown, 
  Share2, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Cpu, 
  Signal, 
  Copy, 
  Check, 
  Camera,
  UserCheck,
  BellRing,
  Home,
  LogOut,
  Coins,
  Sparkles,
  Hash,
  PanelLeft,
} from "lucide-react";
import { Participant, RoomState } from "../types";
import { getEffectiveInviteUrl } from "../utils/inviteUrl";
import { copyToClipboardSafe } from "../utils/clipboard";
import { getKokiCoins, formatCoinDisplay } from "../utils/storage";

interface HeaderProps {
  room: RoomState;
  self: Participant;
  isMaster?: boolean;
  hasVipBadge?: boolean;
  lowResourceMode: boolean;
  pingMs: number;
  pendingKnocksCount?: number;
  kokiCoins?: number;
  onOpenStore?: () => void;
  onOpenInvite: () => void;
  onOpenHostPanel: () => void;
  onOpenAdmissionModal?: () => void;
  onOpenSecurityAudit?: () => void;
  onOpenOwnerProfile?: () => void;
  isChannelsOpen?: boolean;
  onToggleChannels?: () => void;
  onToggleLowResource: () => void;
  onLeaveRoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  self,
  isMaster = false,
  hasVipBadge = false,
  lowResourceMode,
  pingMs,
  pendingKnocksCount = 0,
  kokiCoins,
  isChannelsOpen,
  onToggleChannels,
  onOpenStore,
  onOpenInvite,
  onOpenHostPanel,
  onOpenAdmissionModal,
  onOpenSecurityAudit,
  onOpenOwnerProfile,
  onToggleLowResource,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const currentCoins = typeof kokiCoins === "number" ? kokiCoins : getKokiCoins();

  // Strict check: Only show top Master control buttons for Master owner (hidden for guests)
  const isUserMaster = Boolean(isMaster);
  const showMasterActionBar = isUserMaster;

  const handleCopyLink = async () => {
    const inviteUrl = getEffectiveInviteUrl(room.roomId);
    await copyToClipboardSafe(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInvite = async () => {
    const inviteUrl = getEffectiveInviteUrl(room.roomId);
    await copyToClipboardSafe(inviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  return (
    <header className="h-14 bg-[#080d19] border-b border-[#1b253b] px-3 sm:px-4 flex items-center justify-between select-none">
      {/* Left: Brand, Home / Leave Button & Room Info */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Back to Home / Lobby Button */}
        {onLeaveRoom && (
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 bg-[#121a2d] hover:bg-rose-950/70 text-slate-300 hover:text-rose-200 border border-[#202f4a] hover:border-rose-500/50 text-xs px-2.5 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer group"
            title="Voltar para o Menu Inicial do App (Sair da Sala)"
          >
            <Home className="w-4 h-4 text-cyan-400 group-hover:text-rose-300 transition-colors" />
            <span className="font-semibold hidden md:inline">Menu Inicial</span>
          </button>
        )}

        {/* Toggle Discord Channels Sidebar */}
        {onToggleChannels && (
          <button
            onClick={onToggleChannels}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer border ${
              isChannelsOpen
                ? "bg-indigo-950/70 border-indigo-500/50 text-indigo-300 shadow-indigo-950/50"
                : "bg-[#121a2d] hover:bg-[#1a253d] border-[#202f4a] text-slate-300 hover:text-white"
            }`}
            title="Alternar Canais do Discord"
          >
            <PanelLeft className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold hidden xl:inline">Canais</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 flex items-center justify-center font-black text-white shadow-md shadow-cyan-500/20 text-sm">
            K
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-wide text-xs sm:text-sm truncate max-w-[140px] sm:max-w-xs">
                {room.roomName}
              </span>
              {room.isLocked ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-950/40 border border-amber-800/60 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" /> Trancada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                  <Unlock className="w-2.5 h-2.5" /> Aberta
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-[11px] text-slate-400">ID: {room.roomId}</span>
              <span>•</span>
              <button
                onClick={handleCopyLink}
                className="hover:text-cyan-400 flex items-center gap-1 transition-colors text-[11px] cursor-pointer"
                title="Copiar link de convite"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copiado!" : "Copiar Link"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Center: System badges (Stats & Low Resource) */}
      <div className="hidden lg:flex items-center gap-2.5">
        {/* Security Shield Active badge */}
        {onOpenSecurityAudit && (
          <button
            onClick={onOpenSecurityAudit}
            className="flex items-center gap-1.5 bg-[#0e1627] hover:bg-[#152038] border border-emerald-500/40 px-2.5 py-1 rounded-full text-xs text-emerald-300 transition-all cursor-pointer shadow-sm"
            title="Koki Shield: Proteção contra vírus, invasões e controle de acesso"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium">Koki Shield Ativo</span>
          </button>
        )}

        {/* Participants count */}
        <div className="flex items-center gap-1.5 bg-[#0f172a] border border-[#1e293b] px-2.5 py-1 rounded-full text-xs text-slate-300">
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          <span>{room.participants.length} conectados</span>
        </div>

        {/* Low Resource Mode switch */}
        <button
          onClick={onToggleLowResource}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
            lowResourceMode
              ? "bg-cyan-950/50 border-cyan-500/60 text-cyan-300 shadow-sm shadow-cyan-500/10"
              : "bg-[#0f172a] border-[#1e293b] text-slate-400 hover:text-slate-200"
          }`}
          title="Modo Baixo Consumo: Economiza CPU e memória RAM para jogos"
        >
          <Cpu className={`w-3.5 h-3.5 ${lowResourceMode ? "text-cyan-400" : "text-slate-400"}`} />
          <span>Modo Gamer: {lowResourceMode ? "ON" : "OFF"}</span>
        </button>

        {/* Latency meter */}
        <div className="flex items-center gap-1 text-xs text-slate-400 bg-[#0f172a] border border-[#1e293b] px-2 py-1 rounded-full">
          <Signal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono text-[11px] text-emerald-400">{pingMs}ms</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Koki Coins & Store Access */}
        {onOpenStore && (
          <button
            onClick={onOpenStore}
            className="flex items-center gap-1.5 bg-[#0e1628] hover:bg-[#16233d] border border-amber-500/50 hover:border-amber-400 text-amber-300 px-3 py-1.5 rounded-xl transition-all shadow-md shadow-amber-950/40 cursor-pointer group"
            title="Loja Koki Coins: Comprar avatares animados GIF, banners MP4, títulos e cargo VIP"
          >
            <Coins className="w-4 h-4 text-amber-400 fill-amber-400/40 group-hover:scale-110 transition-transform" />
            <span className="font-mono font-bold text-xs">{formatCoinDisplay(currentCoins, self.isHost)}</span>
            <span className="text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 hidden sm:inline">
              Loja
            </span>
          </button>
        )}

        {/* Master & VIP Exclusive Action Bar: Permitir Entrada, Vídeo MP4 & GIF, Painel Master */}
        {showMasterActionBar && (
          <>
            {/* Permitir Entrada / Portaria */}
            {onOpenAdmissionModal && (
              <button
                onClick={onOpenAdmissionModal}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer font-bold relative ${
                  pendingKnocksCount > 0
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 ring-2 ring-amber-400/50 shadow-amber-950/60 animate-pulse"
                    : "bg-[#141e33] hover:bg-[#1a2947] text-amber-300 border border-amber-500/40"
                }`}
                title="Portaria da Chamada: Permitir ou recusar entrada de pessoas"
              >
                {pendingKnocksCount > 0 ? (
                  <BellRing className="w-3.5 h-3.5 animate-bounce" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span className="hidden sm:inline">Permitir Entrada</span>
                {pendingKnocksCount > 0 && (
                  <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-amber-400">
                    {pendingKnocksCount}
                  </span>
                )}
              </button>
            )}

            {/* Vídeo MP4 & GIF */}
            {onOpenOwnerProfile && (
              <button
                onClick={onOpenOwnerProfile}
                className="flex items-center gap-1.5 bg-[#121b2d] hover:bg-[#1a2742] text-amber-300 border border-amber-500/40 text-xs px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
                title="Editar Foto, Vídeos MP4, GIFs Animados e Perfil do Dono"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-medium hidden md:inline">Vídeo MP4 & GIF</span>
              </button>
            )}

            {/* Painel Master */}
            {onOpenHostPanel && (
              <button
                onClick={onOpenHostPanel}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border border-amber-500/40 text-xs px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-medium hidden sm:inline">Painel Master</span>
              </button>
            )}
          </>
        )}

        <button
          id="btn-header-invite"
          onClick={handleCopyInvite}
          className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-md cursor-pointer ${
            inviteCopied
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950"
              : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950"
          }`}
          title={`Copiar URL da sala (?room=${room.roomId})`}
        >
          {inviteCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{inviteCopied ? "Link Copiado!" : "Convidar"}</span>
        </button>

        {onLeaveRoom && (
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-rose-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
            title="Sair da Chamada"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        )}
      </div>
    </header>
  );
};
