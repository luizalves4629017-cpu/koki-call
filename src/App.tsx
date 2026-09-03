import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { RoomState, Participant } from "./types";
import { Lobby } from "./components/Lobby";
import { CallRoom } from "./components/CallRoom";
import { saveHostToken, getHostToken, isMasterIdentity } from "./utils/storage";
import { getStoredMasterInfo, isMasterKeyValid, getMasterTokenSync, clearMasterAuthLocally } from "./utils/masterAuth";
import { playVoiceJoinChime } from "./utils/audioChimes";

// Resolve default backend Socket.IO connection URL explicitly
const BACKEND_SOCKET_URL =
  ((import.meta as any).env && (import.meta as any).env.VITE_BACKEND_URL) ||
  (typeof window !== "undefined" && window.location && window.location.origin && !window.location.origin.includes("file://")
    ? window.location.origin
    : "https://koki-call.onrender.com");

const cleanRoomParam = (rawRoom?: string | null): string => {
  if (!rawRoom || typeof rawRoom !== "string") return "main-lounge";
  let clean = rawRoom.trim();
  if (clean.includes("?room=") || clean.includes("&room=")) {
    const match = clean.match(/[?&]room=([^&?#\s]+)/i);
    if (match && match[1]) {
      clean = decodeURIComponent(match[1]).trim();
    }
  }
  clean = clean.replace(/^[/?#&]+/, "");
  if (clean.toLowerCase().startsWith("room=")) {
    clean = clean.slice(5);
  }
  clean = clean.split("?")[0].split("&")[0].split("#")[0].trim();
  clean = clean.replace(/^[\/\s]+|[\/\s]+$/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  return clean || "main-lounge";
};

const getInitialRoomId = (): string => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam && roomParam.trim().length > 0) {
      return cleanRoomParam(roomParam);
    }
  }
  return "main-lounge";
};

interface LastJoinSession {
  roomId: string;
  username?: string;
  name: string;
  isMaster?: boolean;
  passcode?: string;
  role?: string;
  isGuestOnly?: boolean;
  masterToken?: string;
  hostSecretToken?: string;
  profile: any;
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [inCall, setInCall] = useState<boolean>(false);
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [selfParticipant, setSelfParticipant] = useState<Participant | null>(null);
  const [urlRoomId, setUrlRoomId] = useState<string>(getInitialRoomId);
  const [urlRole, setUrlRole] = useState<string>("");
  const [isWaitingApproval, setIsWaitingApproval] = useState<boolean>(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active call session tracking for automatic reconnection when backend restarts
  const lastJoinSessionRef = useRef<LastJoinSession | null>(null);
  const inCallRef = useRef<boolean>(false);
  // WebRTC HTML <audio autoplay> ref for instant remote peer audio playback
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    inCallRef.current = inCall;
  }, [inCall]);

  // Unlock browser autoplay policy on user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current && audioRef.current.srcObject) {
        audioRef.current.play().catch(() => {});
      }
    };
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // Master Machine & Hardware Authorization State
  const initialMaster = getStoredMasterInfo();
  const [isMaster, setIsMaster] = useState<boolean>(initialMaster.isMaster);
  const [masterToken, setMasterToken] = useState<string | null>(initialMaster.token);
  const [machineInfo, setMachineInfo] = useState<{ username?: string; hostname?: string; authMethod?: string } | null>(
    initialMaster.isMaster ? { authMethod: "owner_key", username: "Dono Master" } : null
  );

  // Automatic Master Detection (IPC, Stored Token & Server Handshake)
  useEffect(() => {
    const detectMasterMachine = async () => {
      let candidateToken: string | null = null;

      // 0. Check localStorage stored master key or token
      try {
        const storedInfo = getStoredMasterInfo();
        if (storedInfo.isMaster && storedInfo.token) {
          candidateToken = storedInfo.token;
          setIsMaster(true);
          setMasterToken(storedInfo.token);
          setMachineInfo({ username: "Dono Master", authMethod: "owner_key" });
        }
      } catch {
        // ignore
      }

      // 1. Electron Native Hardware / Key Verification
      if (typeof window !== "undefined" && window.electronAPI && typeof window.electronAPI.checkMasterStatus === "function") {
        try {
          const auth = await window.electronAPI.checkMasterStatus();
          if (auth.isMaster && auth.masterToken) {
            setIsMaster(true);
            setMasterToken(auth.masterToken);
            setMachineInfo({
              username: auth.username,
              hostname: auth.hostname,
              authMethod: auth.authMethod,
            });
            candidateToken = auth.masterToken;
          }
        } catch (e) {
          console.warn("Electron check error:", e);
        }
      }

      // 2. Server-side validation check (non-blocking verification)
      if (candidateToken) {
        try {
          const res = await fetch("/api/auth/master-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ masterToken: candidateToken }),
          });
          const data = await res.json();
          if (data.isMaster) {
            setIsMaster(true);
            setMasterToken(candidateToken);
            setMachineInfo((prev) => prev || { authMethod: data.authMethod });
          } else {
            // Keep master if user had the specific owner key saved
            const savedKey = localStorage.getItem("koki_master_key_saved");
            if (isMasterKeyValid(savedKey)) {
              setIsMaster(true);
              setMasterToken(candidateToken || getMasterTokenSync(savedKey!));
            } else {
              setIsMaster(false);
              setMasterToken(null);
              clearMasterAuthLocally();
            }
          }
        } catch {
          // If server offline or slow, KEEP local master privileges if stored token/key is valid
          const savedKey = localStorage.getItem("koki_master_key_saved");
          if (isMasterKeyValid(savedKey) || candidateToken) {
            setIsMaster(true);
            setMasterToken(candidateToken || getMasterTokenSync("koki24122024master"));
            setMachineInfo({ username: "Dono Master", authMethod: "owner_key" });
          }
        }
      }
    };

    detectMasterMachine();
  }, []);

  const handleMasterLoginSuccess = (token: string) => {
    setIsMaster(true);
    setMasterToken(token);
    setMachineInfo({
      authMethod: "owner_key",
      username: "Dono Master",
    });
  };

  const handleMasterLogout = () => {
    setIsMaster(false);
    setMasterToken(null);
    setMachineInfo(null);
    clearMasterAuthLocally();
  };

  // Initialize Socket.IO connection and query params with Render URL & automatic reconnection
  useEffect(() => {
    // If backend is on the same host (e.g. preview proxy / express), socket.io connects smoothly
    // Fallback explicitly to https://koki-call.onrender.com or custom VITE_BACKEND_URL
    const socketInstance = io(BACKEND_SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    setSocket(socketInstance);

    // Read room ID and role from query string (e.g. ?room=xyz)
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    const roleParam = params.get("role");

    const effectiveRoom = cleanRoomParam(roomParam);
    setUrlRoomId(effectiveRoom);
    if (roleParam) {
      setUrlRole(roleParam);
    }

    // Listen for Portaria knock events
    const handleKnockApproved = (data: { room: RoomState; self: Participant }) => {
      setIsWaitingApproval(false);
      setApprovalError(null);
      setCurrentRoom(data.room);
      setSelfParticipant(data.self);
      setInCall(true);
      // Play soft synthesized chime upon connecting to voice channel
      playVoiceJoinChime();
    };

    const handleKnockRejected = (data: { message?: string }) => {
      setIsWaitingApproval(false);
      setApprovalError(data.message || "Sua solicitação de entrada foi recusada pelo Dono da sala.");
    };

    // Listen for voice channel events
    const handleVoiceChannelEvent = () => {
      playVoiceJoinChime();
    };

    // Listen for connection lifecycle and automatic room re-entry
    const handleConnect = () => {
      console.log("[Koki Call] Socket connected to backend:", socketInstance.id);
      // If user was actively in a call before connection dropped / server restart, automatically re-join
      if (inCallRef.current && lastJoinSessionRef.current) {
        const session = lastJoinSessionRef.current;
        console.log("[Koki Call] Reconnecting to room after backend restart:", session.roomId);
        socketInstance.emit("room:join", session, (res: {
          success: boolean;
          needsApproval?: boolean;
          hostSecretToken?: string;
          room?: RoomState;
          self?: Participant;
          message?: string;
        }) => {
          if (res && res.success && res.room && res.self) {
            if (res.hostSecretToken) {
              saveHostToken(res.room.roomId, res.hostSecretToken);
              if (lastJoinSessionRef.current) {
                lastJoinSessionRef.current.hostSecretToken = res.hostSecretToken;
              }
            }
            setCurrentRoom(res.room);
            setSelfParticipant(res.self);
            setInCall(true);
            playVoiceJoinChime();
          }
        });
      }
    };

    const handleDisconnect = (reason: string) => {
      console.warn("[Koki Call] Socket disconnected from backend:", reason);
    };

    const handleRoomJoined = (data: {
      roomId: string;
      room?: RoomState;
      self?: Participant;
      isMaster?: boolean;
      participants?: Participant[];
    }) => {
      if (data.room) {
        setCurrentRoom(data.room);
      }
      if (data.self) {
        setSelfParticipant(data.self);
      }
      setInCall(true);
    };

    const handleRoomParticipants = (data: any) => {
      const list: Participant[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.participants)
        ? data.participants
        : [];
      if (!list) return;

      setCurrentRoom((prev) => {
        if (!prev) return prev;
        const prevMap = new Map<string, Participant>(prev.participants.map((p) => [p.id, p]));
        const merged = list.map((incoming) => {
          const existing = prevMap.get(incoming.id);
          return existing ? { ...existing, ...incoming } : incoming;
        });
        return {
          ...prev,
          participants: merged,
        };
      });

      setSelfParticipant((prev) => {
        if (!prev) return prev;
        const selfInList = list.find((p) => p.id === prev.id);
        return selfInList ? { ...prev, ...selfInList } : prev;
      });
    };

    const handleUserJoined = (participant: Participant) => {
      if (!participant || !participant.id) return;
      setCurrentRoom((prev) => {
        if (!prev) return prev;
        const exists = prev.participants.some((p) => p.id === participant.id);
        if (exists) {
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              p.id === participant.id ? { ...p, ...participant } : p
            ),
          };
        }
        return {
          ...prev,
          participants: [...prev.participants, participant],
        };
      });
    };

    const handleUserLeft = (data: { id: string }) => {
      if (!data?.id) return;
      setCurrentRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.filter((p) => p.id !== data.id),
        };
      });
    };

    const handleUserUpdated = (updatedUser: Participant) => {
      if (!updatedUser?.id) return;
      setCurrentRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === updatedUser.id ? { ...p, ...updatedUser } : p
          ),
        };
      });
      setSelfParticipant((prev) =>
        prev && prev.id === updatedUser.id ? { ...prev, ...updatedUser } : prev
      );
    };

    const handleRoomSync = (syncedRoom: RoomState) => {
      if (syncedRoom && syncedRoom.roomId) {
        setCurrentRoom((prev) => ({
          ...(prev || {}),
          ...syncedRoom,
          participants: syncedRoom.participants || prev?.participants || [],
        }));
      }
    };

    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisconnect);
    socketInstance.io.on("reconnect", handleConnect);

    socketInstance.on("room:joined", handleRoomJoined);
    socketInstance.on("room:participants", handleRoomParticipants);
    socketInstance.on("voice:participants", handleRoomParticipants);
    socketInstance.on("room:sync", handleRoomSync);
    socketInstance.on("room:user-joined", handleUserJoined);
    socketInstance.on("room:user_joined", handleUserJoined);
    socketInstance.on("user-connected", handleUserJoined);
    socketInstance.on("user_connected", handleUserJoined);
    socketInstance.on("room:user-left", handleUserLeft);
    socketInstance.on("room:user_left", handleUserLeft);
    socketInstance.on("user-disconnected", handleUserLeft);
    socketInstance.on("user_disconnected", handleUserLeft);
    socketInstance.on("room:user-updated", handleUserUpdated);
    socketInstance.on("room:knock-approved", handleKnockApproved);
    socketInstance.on("room:knock-rejected", handleKnockRejected);
    socketInstance.on("voice:joined", handleVoiceChannelEvent);
    socketInstance.on("voice:channel-changed", handleVoiceChannelEvent);

    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.io.off("reconnect", handleConnect);
      socketInstance.off("room:joined", handleRoomJoined);
      socketInstance.off("room:participants", handleRoomParticipants);
      socketInstance.off("voice:participants", handleRoomParticipants);
      socketInstance.off("room:sync", handleRoomSync);
      socketInstance.off("room:user-joined", handleUserJoined);
      socketInstance.off("room:user_joined", handleUserJoined);
      socketInstance.off("user-connected", handleUserJoined);
      socketInstance.off("user_connected", handleUserJoined);
      socketInstance.off("room:user-left", handleUserLeft);
      socketInstance.off("room:user_left", handleUserLeft);
      socketInstance.off("user-disconnected", handleUserLeft);
      socketInstance.off("user_disconnected", handleUserLeft);
      socketInstance.off("room:user-updated", handleUserUpdated);
      socketInstance.off("room:knock-approved", handleKnockApproved);
      socketInstance.off("room:knock-rejected", handleKnockRejected);
      socketInstance.off("voice:joined", handleVoiceChannelEvent);
      socketInstance.off("voice:channel-changed", handleVoiceChannelEvent);
      socketInstance.disconnect();
    };
  }, []);

  // Synthesized Web Audio API soft chime sound played upon connecting to any voice channel
  useEffect(() => {
    if (inCall) {
      playVoiceJoinChime();
    }
  }, [inCall]);

  // Handle Host Room Creation (Immediate non-blocking transition into Call Room)
  const handleCreateRoom = (params: {
    roomName: string;
    roomId: string;
    hostName: string;
    hostPasscode: string;
    lowBandwidthDefault: boolean;
    profile: {
      avatarEmoji: string;
      avatarColor: string;
      avatarUrl?: string;
      bannerColor: string;
      bannerUrl?: string;
      customStatus: string;
      bio: string;
      tag: string;
      badges?: string[];
    };
  }) => {
    setErrorMsg(null);
    setApprovalError(null);

    const safeRoomId = params.roomId.trim()
      ? params.roomId.trim().toLowerCase().replace(/\s+/g, "-")
      : (urlRoomId && urlRoomId.trim() ? urlRoomId.trim().toLowerCase() : "main-lounge");

    const isMasterUser = Boolean(isMaster || params.profile.tag === "0001" || isMasterIdentity(params.hostName, isMaster));
    const effectiveSocketId = socket?.id || `temp-host-${Date.now()}`;

    // 1. Immediately create optimistic participant and room state so UI transitions instantly
    const optimisticSelf: Participant = {
      id: effectiveSocketId,
      name: params.hostName,
      tag: params.profile.tag || (isMasterUser ? "0001" : "1001"),
      isHost: true,
      hasAudio: true,
      hasVideo: false,
      isScreenSharing: false,
      isDeafened: false,
      isMutedByHost: false,
      joinedAt: Date.now(),
      avatarEmoji: params.profile.avatarEmoji,
      avatarColor: params.profile.avatarColor,
      avatarUrl: params.profile.avatarUrl,
      bannerColor: params.profile.bannerColor,
      bannerUrl: params.profile.bannerUrl,
      customStatus: params.profile.customStatus,
      bio: params.profile.bio,
      badges: params.profile.badges || (isMasterUser ? ["owner_supreme", "creator_shield"] : []),
      kokiCoins: isMasterUser ? 999999 : 50,
    };

    const optimisticRoom: RoomState = {
      roomId: safeRoomId,
      roomName: params.roomName,
      createdAt: Date.now(),
      hostSocketId: effectiveSocketId,
      isLocked: false,
      channels: [
        { id: "geral", name: "geral", description: "Canal de texto principal para todos os membros da sala" },
        { id: "links-midia", name: "links-e-mídia", description: "Compartilhamento de links, vídeos e imagens" },
        { id: "comandos-koki", name: "comandos-koki", description: "Comandos da sala, bots e interações" },
      ],
      participants: [optimisticSelf],
      settings: {
        lowBandwidthDefault: params.lowBandwidthDefault,
        allowScreenShare: true,
        allowVideo: true,
        allowGuestChat: true,
        maxParticipants: 16,
        requireKnockApproval: false,
      },
    };

    // 2. Immediately switch to call view and set URL (Zero blocking or freezing)
    window.history.pushState({}, "", `/?room=${safeRoomId}`);
    setCurrentRoom(optimisticRoom);
    setSelfParticipant(optimisticSelf);
    setInCall(true);

    // Save session for automatic reconnection if backend restarts
    lastJoinSessionRef.current = {
      roomId: safeRoomId,
      name: params.hostName,
      passcode: params.hostPasscode,
      role: "host",
      isGuestOnly: false,
      masterToken: masterToken || undefined,
      hostSecretToken: undefined,
      profile: params.profile,
    };

    // 3. Emit room:create over socket (in background or once connected)
    const sendRoomCreate = (targetSock: Socket) => {
      targetSock.emit(
        "room:create",
        {
          roomId: safeRoomId,
          roomName: params.roomName,
          hostName: params.hostName,
          hostPasscode: params.hostPasscode,
          masterToken: masterToken || undefined,
          profile: params.profile,
          settings: {
            lowBandwidthDefault: params.lowBandwidthDefault,
            allowScreenShare: true,
            allowVideo: true,
            allowGuestChat: true,
            maxParticipants: 16,
            requireKnockApproval: false,
          },
        },
        (res: { success: boolean; hostSecretToken?: string; room?: RoomState; self?: Participant; message?: string }) => {
          if (res && res.success) {
            if (res.hostSecretToken && res.room) {
              saveHostToken(res.room.roomId, res.hostSecretToken);
              if (lastJoinSessionRef.current) {
                lastJoinSessionRef.current.hostSecretToken = res.hostSecretToken;
              }
            }
            if (res.room) {
              setCurrentRoom(res.room);
            }
            if (res.self) {
              setSelfParticipant(res.self);
            }
          }
        }
      );
    };

    if (socket) {
      if (socket.connected) {
        sendRoomCreate(socket);
      } else {
        socket.once("connect", () => {
          sendRoomCreate(socket);
        });
        socket.connect();
      }
    }
  };

  // Handle Guest Room Join (or Authenticated Returning Host)
  const handleJoinRoom = (params: {
    roomId: string;
    name: string;
    passcode?: string;
    profile: {
      avatarEmoji: string;
      avatarColor: string;
      avatarUrl?: string;
      bannerColor: string;
      bannerUrl?: string;
      customStatus: string;
      bio: string;
      tag: string;
      badges?: string[];
    };
  }) => {
    setErrorMsg(null);
    setApprovalError(null);

    const username = (params.name || "").trim() || `Convidado ${Math.floor(100 + Math.random() * 900)}`;
    const safeRoomId = cleanRoomParam(params.roomId || urlRoomId || "main-lounge");
    const isMasterUser = Boolean(isMaster && (params.profile?.tag === "0001" || isMasterIdentity(username, isMaster)));
    const isGuestRole = !isMasterUser;
    // If joining explicitly as guest, never send host secret token to ensure role isolation
    const existingHostToken = isGuestRole ? undefined : getHostToken(safeRoomId);

    // Update URL query string with clean room ID
    const newUrl = `/?room=${encodeURIComponent(safeRoomId)}`;
    window.history.pushState({}, "", newUrl);
    setUrlRoomId(safeRoomId);

    // 1. Immediately transition UI state to active room view / voice channel layout upon clicking
    const effectiveSocketId = socket?.id || `guest-${Date.now()}`;
    const optimisticParticipant: Participant = {
      id: effectiveSocketId,
      name: username,
      tag: params.profile?.tag || (isMasterUser ? "0001" : "0002"),
      isHost: isMasterUser,
      isMaster: isMasterUser,
      hasAudio: true,
      hasVideo: false,
      isScreenSharing: false,
      isDeafened: false,
      isMutedByHost: false,
      avatarColor: params.profile?.avatarColor || "#0284c7",
      avatarEmoji: params.profile?.avatarEmoji || (isMasterUser ? "👑" : "🎮"),
      avatarUrl: params.profile?.avatarUrl,
      bannerColor: params.profile?.bannerColor || "#0f172a",
      bannerUrl: params.profile?.bannerUrl,
      customStatus: params.profile?.customStatus || (isMasterUser ? "👑 Dono Master do Koki" : "🟢 Conectado na Call"),
      bio: params.profile?.bio || (isMasterUser ? "Criador e moderador oficial do Koki Call." : "Participante da Chamada"),
      badges: params.profile?.badges || (isMasterUser ? ["owner_supreme", "koki_creator", "nitro_owner"] : []),
      joinedAt: Date.now(),
      voiceChannelId: "voice-geral",
    };

    const optimisticRoom: RoomState = {
      roomId: safeRoomId,
      roomName: `Sala ${safeRoomId.toUpperCase()}`,
      createdAt: Date.now(),
      hostSocketId: isMasterUser ? effectiveSocketId : "",
      isLocked: false,
      channels: [
        { id: "geral", name: "geral", description: "Canal de texto principal para todos os membros da sala" },
        { id: "links-midia", name: "links-e-mídia", description: "Compartilhamento de links, vídeos e imagens" },
        { id: "comandos-koki", name: "comandos-koki", description: "Comandos da sala, bots e interações" },
      ],
      participants: [optimisticParticipant],
      settings: {
        lowBandwidthDefault: false,
        allowScreenShare: true,
        allowVideo: true,
        allowGuestChat: true,
        maxParticipants: 16,
        requireKnockApproval: false,
      },
    };

    setCurrentRoom(optimisticRoom);
    setSelfParticipant(optimisticParticipant);
    setInCall(true);
    playVoiceJoinChime();

    // 2. Prepare payload with roomId, username, isMaster and optional passcode
    const joinPayload = {
      roomId: safeRoomId,
      username: username,
      name: username,
      isMaster: isMasterUser,
      passcode: params.passcode?.trim() || undefined,
      role: isGuestRole ? "guest" : "auto",
      isGuestOnly: isGuestRole,
      masterToken: masterToken || undefined,
      hostSecretToken: existingHostToken,
      profile: params.profile,
    };

    // Store in ref for seamless automatic reconnect if backend restarts
    lastJoinSessionRef.current = joinPayload;

    const performRoomJoin = (activeSocket: Socket) => {
      // 3. Immediately emit socket room:join on click
      activeSocket.emit(
        "room:join",
        joinPayload,
        (res: {
          success: boolean;
          needsApproval?: boolean;
          hostSecretToken?: string;
          room?: RoomState;
          self?: Participant;
          message?: string;
        }) => {
          if (res && res.success) {
            if (res.needsApproval) {
              setInCall(false);
              setIsWaitingApproval(true);
              return;
            }

            if (res.room && res.self) {
              if (res.hostSecretToken) {
                saveHostToken(res.room.roomId, res.hostSecretToken);
                if (lastJoinSessionRef.current) {
                  lastJoinSessionRef.current.hostSecretToken = res.hostSecretToken;
                }
              }
              setCurrentRoom(res.room);
              setSelfParticipant(res.self);
              setInCall(true);
            }
          } else if (res && !res.success) {
            setInCall(false);
            lastJoinSessionRef.current = null;
            setErrorMsg(res?.message || "Não foi possível entrar na chamada.");
          }
        }
      );
    };

    if (socket) {
      performRoomJoin(socket);
      if (!socket.connected) {
        socket.connect();
      }
    }
  };

  // Cancel Knock Approval Request
  const handleCancelApproval = () => {
    if (socket && urlRoomId) {
      socket.emit("room:cancel-knock", { roomId: urlRoomId });
    }
    setIsWaitingApproval(false);
    setApprovalError(null);
  };

  // Handle Leaving Call
  const handleLeaveRoom = () => {
    lastJoinSessionRef.current = null;
    if (socket) {
      socket.emit("room:leave");
    }
    setInCall(false);
    setCurrentRoom(null);
    setSelfParticipant(null);
    setIsWaitingApproval(false);
    setUrlRoomId("main-lounge");
    setUrlRole("");
    setErrorMsg(null);
    setApprovalError(null);
    // Reset query param
    window.history.pushState({}, "", "/?room=main-lounge");
  };

  // Calculate whether participant has an assigned VIP badge or VIP permissions
  const hasVipBadge = Boolean(
    selfParticipant?.vipPermissions?.hasVipBadge ||
    selfParticipant?.badges?.some(
      (b: string) =>
        b.toLowerCase().includes("vip") ||
        b === "vip_role" ||
        b === "vip_granted" ||
        b === "vip"
    ) ||
    (selfParticipant?.purchasedPerks &&
      selfParticipant.purchasedPerks["vip_role"] &&
      selfParticipant.purchasedPerks["vip_role"] > Date.now())
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans antialiased select-none">
      {/* Global Error Banner */}
      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-950/90 border border-rose-500/80 text-rose-200 px-4 py-2 rounded-xl text-xs flex items-center gap-3 shadow-2xl backdrop-blur-md animate-in fade-in">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-400 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Global WebRTC HTML <audio autoplay> element for instant remote peer audio playback */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        id="global-webrtc-remote-audio"
        style={{ display: "none" }}
      />

      {inCall && socket && currentRoom && selfParticipant ? (
        <CallRoom
          socket={socket}
          initialRoom={currentRoom}
          initialSelf={selfParticipant}
          isMaster={isMaster}
          hasVipBadge={hasVipBadge}
          masterToken={masterToken}
          onLeaveRoom={handleLeaveRoom}
          audioRef={audioRef}
        />
      ) : (
        <Lobby
          initialRoomId={urlRoomId}
          initialRole={urlRole}
          isMaster={isMaster}
          masterToken={masterToken}
          machineInfo={machineInfo}
          isWaitingApproval={isWaitingApproval}
          approvalError={approvalError}
          onCancelApproval={handleCancelApproval}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onMasterLogin={handleMasterLoginSuccess}
          onMasterLogout={handleMasterLogout}
        />
      )}
    </div>
  );
}
