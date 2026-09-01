import React, { useState, useEffect } from "react";
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

const getInitialRoomId = (): string => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam && roomParam.trim().length > 0) {
      return roomParam.trim();
    }
  }
  return "main-lounge";
};

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

    const effectiveRoom = (roomParam && roomParam.trim().length > 0) ? roomParam.trim() : "main-lounge";
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

    socketInstance.on("room:knock-approved", handleKnockApproved);
    socketInstance.on("room:knock-rejected", handleKnockRejected);
    socketInstance.on("voice:joined", handleVoiceChannelEvent);
    socketInstance.on("voice:channel-changed", handleVoiceChannelEvent);

    return () => {
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

    const safeRoomId = (params.roomId || urlRoomId || "main-lounge").trim().toLowerCase().replace(/\s+/g, "-");
    const isGuestRole = urlRole === "guest" || !params.passcode;
    // If joining explicitly as guest, never send host secret token to ensure role isolation
    const existingHostToken = isGuestRole ? undefined : getHostToken(safeRoomId);
    const isMasterUser = Boolean(isMaster || params.profile.tag === "0001" || isMasterIdentity(params.name, isMaster));
    const effectiveSocketId = socket?.id || `temp-join-${Date.now()}`;

    // 1. Immediately create optimistic participant and room state so user instantly enters the call
    const optimisticSelf: Participant = {
      id: effectiveSocketId,
      name: params.name || (isMasterUser ? "Koki u sujo" : `Convidado ${Math.floor(100 + Math.random() * 900)}`),
      tag: params.profile.tag || (isMasterUser ? "0001" : "1001"),
      isHost: isMasterUser,
      isMaster: isMasterUser,
      hasAudio: true,
      hasVideo: false,
      isScreenSharing: false,
      isDeafened: false,
      isMutedByHost: false,
      joinedAt: Date.now(),
      avatarEmoji: params.profile.avatarEmoji || (isMasterUser ? "👑" : "🎮"),
      avatarColor: params.profile.avatarColor || "#06b6d4",
      avatarUrl: params.profile.avatarUrl,
      bannerColor: params.profile.bannerColor || "#0284c7",
      bannerUrl: params.profile.bannerUrl,
      customStatus: params.profile.customStatus || (isMasterUser ? "👑 Dono Master do Koki" : "🟢 Conectado na Call"),
      bio: params.profile.bio || "Participante na chamada.",
      badges: params.profile.badges || (isMasterUser ? ["owner_supreme", "koki_creator", "nitro_owner"] : []),
      kokiCoins: isMasterUser ? 999999 : 50,
      voiceChannelId: "voice-geral",
    };

    const optimisticRoom: RoomState = {
      roomId: safeRoomId,
      roomName: `Sala ${safeRoomId.toUpperCase()}`,
      hostSocketId: effectiveSocketId,
      createdAt: Date.now(),
      isLocked: false,
      participants: [optimisticSelf],
      settings: {
        allowScreenShare: true,
        allowVideo: true,
        allowGuestChat: true,
        maxParticipants: 16,
        lowBandwidthDefault: false,
        requireKnockApproval: false,
      },
      channels: [
        { id: "geral", name: "geral", description: "Canal de texto principal para todos os membros da sala" },
        { id: "links-e-clips", name: "links-e-clips", description: "Compartilhe links, clips e memes" },
        { id: "comandos-bot", name: "comandos-bot", description: "Músicas e comandos do Koki Bot" },
      ],
    };

    // Update URL query string
    const newUrl = `/?room=${encodeURIComponent(safeRoomId)}`;
    window.history.pushState({}, "", newUrl);

    // Instant optimistic UI entry
    setCurrentRoom(optimisticRoom);
    setSelfParticipant(optimisticSelf);
    setInCall(true);
    playVoiceJoinChime();

    // 2. Transmit room:join over socket
    const sendRoomJoin = (sock: any) => {
      sock.emit(
        "room:join",
        {
          roomId: safeRoomId,
          name: params.name,
          passcode: params.passcode,
          role: urlRole === "guest" ? "guest" : "auto",
          isGuestOnly: urlRole === "guest",
          masterToken: masterToken || undefined,
          hostSecretToken: existingHostToken,
          profile: params.profile,
        },
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
              }
              setCurrentRoom(res.room);
              setSelfParticipant(res.self);
              setInCall(true);
            }
          } else if (res && !res.success) {
            setInCall(false);
            setErrorMsg(res?.message || "Não foi possível entrar na sala.");
          }
        }
      );
    };

    if (socket) {
      if (socket.connected) {
        sendRoomJoin(socket);
      } else {
        socket.once("connect", () => {
          sendRoomJoin(socket);
        });
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

      {inCall && socket && currentRoom && selfParticipant ? (
        <CallRoom
          socket={socket}
          initialRoom={currentRoom}
          initialSelf={selfParticipant}
          isMaster={isMaster}
          hasVipBadge={hasVipBadge}
          masterToken={masterToken}
          onLeaveRoom={handleLeaveRoom}
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
