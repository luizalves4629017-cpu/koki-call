import React, { useEffect, useRef, useState } from "react";
import {
  Monitor,
  Volume2,
  VolumeX,
  Expand,
  Shrink,
  Square,
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
  isDarkTheme?: boolean;
  onToggleSpotlight?: () => void;
  onVolumeChange?: (userId: string, volume: number) => void;
  onStopScreenShare?: () => void;
}

export const ScreenShareTile: React.FC<ScreenShareTileProps> = ({
  participant,
  isSelf,
  screenStream,
  isSpotlight = true,
  userVolume = 100,
  masterVoiceVolume = 100,
  currentVoiceChannelId = "voice-geral",
  onToggleSpotlight,
  onVolumeChange,
  onStopScreenShare,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localVolume, setLocalVolume] = useState<number>(userVolume);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [hasActiveVideo, setHasActiveVideo] = useState(false);

  const isSameVoiceChannel =
    (participant.voiceChannelId || "voice-geral") ===
    (currentVoiceChannelId || "voice-geral");

  // Bind screen video stream to video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (screenStream && screenStream.getVideoTracks().length > 0) {
      const videoTracks = screenStream.getVideoTracks();
      const firstTrack = videoTracks[0];

      if (videoEl.srcObject !== screenStream) {
        videoEl.srcObject = screenStream;
        console.log("[tela] srcObject atribuído ao elemento de vídeo, track id:", firstTrack.id);
      }

      const checkTrackActive = () => {
        const live = videoTracks.some((t) => !t.muted && t.readyState === "live");
        setHasActiveVideo(live);
      };

      checkTrackActive();

      // Listen for unmuting or mute state transitions
      videoTracks.forEach((track) => {
        track.onunmute = () => {
          console.log("[tela] track.onunmute recebido para trilha:", track.id);
          checkTrackActive();
          videoEl.play().then(() => {
            console.log("[tela] play executado com sucesso no onunmute");
          }).catch((err) => {
            console.warn("[tela] erro ao executar play no onunmute:", err);
          });
        };

        track.onmute = () => {
          console.log("[tela] track.onmute para trilha:", track.id);
          checkTrackActive();
        };

        track.onended = () => {
          console.log("[tela] track.onended para trilha:", track.id);
          checkTrackActive();
        };
      });

      // Always call play() on the video element
      videoEl
        .play()
        .then(() => {
          console.log("[tela] play executado com sucesso");
          checkTrackActive();
        })
        .catch((err) => {
          console.warn("[tela] erro ao executar play:", err);
        });

      return () => {
        videoTracks.forEach((track) => {
          track.onunmute = null;
          track.onmute = null;
          track.onended = null;
        });
      };
    } else {
      videoEl.srcObject = null;
      setHasActiveVideo(false);
    }
  }, [screenStream]);

  // Bind screen audio stream to audio element
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

  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
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

  const hasAudioTrack = Boolean(screenStream && screenStream.getAudioTracks().length > 0);

  return (
    <div
      ref={containerRef}
      className="relative group w-full h-full min-h-[380px] rounded-2xl overflow-hidden border border-[#2A2D35] bg-[#0E0F12] shadow-2xl flex items-center justify-center select-none"
    >
      {/* Remote screen share audio */}
      {!isSelf && <audio ref={audioRef} autoPlay playsInline />}

      {/* Screen video element: autoplay, playsInline, always muted (audio is handled in separate audio element) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-contain bg-[#0E0F12] transition-opacity duration-300 ${
          hasActiveVideo ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Connecting overlay if video track is still pending or negotiating */}
      {!hasActiveVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0E0F12] text-[#8B8F98] p-6 z-10 pointer-events-none">
          <Monitor className="w-12 h-12 text-[#5EEAD4] animate-pulse" />
          <p className="text-sm font-medium text-[#ECECEC]">
            Conectando à tela de {participant.name}...
          </p>
        </div>
      )}

      {/* Top Left Badge: Você está compartilhando com botão Parar (se isSelf) ou Tela de [Nome] */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
        {isSelf ? (
          <div className="bg-[#1E2026]/90 backdrop-blur-md border border-[#5EEAD4]/40 text-[#5EEAD4] text-xs px-3 py-1.5 rounded-full flex items-center gap-2 font-semibold shadow-lg">
            <Monitor className="w-3.5 h-3.5 animate-pulse text-[#5EEAD4]" />
            <span>Você está compartilhando</span>
            {onStopScreenShare && (
              <button
                onClick={onStopScreenShare}
                className="ml-1 px-2 py-0.5 rounded-full bg-[#F43F5E] hover:bg-[#E11D48] text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                title="Parar de compartilhar agora"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Parar</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-[#1E2026]/90 backdrop-blur-md border border-[#2A2D35] text-[#ECECEC] text-xs px-3 py-1.5 rounded-full flex items-center gap-2 font-semibold shadow-lg">
            <Monitor className="w-3.5 h-3.5 text-[#5EEAD4] animate-pulse" />
            <span>Tela de {participant.name}</span>
          </div>
        )}

        {hasAudioTrack && !isSelf && (
          <div
            className="bg-[#1E2026]/90 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 font-medium shadow-sm"
            title="Áudio compartilhado ativo"
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Áudio da Tela</span>
          </div>
        )}
      </div>

      {/* Top Right Quick Controls: Volume e Tela Cheia */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20 bg-[#1E2026]/80 p-1.5 rounded-full backdrop-blur-sm border border-[#2A2D35] opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Screen audio volume slider */}
        {hasAudioTrack && !isSelf && (
          <div className="relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="p-1.5 rounded-full hover:bg-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC] transition-all cursor-pointer"
              title="Ajustar volume da transmissão"
            >
              {localVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#F43F5E]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#5EEAD4]" />
              )}
            </button>

            {showVolumeSlider && (
              <div className="absolute right-0 mt-2 p-3 bg-[#1E2026] border border-[#2A2D35] rounded-2xl shadow-xl z-30 w-40 flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] text-[#8B8F98]">
                  <span>Volume da Tela</span>
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

        {/* Botão de Tela Cheia */}
        <button
          onClick={handleToggleFullscreen}
          className="p-1.5 rounded-full hover:bg-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC] transition-all cursor-pointer"
          title={isFullscreen ? "Sair de tela cheia" : "Tela cheia da transmissão"}
        >
          {isFullscreen ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
