export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // Primary Google STUN cluster
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"] },
    // Mozilla STUN
    { urls: ["stun:stun.services.mozilla.com"] },
    // Twilio STUN
    { urls: ["stun:global.stun.twilio.com:3478"] },
    // Cloudflare STUN
    { urls: ["stun:stun.cloudflare.com:3478"] },
    // Nextcloud STUN
    { urls: ["stun:stun.nextcloud.com:443"] },
    // Sipgate STUN
    { urls: ["stun:stun.sipgate.net:3478"] },
    // Open Relay Project (Free public WebRTC relay fallback for symmetric NATs / mobile networks)
    {
      urls: [
        "stun:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelay",
      credential: "openrelay",
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

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
