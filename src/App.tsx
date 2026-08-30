import React, { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { RoomState, Participant } from "./types";
import { Lobby } from "./components/Lobby";
import { CallRoom } from "./components/CallRoom";
import { saveHostToken, getHostToken } from "./utils/storage";
import { getStoredMasterInfo, isMasterKeyValid, getMasterTokenSync, clearMasterAuthLocally } from "./utils/masterAuth";

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [inCall, setInCall] = useState<boolean>(false);
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [selfParticipant, setSelfParticipant] = useState<Participant | null>(null);
  const [urlRoomId, setUrlRoomId] = useState<string>("");
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

  // Initialize Socket.IO connection and query params
  useEffect(() => {
    const socketInstance = io({
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    setSocket(socketInstance);

    // Read room ID and role from query string (e.g. ?room=xyz&role=guest)
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    const roleParam = params.get("role");

    if (roomParam) {
      setUrlRoomId(roomParam);
    }
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
    };

    const handleKnockRejected = (data: { message?: string }) => {
      setIsWaitingApproval(false);
      setApprovalError(data.message || "Sua solicitação de entrada foi recusada pelo Dono da sala.");
    };

    socketInstance.on("room:knock-approved", handleKnockApproved);
    socketInstance.on("room:knock-rejected", handleKnockRejected);

    return () => {
      socketInstance.off("room:knock-approved", handleKnockApproved);
      socketInstance.off("room:knock-rejected", handleKnockRejected);
      socketInstance.disconnect();
    };
  }, []);

  // Handle Host Room Creation
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
    if (!socket) {
      setErrorMsg("Conectando ao servidor de chamadas... Tente novamente em alguns segundos.");
      return;
    }
    setErrorMsg(null);
    setApprovalError(null);

    const safeRoomId = params.roomId.trim()
      ? params.roomId.trim().toLowerCase().replace(/\s+/g, "-")
      : `koki-${Math.random().toString(36).substring(2, 8)}`;

    socket.emit(
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
        if (res && res.success && res.room && res.self) {
          // Save creator host secret token so creator is persistently recognized as host
          if (res.hostSecretToken) {
            saveHostToken(res.room.roomId, res.hostSecretToken);
          }

          // Keep host in room URL
          window.history.pushState({}, "", `/?room=${res.room.roomId}`);
          setCurrentRoom(res.room);
          setSelfParticipant(res.self);
          setInCall(true);
        } else {
          setErrorMsg(res?.message || "Erro ao criar sala. Tente novamente.");
        }
      }
    );
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
    if (!socket) {
      setErrorMsg("Conectando ao servidor de chamadas... Tente novamente em alguns segundos.");
      return;
    }
    setErrorMsg(null);
    setApprovalError(null);

    const safeRoomId = (params.roomId || urlRoomId || "").trim().toLowerCase();
    const isGuestRole = urlRole === "guest" || !params.passcode;
    // If joining explicitly as guest, never send host secret token to ensure role isolation
    const existingHostToken = isGuestRole ? undefined : getHostToken(safeRoomId);

    socket.emit(
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
            setIsWaitingApproval(true);
            return;
          }

          if (res.room && res.self) {
            if (res.hostSecretToken) {
              saveHostToken(res.room.roomId, res.hostSecretToken);
            }

            const newUrl = urlRole === "guest"
              ? `/?room=${res.room.roomId}&role=guest`
              : `/?room=${res.room.roomId}`;
            window.history.pushState({}, "", newUrl);

            setCurrentRoom(res.room);
            setSelfParticipant(res.self);
            setInCall(true);
          }
        } else {
          setErrorMsg(res?.message || "Não foi possível entrar na sala.");
        }
      }
    );
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
    setUrlRoomId("");
    setUrlRole("");
    setErrorMsg(null);
    setApprovalError(null);
    // Reset query param
    window.history.pushState({}, "", "/");
  };

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
