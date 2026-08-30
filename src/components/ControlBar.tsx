import React, { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Headphones,
  MessageSquare,
  Settings,
  PhoneOff,
  Crown,
  Volume2,
  Volume1,
  VolumeX,
  Users,
  UserCheck,
  BellRing,
  ChevronUp,
  Sparkles,
  Check,
} from "lucide-react";
import { Participant } from "../types";
import {
  ScreenSharePresetId,
  SCREEN_SHARE_PRESETS,
  DEFAULT_SCREEN_PRESET_ID,
} from "../utils/screenShareConfig";

interface ControlBarProps {
  self: Participant;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  isChatOpen: boolean;
  isMemberListOpen: boolean;
  unreadChatCount: number;
  lowResourceMode: boolean;
  allowScreenShare: boolean;
  masterVoiceVolume: number;
  screenQualityPreset?: ScreenSharePresetId;
  pendingKnocksCount?: number;
  onVolumeChange: (newVol: number) => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onChangeScreenQuality?: (preset: ScreenSharePresetId) => void;
  onToggleDeafen: () => void;
  onToggleChat: () => void;
  onToggleMemberList: () => void;
  onToggleLowResource: () => void;
  onOpenSettings: () => void;
  onOpenHostPanel: () => void;
  onOpenAdmissionModal?: () => void;
  onLeaveCall: () => void;
  onOpenSelfProfile: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  self,
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  isDeafened,
  isChatOpen,
  isMemberListOpen,
  unreadChatCount,
  lowResourceMode,
  allowScreenShare,
  masterVoiceVolume,
  screenQualityPreset = DEFAULT_SCREEN_PRESET_ID,
  pendingKnocksCount = 0,
  onVolumeChange,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onChangeScreenQuality,
  onToggleDeafen,
  onToggleChat,
  onToggleMemberList,
  onToggleLowResource,
  onOpenSettings,
  onOpenHostPanel,
  onOpenAdmissionModal,
  onLeaveCall,
  onOpenSelfProfile,
}) => {
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [showScreenQualityMenu, setShowScreenQualityMenu] = useState(false);

  return (
    <div className="h-18 bg-[#080d1a] border-t border-[#1b253b] px-3 sm:px-4 flex items-center justify-between z-20 select-none">
      {/* Left: User Quick Status Info (Clickable for Discord Profile) */}
      <button
        onClick={onOpenSelfProfile}
        className="flex items-center gap-2.5 p-1 -ml-1 rounded-xl hover:bg-[#131b2c] transition-all text-left max-w-[160px] sm:max-w-[200px]"
        title={self.isHost ? "Seu Perfil do Dono (Clique para editar)" : "Seu Perfil de Convidado"}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md text-base shrink-0 ring-1 ring-white/10 overflow-hidden"
          style={{
            backgroundColor: self.avatarColor || "#0284c7",
          }}
        >
          {self.avatarUrl ? (
            <img
              src={self.avatarUrl}
              alt={self.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{self.avatarEmoji || (self.isHost ? "👑" : "🎮")}</span>
          )}
        </div>
        <div className="flex flex-col truncate">
          <span className="text-xs font-bold text-white truncate flex items-center gap-1">
            {self.name}
            {self.isHost && <Crown className="w-3 h-3 text-amber-400 fill-amber-400/30 shrink-0" />}
          </span>
          <span className="text-[10px] text-slate-400 truncate">
            {self.customStatus || (isDeafened ? "Ensurdecido" : isAudioMuted ? "Mic Mutado" : "Conectado")}
          </span>
        </div>
      </button>

      {/* Center: Core Action Dials & Volume Slider */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Dedicated Self-Mic Mute Toggle (Everyone controls their own mic with Key '0') */}
        <button
          onClick={onToggleAudio}
          className={`px-3 py-2 sm:px-3.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer ${
            isAudioMuted || self.isMutedByHost
              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 ring-1 ring-rose-400/50"
              : "bg-[#162032] hover:bg-[#1e2c44] text-slate-100 hover:text-white border border-[#253550]"
          }`}
          title={
            self.isMutedByHost
              ? "Você foi silenciado pelo anfitrião"
              : isAudioMuted
              ? "Ativar Microfone (Pressione a tecla 0)"
              : "Silenciar Microfone (Pressione a tecla 0)"
          }
        >
          {isAudioMuted || self.isMutedByHost ? (
            <MicOff className="w-4 h-4 text-white" />
          ) : (
            <Mic className="w-4 h-4 text-emerald-400" />
          )}
          <span className="text-xs font-bold hidden md:inline">
            {isAudioMuted || self.isMutedByHost ? "Mic Mudo" : "Meu Mic"}
          </span>
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              isAudioMuted || self.isMutedByHost
                ? "bg-rose-700/80 border-rose-400/40 text-rose-100"
                : "bg-[#0f1624] border-[#293a54] text-cyan-300"
            }`}
            title="Atalho do teclado: Tecla 0"
          >
            0
          </span>
        </button>

        {/* Voice Volume Slider Dock ("Barra de Aumentar Voz e Baixar") */}
        <div className="relative flex items-center bg-[#101726] border border-[#202e48] rounded-xl px-2 sm:px-3 py-1.5 gap-2 shadow-inner">
          <button
            onClick={() => onVolumeChange(masterVoiceVolume === 0 ? 100 : 0)}
            className="text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
            title={masterVoiceVolume === 0 ? "Desmutar Voz Geral" : "Mutar Voz Geral"}
          >
            {masterVoiceVolume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : masterVoiceVolume < 50 ? (
              <Volume1 className="w-4 h-4 text-slate-300" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          <div className="hidden sm:flex items-center gap-1.5">
            <input
              type="range"
              min="0"
              max="200"
              step="5"
              value={masterVoiceVolume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-16 md:w-24 h-1.5 bg-[#202f4a] rounded-lg appearance-none cursor-pointer accent-cyan-400"
              title={`Volume da Voz: ${masterVoiceVolume}% (Aumentar ou Baixar som dos participantes)`}
            />
            <span className="text-[10px] font-mono text-cyan-300 font-bold min-w-[32px] text-right">
              {masterVoiceVolume}%
            </span>
          </div>

          {/* Mobile popup toggle for volume slider */}
          <button
            onClick={() => setShowVolumePopup(!showVolumePopup)}
            className="sm:hidden text-[10px] font-mono font-bold text-cyan-400 px-1"
          >
            {masterVoiceVolume}%
          </button>

          {showVolumePopup && (
            <div className="sm:hidden absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#0c1220] border border-[#253550] rounded-xl p-3 shadow-2xl flex flex-col items-center gap-2 z-30 min-w-[150px]">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                Volume da Voz
              </span>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={masterVoiceVolume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-full h-2 bg-[#202f4a] rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-xs font-mono font-bold text-cyan-300">{masterVoiceVolume}%</span>
            </div>
          )}
        </div>

        {/* Deafen Toggle */}
        <button
          onClick={onToggleDeafen}
          className={`p-2.5 sm:p-3 rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer ${
            isDeafened
              ? "bg-rose-600/90 hover:bg-rose-500 text-white shadow-rose-950"
              : "bg-[#162032] hover:bg-[#1e2c44] text-slate-200 hover:text-white border border-[#253550]"
          }`}
          title={isDeafened ? "Desativar Modo Ensurdecido" : "Ensurdecer (Mutar todos os áudios)"}
        >
          {isDeafened ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Headphones className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Camera toggle */}
        <button
          onClick={onToggleVideo}
          className={`p-2.5 sm:p-3 rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer ${
            isVideoMuted || lowResourceMode
              ? "bg-[#162032] hover:bg-[#1e2c44] text-slate-400 hover:text-slate-200 border border-[#253550]"
              : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950"
          }`}
          title={
            lowResourceMode
              ? "Câmera desativada no Modo Baixo Consumo"
              : isVideoMuted
              ? "Ligar Câmera"
              : "Desligar Câmera"
          }
        >
          {isVideoMuted || lowResourceMode ? <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Screen Share Toggle & Quality Selector Dock */}
        <div className="relative flex items-center">
          <div
            className={`flex items-center rounded-xl overflow-hidden shadow-md transition-all ${
              !allowScreenShare && !self.isHost
                ? "bg-[#101726] border border-[#1b253b]"
                : isScreenSharing
                ? "bg-emerald-600 border border-emerald-400/60 shadow-emerald-950 ring-2 ring-emerald-400/30"
                : "bg-[#162032] hover:bg-[#1e2c44] border border-[#253550]"
            }`}
          >
            {/* Main Screen Share Toggle */}
            <button
              onClick={onToggleScreenShare}
              disabled={!allowScreenShare && !self.isHost}
              className={`p-2.5 sm:p-3 flex items-center justify-center transition-all cursor-pointer ${
                !allowScreenShare && !self.isHost
                  ? "text-slate-600 cursor-not-allowed"
                  : isScreenSharing
                  ? "text-white"
                  : "text-slate-200 hover:text-white"
              }`}
              title={
                !allowScreenShare && !self.isHost
                  ? "Compartilhamento de tela desativado pelo anfitrião"
                  : isScreenSharing
                  ? `Transmitindo (${SCREEN_SHARE_PRESETS[screenQualityPreset]?.label}) • Clique para parar`
                  : `Compartilhar Tela (${SCREEN_SHARE_PRESETS[screenQualityPreset]?.label})`
              }
            >
              {isScreenSharing ? <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {/* Quality Preset Trigger Button */}
            <button
              onClick={() => setShowScreenQualityMenu(!showScreenQualityMenu)}
              disabled={!allowScreenShare && !self.isHost}
              className={`px-1.5 sm:px-2 py-2.5 sm:py-3 border-l flex items-center gap-1 transition-all text-[10px] font-mono font-bold cursor-pointer ${
                !allowScreenShare && !self.isHost
                  ? "border-[#1b253b] text-slate-700 cursor-not-allowed"
                  : isScreenSharing
                  ? "border-emerald-500/50 bg-emerald-700/60 hover:bg-emerald-700 text-emerald-100"
                  : "border-[#253550] hover:bg-[#202f4a] text-cyan-300"
              }`}
              title="Ajustar Qualidade de Transmissão (1080p 90fps, 60fps, 720p...)"
            >
              <span className="hidden md:inline">{SCREEN_SHARE_PRESETS[screenQualityPreset]?.badge || "1080p 90FPS"}</span>
              <ChevronUp className={`w-3 h-3 transition-transform duration-200 ${showScreenQualityMenu ? "rotate-180 text-white" : ""}`} />
            </button>
          </div>

          {/* Quality Options Popover Dropdown */}
          {showScreenQualityMenu && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-72 sm:w-80 bg-[#0a0f1d] border border-[#22334f] rounded-2xl p-3 shadow-2xl z-50 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[#1b283f]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Qualidade de Transmissão</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  {SCREEN_SHARE_PRESETS[screenQualityPreset]?.badge}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {(Object.keys(SCREEN_SHARE_PRESETS) as ScreenSharePresetId[]).map((presetKey) => {
                  const preset = SCREEN_SHARE_PRESETS[presetKey];
                  const isSelected = screenQualityPreset === presetKey;

                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        onChangeScreenQuality?.(preset.id);
                        setShowScreenQualityMenu(false);
                      }}
                      className={`p-2.5 rounded-xl text-left flex items-center justify-between border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-cyan-950/80 border-cyan-500 text-white shadow-md shadow-cyan-950/50"
                          : "bg-[#111a2d] hover:bg-[#19263f] border-[#1f2e49] text-slate-300 hover:text-white"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100">{preset.label}</span>
                          {preset.frameRate === 90 ? (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Ultra Gamer
                            </span>
                          ) : preset.frameRate === 60 ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              Fluido
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-slate-400">{preset.subLabel}</span>
                      </div>

                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono font-medium text-slate-500">{preset.frameRate} FPS</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {isScreenSharing ? (
                <div className="text-[10px] text-emerald-300 bg-emerald-950/40 border border-emerald-700/40 rounded-xl p-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span>Transmissão em andamento: a resolução e FPS são ajustados em tempo real!</span>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 bg-[#101726] border border-[#1e2a40] rounded-xl p-2 flex items-center justify-between">
                  <span>Padrão inicial de captura:</span>
                  <span className="text-cyan-300 font-bold font-mono">1080p @ 90 FPS</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Leave call */}
        <button
          onClick={onLeaveCall}
          className="p-2.5 sm:p-3 sm:px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-950 transition-all cursor-pointer"
          title="Desconectar da chamada"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Sair</span>
        </button>
      </div>

      {/* Right: Secondary Utilities (Members List, Chat, Host Panel, Settings) */}
      <div className="flex items-center gap-1 sm:gap-1.5 justify-end">
        {/* Member List Toggle */}
        <button
          onClick={onToggleMemberList}
          className={`p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer ${
            isMemberListOpen
              ? "bg-cyan-950/60 border-cyan-500/60 text-cyan-300"
              : "bg-[#162032] border-[#253550] text-slate-400 hover:text-slate-200"
          }`}
          title="Lista de Membros na Call (Estilo Discord)"
        >
          <Users className="w-4 h-4" />
        </button>

        {/* Chat & Channels Drawer Toggle */}
        <button
          onClick={onToggleChat}
          className={`relative p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer ${
            isChatOpen
              ? "bg-cyan-950/60 border-cyan-500/60 text-cyan-300"
              : "bg-[#162032] border-[#253550] text-slate-300 hover:text-white"
          }`}
          title="Canais de Texto e Chat"
        >
          <MessageSquare className="w-4 h-4" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 bg-cyan-500 text-slate-950 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Host master admission / Portaria control */}
        {self.isHost && onOpenAdmissionModal && (
          <button
            onClick={onOpenAdmissionModal}
            className={`relative p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer ${
              pendingKnocksCount > 0
                ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-950 animate-pulse"
                : "bg-[#162032] hover:bg-[#1e2c44] border-amber-500/40 text-amber-300"
            }`}
            title="Portaria: Permitir ou Recusar Entrada de Pessoas na Chamada"
          >
            <UserCheck className="w-4 h-4" />
            {pendingKnocksCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-amber-300">
                {pendingKnocksCount}
              </span>
            )}
          </button>
        )}

        {/* Host master control */}
        {self.isHost && (
          <button
            onClick={onOpenHostPanel}
            className="p-2 sm:p-2.5 rounded-lg bg-[#162032] hover:bg-[#1e2c44] border border-amber-500/40 text-amber-300 transition-all cursor-pointer"
            title="Painel Master do Dono / Anfitrião"
          >
            <Crown className="w-4 h-4 text-amber-400 fill-current" />
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 sm:p-2.5 rounded-lg bg-[#162032] hover:bg-[#1e2c44] border border-[#253550] text-slate-300 hover:text-white transition-all cursor-pointer"
          title="Configurações de Áudio e Vídeo"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
