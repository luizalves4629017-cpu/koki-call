import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Headphones,
  MessageSquare,
  Settings,
  PhoneOff,
  Users,
  ChevronUp,
  Volume2,
  Check,
} from "lucide-react";
import { Participant } from "../types";
import {
  ScreenSharePresetId,
  SCREEN_SHARE_PRESETS,
  DEFAULT_SCREEN_PRESET_ID,
} from "../utils/screenShareConfig";

interface ControlBarProps {
  /** Capas das salas salvas (aparecem à esquerda dos controles) */
  salasSlot?: React.ReactNode;
  self: Participant;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  isChatOpen: boolean;
  isMemberListOpen: boolean;
  unreadChatCount: number;
  lowResourceMode?: boolean;
  allowScreenShare: boolean;
  masterVoiceVolume: number;
  screenQualityPreset?: ScreenSharePresetId;
  pendingKnocksCount?: number;
  isMaster?: boolean;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
  onVolumeChange: (newVol: number) => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onChangeScreenQuality?: (preset: ScreenSharePresetId) => void;
  onToggleDeafen: () => void;
  onToggleChat: () => void;
  onToggleMemberList: () => void;
  onToggleLowResource?: () => void;
  onOpenSettings: () => void;
  onOpenHostPanel?: () => void;
  onOpenAdmissionModal?: () => void;
  onLeaveCall: () => void;
  onOpenSelfProfile?: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  salasSlot,
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  isDeafened,
  isChatOpen,
  isMemberListOpen,
  unreadChatCount,
  masterVoiceVolume,
  screenQualityPreset = DEFAULT_SCREEN_PRESET_ID,
  onVolumeChange,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onChangeScreenQuality,
  onToggleDeafen,
  onToggleChat,
  onToggleMemberList,
  onOpenSettings,
  onLeaveCall,
}) => {
  const [showScreenMenu, setShowScreenMenu] = useState(false);
  const screenMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (screenMenuRef.current && !screenMenuRef.current.contains(e.target as Node)) {
        setShowScreenMenu(false);
      }
    };
    if (showScreenMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showScreenMenu]);

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 select-none pointer-events-auto">
      <div className={`flex items-center gap-2 sm:gap-2.5 px-3 py-2 ${salasSlot ? "rounded-2xl" : "rounded-full"} bg-[#1E2026] border border-[#2A2D35] shadow-2xl backdrop-blur-md`}>
        {salasSlot && (
          <>
            {salasSlot}
            <div className="w-px h-8 bg-[#2A2D35] mx-0.5 shrink-0" />
          </>
        )}
        {/* GRUPO 1: Mídia (Mic, Câmera, Compartilhar tela + menu qualidade/volume, Fone) */}
        
        {/* Microfone: mutado = vermelho #F43F5E; ligado = cinza #2A2D35 */}
        <button
          onClick={onToggleAudio}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isAudioMuted
              ? "bg-[#F43F5E] text-white hover:bg-[#E11D48] shadow-md shadow-[#F43F5E]/30"
              : "bg-[#2A2D35] text-[#ECECEC] hover:bg-[#343842] hover:text-[#5EEAD4]"
          }`}
          title={isAudioMuted ? "Desmutar microfone" : "Mutar microfone"}
        >
          {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Câmera */}
        <button
          onClick={onToggleVideo}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isVideoMuted
              ? "bg-[#2A2D35] text-[#8B8F98] hover:bg-[#343842] hover:text-[#ECECEC]"
              : "bg-[#5EEAD4] text-[#16171B] hover:bg-[#2DD4BF] shadow-md shadow-[#5EEAD4]/20"
          }`}
          title={isVideoMuted ? "Ligar câmera" : "Desligar câmera"}
        >
          {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
        </button>

        {/* Compartilhar Tela com Menu de Qualidade e Volume na setinha */}
        <div className="relative flex items-center" ref={screenMenuRef}>
          <button
            onClick={onToggleScreenShare}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isScreenSharing
                ? "bg-[#5EEAD4] text-[#16171B] font-bold shadow-lg shadow-[#5EEAD4]/30"
                : "bg-[#2A2D35] text-[#ECECEC] hover:bg-[#343842] hover:text-[#5EEAD4]"
            }`}
            title={isScreenSharing ? "Parar de compartilhar tela" : "Compartilhar tela"}
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* Setinha para abrir opções de transmissão e volume */}
          <button
            onClick={() => setShowScreenMenu((prev) => !prev)}
            className="w-4 h-10 -ml-1 text-[#8B8F98] hover:text-[#ECECEC] flex items-center justify-center cursor-pointer transition-colors"
            title="Opções de transmissão (resolução, FPS, volume)"
          >
            <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-150 ${showScreenMenu ? "rotate-180" : ""}`} />
          </button>

          {/* Menu popover de qualidade (720p/1080p, 30/60/90 fps) e volume geral */}
          {showScreenMenu && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-64 p-3 bg-[#1E2026] border border-[#2A2D35] rounded-2xl shadow-2xl z-50 text-[#ECECEC] space-y-3 animate-in fade-in duration-150">
              <div className="text-[11px] font-bold text-[#8B8F98] uppercase tracking-wider">
                Qualidade de Transmissão
              </div>

              <div className="space-y-1">
                {(Object.keys(SCREEN_SHARE_PRESETS) as ScreenSharePresetId[]).map((key) => {
                  const preset = SCREEN_SHARE_PRESETS[key];
                  const isSelected = screenQualityPreset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (onChangeScreenQuality) onChangeScreenQuality(key);
                        setShowScreenMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#5EEAD4]/15 text-[#5EEAD4] font-bold border border-[#5EEAD4]/30"
                          : "hover:bg-[#252830] text-[#ECECEC]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{preset.label}</span>
                        <span className="text-[10px] text-[#8B8F98] font-mono">
                          {preset.badge}
                        </span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#5EEAD4]" />}
                    </button>
                  );
                })}
              </div>

              {/* Volume Master da Transmissão */}
              <div className="pt-2 border-t border-[#2A2D35] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[#8B8F98]">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Volume de Voz</span>
                  </span>
                  <span className="font-mono text-[#5EEAD4] font-bold">{masterVoiceVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={masterVoiceVolume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-full accent-[#5EEAD4] cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Fone (Ensurdecer) */}
        <button
          onClick={onToggleDeafen}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isDeafened
              ? "bg-[#F43F5E] text-white hover:bg-[#E11D48] shadow-md shadow-[#F43F5E]/30"
              : "bg-[#2A2D35] text-[#ECECEC] hover:bg-[#343842] hover:text-[#5EEAD4]"
          }`}
          title={isDeafened ? "Desativar ensurdecer" : "Ensurdecer áudio"}
        >
          <Headphones className="w-4 h-4" />
        </button>

        {/* SEPARADOR 1: Barra vertical fina */}
        <div className="w-[1px] h-6 bg-[#2A2D35] mx-1" />

        {/* GRUPO 2: Sair (Vermelho redondo de destaque) */}
        <button
          onClick={onLeaveCall}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F43F5E] hover:bg-[#E11D48] text-white transition-all shadow-md shadow-[#F43F5E]/20 cursor-pointer active:scale-95"
          title="Sair da chamada"
        >
          <PhoneOff className="w-4 h-4" />
        </button>

        {/* SEPARADOR 2: Barra vertical fina */}
        <div className="w-[1px] h-6 bg-[#2A2D35] mx-1" />

        {/* GRUPO 3: Utilidades (Membros, Chat, Configurações) */}
        
        {/* Membros */}
        <button
          onClick={onToggleMemberList}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isMemberListOpen
              ? "bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/40"
              : "bg-[#2A2D35] text-[#ECECEC] hover:bg-[#343842] hover:text-[#5EEAD4]"
          }`}
          title="Lista de membros na chamada"
        >
          <Users className="w-4 h-4" />
        </button>

        {/* Chat com contador de não lidas */}
        <button
          onClick={onToggleChat}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer relative ${
            isChatOpen
              ? "bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/40"
              : "bg-[#2A2D35] text-[#ECECEC] hover:bg-[#343842] hover:text-[#5EEAD4]"
          }`}
          title="Abrir chat de texto"
        >
          <MessageSquare className="w-4 h-4" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 bg-[#F43F5E] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#1E2026]">
              {unreadChatCount > 9 ? "9+" : unreadChatCount}
            </span>
          )}
        </button>

        {/* Configurações (Abre modal com Modo Gamer, Tema claro/escuro, Ver Mockup, Dispositivos) */}
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[#2A2D35] text-[#ECECEC] hover:bg-[#343842] hover:text-[#5EEAD4] transition-all cursor-pointer"
          title="Configurações (Modo Gamer, Tema, Áudio e Vídeo)"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
