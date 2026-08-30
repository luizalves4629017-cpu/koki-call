export type ScreenSharePresetId = '1080p_90' | '1080p_60' | '720p_60' | '720p_30';

export interface ScreenSharePreset {
  id: ScreenSharePresetId;
  label: string;
  subLabel: string;
  badge: string;
  width: number;
  height: number;
  frameRate: number;
  maxBitrateBps: number;
}

export const SCREEN_SHARE_PRESETS: Record<ScreenSharePresetId, ScreenSharePreset> = {
  '1080p_90': {
    id: '1080p_90',
    label: '1080p @ 90 FPS',
    subLabel: 'Ultra / Alta Performance Gamer',
    badge: '1080p 90FPS',
    width: 1920,
    height: 1080,
    frameRate: 90,
    maxBitrateBps: 8000000,
  },
  '1080p_60': {
    id: '1080p_60',
    label: '1080p @ 60 FPS',
    subLabel: 'High / Padrão Fluido',
    badge: '1080p 60FPS',
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrateBps: 5000000,
  },
  '720p_60': {
    id: '720p_60',
    label: '720p @ 60 FPS',
    subLabel: 'Equilibrado / HD Fluido',
    badge: '720p 60FPS',
    width: 1280,
    height: 720,
    frameRate: 60,
    maxBitrateBps: 3000000,
  },
  '720p_30': {
    id: '720p_30',
    label: '720p @ 30 FPS',
    subLabel: 'Econômico / Baixo Consumo de Banda',
    badge: '720p 30FPS',
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrateBps: 1500000,
  },
};

export const DEFAULT_SCREEN_PRESET_ID: ScreenSharePresetId = '1080p_90';

/**
 * Returns DisplayMedia constraints matching the selected preset
 * Default: 1080p @ 90 FPS ({ width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 90, max: 90 } })
 */
export function getDisplayMediaConstraints(presetId: ScreenSharePresetId = DEFAULT_SCREEN_PRESET_ID): DisplayMediaStreamOptions {
  const preset = SCREEN_SHARE_PRESETS[presetId] || SCREEN_SHARE_PRESETS['1080p_90'];
  return {
    video: {
      width: { ideal: preset.width, max: preset.width },
      height: { ideal: preset.height, max: preset.height },
      frameRate: { ideal: preset.frameRate, max: preset.frameRate },
    } as any,
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };
}

/**
 * Dynamically re-applies constraints (track.applyConstraints()) and adjusts sender encodings for WebRTC peers
 */
export async function applyScreenShareQuality(
  stream: MediaStream | null,
  presetId: ScreenSharePresetId,
  peerConnections?: Map<string, RTCPeerConnection>
): Promise<boolean> {
  if (!stream) return false;
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return false;

  const preset = SCREEN_SHARE_PRESETS[presetId] || SCREEN_SHARE_PRESETS['1080p_90'];

  try {
    await videoTrack.applyConstraints({
      width: { ideal: preset.width, max: preset.width },
      height: { ideal: preset.height, max: preset.height },
      frameRate: { ideal: preset.frameRate, max: preset.frameRate },
    });
  } catch (err) {
    console.warn("Could not apply exact screen share constraints:", err);
  }

  // Adjust RTCRtpSender parameters on all peer connections
  if (peerConnections) {
    peerConnections.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && (sender.track.id === videoTrack.id || sender.track.label.toLowerCase().includes("screen"))) {
          try {
            const params = sender.getParameters();
            if (params.encodings && params.encodings.length > 0) {
              params.encodings.forEach((enc) => {
                enc.maxBitrate = preset.maxBitrateBps;
                enc.maxFramerate = preset.frameRate;
              });
              sender.setParameters(params).catch(() => {});
            }
          } catch (e) {
            // ignore
          }
        }
      });
    });
  }

  return true;
}
