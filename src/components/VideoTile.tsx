import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  VideoOff,
  Crown,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  MoreVertical,
  UserX,
  Volume1,
  Monitor,
  User
} from "lucide-react";
import { Participant } from "../types";

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

  const [localVolume, setLocalVolume] = useState<number>(userVolume);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);

  // VIP & Voice Channel Audio/Video Isolation
  const isSameVoiceChannel = (participant.voiceChannelId || "voice-geral") === (currentVoiceChannelId || "voice-geral");

  const isSpeaking = isSameVoiceChannel &&
    (audioLevel > 15 || (participant.audioLevel && participant.audioLevel > 15)) &&
    participant.hasAudio &&
    !participant.isMutedByHost;

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

  // Handle Screen Share Track (if specifically used standalone)
  useEffect(() => {
    if (screenRef.current && screenStream) {
      if (screenRef.current.srcObject !== screenStream) {
        screenRef.current.srcObject = screenStream;
      }
      screenRef.current.play().catch(() => {});
    }
  }, [screenStream]);

  const screenAudioRef = useRef<HTMLAudioElement | null>(null);

  // Handle Remote Audio Element with Master & Individual Volume + Strict Channel Isolation
  useEffect(() => {
    if (!isSelf && audioRef.current && stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        if (audioRef.current.srcObject !== stream) {
          audioRef.current.srcObject = stream;
        }
        if (!isSameVoiceChannel) {
          // Strictly mute and silence audio when in different voice channels
          audioRef.current.muted = true;
          audioRef.current.volume = 0;
          audioRef.current.pause();
        } else {
          audioRef.current.muted = false;
          const effectiveGain = (localVolume / 100) * (masterVoiceVolume / 100) * (participant.isDeafened ? 0 : 1);
          audioRef.current.volume = Math.max(0, Math.min(1, effectiveGain));
          audioRef.current.play().catch(() => {});
        }
      }
    }
  }, [stream, isSelf, localVolume, masterVoiceVolume, participant.isDeafened, isSameVoiceChannel]);

  // Handle Screen Audio if screen has audio + Strict Channel Isolation
  useEffect(() => {
    if (!isSelf && screenAudioRef.current && screenStream) {
      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        if (screenAudioRef.current.srcObject !== screenStream) {
          screenAudioRef.current.srcObject = screenStream;
        }
        if (!isSameVoiceChannel) {
          screenAudioRef.current.muted = true;
          screenAudioRef.current.volume = 0;
          screenAudioRef.current.pause();
        } else {
          screenAudioRef.current.muted = false;
          const effectiveGain = (localVolume / 100) * (masterVoiceVolume / 100) * (participant.isDeafened ? 0 : 1);
          screenAudioRef.current.volume = Math.max(0, Math.min(1, effectiveGain));
          screenAudioRef.current.play().catch(() => {});
        }
      }
    }
  }, [screenStream, isSelf, localVolume, masterVoiceVolume, participant.isDeafened, isSameVoiceChannel]);

  const hasActiveVideo = (participant.hasVideo || (stream && stream.getVideoTracks().some((t) => t.enabled))) && !lowResourceMode && Boolean(stream && stream.getVideoTracks().length > 0);
  // Only display screen directly inside VideoTile if screenStream is passed AND participant has no stream/camera
  const isDisplayingScreen = Boolean(screenStream && !stream && participant.isScreenSharing);

  return (
    <div
      className={`relative group rounded-2xl overflow-hidden bg-[#0a0f1d] border transition-all flex items-center justify-center ${
        isSpeaking
          ? "border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40"
          : "border-[#1e293b] hover:border-[#334155]"
      } ${isSpotlight ? "w-full h-full min-h-[400px]" : "w-full aspect-video min-h-[160px]"}`}
    >
      {/* Remote Audio output tags (hidden) */}
      {!isSelf && <audio ref={audioRef} autoPlay playsInline />}
      {!isSelf && <audio ref={screenAudioRef} autoPlay playsInline />}

      {/* Screen share rendering if active */}
      {isDisplayingScreen ? (
        <div className="w-full h-full relative bg-black flex items-center justify-center">
          <video
            ref={screenRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm border border-cyan-500/40 text-cyan-300 text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium">
            <Monitor className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>Transmissão de Tela • {participant.name}</span>
          </div>
        </div>
      ) : hasActiveVideo ? (
        /* Video Stream */
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={`w-full h-full object-cover ${isSelf ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        /* Avatar & Speaking Glow when Video is OFF */
        <button
          onClick={() => onSelectProfile?.(participant)}
          className="flex flex-col items-center justify-center gap-2 select-none group/avatar cursor-pointer focus:outline-none"
          title="Clique para ver o perfil Koki"
        >
          <div
            className={`relative rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl transition-all overflow-hidden ${
              isSpotlight ? "w-28 h-28 text-4xl" : "w-16 h-16 sm:w-20 sm:h-20 text-2xl sm:text-3xl"
            } ${
              isSpeaking
                ? "animate-speaking ring-4 ring-emerald-400 scale-105"
                : "ring-2 ring-white/10 group-hover/avatar:ring-cyan-400 group-hover/avatar:scale-105"
            }`}
            style={{
              backgroundColor: participant.avatarColor || "#0284c7",
            }}
          >
            {participant.avatarUrl ? (
              <img
                src={participant.avatarUrl}
                alt={participant.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{participant.avatarEmoji || (participant.isHost ? "👑" : "🎮")}</span>
            )}

            {participant.isHost && (
              <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow-md z-10">
                <Crown className="w-3.5 h-3.5 fill-current" />
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1 bg-[#0b0f19]/80 px-2.5 py-0.5 rounded-full border border-slate-800">
              {participant.name} {isSelf && "(Você)"}
            </span>
            {participant.customStatus && (
              <span className="text-[10px] text-slate-400 mt-0.5 max-w-[150px] truncate">
                {participant.customStatus}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Top Left info overlay */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 pointer-events-none">
        {participant.tag === "0001" || participant.badges?.includes("owner_supreme") ? (
          <span className="bg-amber-500/90 text-slate-950 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
            <Crown className="w-3 h-3 fill-current" /> MASTER
          </span>
        ) : participant.isHost ? (
          <span className="bg-cyan-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
            HOST
          </span>
        ) : null}
        {participant.isScreenSharing && !isDisplayingScreen && (
          <span className="bg-purple-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
            <Monitor className="w-3 h-3" /> TELA
          </span>
        )}
      </div>

      {/* Top Right Quick Controls */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Profile Button */}
        {onSelectProfile && (
          <button
            onClick={() => onSelectProfile(participant)}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-slate-300 hover:text-cyan-300 border border-slate-700/50 backdrop-blur-sm transition-all cursor-pointer"
            title="Ver Perfil"
          >
            <User className="w-3.5 h-3.5" />
          </button>
        )}

        {onToggleSpotlight && (
          <button
            onClick={onToggleSpotlight}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border border-slate-700/50 backdrop-blur-sm transition-all cursor-pointer"
            title={isSpotlight ? "Voltar para Grade" : "Destacar participante"}
          >
            {isSpotlight ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}

        {!isSelf && (
          <div className="relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border border-slate-700/50 backdrop-blur-sm transition-all cursor-pointer"
              title="Ajustar volume individual"
            >
              {localVolume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {showVolumeSlider && (
              <div className="absolute right-0 mt-1 p-2 bg-[#090e1a] border border-[#1e293b] rounded-lg shadow-xl z-20 w-36 flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Volume</span>
                  <span>{localVolume}%</span>
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
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
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
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border border-slate-700/50 backdrop-blur-sm transition-all cursor-pointer"
              title="Ações do Dono Master"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 py-1 bg-[#090e1a] border border-[#1e293b] rounded-lg shadow-xl z-30 w-44 text-xs flex flex-col">
                {onMoveToVoiceChannel && (
                  <button
                    onClick={() => {
                      const nextChan = participant.voiceChannelId === "voice-vip" ? "voice-geral" : "voice-vip";
                      onMoveToVoiceChannel(participant.id, nextChan);
                      setShowMenu(false);
                    }}
                    className="px-3 py-1.5 text-left text-amber-300 hover:text-amber-200 hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer font-semibold border-b border-slate-800"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      {participant.voiceChannelId === "voice-vip" ? "Mover para Geral" : "Mover para Call VIP"}
                    </span>
                  </button>
                )}
                {onHostMute && (
                  <button
                    onClick={() => {
                      onHostMute(participant.id);
                      setShowMenu(false);
                    }}
                    className="px-3 py-1.5 text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <MicOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>Silenciar</span>
                  </button>
                )}
                {onHostKick && (
                  <button
                    onClick={() => {
                      onHostKick(participant.id);
                      setShowMenu(false);
                    }}
                    className="px-3 py-1.5 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Expulsar</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar overlay: Name & Mic/Camera Status */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5 max-w-[70%] truncate">
          <span className="text-xs font-semibold text-white truncate drop-shadow-sm">
            {participant.name}
          </span>
          {isSelf && (
            <span className="text-[10px] text-cyan-300 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800/40">
              Você
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mute status badge */}
          {(!participant.hasAudio || participant.isMutedByHost) ? (
            <span
              className="p-1 rounded-full bg-rose-500/80 text-white"
              title={participant.isMutedByHost ? "Silenciado pelo host" : "Microfone mutado"}
            >
              <MicOff className="w-3 h-3" />
            </span>
          ) : isSpeaking ? (
            <span className="p-1 rounded-full bg-emerald-500/90 text-white animate-pulse" title="Falando">
              <Mic className="w-3 h-3" />
            </span>
          ) : (
            <span className="p-1 rounded-full bg-slate-800/70 text-slate-400" title="Microfone aberto">
              <Mic className="w-3 h-3" />
            </span>
          )}

          {/* Camera status badge */}
          {!participant.hasVideo && (
            <span className="p-1 rounded-full bg-slate-800/70 text-slate-400" title="Câmera desligada">
              <VideoOff className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
