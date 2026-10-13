import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  VideoOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  MoreVertical,
  Monitor,
  User,
} from "lucide-react";
import { Participant } from "../types";
import { AnelPerk } from "./AnelPerk";
import { anelDoParticipante } from "../utils/perks";
import { BlackHoleBadge } from "./BlackHoleBadge";

interface VideoTileProps {
  participant: Participant;
  isSelf: boolean;
  isHostViewer: boolean;
  stream?: MediaStream | null;
  screenStream?: MediaStream | null;
  audioLevel?: number;
  lowResourceMode?: boolean;
  isSpotlight?: boolean;
  userVolume?: number;
  masterVoiceVolume?: number;
  currentVoiceChannelId?: string;
  isDarkTheme?: boolean;
  onToggleSpotlight?: () => void;
  onHostMute?: (userId: string) => void;
  onHostKick?: (userId: string) => void;
  onSelectProfile?: (participant: Participant) => void;
  onVolumeChange?: (userId: string, volume: number) => void;
  onMoveToVoiceChannel?: (userId: string, targetChannelId: string) => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isSelf,
  isHostViewer,
  stream,
  screenStream,
  audioLevel = 0,
  lowResourceMode = false,
  isSpotlight = false,
  userVolume = 100,
  masterVoiceVolume = 100,
  currentVoiceChannelId = "voice-geral",
  onToggleSpotlight,
  onHostMute,
  onHostKick,
  onSelectProfile,
  onVolumeChange,
  onMoveToVoiceChannel,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const screenAudioRef = useRef<HTMLAudioElement | null>(null);

