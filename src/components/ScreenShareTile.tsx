import React, { useEffect, useRef, useState } from "react";
import {
  Monitor,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Expand,
  Shrink,
} from "lucide-react";
import { Participant } from "../types";

interface ScreenShareTileProps {
  participant: Participant;
  isSelf: boolean;
  screenStream?: MediaStream | null;
  isSpotlight?: boolean;
  userVolume?: number;
  masterVoiceVolume?: number;
  currentVoiceChannelId?: string;
  onToggleSpotlight?: () => void;
  onVolumeChange?: (userId: string, volume: number) => void;
}

export const ScreenShareTile: React.FC<ScreenShareTileProps> = ({
  participant,
  isSelf,
  screenStream,
  isSpotlight = false,
  userVolume = 100,
  masterVoiceVolume = 100,
  currentVoiceChannelId = "voice-geral",
  onToggleSpotlight,
  onVolumeChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localVolume, setLocalVolume] = useState<number>(userVolume);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // VIP & Voice Channel Audio/Video Isolation
  const isSameVoiceChannel =
    (participant.voiceChannelId || "voice-geral") ===
    (currentVoiceChannelId || "voice-geral");

  // Bind screen video stream to video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (screenStream) {
      if (videoEl.srcObject !== screenStream) {
        videoEl.srcObject = screenStream;
      }
      videoEl.play().catch((err) => {
        console.warn("Screen video autoplay error:", err);
      });
    } else {
      videoEl.srcObject = null;
    }
  }, [screenStream]);

  // Bind screen audio stream to audio element (for desktop / system / tab audio sharing)
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || isSelf || !screenStream) return;

    const screenAudioTracks = screenStream.getAudioTracks();
    if (screenAudioTracks.length > 0) {
      if (audioEl.srcObject !== screenStream) {
        audioEl.srcObject = screenStream;
      }

      if (!isSameVoiceChannel) {
        audioEl.muted = true;
        audioEl.volume = 0;
        audioEl.pause();
      } else {
        audioEl.muted = false;
        const effectiveGain =
          (localVolume / 100) *
          (masterVoiceVolume / 100) *
          (participant.isDeafened ? 0 : 1);
        audioEl.volume = Math.max(0, Math.min(1, effectiveGain));
        audioEl.play().catch(() => {});
      }
    } else {
      audioEl.srcObject = null;
    }
  }, [
    screenStream,
    isSelf,
    localVolume,
    masterVoiceVolume,
    participant.isDeafened,
    isSameVoiceChannel,
  ]);

  // Toggle true DOM fullscreen for the screen share
  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const hasAudioTrack =
    Boolean(screenStream && screenStream.getAudioTracks().length > 0);

  return (
    <div
      ref={containerRef}
      className={`relative group rounded-2xl overflow-hidden bg-slate-950 border border-purple-500/40 shadow-lg shadow-purple-950/20 transition-all flex items-center justify-center ${
        isSpotlight
          ? "w-full h-full min-h-[400px]"
          : "w-full aspect-video min-h-[160px]"
      }`}
    >
      {/* Remote screen share system/game audio */}
      {!isSelf && <audio ref={audioRef} autoPlay playsInline />}

      {/* Screen video element */}
      {screenStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="w-full h-full object-contain bg-black"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 text-slate-400 p-6">
          <Monitor className="w-12 h-12 text-purple-400 animate-pulse" />
          <p className="text-sm font-medium text-slate-300">
            Conectando transmissão de tela de {participant.name}...
          </p>
        </div>
      )}

      {/* Top Left Status Badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
        <div className="bg-purple-950/80 backdrop-blur-md border border-purple-500/40 text-purple-200 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-semibold shadow-md">
          <Monitor className="w-4 h-4 text-purple-400 animate-pulse" />
          <span>
            Transmissão de Tela • {participant.name} {isSelf && "(Você)"}
          </span>
        </div>
        {hasAudioTrack && !isSelf && (
          <div
            className="bg-emerald-950/80 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[11px] px-2 py-1 rounded-md flex items-center gap-1 font-medium shadow-sm"
            title="Áudio da tela ativo"
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Áudio Compartilhado</span>
          </div>
        )}
      </div>

      {/* Top Right Quick Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded-xl backdrop-blur-sm border border-slate-700/50">
        {/* Screen audio volume slider if screen has audio */}
        {hasAudioTrack && !isSelf && (
          <div className="relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border border-slate-700/50 transition-all cursor-pointer"
              title="Ajustar volume da transmissão"
            >
              {localVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-purple-300" />
              )}
            </button>

            {showVolumeSlider && (
              <div className="absolute right-0 mt-1 p-2.5 bg-[#090e1a] border border-[#1e293b] rounded-lg shadow-xl z-20 w-36 flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Volume da Tela</span>
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
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
              </div>
            )}
          </div>
        )}

        {/* Spotlight toggle */}
        {onToggleSpotlight && (
          <button
            onClick={onToggleSpotlight}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border border-slate-700/50 transition-all cursor-pointer"
            title={
              isSpotlight ? "Sair do destaque" : "Destacar tela principal"
            }
          >
            {isSpotlight ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}

        {/* True Fullscreen Toggle */}
        <button
          onClick={handleToggleFullscreen}
          className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border border-slate-700/50 transition-all cursor-pointer"
          title={
            isFullscreen ? "Sair de tela cheia" : "Tela cheia da transmissão"
          }
        >
          {isFullscreen ? (
            <Shrink className="w-4 h-4" />
          ) : (
            <Expand className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
