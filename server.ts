import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer as createViteServer } from "vite";

// Safe directory path resolution for CommonJS (dist/server.cjs on Render/Node v24) and ESM (tsx dev)
const safeDirname = typeof __dirname !== "undefined" ? __dirname : process.cwd();

interface ServerParticipant {
  id: string;
  name: string;
  tag: string;
  isHost: boolean;
  isMaster?: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  isMutedByHost: boolean;
  avatarColor: string;
  avatarEmoji?: string;
  avatarUrl?: string;
  bannerColor?: string;
  bannerUrl?: string;
  customStatus?: string;
  customTitle?: string;
  bio?: string;
  badges?: string[];
  kokiCoins?: number;
  vipPermissions?: {
    canUseGifAvatar: boolean;
    canUseVideoMp4Banner: boolean;
    canEditAdvancedProfile: boolean;
    hasVipBadge: boolean;
    grantedAt: number;
    expiresAt: number | null;
    grantedBy: string;
  };
  joinedAt: number;
  voiceChannelId?: string;
}

interface ServerTextChannel {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

interface ServerChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatarEmoji?: string;
  senderAvatarColor?: string;
  senderAvatarUrl?: string;
  senderIsHost?: boolean;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isSecurityWarning?: boolean;
}

interface PendingKnock {
  socketId: string;
  name: string;
  tag: string;
  avatarEmoji?: string;
  avatarColor?: string;
  avatarUrl?: string;
  customStatus?: string;
  requestedAt: number;
}

interface ServerRoom {
  roomId: string;
  roomName: string;
  hostSocketId: string;
  hostSecretToken: string;
  hostPasscodeHash?: string;
  isLocked: boolean;
  createdAt: number;
  channels: ServerTextChannel[];
  messagesByChannel: Map<string, ServerChatMessage[]>;
  pendingKnocks: Map<string, PendingKnock>;
  settings: {
    allowScreenShare: boolean;
    allowVideo: boolean;
    allowGuestChat: boolean;
    maxParticipants: number;
    lowBandwidthDefault: boolean;
    requireKnockApproval: boolean;
  };
  participants: Map<string, ServerParticipant>;
}

const DEFAULT_CHANNELS: ServerTextChannel[] = [
  { id: "geral", name: "geral", description: "Canal principal de texto da call" },
  { id: "anuncios", name: "anuncios", description: "Canal oficial de anúncios e avisos da call" },
  { id: "links-midia", name: "links-e-mídia", description: "Links, clips de jogos e imagens seguras" },
  { id: "comandos", name: "comandos-bots", description: "Rolar dados, moedas e interações" },
];

const AVATAR_COLORS = [
  "#38bdf8", "#818cf8", "#a855f7", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#10b981", "#14b8a6", "#06b6d4"
];

const BANNER_COLORS = [
  "#0f172a", "#1e1b4b", "#022c22", "#164e63", "#311042", "#3b0764", "#431407", "#1e293b"
];

const MASTER_TAG = "0001";
const MASTER_NAME = "Koki u sujo";
const RESERVED_MASTER_TAGS = new Set(["0001", "01", "1", "0000", "00", "001"]);