  const [localVolume, setLocalVolume] = useState<number>(userVolume);
  const [showMenu, setShowMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const isSameVoiceChannel =
    (participant.voiceChannelId || "voice-geral") ===
    (currentVoiceChannelId || "voice-geral");

  const isSpeaking =
    isSameVoiceChannel &&
    (audioLevel > 15 || (participant.audioLevel && participant.audioLevel > 15)) &&
    participant.hasAudio &&
    !participant.isMutedByHost;

  const isOwner = Boolean(participant.isMaster);
  const hasHorizonteBadge = Boolean(participant.badges?.includes("horizonte"));

  // Handle Video Track
  useEffect(() => {
    if (videoRef.current && stream && !lowResourceMode) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.play().catch(() => {});
      }
    }
  }, [stream, participant.hasVideo, lowResourceMode]);

  // Handle Screen Share Track
  useEffect(() => {
    if (screenRef.current && screenStream) {
      if (screenRef.current.srcObject !== screenStream) {
        screenRef.current.srcObject = screenStream;
      }
      screenRef.current.play().catch(() => {});
    }
  }, [screenStream]);

  // Handle Remote Audio Element
  useEffect(() => {
    if (!isSelf && audioRef.current && stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        if (audioRef.current.srcObject !== stream) {
          audioRef.current.srcObject = stream;
        }
        if (!isSameVoiceChannel) {
          audioRef.current.muted = true;
          audioRef.current.volume = 0;
          audioRef.current.pause();
        } else {
          audioRef.current.muted = false;
          const effectiveGain =
            (localVolume / 100) *
            (masterVoiceVolume / 100) *
            (participant.isDeafened ? 0 : 1);
          audioRef.current.volume = Math.max(0, Math.min(1, effectiveGain));
          audioRef.current.play().catch(() => {});
        }
      }
    }
  }, [
    stream,
    isSelf,
    localVolume,
    masterVoiceVolume,
    participant.isDeafened,
    isSameVoiceChannel,
  ]);

  // Só mostra o vídeo quando a câmera está realmente enviando imagem.
  // Em pessoas remotas, a trilha de câmera existe sempre (slot fixo), mas fica
  // "muted" enquanto a câmera está desligada; nesse caso mostra o avatar.
  const hasLiveVideoTrack = Boolean(
    stream &&
      stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live" && (isSelf || !t.muted))
  );
  const hasActiveVideo =
    !lowResourceMode &&
    hasLiveVideoTrack &&
    (isSelf ? Boolean(participant.hasVideo) || hasLiveVideoTrack : participant.hasVideo !== false);

  const isDisplayingScreen = Boolean(
    screenStream && !stream && participant.isScreenSharing
  );

  return (
    <div
      className={`relative group rounded-2xl overflow-hidden bg-[#1E2026] border transition-all duration-200 flex items-center justify-center select-none ${
        isSpeaking
          ? "border-[#5EEAD4] shadow-lg shadow-[#5EEAD4]/20 ring-1 ring-[#5EEAD4]"
          : "border-[#2A2D35] hover:border-[#383C47]"
      } ${
        isSpotlight ? "w-full h-full min-h-[380px]" : "w-full aspect-video min-h-[160px]"
      }`}
    >
      {/* Remote Audio output tags (hidden) */}
      {!isSelf && <audio ref={audioRef} autoPlay playsInline />}
      {!isSelf && <audio ref={screenAudioRef} autoPlay playsInline />}

      {/* Screen share rendering if active */}
      {isDisplayingScreen ? (
        <div className="w-full h-full relative bg-[#0E0F12] flex items-center justify-center">
          <video
            ref={screenRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          <div className="absolute top-3 left-3 bg-[#1E2026]/90 backdrop-blur-sm border border-[#2A2D35] text-[#ECECEC] text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-md">
            <Monitor className="w-3.5 h-3.5 animate-pulse text-[#5EEAD4]" />
            <span>Tela de {participant.name}</span>
          </div>
        </div>
      ) : hasActiveVideo ? (
        /* Video Stream */
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={`w-full h-full object-cover rounded-2xl ${isSelf ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        /* Central Avatar & Iniciais */
        <button
          onClick={() => onSelectProfile?.(participant)}
          className="flex flex-col items-center justify-center gap-2 select-none group/avatar cursor-pointer focus:outline-none p-4"
          title="Clique para abrir o cartão de perfil Órbita"
        >
          <div
            className={`relative rounded-full flex items-center justify-center font-bold text-white shadow-xl transition-all ${
              isSpotlight ? "w-24 h-24 text-3xl" : "w-16 h-16 sm:w-20 sm:h-20 text-2xl"
            } ${
              isSpeaking
                ? "ring-4 ring-[#5EEAD4] scale-105"
                : isOwner
                ? "ring-2 ring-[#C4B5FD]"
                : "ring-1 ring-[#2A2D35]"
            }`}
            style={{
              backgroundColor: participant.avatarColor || "#2DD4BF",
            }}
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
            {anelDoParticipante(participant) && <AnelPerk tipo={anelDoParticipante(participant)!} />}
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#ECECEC]">
              <span>{participant.name} {isSelf && "(Você)"}</span>
              {isOwner && (
                <BlackHoleBadge type="singularidade" size={15} />
              )}
              {hasHorizonteBadge && !isOwner && (
                <BlackHoleBadge type="horizonte" size={15} />
              )}
            </div>
            {participant.customStatus && (
              <span className="text-[10px] text-[#8B8F98] max-w-[150px] truncate">
                {participant.customStatus}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Top Left: Selo MASTER lilás e pequeno (se for o Dono Master) */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
        {isOwner && (
          <span className="bg-[#C4B5FD]/15 border border-[#C4B5FD]/40 text-[#C4B5FD] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <BlackHoleBadge type="singularidade" size={12} />
            <span>MASTER</span>
          </span>
        )}
        {participant.isScreenSharing && !isDisplayingScreen && (
          <span className="bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <Monitor className="w-3 h-3" /> TELA
          </span>
        )}
      </div>

      {/* Top Right Quick Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSelectProfile && (
          <button
            onClick={() => onSelectProfile(participant)}
            className="p-1.5 rounded-full bg-[#1E2026]/90 hover:bg-[#252830] text-[#8B8F98] hover:text-[#ECECEC] border border-[#2A2D35] transition-all cursor-pointer shadow-sm"
            title="Ver Perfil Órbita"
          >
            <User className="w-3.5 h-3.5" />
          </button>
        )}

        {onToggleSpotlight && (
          <button
            onClick={() => onToggleSpotlight()}
            className="p-1.5 rounded-full bg-[#1E2026]/90 hover:bg-[#252830] text-[#8B8F98] hover:text-[#ECECEC] border border-[#2A2D35] transition-all cursor-pointer shadow-sm"
            title={isSpotlight ? "Voltar para Grade" : "Destacar participante"}
          >
            {isSpotlight ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}

        {!isSelf && (
          <div className="relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="p-1.5 rounded-full bg-[#1E2026]/90 hover:bg-[#252830] text-[#8B8F98] hover:text-[#ECECEC] border border-[#2A2D35] transition-all cursor-pointer shadow-sm"
              title="Ajustar Volume do Participante"
            >
              {localVolume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-[#F43F5E]" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>

            {showVolumeSlider && (
              <div className="absolute right-0 mt-2 p-3 bg-[#1E2026] border border-[#2A2D35] rounded-2xl shadow-xl z-30 w-36 flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-[#8B8F98]">
                  <span>Volume</span>
                  <span className="font-mono text-[#5EEAD4]">{localVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={localVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setLocalVolume(v);
                    onVolumeChange?.(participant.id, v);
                  }}
                  className="w-full accent-[#5EEAD4] cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        {/* Host Moderation Menu */}
        {isHostViewer && !isSelf && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-full bg-[#1E2026]/90 hover:bg-[#252830] text-[#8B8F98] hover:text-[#ECECEC] border border-[#2A2D35] transition-all cursor-pointer shadow-sm"
              title="Ações do Dono"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 py-1 rounded-xl shadow-xl z-30 w-44 text-xs flex flex-col bg-[#1E2026] border border-[#2A2D35] text-[#ECECEC]">
                {onMoveToVoiceChannel && (
                  <button
                    onClick={() => {
                      const nextChan =
                        participant.voiceChannelId === "voice-vip"
                          ? "voice-geral"
                          : "voice-vip";
                      onMoveToVoiceChannel(participant.id, nextChan);
                      setShowMenu(false);
                    }}
                    className="px-3 py-1.5 text-left text-[#C4B5FD] hover:bg-[#252830] flex items-center gap-2 cursor-pointer font-semibold border-b border-[#2A2D35]"
                  >
                    <BlackHoleBadge type="singularidade" size={13} />
                    <span className="truncate">
                      {participant.voiceChannelId === "voice-vip"
                        ? "Mover para Geral"
                        : "Mover para Call VIP"}
                    </span>
                  </button>
                )}
                {onHostMute && (
                  <button
                    onClick={() => {
                      onHostMute(participant.id);
                      setShowMenu(false);
                    }}
                    className="px-3 py-1.5 text-left hover:bg-[#252830] flex items-center gap-2 cursor-pointer text-[#ECECEC]"
                  >
                    <MicOff className="w-3.5 h-3.5 text-[#F43F5E]" />
                    <span>{participant.isMutedByHost ? "Desmutar" : "Mutar na Sala"}</span>
                  </button>
                )}
                {onHostKick && (
                  <button
                    onClick={() => {
                      onHostKick(participant.id);
                      setShowMenu(false);
                    }}
                    className="px-3 py-1.5 text-left hover:bg-[#252830] flex items-center gap-2 cursor-pointer text-[#F43F5E]"
                  >
                    <span>Remover da Sala</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nome em pílula no canto inferior esquerdo */}
      <div className="absolute bottom-3 left-3 z-10">
        <div className="px-2.5 py-1 rounded-full bg-[#16171B]/80 backdrop-blur-sm border border-[#2A2D35] flex items-center gap-1.5 text-xs font-semibold text-[#ECECEC]">
          <span className="truncate max-w-[120px]">{participant.name}</span>
          {isSelf && (
            <span className="text-[10px] text-[#5EEAD4] font-bold">
              (Você)
            </span>
          )}
          {isOwner && (
            <BlackHoleBadge type="singularidade" size={13} />
          )}
        </div>
      </div>
    </div>
  );
};
