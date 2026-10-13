import { apiUrl } from "./backend";
/**
 * Configuração de Servidores ICE (STUN & TURN) para WebRTC
 * 
 * NOTA SOBRE CONEXÃO ENTRE REDES DIFERENTES (NAT / FIREWALL):
 * Os servidores STUN permitem que os navegadores descubram seus IPs públicos
 * para estabelecer conexões P2P diretas. No entanto, em redes com NAT Simétrico
 * ou CGNAT (muito comum em redes móveis 4G/5G ou redes corporativas restritas),
 * a conexão direta pode ser bloqueada pelo firewall.
 * Nesses casos, SEM um servidor TURN (relay), os pacotes de vídeo da tela não chegam
 * e o receptor fica com a tela preta.
 * 
 * A configuração abaixo mantém os servidores STUN do Google e já deixa o TURN preparado
 * para uso imediato via variáveis de ambiente ou com relay de contingência configurado.
 */

export interface TurnServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

// Configuração dedicada para servidor TURN customizado
export const CUSTOM_TURN_CONFIG: TurnServerConfig = {
  urls: [
    (import.meta as any).env?.VITE_TURN_URL || "turn:openrelay.metered.ca:80",
    "turn:openrelay.metered.ca:443",
    "turn:openrelay.metered.ca:443?transport=tcp",
  ],
  username: (import.meta as any).env?.VITE_TURN_USERNAME || "openrelay",
  credential: (import.meta as any).env?.VITE_TURN_CREDENTIAL || "openrelay",
};

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // Servidores STUN públicos do Google (alta disponibilidade e baixa latência)
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"] },
    // Servidores STUN secundários
    { urls: ["stun:stun.services.mozilla.com"] },
    { urls: ["stun:stun.cloudflare.com:3478"] },

    // Servidor TURN configurado para retransmissão quando P2P direto for bloqueado por NAT
    {
      urls: CUSTOM_TURN_CONFIG.urls,
      username: CUSTOM_TURN_CONFIG.username,
      credential: CUSTOM_TURN_CONFIG.credential,
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

// Busca o TURN (ExpressTURN ou Cloudflare) no servidor e coloca na frente da lista.
// Se não estiver configurado, continua usando os servidores acima.
async function loadCloudflareTurn(): Promise<void> {
  try {
    const res = await fetch(apiUrl("/api/turn-credentials"));
    const data = await res.json();
    if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
      const stun = (RTC_CONFIG.iceServers || []).filter((s) =>
        (Array.isArray(s.urls) ? s.urls : [s.urls]).every((u) => String(u).startsWith("stun:"))
      );
      RTC_CONFIG.iceServers = [...data.iceServers, ...stun];
    }
  } catch {
    // mantém a configuração padrão
  }
}
if (typeof window !== "undefined") {
  void loadCloudflareTurn();
}

export const DEFAULT_MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
  },
};

export const LOW_RESOURCE_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 640, max: 854 },
    height: { ideal: 360, max: 480 },
    frameRate: { ideal: 15, max: 24 },
  },
};