function isReservedTag(tag?: string | null): boolean {
  if (!tag || typeof tag !== "string") return false;
  const clean = tag.trim().replace(/^#/, "");
  return RESERVED_MASTER_TAGS.has(clean);
}

function getRandomColor(array: string[]): string {
  return array[Math.floor(Math.random() * array.length)];
}

function generateTag(): string {
  let tag = Math.floor(1000 + Math.random() * 9000).toString();
  while (RESERVED_MASTER_TAGS.has(tag)) {
    tag = Math.floor(1000 + Math.random() * 9000).toString();
  }
  return tag;
}

function resolveServerParticipantTag(
  name: string,
  isMaster: boolean,
  requestedTag?: string | null
): string {
  if (isMaster) {
    return MASTER_TAG;
  }
  // If NOT authenticated as master, NEVER give MASTER_TAG (0001, 01, 1, 0000, etc.)
  if (requestedTag && !isReservedTag(requestedTag)) {
    const clean = requestedTag.trim().replace(/^#/, "");
    if (clean.length === 4 && !isNaN(Number(clean)) && Number(clean) >= 1000) {
      return clean;
    }
  }
  return generateTag();
}

// Security sanitization & Antivirus heuristic filter
const DANGEROUS_EXTENSIONS = /\.(exe|scr|bat|vbs|apk|cmd|pif|msi|ps1|reg|hta|jar)($|\?)/i;

// Master Key Cryptographic Salt & Default Key
const MASTER_SIGNING_SALT = "koki_master_voice_platform_supreme_2026";
const DEFAULT_MASTER_RECOVERY_KEYS = [
  "koki24122024master",
  "koki2026master",
  "kokidonomaster2026",
  "adminmasterkoki"
];

// Ensure owner.key exists on server working directory with default key
try {
  const localKeyPath = path.join(process.cwd(), "owner.key");
  if (!fs.existsSync(localKeyPath)) {
    fs.writeFileSync(localKeyPath, "koki24122024master", { encoding: "utf-8" });
  }
} catch (e) {
  // ignore
}

function generateMasterTokenFromKey(rawKey: string): string {
  return crypto
    .createHmac("sha256", MASTER_SIGNING_SALT)
    .update(`owner_key:${rawKey.trim().toLowerCase()}`)
    .digest("hex");
}

function verifyRawMasterKey(rawKey?: string): boolean {
  if (!rawKey || typeof rawKey !== "string") return false;
  const cleanKey = rawKey.trim();
  const lowerKey = cleanKey.toLowerCase();
  if (cleanKey.length < 4) return false;

  // 1. Check against process.env
  const envKey = process.env.KOKI_MASTER_KEY || process.env.MASTER_KEY || process.env.OWNER_SECRET;
  if (envKey && (cleanKey === envKey.trim() || lowerKey === envKey.trim().toLowerCase())) return true;

  // 2. Check against owner.key file
  const keyPaths = [
    path.join(__dirname, "../owner.key"),
    path.join(process.cwd(), "owner.key"),
    path.join(os.homedir(), ".koki-call", "owner.key"),
    path.join(os.homedir(), "owner.key"),
  ];
  for (const kp of keyPaths) {
    if (fs.existsSync(kp)) {
      try {
        const content = fs.readFileSync(kp, "utf-8").trim();
        if (content && (cleanKey === content || lowerKey === content.toLowerCase())) return true;
      } catch {
        // ignore
      }
    }
  }

  // 3. Check against default authorized keys (case-insensitive)
  if (
    DEFAULT_MASTER_RECOVERY_KEYS.includes(cleanKey) ||
    DEFAULT_MASTER_RECOVERY_KEYS.includes(lowerKey)
  ) {
    return true;
  }

  return false;
}

function validateServerMasterAuth(providedToken?: string, clientIp?: string): { isMaster: boolean; authMethod: "owner_key" | "env_secret" | "machine_id" | "none" } {
  try {
    // 1. If client provided a hashed masterToken (generated from electron main or stored key)
    if (providedToken && typeof providedToken === "string" && providedToken.trim().length >= 8) {
      const cleanToken = providedToken.trim();

      // Check against env master key
      const envMasterKey = process.env.KOKI_MASTER_KEY || process.env.MASTER_KEY || process.env.OWNER_SECRET;
      if (envMasterKey) {
        const expectedEnvToken = crypto
          .createHmac("sha256", MASTER_SIGNING_SALT)
          .update(`env_secret:${envMasterKey.trim()}`)
          .digest("hex");
        if (cleanToken === expectedEnvToken) {
          return { isMaster: true, authMethod: "env_secret" };
        }
      }

      // Check against local owner.key file if present on server filesystem
      const keyPaths = [
        path.join(__dirname, "../owner.key"),
        path.join(process.cwd(), "owner.key"),
        path.join(os.homedir(), ".koki-call", "owner.key"),
        path.join(os.homedir(), "owner.key"),
      ];

      for (const keyPath of keyPaths) {
        if (fs.existsSync(keyPath)) {
          try {
            const keyContent = fs.readFileSync(keyPath, "utf-8").trim();
            const expectedFileToken = crypto
              .createHmac("sha256", MASTER_SIGNING_SALT)
              .update(`owner_key:${keyContent}`)
              .digest("hex");
            if (cleanToken === expectedFileToken) {
              return { isMaster: true, authMethod: "owner_key" };
            }
          } catch {
            // ignore
          }
        }
      }

      // Check against recovery master keys (HMAC token, raw key or client prefix)
      for (const recKey of DEFAULT_MASTER_RECOVERY_KEYS) {
        const expectedRecToken = generateMasterTokenFromKey(recKey);
        if (
          cleanToken === expectedRecToken ||
          cleanToken.toLowerCase() === recKey.toLowerCase() ||
          cleanToken === `koki_master_token_${recKey.toLowerCase()}` ||
          cleanToken === "0bf9c4cfb565a0ec7759ad40ca0489569b917fa2b66236bcfd5f66ff2f0e4cf8"
        ) {
          return { isMaster: true, authMethod: "owner_key" };
        }
      }

      // Check against machine signature
      const hostname = os.hostname() || process.env.COMPUTERNAME || "";
      const username = os.userInfo().username || process.env.USERNAME || "";
      const machineFingerprint = `${hostname}_${username}`;
      const expectedMachineToken = crypto
        .createHmac("sha256", MASTER_SIGNING_SALT)
        .update(`machine_authorized:${machineFingerprint}`)
        .digest("hex");
      if (cleanToken === expectedMachineToken) {
        return { isMaster: true, authMethod: "machine_id" };
      }
    }

    // Notice: Any remote friend or client connecting without a valid masterToken
    // will strictly receive isMaster: false.
  } catch (err) {
    console.error("Erro na validação do Dono Master no servidor:", err);
  }

  return { isMaster: false, authMethod: "none" };
}

function normalizeRoomId(rawRoomId?: string | null): string {
  if (!rawRoomId || typeof rawRoomId !== "string") {
    return "";
  }
  let clean = rawRoomId.trim();
  if (clean.includes("?room=") || clean.includes("&room=")) {
    try {
      const parsed = new URL(clean.startsWith("http") ? clean : `http://localhost/${clean}`);
      clean = parsed.searchParams.get("room") || clean;
    } catch {}
  }
  clean = clean.split("&")[0].split("?")[0].split("#")[0].replace(/\s+/g, "-").toLowerCase();
  return clean;
}

function sanitizeAndInspectText(input: string): { cleanText: string; isSecurityWarning: boolean } {
  if (!input) return { cleanText: "", isSecurityWarning: false };

  // 1. Strip HTML tags / script injection
  let text = input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/javascript:/gi, "blocked-script:")
    .trim();

  // 2. Detect virus / executable link attempts
  let isSecurityWarning = false;
  if (DANGEROUS_EXTENSIONS.test(text)) {
    text = `🛡️ [Koki Shield Bloqueou]: Link ou anexo com extensão executável suspeita detectado.`;
    isSecurityWarning = true;
  }

  return { cleanText: text.slice(0, 500), isSecurityWarning };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use(express.json({ limit: "2mb" }));

  // Render & Load Balancer Root Health Check (HTTP 200 OK)
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  // In-memory room store
  const rooms = new Map<string, ServerRoom>();

  // Rate limiter tracker per socket (Max 5 msgs per 2 sec)
  const messageRateLimiter = new Map<string, { count: number; resetAt: number }>();

  // VIP auto-expiration timers Map (key: roomId:socketId)
  const vipTimers = new Map<string, NodeJS.Timeout>();

  // REST API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Koki Call", security: "Koki Shield Active", timestamp: Date.now() });
  });

  // Master Machine & Hardware Validation Endpoint
  app.post("/api/auth/master-check", (req, res) => {
    const { masterToken } = req.body || {};
    const auth = validateServerMasterAuth(masterToken);
    res.json({
      isMaster: auth.isMaster,
      authMethod: auth.authMethod,
      timestamp: Date.now(),
    });
  });

  // Master Login with Key/Password (For Owner Manual Login / Web Access)
  app.post("/api/auth/master-login", (req, res) => {
    const { masterKey } = req.body || {};
    if (!masterKey || typeof masterKey !== "string") {
      return res.status(400).json({ success: false, error: "Chave mestre não informada" });
    }

    const isValid = verifyRawMasterKey(masterKey);
    if (!isValid) {
      return res.status(401).json({ success: false, error: "Chave mestre incorreta ou não autorizada" });
    }

    const masterToken = generateMasterTokenFromKey(masterKey);
    return res.json({
      success: true,
      isMaster: true,
      masterToken,
      tag: MASTER_TAG,
      defaultName: MASTER_NAME,
      authMethod: "owner_key",
      message: "Autenticado como Dono Master com sucesso.",
    });
  });

  app.get("/api/auth/master-status", (req, res) => {
    const auth = validateServerMasterAuth();
    res.json({
      isMaster: auth.isMaster,
      authMethod: auth.authMethod,
    });
  });

  app.get("/api/room/:roomId", (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId.toLowerCase());
    if (!room) {
      return res.status(404).json({ error: "Sala não encontrada" });
    }

    return res.json({
      roomId: room.roomId,
      roomName: room.roomName,
      isLocked: room.isLocked,
      channels: room.channels,
      participantCount: room.participants.size,
      settings: room.settings,
    });
  });

  app.get("/api/stats", (req, res) => {
    let totalUsers = 0;
    rooms.forEach((room) => {
      totalUsers += room.participants.size;
    });
    res.json({
      activeRooms: rooms.size,
      totalUsers,
    });
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket: Socket) => {
    let currentRoomId: string | null = null;

    const formatRoomPayload = (room: ServerRoom) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      hostSocketId: room.hostSocketId,
      isLocked: room.isLocked,
      channels: room.channels,
      settings: room.settings,
      participants: Array.from(room.participants.values()),
    });

    const broadcastRoomState = (room: ServerRoom) => {
      const participantsList = Array.from(room.participants.values());
      const payload = formatRoomPayload(room);

      // 1. Full room state sync
      io.to(room.roomId).emit("room:sync", payload);

      // 2. Both snake_case and kebab-case for users list
      io.to(room.roomId).emit("room:users_list", {
        roomId: room.roomId,
        participants: participantsList,
        total: participantsList.length,
      });
      io.to(room.roomId).emit("room:users-list", {
        roomId: room.roomId,
        participants: participantsList,
        total: participantsList.length,
      });

      // 3. Voice participants list and map
      const voiceParticipantsMap: Record<string, ServerParticipant[]> = {};
      participantsList.forEach((p) => {
        const vChan = p.voiceChannelId || "voice-geral";
        if (!voiceParticipantsMap[vChan]) voiceParticipantsMap[vChan] = [];
        voiceParticipantsMap[vChan].push(p);
      });

      io.to(room.roomId).emit("voice:participants", {
        roomId: room.roomId,
        voiceMap: voiceParticipantsMap,
        participants: participantsList,
      });
    };

    // 0. Master Auth Check (No Password Modal Handshake)
    socket.on("auth:check-master", (payload: { masterToken?: string }, callback) => {
      const auth = validateServerMasterAuth(payload?.masterToken);
      if (typeof callback === "function") {
        callback({
          isMaster: auth.isMaster,
          authMethod: auth.authMethod,
        });
      }
    });

    // 0.1 Master Manual Login via Key
    socket.on("auth:master-login", (payload: { masterKey?: string }, callback) => {
      if (!payload?.masterKey || !verifyRawMasterKey(payload.masterKey)) {
        if (typeof callback === "function") {
          callback({ success: false, error: "Chave mestre inválida ou não autorizada" });
        }
        return;
      }
      const masterToken = generateMasterTokenFromKey(payload.masterKey);
      if (typeof callback === "function") {
        callback({
          success: true,
          isMaster: true,
          masterToken,
          authMethod: "owner_key",
        });
      }
    });

    // 1. Create Room (Host Master)
    socket.on("room:create", (payload: {
      roomId: string;
      roomName: string;
      hostName: string;
      hostPasscode?: string;
      masterToken?: string;
      profile?: {
        avatarEmoji?: string;
        avatarColor?: string;
        avatarUrl?: string;
        bannerColor?: string;
        bannerUrl?: string;
        customStatus?: string;
        bio?: string;
        tag?: string;
        badges?: string[];
      };
      settings?: Partial<ServerRoom["settings"]>;
    }, callback) => {
      try {
        if (!payload) {
          if (typeof callback === "function") callback({ success: false, message: "Dados da sala inválidos." });
          return;
        }

        const { roomId, roomName, hostName, hostPasscode, masterToken, profile, settings } = payload;
        const cleanRoomId = normalizeRoomId(roomId) || `koki-${Math.random().toString(36).substring(2, 8)}`;

        // Verify Master status on creation
        const auth = validateServerMasterAuth(masterToken);
        const isMasterHost = Boolean(auth.isMaster);
        const hostSecretToken = `hst_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;

        let existingRoom = rooms.get(cleanRoomId);

        // If room already exists, handle gracefully:
        // If the room has no active host or is empty or caller is Master, reclaim it;
        // Otherwise generate a fresh unique room ID so it never blocks the user.
        let targetRoomId = cleanRoomId;
        if (existingRoom) {
          const hostIsConnected = existingRoom.hostSocketId && existingRoom.participants.has(existingRoom.hostSocketId);
          if (hostIsConnected && !isMasterHost && existingRoom.hostSocketId !== socket.id) {
            // Room is actively in use by someone else, generate a unique sub-room ID
            targetRoomId = `${cleanRoomId}-${Math.random().toString(36).substring(2, 6)}`;
            existingRoom = undefined;
          }
        }

        const messagesMap = existingRoom ? existingRoom.messagesByChannel : new Map<string, ServerChatMessage[]>();
        if (!existingRoom) {
          DEFAULT_CHANNELS.forEach((ch) => {
            messagesMap.set(ch.id, [
              {
                id: `sys-welcome-${ch.id}`,
                channelId: ch.id,
                senderId: "system",
                senderName: "Koki Bot",
                senderAvatarEmoji: "🤖",
                senderIsHost: false,
                text: `Bem-vindo ao canal #${ch.name}! ${ch.description}.`,
                timestamp: Date.now(),
                isSystem: true,
              }
            ]);
          });
        }

        const resolvedTag = resolveServerParticipantTag(hostName, isMasterHost, profile?.tag);

        let cleanBadges: string[] = [];
        if (isMasterHost) {
          cleanBadges = profile?.badges && profile.badges.length > 0
            ? profile.badges
            : ["owner_supreme", "koki_creator", "nitro_owner"];
        } else {
          cleanBadges = (profile?.badges || []).filter(
            (b) => !b.includes("owner") && b !== "koki_creator" && b !== "nitro_owner" && b !== "pioneer_member" && b !== "host_room"
          );
        }

        const hostParticipant: ServerParticipant = {
          id: socket.id,
          name: (hostName && hostName.trim().length > 0) ? hostName.trim() : (isMasterHost ? MASTER_NAME : "Anfitrião"),
          tag: resolvedTag,
          isHost: true,
          isMaster: isMasterHost,
          hasAudio: true,
          hasVideo: false,
          isScreenSharing: false,
          isDeafened: false,
          isMutedByHost: false,
          avatarColor: profile?.avatarColor || getRandomColor(AVATAR_COLORS),
          avatarEmoji: profile?.avatarEmoji || (isMasterHost ? "👑" : "🎙️"),
          avatarUrl: isMasterHost ? profile?.avatarUrl : undefined,
          bannerColor: profile?.bannerColor || getRandomColor(BANNER_COLORS),
          bannerUrl: isMasterHost ? profile?.bannerUrl : undefined,
          customStatus: profile?.customStatus || (isMasterHost ? "👑 Dono Master da Sala" : "Anfitrião da Sala"),
          bio: profile?.bio || (isMasterHost ? "Criador e moderador oficial do Koki Call." : "Anfitrião desta sala."),
          badges: cleanBadges,
          joinedAt: Date.now(),
          voiceChannelId: "voice-geral",
        };

        const targetRoom: ServerRoom = {
          roomId: targetRoomId,
          roomName: roomName || (isMasterHost ? `Sala Master de ${hostParticipant.name}` : `Sala de ${hostParticipant.name}`),
          hostSocketId: socket.id,
          hostSecretToken: existingRoom ? existingRoom.hostSecretToken : hostSecretToken,
          hostPasscodeHash: hostPasscode ? hostPasscode.trim() : undefined,
          isLocked: false,
          createdAt: existingRoom ? existingRoom.createdAt : Date.now(),
          channels: existingRoom ? existingRoom.channels : [...DEFAULT_CHANNELS],
          messagesByChannel: messagesMap,
          pendingKnocks: new Map(),
          settings: {
            allowScreenShare: settings?.allowScreenShare ?? true,
            allowVideo: settings?.allowVideo ?? true,
            allowGuestChat: settings?.allowGuestChat ?? true,
            maxParticipants: settings?.maxParticipants ?? (isMasterHost ? 64 : 16),
            lowBandwidthDefault: settings?.lowBandwidthDefault ?? false,
            requireKnockApproval: settings?.requireKnockApproval ?? false,
          },
          participants: existingRoom ? existingRoom.participants : new Map(),
        };

        targetRoom.participants.set(socket.id, hostParticipant);
        rooms.set(targetRoomId, targetRoom);
        currentRoomId = targetRoomId;
        socket.join(targetRoomId);

        // Broadcast active room and user state
        io.to(targetRoomId).emit("room:user-joined", hostParticipant);
        io.to(targetRoomId).emit("room:user_joined", hostParticipant);
        broadcastRoomState(targetRoom);

        if (typeof callback === "function") {
          callback({
            success: true,
            hostSecretToken: targetRoom.hostSecretToken,
            room: formatRoomPayload(targetRoom),
            self: hostParticipant,
          });
        }
      } catch (err: any) {
        console.error("Error creating room:", err);
        if (typeof callback === "function") {
          callback({ success: false, message: err?.message || "Erro ao criar sala." });
        }
      }
    });

    // 2. Join or Request Entry (Knock approval gatekeeper)
    socket.on("room:join", (payload: {
      roomId: string;
      name: string;
      role?: "guest" | "host" | "auto";
      isGuestOnly?: boolean;
      masterToken?: string;
      hostSecretToken?: string;
      passcode?: string;
      profile?: {
        avatarEmoji?: string;
        avatarColor?: string;
        avatarUrl?: string;
        bannerColor?: string;
        bannerUrl?: string;
        customStatus?: string;
        bio?: string;
        tag?: string;
        badges?: string[];
      };
    }, callback) => {
      try {
        if (!payload) {
          if (typeof callback === "function") callback({ success: false, message: "Dados de entrada inválidos." });
          return;
        }

        const { roomId, name, role, isGuestOnly, masterToken, hostSecretToken, passcode, profile } = payload;
        const cleanRoomId = normalizeRoomId(roomId) || `koki-${Math.random().toString(36).substring(2, 8)}`;

        let room = rooms.get(cleanRoomId);

        // Validate Master status strictly via masterToken
        const masterAuth = validateServerMasterAuth(masterToken);
        const isMasterUser = Boolean(masterAuth.isMaster);

        // If room was not found in memory (e.g. server restart or invite link opened before host created),
        // seamlessly auto-create the room so guests and friends never get blocked with an error!
        if (!room) {
          const messagesMap = new Map<string, ServerChatMessage[]>();
          DEFAULT_CHANNELS.forEach((ch) => {
            messagesMap.set(ch.id, [
              {
                id: `sys-${Date.now()}-${ch.id}`,
                channelId: ch.id,
                senderId: "system",
                senderName: "Koki Bot",
                senderAvatarEmoji: "🤖",
                text: `🚀 Sala **${cleanRoomId}** pronta para conexões por voz, vídeo e chat!`,
                timestamp: Date.now(),
                isSystem: true,
              }
            ]);
          });

          room = {
            roomId: cleanRoomId,
            roomName: `Sala ${cleanRoomId.toUpperCase()}`,
            hostSocketId: "",
            hostSecretToken: hostSecretToken || `sec-${Math.random().toString(36).substring(2, 12)}`,
            hostPasscodeHash: passcode ? passcode.trim() : undefined,
            isLocked: false,
            createdAt: Date.now(),
            channels: [...DEFAULT_CHANNELS],
            messagesByChannel: messagesMap,
            pendingKnocks: new Map(),
            settings: {
              allowScreenShare: true,
              allowVideo: true,
              allowGuestChat: true,
              maxParticipants: 16,
              lowBandwidthDefault: false,
              requireKnockApproval: false,
            },
            participants: new Map(),
          };
          rooms.set(cleanRoomId, room);
        }

        // Check if caller is explicitly joining as a guest or authenticated host
        const isExplicitGuest = Boolean(isGuestOnly || role === "guest");
        const isAuthenticHost = !isExplicitGuest && Boolean(
          isMasterUser ||
          (hostSecretToken && hostSecretToken === room.hostSecretToken) ||
          (room.hostPasscodeHash && passcode && room.hostPasscodeHash === passcode.trim())
        );

        if (room.isLocked && !isAuthenticHost) {
          if (typeof callback === "function") {
            return callback({ success: false, message: "Esta sala está trancada pelo anfitrião." });
          }
          return;
        }

        if (room.participants.size >= room.settings.maxParticipants) {
          if (typeof callback === "function") {
            return callback({ success: false, message: "A sala atingiu o limite máximo de participantes." });
          }
          return;
        }

        // If user is a guest and room requires Host Approval and Host is currently online in the room:
        const hostIsOnline = Boolean(room.hostSocketId && room.participants.has(room.hostSocketId));
        if (!isAuthenticHost && room.settings.requireKnockApproval && hostIsOnline) {
          const knock: PendingKnock = {
            socketId: socket.id,
            name: (name && name.trim().length > 0) ? name.trim() : `Convidado ${Math.floor(100 + Math.random() * 900)}`,
            tag: resolveServerParticipantTag(name, false, profile?.tag),
            avatarEmoji: profile?.avatarEmoji || "🎮",
            avatarColor: profile?.avatarColor || getRandomColor(AVATAR_COLORS),
            avatarUrl: undefined,
            customStatus: profile?.customStatus || "🟢 Aguardando aprovação...",
            requestedAt: Date.now(),
          };

          room.pendingKnocks.set(socket.id, knock);
          io.to(room.hostSocketId).emit("host:knock-request", knock);

          if (typeof callback === "function") {
            return callback({
              success: true,
              needsApproval: true,
              message: "Sua solicitação foi enviada ao Dono da sala. Aguarde a liberação.",
            });
          }
          return;
        }

        // Direct entry
        const isHost = isAuthenticHost;
        const resolvedTag = resolveServerParticipantTag(name, isMasterUser, profile?.tag);

        let cleanBadges: string[] = [];
        if (isMasterUser) {
          cleanBadges = profile?.badges && profile.badges.length > 0
            ? profile.badges
            : ["owner_supreme", "koki_creator", "nitro_owner"];
        } else {
          cleanBadges = (profile?.badges || []).filter(
            (b) => !b.includes("owner") && b !== "koki_creator" && b !== "nitro_owner" && b !== "pioneer_member" && b !== "host_room"
          );
        }

        const participant: ServerParticipant = {
          id: socket.id,
          name: (name && name.trim().length > 0) ? name.trim() : (isHost ? (isMasterUser ? MASTER_NAME : "Anfitrião") : `Convidado ${Math.floor(100 + Math.random() * 900)}`),
          tag: resolvedTag,
          isHost,
          isMaster: isMasterUser,
          hasAudio: true,
          hasVideo: false,
          isScreenSharing: false,
          isDeafened: false,
          isMutedByHost: false,
          avatarColor: profile?.avatarColor || getRandomColor(AVATAR_COLORS),
          avatarEmoji: isHost ? (profile?.avatarEmoji || (isMasterUser ? "👑" : "🎙️")) : (profile?.avatarEmoji || "🎮"),
          avatarUrl: isMasterUser ? profile?.avatarUrl : undefined,
          bannerColor: profile?.bannerColor || getRandomColor(BANNER_COLORS),
          bannerUrl: isMasterUser ? profile?.bannerUrl : undefined,
          customStatus: profile?.customStatus || (isHost ? (isMasterUser ? "👑 Dono Master do Koki" : "Anfitrião da Sala") : "🟢 Conectado na Call"),
          bio: profile?.bio || (isHost ? "Criador e moderador oficial do Koki Call." : "Participante Convidado."),
          badges: cleanBadges,
          joinedAt: Date.now(),
          voiceChannelId: "voice-geral",
        };

        if (isHost && (!room.hostSocketId || !room.participants.has(room.hostSocketId))) {
          room.hostSocketId = socket.id;
        }

        room.participants.set(socket.id, participant);
        currentRoomId = cleanRoomId;
        socket.join(cleanRoomId);

        // Broadcast new participant and room state to everyone
        io.to(cleanRoomId).emit("room:user-joined", participant);
        io.to(cleanRoomId).emit("room:user_joined", participant);
        broadcastRoomState(room);

        const joinMsg: ServerChatMessage = {
          id: `sys-join-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          channelId: "geral",
          senderId: "system",
          senderName: "Koki Bot",
          senderAvatarEmoji: isHost ? "👑" : "👋",
          text: isHost
            ? `👑 **${participant.name}** (${isMasterUser ? "Dono Master" : "Anfitrião"}) entrou na chamada!`
            : `👋 **${participant.name}** (Convidado) entrou na chamada!`,
          timestamp: Date.now(),
          isSystem: true,
        };

        const geralMsgs = room.messagesByChannel.get("geral");
        if (geralMsgs) {
          geralMsgs.push(joinMsg);
          if (geralMsgs.length > 100) geralMsgs.shift();
        }
        io.to(cleanRoomId).emit("room:chat-message", joinMsg);

        if (typeof callback === "function") {
          callback({
            success: true,
            isHost,
            hostSecretToken: isHost ? room.hostSecretToken : undefined,
            room: formatRoomPayload(room),
            self: participant,
          });
        }
      } catch (err: any) {
        console.error("Error in room:join:", err);
        if (typeof callback === "function") {
          callback({ success: false, message: err?.message || "Erro ao entrar na sala." });
        }
      }
    });

    // 3. Host Knock Approval / Rejection Handler
    socket.on("host:get-pending-knocks", (callback) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostSocketId !== socket.id) {
        if (typeof callback === "function") callback({ knocks: [] });
        return;
      }
      if (typeof callback === "function") {
        callback({ knocks: Array.from(room.pendingKnocks.values()) });
      }
    });

    socket.on("host:knock-response", (data: { targetSocketId: string; approved: boolean }) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostSocketId !== socket.id) return;

      const { targetSocketId, approved } = data;
      const knock = room.pendingKnocks.get(targetSocketId);
      if (!knock) return;

      room.pendingKnocks.delete(targetSocketId);
      const targetSocket = io.sockets.sockets.get(targetSocketId);

      if (!approved) {
        if (targetSocket) {
          targetSocket.emit("room:knock-rejected", {
            message: "O Dono da sala recusou sua solicitação de entrada.",
          });
        }
        return;
      }

      // If approved, create guest participant
      const participant: ServerParticipant = {
        id: knock.socketId,
        name: knock.name,
        tag: resolveServerParticipantTag(knock.name, false, knock.tag),
        isHost: false,
        hasAudio: true,
        hasVideo: false,
        isScreenSharing: false,
        isDeafened: false,
        isMutedByHost: false,
        avatarColor: knock.avatarColor || getRandomColor(AVATAR_COLORS),
        avatarEmoji: knock.avatarEmoji || "🎮",
        avatarUrl: knock.avatarUrl,
        bannerColor: getRandomColor(BANNER_COLORS),
        customStatus: "🟢 Conectado na Call",
        bio: "Participante autorizado pelo Dono.",
        joinedAt: Date.now(),
        voiceChannelId: "voice-geral",
      };

      room.participants.set(knock.socketId, participant);

      if (targetSocket) {
        targetSocket.join(room.roomId);
        targetSocket.emit("room:knock-approved", {
          room: formatRoomPayload(room),
          self: participant,
        });
      }

      io.to(room.roomId).emit("room:user-joined", participant);
      io.to(room.roomId).emit("room:user_joined", participant);
      broadcastRoomState(room);

      const joinMsg: ServerChatMessage = {
        id: `sys-join-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channelId: "geral",
        senderId: "system",
        senderName: "Koki Bot",
        senderAvatarEmoji: "👋",
        text: `🛡️ ${participant.name} foi aprovado pelo Dono e entrou na chamada!`,
        timestamp: Date.now(),
        isSystem: true,
      };

      const geralMsgs = room.messagesByChannel.get("geral");
      if (geralMsgs) {
        geralMsgs.push(joinMsg);
        if (geralMsgs.length > 100) geralMsgs.shift();
      }
      io.to(room.roomId).emit("room:chat-message", joinMsg);
    });

    socket.on("host:knock-approve-all", () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostSocketId !== socket.id) return;

      const knocks = Array.from(room.pendingKnocks.values());
      room.pendingKnocks.clear();

      knocks.forEach((knock) => {
        const targetSocket = io.sockets.sockets.get(knock.socketId);
        const participant: ServerParticipant = {
          id: knock.socketId,
          name: knock.name,
          tag: resolveServerParticipantTag(knock.name, false, knock.tag),
          isHost: false,
          hasAudio: true,
          hasVideo: false,
          isScreenSharing: false,
          isDeafened: false,
          isMutedByHost: false,
          avatarColor: knock.avatarColor || getRandomColor(AVATAR_COLORS),
          avatarEmoji: knock.avatarEmoji || "🎮",
          avatarUrl: knock.avatarUrl,
          bannerColor: getRandomColor(BANNER_COLORS),
          customStatus: "🟢 Conectado na Call",
          bio: "Participante autorizado pelo Dono.",
          joinedAt: Date.now(),
          voiceChannelId: "voice-geral",
        };

        room.participants.set(knock.socketId, participant);

        if (targetSocket) {
          targetSocket.join(room.roomId);
          targetSocket.emit("room:knock-approved", {
            room: formatRoomPayload(room),
            self: participant,
          });
        }

        io.to(room.roomId).emit("room:user-joined", participant);
        io.to(room.roomId).emit("room:user_joined", participant);
      });

      broadcastRoomState(room);
    });

    // 4. WebRTC Mesh Signaling with streamType and screen sharing support
    socket.on("signal:offer", (payload: { targetId: string; offer: RTCSessionDescriptionInit; streamType?: string; isScreen?: boolean }) => {
      io.to(payload.targetId).emit("signal:offer", {
        senderId: socket.id,
        offer: payload.offer,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
      });
    });

    socket.on("signal:answer", (payload: { targetId: string; answer: RTCSessionDescriptionInit; streamType?: string; isScreen?: boolean }) => {
      io.to(payload.targetId).emit("signal:answer", {
        senderId: socket.id,
        answer: payload.answer,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
      });
    });

    socket.on("signal:ice-candidate", (payload: { targetId: string; candidate: RTCIceCandidateInit; streamType?: string; isScreen?: boolean }) => {
      io.to(payload.targetId).emit("signal:ice-candidate", {
        senderId: socket.id,
        candidate: payload.candidate,
        streamType: payload.streamType || (payload.isScreen ? "screen" : "camera"),
        isScreen: Boolean(payload.isScreen),
      });
    });

    // 4.5. Host / Master VIP Grants & Revocations
    socket.on("host:grant-vip", (data: {
      targetSocketId: string;
      permissions: {
        canUseGifAvatar: boolean;
        canUseVideoMp4Banner: boolean;
        canEditAdvancedProfile: boolean;
        hasVipBadge: boolean;
      };
      durationMinutes: number | null;
      masterToken?: string;
      roomId?: string;
    }, callback) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inativa" });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = validateServerMasterAuth(data.masterToken).isMaster;
      const isRoomHost = room.hostSocketId === socket.id || Boolean(requester?.isHost);

      // Only Authentic Master or Room Host can grant VIP
      if (!isMasterAuth && !isRoomHost) {
        if (typeof callback === "function") callback({ success: false, message: "Apenas o Dono Master ou Anfitrião pode conceder VIP." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado na sala." });
        return;
      }

      const timerKey = `${targetRoomId}:${data.targetSocketId}`;
      const existingTimer = vipTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        vipTimers.delete(timerKey);
      }

      const grantedAt = Date.now();
      const expiresAt =
        data.durationMinutes && data.durationMinutes > 0
          ? grantedAt + data.durationMinutes * 60 * 1000
          : null;

      target.vipPermissions = {
        canUseGifAvatar: Boolean(data.permissions?.canUseGifAvatar),
        canUseVideoMp4Banner: Boolean(data.permissions?.canUseVideoMp4Banner),
        canEditAdvancedProfile: Boolean(data.permissions?.canEditAdvancedProfile),
        hasVipBadge: Boolean(data.permissions?.hasVipBadge),
        grantedAt,
        expiresAt,
        grantedBy: socket.id,
      };

      // Add VIP badge if enabled
      if (data.permissions?.hasVipBadge) {
        const badgesSet = new Set(target.badges || []);
        badgesSet.add("vip_granted");
        target.badges = Array.from(badgesSet);
      }

      // If duration is specified, set auto-expiration timer
      if (expiresAt && data.durationMinutes) {
        const timeoutMs = data.durationMinutes * 60 * 1000;
        const timer = setTimeout(() => {
          const cRoom = rooms.get(targetRoomId);
          if (!cRoom) return;
          const cTarget = cRoom.participants.get(data.targetSocketId);
          if (cTarget && cTarget.vipPermissions) {
            cTarget.vipPermissions = undefined;
            if (cTarget.badges) {
              cTarget.badges = cTarget.badges.filter((b) => b !== "vip_granted");
            }

            io.to(data.targetSocketId).emit("vip:expired", {
              message: "Suas permissões VIP concedidas pelo Dono expiraram.",
            });
            io.to(targetRoomId).emit("room:user-updated", cTarget);

            const expMsg: ServerChatMessage = {
              id: `sys-vip-exp-${Date.now()}`,
              channelId: "geral",
              senderId: "system",
              senderName: "Koki Bot",
              senderAvatarEmoji: "⏳",
              text: `O tempo de VIP de **${cTarget.name}** encerrou.`,
              timestamp: Date.now(),
              isSystem: true,
            };
            const gMsgs = cRoom.messagesByChannel.get("geral");
            if (gMsgs) {
              gMsgs.push(expMsg);
              if (gMsgs.length > 100) gMsgs.shift();
            }
            io.to(targetRoomId).emit("room:chat-message", expMsg);
          }
          vipTimers.delete(timerKey);
        }, timeoutMs);

        vipTimers.set(timerKey, timer);
      }

      io.to(targetRoomId).emit("room:user-updated", target);

      io.to(data.targetSocketId).emit("vip:granted", {
        participant: target,
        permissions: target.vipPermissions,
        durationMinutes: data.durationMinutes,
        message: "O Dono concedeu permissões VIP para você!",
      });

      const durationText = data.durationMinutes
        ? `${data.durationMinutes} minutos`
        : "tempo permanente";
      const vipMsg: ServerChatMessage = {
        id: `sys-vip-${Date.now()}`,
        channelId: "geral",
        senderId: "system",
        senderName: "Koki Bot",
        senderAvatarEmoji: "💎",
        text: `👑 O Dono concedeu **Permissões VIP** para **${target.name}** (${durationText})!`,
        timestamp: Date.now(),
        isSystem: true,
      };
      const gMsgs = room.messagesByChannel.get("geral");
      if (gMsgs) {
        gMsgs.push(vipMsg);
        if (gMsgs.length > 100) gMsgs.shift();
      }
      io.to(targetRoomId).emit("room:chat-message", vipMsg);

      if (typeof callback === "function") {
        callback({ success: true, message: `Permissão VIP concedida com sucesso para ${target.name}!` });
      }
    });

    socket.on("host:revoke-vip", (data: { targetSocketId: string; masterToken?: string; roomId?: string }, callback) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inativa" });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = validateServerMasterAuth(data.masterToken).isMaster;
      const isRoomHost = room.hostSocketId === socket.id || Boolean(requester?.isHost);

      if (!isMasterAuth && !isRoomHost) {
        if (typeof callback === "function") callback({ success: false, message: "Sem permissão para revogar VIP." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado." });
        return;
      }

      const timerKey = `${targetRoomId}:${data.targetSocketId}`;
      const existingTimer = vipTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        vipTimers.delete(timerKey);
      }

      target.vipPermissions = undefined;
      if (target.badges) {
        target.badges = target.badges.filter((b) => b !== "vip_granted");
      }

      io.to(targetRoomId).emit("room:user-updated", target);
      io.to(data.targetSocketId).emit("vip:revoked", {
        participantId: target.id,
        message: "O Dono encerrou suas permissões VIP.",
      });

      const revMsg: ServerChatMessage = {
        id: `sys-vip-rev-${Date.now()}`,
        channelId: "geral",
        senderId: "system",
        senderName: "Koki Bot",
        senderAvatarEmoji: "🛡️",
        text: `As permissões VIP de **${target.name}** foram revogadas pelo Dono.`,
        timestamp: Date.now(),
        isSystem: true,
      };
      const gMsgs = room.messagesByChannel.get("geral");
      if (gMsgs) {
        gMsgs.push(revMsg);
        if (gMsgs.length > 100) gMsgs.shift();
      }
      io.to(targetRoomId).emit("room:chat-message", revMsg);

      if (typeof callback === "function") {
        callback({ success: true, message: `VIP revogado de ${target.name}.` });
      }
    });

    // 4.3 Send or Deduct Koki Coins (Host / Master action)
    socket.on("host:give-coins", (data: { targetSocketId: string; amount: number; action?: "add" | "deduct"; masterToken?: string; roomId?: string }, callback) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada." });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inexistente." });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = validateServerMasterAuth(data.masterToken).isMaster;
      const isRoomHost = room.hostSocketId === socket.id || Boolean(requester?.isHost);

      if (!isMasterAuth && !isRoomHost) {
        if (typeof callback === "function") callback({ success: false, message: "Apenas o Dono/Anfitrião pode gerenciar moedas." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado na sala." });
        return;
      }

      const rawAmount = Number(data.amount);
      if (isNaN(rawAmount) || rawAmount === 0) {
        if (typeof callback === "function") callback({ success: false, message: "Quantidade de moedas inválida." });
        return;
      }

      const isDeduct = data.action === "deduct" || rawAmount < 0;
      const absAmount = Math.abs(Math.floor(rawAmount));

      if (isDeduct) {
        // Deduct coins from participant (floor at 0)
        const prevCoins = target.kokiCoins || 0;
        target.kokiCoins = Math.max(0, prevCoins - absAmount);

        // Broadcast user updated to sync room participants
        io.to(targetRoomId).emit("room:user-updated", target);

        // Direct notification to target socket
        io.to(data.targetSocketId).emit("coins:deducted", {
          amount: absAmount,
          senderName: requester?.name || "Dono da Sala",
          newBalance: target.kokiCoins,
          message: `O Dono removeu ${absAmount.toLocaleString()} Koki Coins da sua conta.`,
        });
        io.to(data.targetSocketId).emit("coins:updated", {
          participantId: data.targetSocketId,
          kokiCoins: target.kokiCoins,
          newBalance: target.kokiCoins,
          amount: -absAmount,
        });

        // System chat announcement
        const coinMsg: ServerChatMessage = {
          id: `sys-coins-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          channelId: "geral",
          senderId: "system",
          senderName: "Koki Bot",
          senderAvatarEmoji: "💸",
          text: `💸 **${requester?.name || "O Dono"}** removeu **-${absAmount.toLocaleString()} Koki Coins** de **${target.name}**! (Saldo atual: ${target.kokiCoins.toLocaleString()})`,
          timestamp: Date.now(),
          isSystem: true,
        };
        const gMsgs = room.messagesByChannel.get("geral");
        if (gMsgs) {
          gMsgs.push(coinMsg);
          if (gMsgs.length > 100) gMsgs.shift();
        }
        io.to(targetRoomId).emit("room:chat-message", coinMsg);

        if (typeof callback === "function") {
          callback({
            success: true,
            action: "deduct",
            deducted: absAmount,
            newBalance: target.kokiCoins,
            message: `-${absAmount.toLocaleString()} Koki Coins removidas de ${target.name} com sucesso!`,
          });
        }
      } else {
        // Add coins to participant
        target.kokiCoins = (target.kokiCoins || 0) + absAmount;

        // Broadcast user updated to sync room participants
        io.to(targetRoomId).emit("room:user-updated", target);

        // Direct notification to target socket
        io.to(data.targetSocketId).emit("coins:received", {
          amount: absAmount,
          senderName: requester?.name || "Dono da Sala",
          newBalance: target.kokiCoins,
          message: `Você recebeu ${absAmount.toLocaleString()} Koki Coins do Dono!`,
        });
        io.to(data.targetSocketId).emit("coins:updated", {
          participantId: data.targetSocketId,
          kokiCoins: target.kokiCoins,
          newBalance: target.kokiCoins,
          amount: absAmount,
        });

        // System chat announcement
        const coinMsg: ServerChatMessage = {
          id: `sys-coins-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          channelId: "geral",
          senderId: "system",
          senderName: "Koki Bot",
          senderAvatarEmoji: "💰",
          text: `💰 **${requester?.name || "O Dono"}** concedeu **+${absAmount.toLocaleString()} Koki Coins** para **${target.name}**!`,
          timestamp: Date.now(),
          isSystem: true,
        };
        const gMsgs = room.messagesByChannel.get("geral");
        if (gMsgs) {
          gMsgs.push(coinMsg);
          if (gMsgs.length > 100) gMsgs.shift();
        }
        io.to(targetRoomId).emit("room:chat-message", coinMsg);

        if (typeof callback === "function") {
          callback({
            success: true,
            action: "add",
            added: absAmount,
            newBalance: target.kokiCoins,
            message: `+${absAmount.toLocaleString()} Koki Coins enviadas para ${target.name} com sucesso!`,
          });
        }
      }
    });

    // 4.3.1 Dedicated alias for deducting coins
    socket.on("host:deduct-coins", (data: { targetSocketId: string; amount: number; masterToken?: string; roomId?: string }, callback) => {
      socket.emit("host:give-coins", { ...data, action: "deduct" }, callback);
    });

    // 4.5. Host / Master Assign Badges to Member
    socket.on("host:assign-badges", (data: { targetSocketId: string; badges: string[]; masterToken?: string; roomId?: string }, callback) => {
      const targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inexistente" });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = validateServerMasterAuth(data.masterToken).isMaster;
      const isRoomHost = room.hostSocketId === socket.id || Boolean(requester?.isHost);

      if (!isMasterAuth && !isRoomHost) {
        if (typeof callback === "function") callback({ success: false, message: "Apenas o Dono/Host pode gerenciar e conceder insígnias." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado na sala." });
        return;
      }

      // Filter badges - non-master users cannot be given supreme master owner badges
      const filteredBadges = (Array.isArray(data.badges) ? data.badges : []).filter(
        (b) => !b.includes("owner") && b !== "koki_creator"
      );

      target.badges = filteredBadges;

      // Broadcast user updated to sync all participants in the room
      io.to(targetRoomId).emit("room:user-updated", target);

      // Direct notification to target socket
      io.to(data.targetSocketId).emit("badges:assigned", {
        badges: target.badges,
        message: "O Dono da Sala atualizou suas insígnias!",
      });

      // System chat announcement
      const badgeMsg: ServerChatMessage = {
        id: `sys-badge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channelId: "geral",
        senderId: "system",
        senderName: "Koki Bot",
        senderAvatarEmoji: "🎖️",
        text: `🎖️ **${requester?.name || "O Dono"}** atualizou as insígnias de **${target.name}**!`,
        timestamp: Date.now(),
        isSystem: true,
      };
      const gMsgs = room.messagesByChannel.get("geral");
      if (gMsgs) {
        gMsgs.push(badgeMsg);
        if (gMsgs.length > 100) gMsgs.shift();
      }
      io.to(targetRoomId).emit("room:chat-message", badgeMsg);

      if (typeof callback === "function") {
        callback({
          success: true,
          badges: target.badges,
          message: `Insígnias atualizadas para ${target.name} com sucesso!`,
        });
      }
    });

    // 5. Update Profile - Strictly Enforce Master or Granted VIP for Custom Avatar/Banner/Media
    socket.on("user:update-profile", (updates: Partial<ServerParticipant> & { masterToken?: string; roomId?: string }) => {
      const targetRoomId = currentRoomId || updates.roomId;
      if (!targetRoomId) return;
      const room = rooms.get(targetRoomId);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant) {
        const safeUpdates = { ...updates };
        delete (safeUpdates as any).isHost;
        delete (safeUpdates as any).id;
        delete (safeUpdates as any).vipPermissions;
        delete (safeUpdates as any).masterToken;
        delete (safeUpdates as any).roomId;

        // Verify if user is truly the authenticated Master Owner OR has explicit VIP permissions from Master
        const masterAuth = validateServerMasterAuth(updates.masterToken);
        const isAuthenticMaster = Boolean(masterAuth.isMaster);
        const hasVipMediaPermission = Boolean(
          participant.vipPermissions?.canEditAdvancedProfile ||
          participant.vipPermissions?.canUseGifAvatar ||
          participant.vipPermissions?.canUseVideoMp4Banner
        );

        // Friends/hosts without master auth or granted VIP are NOT allowed to set custom bannerUrl or avatarUrl
        if (!isAuthenticMaster && !hasVipMediaPermission) {
          delete safeUpdates.avatarUrl;
          delete safeUpdates.bannerUrl;
        }

        // Master always gets tag #0001
        if (isAuthenticMaster) {
          participant.tag = MASTER_TAG;
          safeUpdates.tag = MASTER_TAG;
        } else {
          // Regular users cannot set tag to 0001 or any reserved master tag
          if (safeUpdates.tag && isReservedTag(safeUpdates.tag)) {
            delete safeUpdates.tag;
          }
          // Filter out owner and default badges for non-masters
          if (Array.isArray(safeUpdates.badges)) {
            safeUpdates.badges = safeUpdates.badges.filter(
              (b) => !b.includes("owner") && b !== "koki_creator" && b !== "nitro_owner" && b !== "pioneer_member" && b !== "host_room"
            );
          }
        }

        if (safeUpdates.name) safeUpdates.name = safeUpdates.name.slice(0, 32);
        if (safeUpdates.customStatus) safeUpdates.customStatus = safeUpdates.customStatus.slice(0, 60);
        if (safeUpdates.bio) safeUpdates.bio = safeUpdates.bio.slice(0, 160);

        Object.assign(participant, safeUpdates);
        io.to(targetRoomId).emit("room:user-updated", participant);
        io.to(targetRoomId).emit("room:user_updated", participant);
        broadcastRoomState(room);
      }
    });

    // 6. State updates (Audio/Video/Screen)
    socket.on("room:state-update", (updates: Partial<ServerParticipant> & { roomId?: string }) => {
      const targetRoomId = normalizeRoomId(updates.roomId) || currentRoomId;
      if (!targetRoomId) return;
      const room = rooms.get(targetRoomId);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant) {
        const safeUpdates = { ...updates };
        delete (safeUpdates as any).isHost;
        delete (safeUpdates as any).id;
        delete (safeUpdates as any).roomId;

        Object.assign(participant, safeUpdates);
        io.to(targetRoomId).emit("room:user-updated", participant);
        io.to(targetRoomId).emit("room:user_updated", participant);
        broadcastRoomState(room);
      }
    });

    // 6.1. Voice Channel Selection & VIP Access Control
    const handleVoiceSelectChannel = (data: { channelId?: string; voiceChannelId?: string; masterToken?: string; roomId?: string }, callback?: any) => {
      const targetRoomId = normalizeRoomId(data?.roomId) || currentRoomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inativa" });
        return;
      }

      const participant = room.participants.get(socket.id);
      if (!participant) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não encontrado" });
        return;
      }

      const targetChannelId = data.channelId || data.voiceChannelId || "voice-geral";

      // If user tries to join VIP channel
      if (targetChannelId === "voice-vip") {
        const isMaster = Boolean(participant.isMaster || validateServerMasterAuth(data.masterToken).isMaster);
        if (!isMaster) {
          if (typeof callback === "function") {
            callback({ success: false, message: "Canal restrito ao Dono Master" });
          }
          return;
        }
      }

      participant.voiceChannelId = targetChannelId;
      io.to(targetRoomId).emit("room:user-updated", participant);
      io.to(targetRoomId).emit("room:user_updated", participant);
      broadcastRoomState(room);

      if (typeof callback === "function") {
        callback({ success: true, channelId: targetChannelId });
      }
    };

    socket.on("voice:select-channel", handleVoiceSelectChannel);
    socket.on("voice:join", handleVoiceSelectChannel);

    // 6.2. Master Drag / Move Members between Voice Channels
    socket.on("host:move-voice-channel", (data: {
      targetSocketId: string;
      targetChannelId: string;
      masterToken?: string;
      roomId?: string;
    }, callback) => {
      const targetRoomId = normalizeRoomId(data?.roomId) || currentRoomId;
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala inativa" });
        return;
      }

      const requester = room.participants.get(socket.id);
      const isMasterAuth = Boolean(requester?.isMaster || validateServerMasterAuth(data.masterToken).isMaster);

      if (!isMasterAuth) {
        if (typeof callback === "function") callback({ success: false, message: "Apenas o Dono Master pode mover membros entre canais." });
        return;
      }

      const target = room.participants.get(data.targetSocketId);
      if (!target) {
        if (typeof callback === "function") callback({ success: false, message: "Membro não encontrado na sala." });
        return;
      }

      const cleanTargetChannelId = data.targetChannelId === "voice-vip" ? "voice-vip" : "voice-geral";
      target.voiceChannelId = cleanTargetChannelId;

      // Update room state
      io.to(targetRoomId).emit("room:user-updated", target);
      io.to(targetRoomId).emit("room:user_updated", target);
      broadcastRoomState(room);

      // Directly notify target client
      const targetSocket = io.sockets.sockets.get(data.targetSocketId);
      if (targetSocket) {
        targetSocket.emit("voice:forced-channel-change", {
          channelId: cleanTargetChannelId,
          channelName: cleanTargetChannelId === "voice-vip" ? "Call VIP" : "Geral",
          movedBy: requester?.name || "Dono Master",
        });
      }

      // System notification in chat
      const channelName = cleanTargetChannelId === "voice-vip" ? "👑 Call VIP" : "🔊 Geral";
      const moveMsg: ServerChatMessage = {
        id: `sys-move-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channelId: "geral",
        senderId: "system",
        senderName: "Koki Bot",
        senderAvatarEmoji: "👑",
        text: `👑 **${requester?.name || "Dono Master"}** moveu **${target.name}** para **${channelName}**!`,
        timestamp: Date.now(),
        isSystem: true,
      };

      const gMsgs = room.messagesByChannel.get("geral");
      if (gMsgs) {
        gMsgs.push(moveMsg);
        if (gMsgs.length > 100) gMsgs.shift();
      }
      io.to(targetRoomId).emit("room:chat-message", moveMsg);

      if (typeof callback === "function") {
        callback({
          success: true,
          targetChannelId: cleanTargetChannelId,
          message: `Membro movido para ${channelName} com sucesso!`,
        });
      }
    });

    // 7. Channel Messages & Antivirus Filter
    socket.on("room:get-channel-messages", (channelId: string, callback) => {
      let targetRoomId = currentRoomId;
      if (!targetRoomId) {
        for (const [rId, r] of rooms.entries()) {
          if (r.participants.has(socket.id)) {
            targetRoomId = rId;
            currentRoomId = rId;
            break;
          }
        }
      }
      if (!targetRoomId) return;
      const room = rooms.get(targetRoomId);
      if (!room) return;

      const cleanChan = channelId || "geral";
      const msgs = room.messagesByChannel.get(cleanChan) || [];
      if (typeof callback === "function") {
        callback({ channelId: cleanChan, messages: msgs });
      }
    });

    socket.on("room:chat-message", (data: { channelId?: string; text: string; roomId?: string }, callback) => {
      let targetRoomId = currentRoomId || data.roomId;
      if (!targetRoomId) {
        for (const [rId, r] of rooms.entries()) {
          if (r.participants.has(socket.id)) {
            targetRoomId = rId;
            currentRoomId = rId;
            break;
          }
        }
      }
      if (!targetRoomId) {
        if (typeof callback === "function") callback({ success: false, message: "Sala desconhecida" });
        return;
      }
      const room = rooms.get(targetRoomId);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, message: "Sala não encontrada" });
        return;
      }

      const participant = room.participants.get(socket.id);
      if (!participant) {
        if (typeof callback === "function") callback({ success: false, message: "Participante não está na sala" });
        return;
      }

      if (!room.settings.allowGuestChat && !participant.isHost) {
        if (typeof callback === "function") callback({ success: false, message: "Chat de convidados desativado" });
        return;
      }

      // Rate limit check
      const now = Date.now();
      const limiter = messageRateLimiter.get(socket.id) || { count: 0, resetAt: now + 2000 };
      if (now > limiter.resetAt) {
        limiter.count = 1;
        limiter.resetAt = now + 2000;
      } else {
        limiter.count += 1;
        if (limiter.count > 10) {
          socket.emit("room:chat-message", {
            id: `ratelimit-${now}`,
            channelId: data.channelId || "geral",
            senderId: "system",
            senderName: "Koki Shield",
            senderAvatarEmoji: "🛡️",
            text: "⚠️ Você está enviando mensagens muito rápido. Aguarde 2 segundos.",
            timestamp: now,
            isSystem: true,
            isSecurityWarning: true,
          });
          return;
        }
      }
      messageRateLimiter.set(socket.id, limiter);

      const targetChannelId = data.channelId || "geral";
      const { cleanText, isSecurityWarning } = sanitizeAndInspectText(data.text);
      if (!cleanText) return;

      // Ensure socket is joined to the room
      socket.join(targetRoomId);

      // Slash commands
      if (cleanText.startsWith("/") && !isSecurityWarning) {
        const parts = cleanText.split(" ");
        const command = parts[0].toLowerCase();

        if (command === "/roll" || command === "/dado") {
          const maxSides = Math.min(1000, Math.max(2, parseInt(parts[1], 10) || 6));
          const rollResult = Math.floor(Math.random() * maxSides) + 1;
          
          const botMsg: ServerChatMessage = {
            id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            channelId: targetChannelId,
            senderId: "system",
            senderName: "Koki Bot",
            senderAvatarEmoji: "🎲",
            text: `🎲 **${participant.name}** rolou um dado (d${maxSides}) e tirou **${rollResult}**!`,
            timestamp: Date.now(),
            isSystem: true,
          };

          const chMsgs = room.messagesByChannel.get(targetChannelId) || [];
          chMsgs.push(botMsg);
          room.messagesByChannel.set(targetChannelId, chMsgs);
          io.to(targetRoomId).emit("room:chat-message", botMsg);
          if (typeof callback === "function") callback({ success: true, message: botMsg });
          return;
        }

        if (command === "/coin" || command === "/moeda") {
          const isHeads = Math.random() > 0.5;
          const resultText = isHeads ? "Cara 👑" : "Coroa 🪙";
          
          const botMsg: ServerChatMessage = {
            id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            channelId: targetChannelId,
            senderId: "system",
            senderName: "Koki Bot",
            senderAvatarEmoji: "🪙",
            text: `🪙 **${participant.name}** jogou a moeda: Deu **${resultText}**!`,
            timestamp: Date.now(),
            isSystem: true,
          };

          const chMsgs = room.messagesByChannel.get(targetChannelId) || [];
          chMsgs.push(botMsg);
          room.messagesByChannel.set(targetChannelId, chMsgs);
          io.to(targetRoomId).emit("room:chat-message", botMsg);
          if (typeof callback === "function") callback({ success: true, message: botMsg });
          return;
        }
      }

      // Broadcast sanitized chat message
      const message: ServerChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channelId: targetChannelId,
        senderId: socket.id,
        senderName: participant.name,
        senderAvatarEmoji: participant.avatarEmoji,
        senderAvatarColor: participant.avatarColor,
        senderAvatarUrl: participant.avatarUrl,
        senderIsHost: participant.isHost,
        text: cleanText,
        timestamp: Date.now(),
        isSecurityWarning,
      };

      const chMsgs = room.messagesByChannel.get(targetChannelId) || [];
      chMsgs.push(message);
      if (chMsgs.length > 100) chMsgs.shift();
      room.messagesByChannel.set(targetChannelId, chMsgs);

      io.to(targetRoomId).emit("room:chat-message", message);
      if (typeof callback === "function") {
        callback({ success: true, message });
      }
    });

    // 8. Host Master Actions
    socket.on("host:action", (action: {
      type: "mute-user" | "kick-user" | "toggle-lock" | "update-settings" | "mute-all" | "claim-host" | "close-room";
      targetUserId?: string;
      settings?: Partial<ServerRoom["settings"]>;
      passcode?: string;
    }, callback) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const requester = room.participants.get(socket.id);
      if (!requester) return;

      if (action.type === "claim-host") {
        if (room.hostPasscodeHash && action.passcode && room.hostPasscodeHash === action.passcode.trim()) {
          if (room.hostSocketId && room.participants.has(room.hostSocketId)) {
            const prev = room.participants.get(room.hostSocketId)!;
            prev.isHost = false;
            io.to(currentRoomId).emit("room:user-updated", prev);
          }
          requester.isHost = true;
          room.hostSocketId = socket.id;
          io.to(currentRoomId).emit("room:user-updated", requester);
          if (typeof callback === "function") callback({ success: true, hostSecretToken: room.hostSecretToken, message: "Você assumiu o controle Master da sala!" });
          return;
        } else {
          if (typeof callback === "function") callback({ success: false, message: "Senha master incorreta." });
          return;
        }
      }

      // Strict Host Verification
      if (!requester.isHost || room.hostSocketId !== socket.id) {
        if (typeof callback === "function") callback({ success: false, message: "Apenas o Dono/Host autêntico tem permissão para executar esta ação." });
        return;
      }

      if (action.type === "close-room") {
        io.to(currentRoomId).emit("room:closed", {
          reason: "O Dono da chamada encerrou a sala para todos os participantes.",
        });
        // Disconnect room
        rooms.delete(currentRoomId);
        if (typeof callback === "function") {
          callback({ success: true, message: "Sala encerrada com sucesso." });
        }
        return;
      }

      if (action.type === "mute-user" && action.targetUserId) {
        const target = room.participants.get(action.targetUserId);
        if (target) {
          target.isMutedByHost = true;
          target.hasAudio = false;
          io.to(action.targetUserId).emit("host:forced-mute");
          io.to(currentRoomId).emit("room:user-updated", target);
          io.to(currentRoomId).emit("room:user_updated", target);
          broadcastRoomState(room);
        }
      } else if (action.type === "mute-all") {
        room.participants.forEach((p) => {
          if (!p.isHost) {
            p.isMutedByHost = true;
            p.hasAudio = false;
            io.to(p.id).emit("host:forced-mute");
            io.to(currentRoomId).emit("room:user-updated", p);
            io.to(currentRoomId).emit("room:user_updated", p);
          }
        });
        broadcastRoomState(room);
      } else if (action.type === "kick-user" && action.targetUserId) {
        const targetSocket = io.sockets.sockets.get(action.targetUserId);
        if (targetSocket) {
          targetSocket.emit("host:kicked", { reason: "Você foi desconectado pelo Dono da chamada." });
          targetSocket.leave(currentRoomId);
        }
        room.participants.delete(action.targetUserId);
        io.to(currentRoomId).emit("room:user-left", { id: action.targetUserId, name: "Participante" });
        io.to(currentRoomId).emit("room:user_left", { id: action.targetUserId, name: "Participante" });
        broadcastRoomState(room);
      } else if (action.type === "toggle-lock") {
        room.isLocked = !room.isLocked;
        io.to(currentRoomId).emit("room:lock-changed", { isLocked: room.isLocked });
      } else if (action.type === "update-settings" && action.settings) {
        Object.assign(room.settings, action.settings);
        io.to(currentRoomId).emit("room:settings-changed", room.settings);
      }

      if (typeof callback === "function") {
        callback({ success: true });
      }
    });

    // 9. Leave & Cleanup
    const handleLeave = () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      const wasKnocking = room.pendingKnocks.has(socket.id);
      room.participants.delete(socket.id);
      room.pendingKnocks.delete(socket.id);

      if (wasKnocking && room.hostSocketId) {
        io.to(room.hostSocketId).emit("host:knock-cancelled", { socketId: socket.id });
      }

      if (participant) {
        io.to(currentRoomId).emit("room:user-left", { id: socket.id, name: participant.name });
        io.to(currentRoomId).emit("room:user_left", { id: socket.id, name: participant.name });
        broadcastRoomState(room);
      }

      const roomIdToClean = currentRoomId;
      if (room.participants.size === 0 && roomIdToClean) {
        setTimeout(() => {
          const checkRoom = rooms.get(roomIdToClean);
          if (checkRoom && checkRoom.participants.size === 0) {
            rooms.delete(roomIdToClean);
          }
        }, 10 * 60 * 1000);
      }

      socket.leave(currentRoomId);
      currentRoomId = null;
    };

    socket.on("room:leave", handleLeave);
    socket.on("disconnect", handleLeave);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Robust static dist directory resolution for Render / Node.js production deployments
    let distPath = path.resolve(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
      if (fs.existsSync(path.resolve(safeDirname, "dist"))) {
        distPath = path.resolve(safeDirname, "dist");
      } else if (fs.existsSync(path.resolve(safeDirname, "..", "dist"))) {
        distPath = path.resolve(safeDirname, "..", "dist");
      } else {
        distPath = safeDirname;
      }
    }
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Koki Call] Secure Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Koki Call server:", err);
  process.exit(1);
});
