import React, { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import {
  Participant,
  RoomState,
  ChatMessage,
  UserPreferences,
  TextChannel,
  KnockRequest,
} from "../types";
import { RTC_CONFIG, DEFAULT_MEDIA_CONSTRAINTS, LOW_RESOURCE_CONSTRAINTS } from "../utils/webrtcConfig";
import { AudioVolumeTracker } from "../utils/audioAnalyser";
import { playVoiceJoinChime } from "../utils/audioChimes";
import { Header } from "./Header";
import { VideoTile } from "./VideoTile";
import { ScreenShareTile } from "./ScreenShareTile";
import { ControlBar } from "./ControlBar";
import { DiscordChatAndChannels } from "./DiscordChatAndChannels";
import { ChannelSidebar, VoiceChannel } from "./ChannelSidebar";
import { MemberList } from "./MemberList";
import { UserProfileCard } from "./UserProfileCard";
import { SettingsModal } from "./SettingsModal";
import { HostPanelModal } from "./HostPanelModal";
import { InviteModal } from "./InviteModal";
import { EditOwnerProfileModal } from "./EditOwnerProfileModal";
import { AdmissionModal } from "./AdmissionModal";
import { FloatingAdmissionBanner } from "./FloatingAdmissionBanner";
import { GrantVipModal } from "./GrantVipModal";
import { GrantBadgesModal } from "./GrantBadgesModal";
import { StoreModal } from "./StoreModal";
import {
  saveUserProfile,
  saveUserPreferences,
  getUserPreferences,
  getKokiCoins,
  setKokiCoins,
  addKokiCoins,
  getPurchasedPerks,
  isPerkActive,
} from "../utils/storage";
import { StorePerkId } from "../types";
import {
  ScreenSharePresetId,
  DEFAULT_SCREEN_PRESET_ID,
  SCREEN_SHARE_PRESETS,
  getDisplayMediaConstraints,
  applyScreenShareQuality,
} from "../utils/screenShareConfig";

interface CallRoomProps {
  socket: Socket;
  initialRoom: RoomState;
  initialSelf: Participant;
  isMaster?: boolean;
  hasVipBadge?: boolean;
  masterToken?: string | null;
  onLeaveRoom: () => void;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

export const CallRoom: React.FC<CallRoomProps> = ({
  socket,
  initialRoom,
  initialSelf,
  isMaster = false,
  hasVipBadge: initialHasVipBadge = false,
  masterToken = null,
  onLeaveRoom,
  audioRef,
}) => {
  const [room, setRoom] = useState<RoomState>(initialRoom);
  const [self, setSelf] = useState<Participant>(initialSelf);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>("geral");
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string>("voice-geral");
  const [isChannelsSidebarOpen, setIsChannelsSidebarOpen] = useState<boolean>(true);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isMemberListOpen, setIsMemberListOpen] = useState<boolean>(true);

  // 2 Text Channels (#geral, #anuncios) and 2 Voice Channels (Geral, Call VIP)
  const defaultTextChannels: TextChannel[] = [
    { id: "geral", name: "geral", description: "Canal principal de texto da call" },
    { id: "anuncios", name: "anúncios", description: "Anúncios oficiais e avisos da comunidade" },
  ];

  const defaultVoiceChannels: VoiceChannel[] = [
    { id: "voice-geral", name: "Geral", isVip: false },
    { id: "voice-vip", name: "Call VIP", isVip: true },
  ];

  // Seamless channel navigation without tearing down Socket.io/WebRTC
  const handleSelectTextChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setIsChatOpen(true);
    setUnreadChatCount(0);
  };

  const handleSelectVoiceChannel = (channelId: string) => {
    if (channelId === activeVoiceChannelId) return;

    // Check if channel is VIP and user has permission
    if (
      channelId === "voice-vip" &&
      !isMaster &&
      !self.isMaster &&
      !self.isHost &&
      !self.vipPermissions?.hasVipBadge
    ) {
      return;
    }

    setActiveVoiceChannelId(channelId);
    setSelf((prev) => ({ ...prev, voiceChannelId: channelId }));

    // Synthesized Web Audio API pleasant join chime
    playVoiceJoinChime();

    socket.emit(
      "voice:select-channel",
      {
        channelId,
        masterToken,
        roomId: room.roomId,
      },
      (res: { success: boolean; message?: string }) => {
        if (res && !res.success && res.message) {
          console.warn("Voice channel selection error:", res.message);
        }
      }
    );
  };

  // Move user to voice channel (Master feature)
  const handleMoveToVoiceChannel = (targetSocketId: string, targetChannelId: string) => {
    socket.emit(
      "host:move-voice-channel",
      {
        targetSocketId,
        targetChannelId,
        masterToken,
        roomId: room.roomId,
      },
      (res: { success: boolean; message?: string }) => {
        if (res && !res.success && res.message) {
          alert(res.message);
        }
      }
    );
  };

  // Play voice connection chime once initial voice connection is active
  useEffect(() => {
    const timer = setTimeout(() => {
      playVoiceJoinChime();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Selected Profile Card Modal (Discord Style)
  const [selectedProfileParticipant, setSelectedProfileParticipant] = useState<Participant | null>(null);

  // Master Voice Volume (Barra de Aumentar Voz e Baixar)
  const [masterVoiceVolume, setMasterVoiceVolume] = useState<number>(100);

  // Participant volume overrides
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHostPanelOpen, setIsHostPanelOpen] = useState<boolean>(false);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
  const [isOwnerProfileOpen, setIsOwnerProfileOpen] = useState<boolean>(false);
  const [isAdmissionOpen, setIsAdmissionOpen] = useState<boolean>(false);
  const [isGrantVipOpen, setIsGrantVipOpen] = useState<boolean>(false);
  const [isGrantBadgesOpen, setIsGrantBadgesOpen] = useState<boolean>(false);
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(false);
  const [targetVipParticipant, setTargetVipParticipant] = useState<Participant | null>(null);
  const [targetBadgeParticipant, setTargetBadgeParticipant] = useState<Participant | null>(null);

  const handlePerkPurchased = (perkId: StorePerkId, activeUntil: number) => {
    const updatedPerks = getPurchasedPerks();
    const newCoins = getKokiCoins();

    setSelf((prev) => {
      const next = {
        ...prev,
        kokiCoins: newCoins,
        purchasedPerks: updatedPerks,
      };

      if (perkId === "vip_role") {
        next.vipPermissions = {
          ...next.vipPermissions,
          hasVipBadge: true,
          canCustomizeMedia: true,
          canChangeNameInCall: true,
          priorityAudio: true,
          customBannerAccess: true,
        };
        if (!next.badges?.includes("vip_role")) {
          next.badges = [...(next.badges || []), "vip_role"];
        }
      }

      // Broadcast profile update to room participants
      socket.emit("profile:update", {
        avatarEmoji: next.avatarEmoji,
        avatarColor: next.avatarColor,
        avatarUrl: next.avatarUrl,
        bannerColor: next.bannerColor,
        bannerUrl: next.bannerUrl,
        customStatus: next.customStatus,
        bio: next.bio,
        customTitle: next.customTitle,
        kokiCoins: next.kokiCoins,
        purchasedPerks: next.purchasedPerks,
        badges: next.badges,
      });

      return next;
    });
  };

  // Pending Knock Requests (Owner Portaria)
  const [pendingKnocks, setPendingKnocks] = useState<KnockRequest[]>([]);

  // Spotlight participant
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  // Connection ping
  const [pingMs, setPingMs] = useState<number>(24);

  // Media and Control states
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(true);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [screenQualityPreset, setScreenQualityPreset] = useState<ScreenSharePresetId>(DEFAULT_SCREEN_PRESET_ID);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);

  // User preferences (Restored automatically from local storage)
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = getUserPreferences();
    return {
      name: initialSelf.name || saved.name,
      selectedAudioInput: saved.selectedAudioInput || "",
      selectedAudioOutput: saved.selectedAudioOutput || "",
      selectedVideoInput: saved.selectedVideoInput || "",
      isPushToTalk: saved.isPushToTalk,
      pushToTalkKey: saved.pushToTalkKey || "Space",
      noiseSuppression: saved.noiseSuppression,
      echoCancellation: saved.echoCancellation,
      lowResourceMode: saved.lowResourceMode || initialRoom.settings.lowBandwidthDefault,
      videoQuality: saved.videoQuality || "medium",
      volume: saved.volume ?? 100,
    };
  });

  // Media Streams refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteScreenStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const incomingStreamTypeRef = useRef<Map<string, "camera" | "screen">>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const [forceUpdate, setForceUpdate] = useState(0);

  const audioTrackerRef = useRef<AudioVolumeTracker | null>(null);
  const pingIntervalRef = useRef<number | null>(null);

  // 1. Load Channel Messages initially and when changing channel
  useEffect(() => {
    socket.emit("room:get-channel-messages", activeChannelId, (res: { channelId: string; messages: ChatMessage[] }) => {
      if (res && res.messages) {
        setMessages((prev) => {
          const others = prev.filter((m) => m.channelId !== res.channelId);
          return [...others, ...res.messages];
        });
      }
    });
  }, [socket, activeChannelId]);

  // 2. Initialize Local Audio/Video Media
  useEffect(() => {
    let active = true;

    const setupMedia = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: preferences.echoCancellation,
              noiseSuppression: preferences.noiseSuppression,
              deviceId: preferences.selectedAudioInput ? { exact: preferences.selectedAudioInput } : undefined,
            },
            video: !isVideoMuted && !preferences.lowResourceMode
              ? {
                  deviceId: preferences.selectedVideoInput ? { exact: preferences.selectedVideoInput } : undefined,
                  ...(preferences.lowResourceMode ? LOW_RESOURCE_CONSTRAINTS.video : DEFAULT_MEDIA_CONSTRAINTS.video),
                }
              : false,
          });
        } catch (mediaErr) {
          // If video failed (e.g. camera busy or denied), try audio only
          console.warn("Retrying with audio-only...", mediaErr);
          setIsVideoMuted(true);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: preferences.echoCancellation,
              noiseSuppression: preferences.noiseSuppression,
            },
            video: false,
          });
        }

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;

        // Apply mute state to local audio track
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks[0].enabled = !isAudioMuted && !self.isMutedByHost;
        }

        // WebRTC Stream & Track Binding:
        // Ensure localStream.getAudioTracks()[0] is attached to every RTCPeerConnection instance via peerConnection.addTrack(track, localStream)
        peerConnectionsRef.current.forEach((pc, targetId) => {
          const senders = pc.getSenders();
          
          if (audioTracks.length > 0) {
            const localAudioTrack = audioTracks[0];
            const existingAudioSender = senders.find((s) => s.track?.kind === "audio");
            if (existingAudioSender) {
              existingAudioSender.replaceTrack(localAudioTrack).catch((e) => console.warn("replaceTrack audio error:", e));
            } else {
              try {
                pc.addTrack(localAudioTrack, stream);
              } catch (e) {
                console.warn("addTrack audio error:", e);
              }
            }
          }

          stream.getVideoTracks().forEach((track) => {
            const existingVideoSender = senders.find((s) => s.track?.kind === "video");
            if (existingVideoSender) {
              existingVideoSender.replaceTrack(track).catch((e) => console.warn("replaceTrack video error:", e));
            } else {
              try {
                pc.addTrack(track, stream);
              } catch (e) {
                console.warn("addTrack video error:", e);
              }
            }
          });

          // Trigger renegotiation so remote peers immediately receive media without failures
          if (pc.signalingState === "stable") {
            pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => {
                socket.emit("signal:offer", {
                  targetId,
                  to: targetId,
                  offer: pc.localDescription,
                  streamType: "camera",
                });
              })
              .catch((e) => console.warn("Renegotiation offer error:", e));
          }
        });

        // Setup volume tracker
        audioTrackerRef.current = new AudioVolumeTracker((level) => {
          setLocalAudioLevel(level);
        });
        audioTrackerRef.current.start(stream);

        // Update local self state in room
        setSelf((prev) => ({
          ...prev,
          stream,
          hasAudio: !isAudioMuted && !self.isMutedByHost,
          hasVideo: !isVideoMuted && !preferences.lowResourceMode,
        }));

        setForceUpdate((prev) => prev + 1);
      } catch (err) {
        console.warn("Could not acquire media devices:", err);
      }
    };

    setupMedia();

    return () => {
      active = false;
      if (audioTrackerRef.current) {
        audioTrackerRef.current.stop();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [preferences.echoCancellation, preferences.noiseSuppression, preferences.selectedAudioInput, preferences.selectedVideoInput]);

  // 3. Ping Interval
  useEffect(() => {
    pingIntervalRef.current = window.setInterval(() => {
      const start = Date.now();
      socket.emit("api:ping", () => {
        setPingMs(Math.max(8, Date.now() - start));
      });
      setPingMs((prev) => Math.min(60, Math.max(12, prev + Math.floor(Math.random() * 7 - 3))));
    }, 4000);

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [socket]);

  // 4. WebRTC Peer Connection Helper
  const createPeerConnection = useCallback((targetId: string, isInitiator: boolean) => {
    if (peerConnectionsRef.current.has(targetId)) {
      return peerConnectionsRef.current.get(targetId)!;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(targetId, pc);

    // WebRTC Stream & Track Binding:
    // Ensure localStream.getAudioTracks()[0] is attached to every RTCPeerConnection instance via peerConnection.addTrack(track, localStream)
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioMuted && !self.isMutedByHost;
        try {
          pc.addTrack(audioTrack, localStreamRef.current);
        } catch (e) {
          console.warn("addTrack audio localStream error:", e);
        }
      }

      // Add camera video track if active
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack && !isVideoMuted && !preferences.lowResourceMode) {
        try {
          pc.addTrack(videoTrack, localStreamRef.current);
        } catch (e) {
          console.warn("addTrack video localStream error:", e);
        }
      }
    }

    // Add screen share tracks if sharing
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localScreenStreamRef.current!);
        } catch (e) {
          console.warn("addTrack localScreenStream error:", e);
        }
      });
    }

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal:ice-candidate", {
          targetId,
          to: targetId,
          candidate: event.candidate,
          iceCandidate: event.candidate,
          streamType: localScreenStreamRef.current ? "screen" : "camera",
        });
      }
    };

    // Handle Incoming Remote Tracks (Camera & Screen Share)
    // Handle peerConnection.ontrack: attach event.streams[0] directly to media elements (<audio autoplay> / <video autoplay>)
    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      const track = event.track;

      if (track.kind === "audio") {
        // Direct audioRef binding if supplied by App.tsx (or audioRef.current.srcObject = event.streams[0])
        if (audioRef && audioRef.current) {
          try {
            if (audioRef.current.srcObject !== stream) {
              audioRef.current.srcObject = stream;
            }
            audioRef.current.play().catch((err) => {
              console.warn("audioRef autoplay error (interaction pending):", err);
            });
          } catch (e) {
            console.warn("Error attaching event.streams[0] to audioRef:", e);
          }
        }

        // Dedicated per-peer HTML <audio autoplay> element to guarantee concurrent audio for all peers
        let peerAudioEl = remoteAudioElementsRef.current.get(targetId);
        if (!peerAudioEl) {
          peerAudioEl = document.getElementById(`remote-peer-audio-${targetId}`) as HTMLAudioElement;
          if (!peerAudioEl) {
            peerAudioEl = document.createElement("audio");
            peerAudioEl.id = `remote-peer-audio-${targetId}`;
            peerAudioEl.autoplay = true;
            peerAudioEl.playsInline = true;
            peerAudioEl.setAttribute("playsinline", "true");
            peerAudioEl.style.display = "none";
            document.body.appendChild(peerAudioEl);
          }
          remoteAudioElementsRef.current.set(targetId, peerAudioEl);
        }

        if (peerAudioEl) {
          if (peerAudioEl.srcObject !== stream) {
            peerAudioEl.srcObject = stream;
          }
          const userVol = participantVolumes[targetId] ?? 100;
          peerAudioEl.volume = Math.max(0, Math.min(1, (userVol / 100) * (masterVoiceVolume / 100)));
          peerAudioEl.play().catch((err) => {
            console.warn(`Autoplay audio for peer ${targetId} pending user interaction:`, err);
          });
        }
      }

      const currentParticipant = room.participants.find((p) => p.id === targetId);

      // Distinguish screen share track from webcam camera track
      const trackLabel = (track.label || "").toLowerCase();
      const isScreenShare =
        trackLabel.includes("screen") ||
        trackLabel.includes("window") ||
        trackLabel.includes("display") ||
        trackLabel.includes("monitor") ||
        trackLabel.includes("tab") ||
        incomingStreamTypeRef.current.get(targetId) === "screen" ||
        Boolean(currentParticipant?.isScreenSharing && remoteStreamsRef.current.has(targetId));

      if (isScreenShare) {
        remoteScreenStreamsRef.current.set(targetId, stream);
      } else {
        remoteStreamsRef.current.set(targetId, stream);
      }

      track.onended = () => {
        if (isScreenShare) {
          remoteScreenStreamsRef.current.delete(targetId);
          if (spotlightId === `screen-${targetId}`) {
            setSpotlightId(null);
          }
        }
        setForceUpdate((prev) => prev + 1);
      };

      setForceUpdate((prev) => prev + 1);
    };

    // Handle Connection State
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        const audioEl = remoteAudioElementsRef.current.get(targetId);
        if (audioEl) {
          audioEl.pause();
          audioEl.srcObject = null;
          audioEl.remove();
          remoteAudioElementsRef.current.delete(targetId);
        }
        peerConnectionsRef.current.delete(targetId);
        remoteStreamsRef.current.delete(targetId);
        remoteScreenStreamsRef.current.delete(targetId);
        setForceUpdate((prev) => prev + 1);
      }
    };

    // Handle ICE Connection State and Auto-Recover with ICE Restart
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        console.warn(`ICE failed for peer ${targetId}, restarting ICE...`);
        if (typeof (pc as any).restartIce === "function") {
          (pc as any).restartIce();
        }
        pc.createOffer({ iceRestart: true, offerToReceiveAudio: true, offerToReceiveVideo: true })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit("signal:offer", {
              targetId,
              to: targetId,
              offer: pc.localDescription,
              streamType: localScreenStreamRef.current ? "screen" : "camera",
            });
          })
          .catch((err) => console.warn("ICE restart offer error:", err));
      } else if (pc.iceConnectionState === "closed") {
        const audioEl = remoteAudioElementsRef.current.get(targetId);
        if (audioEl) {
          audioEl.pause();
          audioEl.srcObject = null;
          audioEl.remove();
          remoteAudioElementsRef.current.delete(targetId);
        }
        peerConnectionsRef.current.delete(targetId);
        remoteStreamsRef.current.delete(targetId);
        remoteScreenStreamsRef.current.delete(targetId);
        setForceUpdate((prev) => prev + 1);
      }
    };

    // If initiator, create and send Offer
    if (isInitiator) {
      makingOfferRef.current.set(targetId, true);
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit("signal:offer", {
            targetId,
            to: targetId,
            offer: pc.localDescription,
            streamType: localScreenStreamRef.current ? "screen" : "camera",
          });
        })
        .catch((err) => console.warn("Error creating WebRTC offer:", err))
        .finally(() => {
          makingOfferRef.current.set(targetId, false);
        });
    }

    return pc;
  }, [socket, room.participants, isAudioMuted, isVideoMuted, preferences.lowResourceMode, self.isMutedByHost, masterVoiceVolume, participantVolumes, audioRef]);

  // 5. Socket.IO Event Listeners
  useEffect(() => {
    const handleUserJoined = (newParticipant: Participant) => {
      setRoom((prev) => {
        const exists = prev.participants.some((p) => p.id === newParticipant.id);
        if (exists) return prev;
        return {
          ...prev,
          participants: [...prev.participants, newParticipant],
        };
      });

      // Play soft synthesized chime when a user joins the voice channel
      playVoiceJoinChime(0.18);

      // Initiate WebRTC connection to new user
      createPeerConnection(newParticipant.id, true);
    };

    const handleUserLeft = (data: { id: string; name: string }) => {
      setRoom((prev) => ({
        ...prev,
        participants: prev.participants.filter((p) => p.id !== data.id),
      }));

      // Clean up remote audio element
      const audioEl = remoteAudioElementsRef.current.get(data.id);
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
        remoteAudioElementsRef.current.delete(data.id);
      }

      // Clean up peer connection & WebRTC refs
      const pc = peerConnectionsRef.current.get(data.id);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.id);
      }
      remoteStreamsRef.current.delete(data.id);
      remoteScreenStreamsRef.current.delete(data.id);
      pendingCandidatesRef.current.delete(data.id);
      makingOfferRef.current.delete(data.id);
      ignoreOfferRef.current.delete(data.id);

      if (spotlightId === data.id) {
        setSpotlightId(null);
      }

      if (selectedProfileParticipant?.id === data.id) {
        setSelectedProfileParticipant(null);
      }

      setForceUpdate((prev) => prev + 1);
    };

    const handleUserUpdated = (updatedUser: Participant) => {
      setRoom((prev) => ({
        ...prev,
        participants: prev.participants.map((p) => (p.id === updatedUser.id ? { ...p, ...updatedUser } : p)),
      }));

      if (updatedUser.id === self.id) {
        setSelf((prev) => ({ ...prev, ...updatedUser }));
      }

      if (selectedProfileParticipant?.id === updatedUser.id) {
        setSelectedProfileParticipant((prev) => (prev ? { ...prev, ...updatedUser } : null));
      }

      // If user started screen sharing, auto spotlight if none set
      if (updatedUser.isScreenSharing && !spotlightId) {
        setSpotlightId(`screen-${updatedUser.id}`);
      }
    };

    // ICE Candidate & Signaling Exchange:
    // Ensure signal:offer, signal:answer, and signal:ice-candidate pass audio media descriptions without renegotiation failures or dropping audio tracks.
    const handleOffer = async (payload: {
      senderId?: string;
      from?: string;
      offer: RTCSessionDescriptionInit;
      streamType?: string;
      isScreen?: boolean;
    }) => {
      const senderId = payload.senderId || payload.from;
      if (!senderId || !payload.offer) return;

      const isScreen = payload.isScreen || payload.streamType === "screen";
      incomingStreamTypeRef.current.set(senderId, isScreen ? "screen" : "camera");

      const pc = createPeerConnection(senderId, false);
      const isPolite = (socket.id || "") < senderId;
      const isOfferCollision =
        makingOfferRef.current.get(senderId) || pc.signalingState !== "stable";

      ignoreOfferRef.current.set(senderId, !isPolite && isOfferCollision);
      if (ignoreOfferRef.current.get(senderId)) {
        console.warn(`[WebRTC] Glare handled: Impolite peer ignoring colliding offer from ${senderId}`);
        return;
      }

      try {
        if (isOfferCollision) {
          // Polite peer rolls back local offer to prevent renegotiation failure
          try {
            await pc.setLocalDescription({ type: "rollback" } as any);
          } catch (rollbackErr) {
            console.warn("Rollback caught:", rollbackErr);
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));

        // Process any queued ICE candidates for this peer
        const queued = pendingCandidatesRef.current.get(senderId) || [];
        for (const cand of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn("Error adding queued ICE candidate in handleOffer:", e);
          }
        }
        pendingCandidatesRef.current.delete(senderId);

        // Ensure local audio track is attached to answer with audio
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = !isAudioMuted && !self.isMutedByHost;
            const senders = pc.getSenders();
            const hasAudioSender = senders.some((s) => s.track?.kind === "audio");
            if (!hasAudioSender) {
              try {
                pc.addTrack(audioTrack, localStreamRef.current);
              } catch (e) {
                console.warn("addTrack audio before answer error:", e);
              }
            }
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("signal:answer", {
          targetId: senderId,
          to: senderId,
          answer: pc.localDescription,
          streamType: payload.streamType || "camera",
        });
      } catch (err) {
        console.warn("Error handling WebRTC offer:", err);
      }
    };

    const handleAnswer = async (payload: {
      senderId?: string;
      from?: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      const senderId = payload.senderId || payload.from;
      if (!senderId || !payload.answer) return;

      const pc = peerConnectionsRef.current.get(senderId);
      if (pc) {
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));

            // Process any queued ICE candidates for this peer
            const queued = pendingCandidatesRef.current.get(senderId) || [];
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn("Error adding queued ICE candidate in handleAnswer:", e);
              }
            }
            pendingCandidatesRef.current.delete(senderId);
          }
        } catch (err) {
          console.warn("Error handling WebRTC answer:", err);
        }
      }
    };

    const handleIceCandidate = async (payload: {
      senderId?: string;
      from?: string;
      candidate?: RTCIceCandidateInit;
      iceCandidate?: RTCIceCandidateInit;
    }) => {
      const senderId = payload.senderId || payload.from;
      const candidateInit = payload.candidate || payload.iceCandidate;
      if (!senderId || !candidateInit) return;

      const pc = peerConnectionsRef.current.get(senderId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (err) {
          if (!ignoreOfferRef.current.get(senderId)) {
            console.warn("Error adding ICE candidate:", err);
          }
        }
      } else {
        const queued = pendingCandidatesRef.current.get(senderId) || [];
        queued.push(candidateInit);
        pendingCandidatesRef.current.set(senderId, queued);
      }
    };

    const handleChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (!isChatOpen) {
        setUnreadChatCount((prev) => prev + 1);
      }
    };

    const handleForcedMute = () => {
      setIsAudioMuted(true);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
      }
    };

    const handleKicked = (data: { reason?: string }) => {
      alert(data.reason || "Você foi desconectado pelo anfitrião.");
      onLeaveRoom();
    };

    const handleRoomClosed = (data: { reason?: string }) => {
      alert(data.reason || "A sala foi encerrada pelo Dono da chamada.");
      onLeaveRoom();
    };

    const handleLockChanged = (data: { isLocked: boolean }) => {
      setRoom((prev) => ({ ...prev, isLocked: data.isLocked }));
    };

    const handleSettingsChanged = (settings: RoomState["settings"]) => {
      setRoom((prev) => ({ ...prev, settings }));
    };

    const handleKnockRequest = (request: KnockRequest) => {
      setPendingKnocks((prev) => {
        const filtered = prev.filter((k) => k.socketId !== request.socketId);
        return [...filtered, request];
      });
    };

    const handleKnockCancelled = (data: { socketId: string }) => {
      setPendingKnocks((prev) => prev.filter((k) => k.socketId !== data.socketId));
    };

    const handleVipGranted = (data: { participant: Participant; message?: string }) => {
      setRoom((prev) => ({
        ...prev,
        participants: prev.participants.map((p) => (p.id === data.participant.id ? data.participant : p)),
      }));
      if (data.participant.id === self.id) {
        setSelf(data.participant);
      }
      if (selectedProfileParticipant && selectedProfileParticipant.id === data.participant.id) {
        setSelectedProfileParticipant(data.participant);
      }
    };

    const handleVipRevoked = (data: { participantId: string; message?: string }) => {
      setRoom((prev) => ({
        ...prev,
        participants: prev.participants.map((p) => {
          if (p.id === data.participantId) {
            const { vipPermissions, ...rest } = p;
            return rest;
          }
          return p;
        }),
      }));
      if (self.id === data.participantId) {
        setSelf((prev) => {
          const { vipPermissions, ...rest } = prev;
          return rest;
        });
      }
      if (selectedProfileParticipant && selectedProfileParticipant.id === data.participantId) {
        setSelectedProfileParticipant((prev) => {
          if (!prev) return null;
          const { vipPermissions, ...rest } = prev;
          return rest;
        });
      }
    };

    const handleCoinsReceived = (data: { amount: number; senderName?: string; newBalance?: number; message?: string }) => {
      addKokiCoins(data.amount);
      setSelf((prev) => ({
        ...prev,
        kokiCoins: (prev.kokiCoins || getKokiCoins()) + data.amount,
      }));
    };

    const handleCoinsUpdated = (data: {
      participantId?: string;
      socketId?: string;
      kokiCoins?: number;
      newBalance?: number;
      balance?: number;
      amount?: number;
    }) => {
      const targetId = data.participantId || data.socketId;
      const newCoins = data.kokiCoins ?? data.newBalance ?? data.balance;

      // If the update is for the current local user (or no specific targetId is specified)
      if (!targetId || targetId === self.id) {
        if (typeof newCoins === "number") {
          setKokiCoins(newCoins);
          setSelf((prev) => ({
            ...prev,
            kokiCoins: newCoins,
          }));
        } else if (typeof data.amount === "number") {
          const updated = addKokiCoins(data.amount);
          setSelf((prev) => ({
            ...prev,
            kokiCoins: updated,
          }));
        }
      }

      // If a participantId is provided, also sync participant's balance in room state & opened profile
      if (targetId && typeof newCoins === "number") {
        setRoom((prev) => ({
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === targetId ? { ...p, kokiCoins: newCoins } : p
          ),
        }));

        if (selectedProfileParticipant && selectedProfileParticipant.id === targetId) {
          setSelectedProfileParticipant((prev) =>
            prev ? { ...prev, kokiCoins: newCoins } : null
          );
        }
      }
    };

    const handleBadgesAssigned = (data: { badges: string[]; message?: string }) => {
      if (Array.isArray(data?.badges)) {
        setSelf((prev) => ({ ...prev, badges: data.badges }));
        saveUserProfile({ badges: data.badges });
      }
    };

    const handleForcedChannelChange = (data: { channelId: string; channelName?: string; movedBy?: string }) => {
      if (data && data.channelId) {
        setActiveVoiceChannelId(data.channelId);
        setSelf((prev) => ({ ...prev, voiceChannelId: data.channelId }));
        playVoiceJoinChime();
      }
    };

    const handleSyncUsersList = (data: any) => {
      let list: Participant[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.participants)) {
        list = data.participants;
      } else if (data && data.room && Array.isArray(data.room.participants)) {
        list = data.room.participants;
      }
      if (!list || list.length === 0) return;

      setRoom((prev) => {
        const prevMap = new Map<string, Participant>(prev.participants.map((p) => [p.id, p]));
        const merged: Participant[] = list.map((incoming: Participant) => {
          const existing = prevMap.get(incoming.id);
          return existing ? Object.assign({}, existing, incoming) : incoming;
        });
        return {
          ...prev,
          participants: merged,
        };
      });

      list.forEach((p: Participant) => {
        if (p.id !== self.id && !peerConnectionsRef.current.has(p.id)) {
          createPeerConnection(p.id, true);
        }
      });
    };

    const handleRoomSync = (syncedRoom: RoomState) => {
      if (syncedRoom && syncedRoom.roomId) {
        setRoom((prev) => ({
          ...prev,
          ...syncedRoom,
          participants: syncedRoom.participants || prev.participants,
        }));
        (syncedRoom.participants || []).forEach((p) => {
          if (p.id !== self.id && !peerConnectionsRef.current.has(p.id)) {
            createPeerConnection(p.id, true);
          }
        });
      }
    };

    const handleSocketReconnect = () => {
      // Upon socket reconnect, refresh room state and peer connections
      if (room.roomId) {
        socket.emit("room:get-state", { roomId: room.roomId }, (res: any) => {
          if (res && res.success && res.room) {
            handleRoomSync(res.room);
          }
        });
      }
      peerConnectionsRef.current.forEach((pc, peerId) => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          pc.close();
          peerConnectionsRef.current.delete(peerId);
          createPeerConnection(peerId, true);
        }
      });
    };

    socket.on("connect", handleSocketReconnect);
    socket.on("room:user-joined", handleUserJoined);
    socket.on("room:user_joined", handleUserJoined);
    socket.on("room:user-left", handleUserLeft);
    socket.on("room:user_left", handleUserLeft);
    socket.on("room:user-updated", handleUserUpdated);
    socket.on("room:user_updated", handleUserUpdated);
    socket.on("room:users-list", handleSyncUsersList);
    socket.on("room:users_list", handleSyncUsersList);
    socket.on("room:participants", handleSyncUsersList);
    socket.on("voice:participants", handleSyncUsersList);
    socket.on("room:sync", handleRoomSync);
    socket.on("signal:offer", handleOffer);
    socket.on("signal:answer", handleAnswer);
    socket.on("signal:ice-candidate", handleIceCandidate);
    socket.on("signal:ice_candidate", handleIceCandidate);
    socket.on("room:chat-message", handleChatMessage);
    socket.on("host:forced-mute", handleForcedMute);
    socket.on("host:kicked", handleKicked);
    socket.on("room:closed", handleRoomClosed);
    socket.on("room:lock-changed", handleLockChanged);
    socket.on("room:settings-changed", handleSettingsChanged);
    socket.on("host:knock-request", handleKnockRequest);
    socket.on("host:knock-cancelled", handleKnockCancelled);
    socket.on("vip:granted", handleVipGranted);
    socket.on("vip:revoked", handleVipRevoked);
    socket.on("vip:expired", handleVipRevoked);
    socket.on("coins:received", handleCoinsReceived);
    socket.on("coins:updated", handleCoinsUpdated);
    socket.on("badges:assigned", handleBadgesAssigned);
    socket.on("voice:forced-channel-change", handleForcedChannelChange);

    if (self.isHost || isMaster) {
      socket.emit("host:get-pending-knocks", (knocks: KnockRequest[]) => {
        if (Array.isArray(knocks)) {
          setPendingKnocks(knocks);
        }
      });
    }

    // Connect to all existing participants
    room.participants.forEach((p) => {
      if (p.id !== self.id) {
        createPeerConnection(p.id, true);
      }
    });

    return () => {
      socket.off("room:user-joined", handleUserJoined);
      socket.off("room:user_joined", handleUserJoined);
      socket.off("room:user-left", handleUserLeft);
      socket.off("room:user_left", handleUserLeft);
      socket.off("room:user-updated", handleUserUpdated);
      socket.off("room:user_updated", handleUserUpdated);
      socket.off("room:users-list", handleSyncUsersList);
      socket.off("room:users_list", handleSyncUsersList);
      socket.off("room:participants", handleSyncUsersList);
      socket.off("voice:participants", handleSyncUsersList);
      socket.off("room:sync", handleRoomSync);
      socket.off("signal:offer", handleOffer);
      socket.off("signal:answer", handleAnswer);
      socket.off("signal:ice-candidate", handleIceCandidate);
      socket.off("signal:ice_candidate", handleIceCandidate);
      socket.off("room:chat-message", handleChatMessage);
      socket.off("host:forced-mute", handleForcedMute);
      socket.off("host:kicked", handleKicked);
      socket.off("room:closed", handleRoomClosed);
      socket.off("room:lock-changed", handleLockChanged);
      socket.off("room:settings-changed", handleSettingsChanged);
      socket.off("host:knock-request", handleKnockRequest);
      socket.off("host:knock-cancelled", handleKnockCancelled);
      socket.off("vip:granted", handleVipGranted);
      socket.off("vip:revoked", handleVipRevoked);
      socket.off("vip:expired", handleVipRevoked);
      socket.off("coins:received", handleCoinsReceived);
      socket.off("coins:updated", handleCoinsUpdated);
      socket.off("badges:assigned", handleBadgesAssigned);
      socket.off("voice:forced-channel-change", handleForcedChannelChange);
      socket.off("connect", handleSocketReconnect);
    };
  }, [socket, self.id, self.isHost, isMaster, isChatOpen, createPeerConnection, onLeaveRoom, selectedProfileParticipant?.id, spotlightId, room.participants]);

  // 6. Broadcast local audio level and state changes
  useEffect(() => {
    socket.emit("room:state-update", {
      hasAudio: !isAudioMuted && !self.isMutedByHost,
      hasVideo: !isVideoMuted && !preferences.lowResourceMode,
      isScreenSharing,
      isDeafened,
      audioLevel: localAudioLevel,
    });
  }, [isAudioMuted, isVideoMuted, isScreenSharing, isDeafened, localAudioLevel, preferences.lowResourceMode, self.isMutedByHost, socket]);

  // Toggle Microphone
  const handleToggleAudio = async () => {
    if (self.isMutedByHost) return;

    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);

    // If activating/unmuting, re-acquire audio track if missing
    if (!nextMuted) {
      if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: preferences.echoCancellation,
              noiseSuppression: preferences.noiseSuppression,
              deviceId: preferences.selectedAudioInput ? { exact: preferences.selectedAudioInput } : undefined,
            },
            video: false,
          });
          const newAudioTrack = micStream.getAudioTracks()[0];
          if (newAudioTrack) {
            if (localStreamRef.current) {
              localStreamRef.current.addTrack(newAudioTrack);
            } else {
              localStreamRef.current = new MediaStream([newAudioTrack]);
            }
          }
        } catch (e) {
          console.warn("Failed to acquire microphone track on unmute:", e);
        }
      }
    }

    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !nextMuted));

      // WebRTC Stream & Track Binding:
      // Ensure localStream.getAudioTracks()[0] is attached to every RTCPeerConnection instance via peerConnection.addTrack(track, localStream) as soon as the microphone is unmuted/activated.
      if (!nextMuted && audioTracks.length > 0) {
        const activeAudioTrack = audioTracks[0];
        peerConnectionsRef.current.forEach((pc, targetId) => {
          const senders = pc.getSenders();
          const existingAudioSender = senders.find((s) => s.track?.kind === "audio");
          if (existingAudioSender) {
            existingAudioSender.replaceTrack(activeAudioTrack).catch((err) => {
              console.warn("replaceTrack error on unmute:", err);
            });
          } else {
            try {
              pc.addTrack(activeAudioTrack, localStreamRef.current!);
            } catch (err) {
              console.warn("addTrack error on unmute:", err);
            }
          }

          if (pc.signalingState === "stable") {
            makingOfferRef.current.set(targetId, true);
            pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => {
                socket.emit("signal:offer", {
                  targetId,
                  to: targetId,
                  offer: pc.localDescription,
                  streamType: "camera",
                });
              })
              .catch((err) => console.warn("Renegotiate offer on unmute error:", err))
              .finally(() => {
                makingOfferRef.current.set(targetId, false);
              });
          }
        });
      }
    }

    setSelf((prev) => ({ ...prev, hasAudio: !nextMuted }));
    socket.emit("room:state-update", { hasAudio: !nextMuted });
  };

  // Toggle Video Camera
  const handleToggleVideo = async () => {
    if (preferences.lowResourceMode) return;

    if (!isVideoMuted) {
      // Turn off video
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
      }

      peerConnectionsRef.current.forEach((pc, targetId) => {
        const senders = pc.getSenders();
        senders.forEach((sender) => {
          if (sender.track && sender.track.kind === "video" && !sender.track.label.toLowerCase().includes("screen")) {
            try {
              pc.removeTrack(sender);
            } catch (e) {
              console.warn("removeTrack video error:", e);
            }
          }
        });

        if (pc.signalingState === "stable") {
          pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
              socket.emit("signal:offer", {
                targetId,
                offer: pc.localDescription,
                streamType: "camera",
              });
            })
            .catch((e) => console.warn("Renegotiation after stop camera error:", e));
        }
      });

      setIsVideoMuted(true);
      setSelf((prev) => ({ ...prev, hasVideo: false }));
      socket.emit("room:state-update", { hasVideo: false });
      setForceUpdate((prev) => prev + 1);
    } else {
      // Turn on video
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: preferences.selectedVideoInput ? { deviceId: { exact: preferences.selectedVideoInput } } : true,
        });

        const newVideoTrack = videoStream.getVideoTracks()[0];
        if (localStreamRef.current && newVideoTrack) {
          localStreamRef.current.addTrack(newVideoTrack);

          // Add to all peer connections and renegotiate
          peerConnectionsRef.current.forEach((pc, targetId) => {
            try {
              pc.addTrack(newVideoTrack, localStreamRef.current!);
            } catch (e) {
              console.warn("addTrack video error:", e);
            }

            if (pc.signalingState === "stable") {
              pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
                .then((offer) => pc.setLocalDescription(offer))
                .then(() => {
                  socket.emit("signal:offer", {
                    targetId,
                    offer: pc.localDescription,
                    streamType: "camera",
                  });
                })
                .catch((e) => console.warn("Renegotiation after start camera error:", e));
            }
          });
        }
        setIsVideoMuted(false);
        setSelf((prev) => ({ ...prev, hasVideo: true }));
        socket.emit("room:state-update", { hasVideo: true });
        setForceUpdate((prev) => prev + 1);
      } catch (err) {
        console.warn("Could not start camera:", err);
      }
    }
  };

  // Change Screen Share Quality dynamically
  const handleChangeScreenQuality = async (presetId: ScreenSharePresetId) => {
    setScreenQualityPreset(presetId);
    const preset = SCREEN_SHARE_PRESETS[presetId];

    if (isScreenSharing && localScreenStreamRef.current) {
      await applyScreenShareQuality(localScreenStreamRef.current, presetId, peerConnectionsRef.current);
      handleSendMessage(`⚙️ Qualidade de transmissão de tela alterada para: ${preset.label} (${preset.badge})`, activeChannelId);
      setForceUpdate((prev) => prev + 1);
    }
  };

  // Toggle Screen Share with full WebRTC renegotiation & broadcast (Default: 1080p @ 90 FPS)
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen share
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
        localScreenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      if (spotlightId === `screen-${self.id}` || spotlightId === self.id) {
        setSpotlightId(null);
      }

      // Remove or replace screen tracks on peer connections and renegotiate
      peerConnectionsRef.current.forEach((pc, targetId) => {
        const senders = pc.getSenders();
        senders.forEach((sender) => {
          if (
            sender.track &&
            (sender.track.label.toLowerCase().includes("screen") ||
              (localStreamRef.current && !localStreamRef.current.getTracks().includes(sender.track)))
          ) {
            try {
              pc.removeTrack(sender);
            } catch (e) {
              try {
                sender.replaceTrack(null);
              } catch (err) {}
            }
          }
        });

        if (pc.signalingState === "stable") {
          makingOfferRef.current.set(targetId, true);
          pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
              socket.emit("signal:offer", {
                targetId,
                to: targetId,
                offer: pc.localDescription,
                streamType: "camera",
                isScreen: false,
              });
            })
            .catch((err) => console.warn("Renegotiation after stop screen error:", err))
            .finally(() => {
              makingOfferRef.current.set(targetId, false);
            });
        }
      });

      socket.emit("room:state-update", { isScreenSharing: false });
      setForceUpdate((prev) => prev + 1);
    } else {
      try {
        const constraints = getDisplayMediaConstraints(screenQualityPreset);
        const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);

        localScreenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        setSpotlightId(`screen-${self.id}`);

        // Apply quality encodings and max framerate parameters
        applyScreenShareQuality(screenStream, screenQualityPreset, peerConnectionsRef.current);

        const screenVideoTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];

        if (screenVideoTrack) {
          screenVideoTrack.onended = () => {
            handleToggleScreenShare();
          };
        }

        // Replace/add screen video & audio track on all active RTCPeerConnection instances
        peerConnectionsRef.current.forEach((pc, targetId) => {
          const senders = pc.getSenders();

          if (screenVideoTrack) {
            const existingScreenSender = senders.find(
              (s) =>
                s.track &&
                (s.track.label.toLowerCase().includes("screen") ||
                  s.track.label.toLowerCase().includes("display") ||
                  s.track === screenVideoTrack)
            );

            if (existingScreenSender) {
              existingScreenSender.replaceTrack(screenVideoTrack).catch((e) => {
                console.warn("replaceTrack screen video error:", e);
              });
            } else {
              try {
                pc.addTrack(screenVideoTrack, screenStream);
              } catch (e) {
                console.warn("addTrack screen video error:", e);
              }
            }
          }

          if (screenAudioTrack) {
            try {
              pc.addTrack(screenAudioTrack, screenStream);
            } catch (e) {
              console.warn("addTrack screen audio error:", e);
            }
          }

          if (pc.signalingState === "stable") {
            makingOfferRef.current.set(targetId, true);
            pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => {
                socket.emit("signal:offer", {
                  targetId,
                  to: targetId,
                  offer: pc.localDescription,
                  streamType: "screen",
                  isScreen: true,
                });
              })
              .catch((err) => console.warn("Renegotiation offer screen error:", err))
              .finally(() => {
                makingOfferRef.current.set(targetId, false);
              });
          }
        });

        socket.emit("room:state-update", { isScreenSharing: true });
        const presetObj = SCREEN_SHARE_PRESETS[screenQualityPreset];
        handleSendMessage(`📺 Iniciou o compartilhamento de tela em ${presetObj.label} (${presetObj.badge}).`, activeChannelId);
        setForceUpdate((prev) => prev + 1);
      } catch (err) {
        console.warn("Screen share cancelled or failed:", err);
      }
    }
  };

  // Toggle Deafen
  const handleToggleDeafen = () => {
    const nextState = !isDeafened;
    setIsDeafened(nextState);
    if (nextState && !isAudioMuted) {
      setIsAudioMuted(true);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
      }
    }
  };

  // Send Message in specific channel with room context & instant local feedback
  const handleSendMessage = (text: string, channelId: string) => {
    if (!text.trim()) return;
    const targetChannel = channelId || activeChannelId || "geral";
    socket.emit(
      "room:chat-message",
      {
        text: text.trim(),
        channelId: targetChannel,
        roomId: room.roomId,
      },
      (res: { success: boolean; message?: ChatMessage; error?: string }) => {
        if (res && res.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.message!.id)) return prev;
            return [...prev, res.message!];
          });
        }
      }
    );
  };

  // Toggle Low Resource Mode (Gamer Mode)
  const handleToggleLowResource = () => {
    const nextMode = !preferences.lowResourceMode;
    setPreferences((prev) => ({ ...prev, lowResourceMode: nextMode }));

    if (nextMode && !isVideoMuted) {
      setIsVideoMuted(true);
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current?.removeTrack(t);
        });
      }
    }
  };

  // Host Action Handlers
  const handleHostToggleLock = () => {
    socket.emit("host:action", { type: "toggle-lock" });
  };

  const handleHostMuteAll = () => {
    socket.emit("host:action", { type: "mute-all" });
  };

  const handleHostMuteUser = (targetUserId: string) => {
    socket.emit("host:action", { type: "mute-user", targetUserId });
  };

  const handleHostKickUser = (targetUserId: string) => {
    socket.emit("host:action", { type: "kick-user", targetUserId });
  };

  const handleHostUpdateSettings = (settings: Partial<RoomState["settings"]>) => {
    socket.emit("host:action", { type: "update-settings", settings });
  };

  const handleCloseRoomForAll = () => {
    socket.emit("host:action", { type: "close-room" }, (res: { success: boolean; message?: string }) => {
      if (res && res.success) {
        onLeaveRoom();
      } else if (res && res.message) {
        alert(res.message);
      }
    });
  };

  const handleClaimHost = (passcode: string) => {
    socket.emit("host:action", { type: "claim-host", passcode }, (res: { success: boolean; message?: string }) => {
      alert(res.message || (res.success ? "Controle Master assumido com sucesso!" : "Erro ao assumir controle"));
    });
  };

  // Host Portaria (Knock Admission) handlers
  const handleApproveKnock = useCallback(
    (socketId: string) => {
      socket.emit("host:knock-response", { targetSocketId: socketId, approved: true });
      setPendingKnocks((prev) => prev.filter((k) => k.socketId !== socketId));
    },
    [socket]
  );

  const handleRejectKnock = useCallback(
    (socketId: string) => {
      socket.emit("host:knock-response", { targetSocketId: socketId, approved: false });
      setPendingKnocks((prev) => prev.filter((k) => k.socketId !== socketId));
    },
    [socket]
  );

  const handleApproveAllKnocks = useCallback(() => {
    socket.emit("host:knock-approve-all");
    setPendingKnocks([]);
  }, [socket]);

  // Host VIP Action Handlers (Master & Host Authentication)
  const handleHostGrantVip = (
    targetSocketId: string,
    permissions: {
      canUseGifAvatar: boolean;
      canUseVideoMp4Banner: boolean;
      canEditAdvancedProfile: boolean;
      hasVipBadge: boolean;
    },
    durationMinutes: number | null
  ) => {
    socket.emit(
      "host:grant-vip",
      {
        targetSocketId,
        permissions,
        durationMinutes,
        masterToken,
        roomId: room.roomId,
      },
      (res: { success: boolean; message?: string; participant?: Participant }) => {
        if (res && res.success) {
          if (res.participant) {
            setRoom((prev) => ({
              ...prev,
              participants: prev.participants.map((p) => (p.id === res.participant!.id ? res.participant! : p)),
            }));
          }
        } else if (res && res.message) {
          alert(res.message);
        }
      }
    );
  };

  const handleHostRevokeVip = (targetSocketId: string) => {
    socket.emit(
      "host:revoke-vip",
      {
        targetSocketId,
        masterToken,
        roomId: room.roomId,
      },
      (res: { success: boolean; message?: string }) => {
        if (res && res.message && !res.success) {
          alert(res.message);
        }
      }
    );
  };

  // Host Give Koki Coins directly to participant
  const handleHostGiveCoins = (targetSocketId: string, amount: number) => {
    socket.emit(
      "host:give-coins",
      {
        targetSocketId,
        amount,
        masterToken,
        roomId: room.roomId,
      },
      (res: { success: boolean; message?: string; newBalance?: number }) => {
        if (res && !res.success && res.message) {
          alert(res.message);
        }
      }
    );
  };

  // Host / Master Assign Custom Badges directly to member
  const handleHostAssignBadges = (targetSocketId: string, badges: string[]) => {
    socket.emit(
      "host:assign-badges",
      {
        targetSocketId,
        badges,
        masterToken,
        roomId: room.roomId,
      },
      (res: { success: boolean; message?: string; badges?: string[] }) => {
        if (res && res.success) {
          if (res.badges) {
            setRoom((prev) => ({
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === targetSocketId ? { ...p, badges: res.badges } : p
              ),
            }));
            if (selectedProfileParticipant?.id === targetSocketId) {
              setSelectedProfileParticipant((prev) =>
                prev ? { ...prev, badges: res.badges } : null
              );
            }
          }
        } else if (res && res.message) {
          alert(res.message);
        }
      }
    );
  };

  // Update self profile (Discord status / bio / avatar / banner / badges) in real-time
  const handleUpdateSelfProfile = (updates: {
    name?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    avatarEmoji?: string;
    avatarColor?: string;
    bannerColor?: string;
    customStatus?: string;
    bio?: string;
    badges?: string[];
  }) => {
    setSelf((prev) => ({ ...prev, ...updates }));
    socket.emit("user:update-profile", {
      ...updates,
      masterToken,
      roomId: room.roomId,
    });
    saveUserProfile(updates);
  };

  // Volume change for a participant
  const handleVolumeChange = (userId: string, vol: number) => {
    setParticipantVolumes((prev) => ({ ...prev, [userId]: vol }));
  };

  // Sync remote audio element volumes when master volume, deafen, or participant volumes update
  useEffect(() => {
    remoteAudioElementsRef.current.forEach((audioEl, targetId) => {
      if (isDeafened) {
        audioEl.muted = true;
      } else {
        audioEl.muted = false;
        const userVol = participantVolumes[targetId] ?? 100;
        audioEl.volume = Math.max(0, Math.min(1, (userVol / 100) * (masterVoiceVolume / 100)));
      }
    });
    if (audioRef && audioRef.current) {
      if (isDeafened) {
        audioRef.current.muted = true;
      } else {
        audioRef.current.muted = false;
        audioRef.current.volume = Math.max(0, Math.min(1, masterVoiceVolume / 100));
      }
    }
  }, [isDeafened, masterVoiceVolume, participantVolumes, audioRef]);

  // Clean up remote audio tags on unmount
  useEffect(() => {
    return () => {
      remoteAudioElementsRef.current.forEach((el) => {
        el.pause();
        el.srcObject = null;
        el.remove();
      });
      remoteAudioElementsRef.current.clear();
    };
  }, []);

  // Keyboard shortcut: Key '0' to mute/unmute microphone
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("input, textarea, [contenteditable='true']"))
      ) {
        return;
      }

      if (e.key === "0" || e.code === "Digit0" || e.code === "Numpad0") {
        e.preventDefault();
        handleToggleAudio();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAudioMuted, self.isMutedByHost]);

  // Active screen shares in the room (Self and Remotes)
  interface ScreenShareItem {
    participant: Participant;
    isSelf: boolean;
    stream: MediaStream | null;
  }

  const activeScreenShares: ScreenShareItem[] = [
    ...(isScreenSharing && localScreenStreamRef.current
      ? [{ participant: self, isSelf: true, stream: localScreenStreamRef.current }]
      : []),
    ...room.participants
      .filter(
        (p) =>
          p.id !== self.id &&
          (p.isScreenSharing || remoteScreenStreamsRef.current.has(p.id))
      )
      .map((p) => ({
        participant: p,
        isSelf: false,
        stream: remoteScreenStreamsRef.current.get(p.id) || null,
      })),
  ];

  // If a screen share is explicitly spotlighted (e.g. "screen-userId")
  const activeSpotlightScreen = spotlightId?.startsWith("screen-")
    ? activeScreenShares.find(
        (s) => s.participant.id === spotlightId.replace("screen-", "")
      )
    : null;

  // Active Spotlight Participant Camera (if not screen spotlight)
  const activeSpotlight =
    spotlightId && !activeSpotlightScreen
      ? room.participants.find((p) => p.id === spotlightId) ||
        (spotlightId === self.id ? self : null)
      : null;

  const totalGridTiles = activeScreenShares.length + room.participants.length;

  const isUserMaster = Boolean(isMaster);
  const hasVipBadge = Boolean(
    initialHasVipBadge ||
    self.vipPermissions?.hasVipBadge ||
    self.badges?.some(
      (b) =>
        b.toLowerCase().includes("vip") ||
        b === "vip_role" ||
        b === "vip_granted" ||
        b === "vip"
    ) ||
    (self.purchasedPerks &&
      self.purchasedPerks["vip_role"] &&
      self.purchasedPerks["vip_role"] > Date.now())
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-[#070b14] overflow-hidden relative">
      {/* Floating Admission Banner for Master when users are knocking */}
      {isUserMaster && (
        <FloatingAdmissionBanner
          pendingKnocks={pendingKnocks}
          onApprove={handleApproveKnock}
          onReject={handleRejectKnock}
          onOpenAdmissionModal={() => setIsAdmissionOpen(true)}
        />
      )}

      {/* Top Header */}
      <Header
        room={room}
        self={self}
        isMaster={isUserMaster}
        hasVipBadge={hasVipBadge}
        lowResourceMode={preferences.lowResourceMode}
        pingMs={pingMs}
        pendingKnocksCount={pendingKnocks.length}
        kokiCoins={self.kokiCoins}
        isChannelsOpen={isChannelsSidebarOpen}
        onToggleChannels={() => setIsChannelsSidebarOpen(!isChannelsSidebarOpen)}
        onOpenStore={() => setIsStoreOpen(true)}
        onOpenInvite={() => setIsInviteOpen(true)}
        onOpenHostPanel={() => setIsHostPanelOpen(true)}
        onOpenAdmissionModal={() => setIsAdmissionOpen(true)}
        onOpenOwnerProfile={() => setIsOwnerProfileOpen(true)}
        onToggleLowResource={handleToggleLowResource}
        onLeaveRoom={onLeaveRoom}
      />

      {/* Main Content Area: Channel Navigation Sidebar, Video Grid & Discord Drawers */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Discord Minimal Channel Navigation Sidebar */}
        <ChannelSidebar
          roomName={room.roomName}
          roomId={room.roomId}
          textChannels={room.channels && room.channels.length > 0 ? room.channels : defaultTextChannels}
          voiceChannels={defaultVoiceChannels}
          activeTextChannelId={activeChannelId}
          activeVoiceChannelId={activeVoiceChannelId}
          onSelectTextChannel={handleSelectTextChannel}
          onSelectVoiceChannel={handleSelectVoiceChannel}
          self={self}
          participants={room.participants}
          isAudioMuted={isAudioMuted}
          isDeafened={isDeafened}
          pingMs={pingMs}
          onToggleMic={handleToggleAudio}
          onToggleDeafen={handleToggleDeafen}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenSelfProfile={() => setSelectedProfileParticipant(self)}
          onOpenStore={() => setIsStoreOpen(true)}
          onOpenInvite={() => setIsInviteOpen(true)}
          isOpen={isChannelsSidebarOpen}
          onClose={() => setIsChannelsSidebarOpen(false)}
          isMaster={Boolean(isMaster)}
        />

        <main className="flex-1 p-3 overflow-y-auto flex flex-col justify-center items-center">
          {activeSpotlightScreen ? (
            /* Spotlight Mode: Screen Share Primary View with Participant Ribbon */
            <div className="w-full h-full flex flex-col gap-3 max-w-7xl mx-auto">
              <div className="flex-1 min-h-0">
                <ScreenShareTile
                  participant={activeSpotlightScreen.participant}
                  isSelf={activeSpotlightScreen.isSelf}
                  screenStream={activeSpotlightScreen.stream}
                  isSpotlight={true}
                  userVolume={participantVolumes[activeSpotlightScreen.participant.id] ?? 100}
                  masterVoiceVolume={masterVoiceVolume}
                  currentVoiceChannelId={activeVoiceChannelId}
                  onToggleSpotlight={() => setSpotlightId(null)}
                  onVolumeChange={handleVolumeChange}
                />
              </div>

              {/* Mini participant ribbon below spotlight containing ALL camera feeds */}
              <div className="h-28 flex items-center gap-2.5 overflow-x-auto pb-1 px-1">
                {/* Self camera tile */}
                <div className="w-44 h-full shrink-0">
                  <VideoTile
                    participant={self}
                    isSelf={true}
                    isHostViewer={self.isHost}
                    stream={localStreamRef.current}
                    audioLevel={localAudioLevel}
                    lowResourceMode={preferences.lowResourceMode}
                    onToggleSpotlight={() => setSpotlightId(self.id)}
                    onSelectProfile={(p) => setSelectedProfileParticipant(p)}
                  />
                </div>

                {/* Other participants' camera feeds */}
                {room.participants
                  .filter((p) => p.id !== self.id)
                  .map((p) => (
                    <div key={p.id} className="w-44 h-full shrink-0">
                      <VideoTile
                        participant={p}
                        isSelf={false}
                        isHostViewer={self.isHost}
                        stream={remoteStreamsRef.current.get(p.id)}
                        audioLevel={p.audioLevel}
                        lowResourceMode={preferences.lowResourceMode}
                        userVolume={participantVolumes[p.id] ?? 100}
                        masterVoiceVolume={masterVoiceVolume}
                        currentVoiceChannelId={activeVoiceChannelId}
                        onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
                        onToggleSpotlight={() => setSpotlightId(p.id)}
                        onHostMute={handleHostMuteUser}
                        onHostKick={handleHostKickUser}
                        onSelectProfile={(part) => setSelectedProfileParticipant(part)}
                        onVolumeChange={handleVolumeChange}
                      />
                    </div>
                  ))}

                {/* Other active screen shares if multiple people are sharing */}
                {activeScreenShares
                  .filter((s) => s.participant.id !== activeSpotlightScreen.participant.id)
                  .map((s) => (
                    <div key={`ribbon-screen-${s.participant.id}`} className="w-44 h-full shrink-0">
                      <ScreenShareTile
                        participant={s.participant}
                        isSelf={s.isSelf}
                        screenStream={s.stream}
                        isSpotlight={false}
                        userVolume={participantVolumes[s.participant.id] ?? 100}
                        masterVoiceVolume={masterVoiceVolume}
                        currentVoiceChannelId={activeVoiceChannelId}
                        onToggleSpotlight={() => setSpotlightId(`screen-${s.participant.id}`)}
                        onVolumeChange={handleVolumeChange}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : activeSpotlight ? (
            /* Spotlight Mode: Pinned Participant Camera with Ribbon */
            <div className="w-full h-full flex flex-col gap-3 max-w-7xl mx-auto">
              <div className="flex-1 min-h-0">
                <VideoTile
                  participant={activeSpotlight}
                  isSelf={activeSpotlight.id === self.id}
                  isHostViewer={self.isHost}
                  stream={activeSpotlight.id === self.id ? localStreamRef.current : remoteStreamsRef.current.get(activeSpotlight.id)}
                  audioLevel={activeSpotlight.id === self.id ? localAudioLevel : 0}
                  lowResourceMode={preferences.lowResourceMode}
                  isSpotlight={true}
                  userVolume={participantVolumes[activeSpotlight.id] ?? 100}
                  masterVoiceVolume={masterVoiceVolume}
                  currentVoiceChannelId={activeVoiceChannelId}
                  onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
                  onToggleSpotlight={() => setSpotlightId(null)}
                  onHostMute={handleHostMuteUser}
                  onHostKick={handleHostKickUser}
                  onSelectProfile={(p) => setSelectedProfileParticipant(p)}
                  onVolumeChange={handleVolumeChange}
                />
              </div>

              {/* Mini participant ribbon below spotlight */}
              <div className="h-28 flex items-center gap-2.5 overflow-x-auto pb-1 px-1">
                {/* Active screen shares in the ribbon */}
                {activeScreenShares.map((s) => (
                  <div key={`ribbon-screen-${s.participant.id}`} className="w-44 h-full shrink-0">
                    <ScreenShareTile
                      participant={s.participant}
                      isSelf={s.isSelf}
                      screenStream={s.stream}
                      isSpotlight={false}
                      userVolume={participantVolumes[s.participant.id] ?? 100}
                      masterVoiceVolume={masterVoiceVolume}
                      currentVoiceChannelId={activeVoiceChannelId}
                      onToggleSpotlight={() => setSpotlightId(`screen-${s.participant.id}`)}
                      onVolumeChange={handleVolumeChange}
                    />
                  </div>
                ))}

                {/* Self tile if not spotlighted */}
                {activeSpotlight.id !== self.id && (
                  <div className="w-44 h-full shrink-0">
                    <VideoTile
                      participant={self}
                      isSelf={true}
                      isHostViewer={self.isHost}
                      stream={localStreamRef.current}
                      audioLevel={localAudioLevel}
                      lowResourceMode={preferences.lowResourceMode}
                      onToggleSpotlight={() => setSpotlightId(self.id)}
                      onSelectProfile={(p) => setSelectedProfileParticipant(p)}
                    />
                  </div>
                )}

                {/* Other participants */}
                {room.participants
                  .filter((p) => p.id !== self.id && p.id !== activeSpotlight.id)
                  .map((p) => (
                    <div key={p.id} className="w-44 h-full shrink-0">
                      <VideoTile
                        participant={p}
                        isSelf={false}
                        isHostViewer={self.isHost}
                        stream={remoteStreamsRef.current.get(p.id)}
                        audioLevel={p.audioLevel}
                        lowResourceMode={preferences.lowResourceMode}
                        userVolume={participantVolumes[p.id] ?? 100}
                        masterVoiceVolume={masterVoiceVolume}
                        currentVoiceChannelId={activeVoiceChannelId}
                        onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
                        onToggleSpotlight={() => setSpotlightId(p.id)}
                        onHostMute={handleHostMuteUser}
                        onHostKick={handleHostKickUser}
                        onSelectProfile={(part) => setSelectedProfileParticipant(part)}
                        onVolumeChange={handleVolumeChange}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Standard Dynamic Grid Mode: Shows ALL screen share containers AND ALL participant camera feeds simultaneously */
            <div
              className={`w-full h-full max-w-7xl mx-auto grid gap-3.5 items-center content-center ${
                totalGridTiles <= 1
                  ? "grid-cols-1 max-w-2xl"
                  : totalGridTiles === 2
                  ? "grid-cols-1 sm:grid-cols-2 max-w-4xl"
                  : totalGridTiles <= 4
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 max-w-5xl"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              }`}
            >
              {/* Separate containers for each active screen share */}
              {activeScreenShares.map((s) => (
                <ScreenShareTile
                  key={`grid-screen-${s.participant.id}`}
                  participant={s.participant}
                  isSelf={s.isSelf}
                  screenStream={s.stream}
                  isSpotlight={false}
                  userVolume={participantVolumes[s.participant.id] ?? 100}
                  masterVoiceVolume={masterVoiceVolume}
                  currentVoiceChannelId={activeVoiceChannelId}
                  onToggleSpotlight={() => setSpotlightId(`screen-${s.participant.id}`)}
                  onVolumeChange={handleVolumeChange}
                />
              ))}

              {/* Local Participant Camera / Avatar Tile */}
              <VideoTile
                key={`grid-cam-${self.id}`}
                participant={self}
                isSelf={true}
                isHostViewer={self.isHost}
                stream={localStreamRef.current}
                audioLevel={localAudioLevel}
                lowResourceMode={preferences.lowResourceMode}
                onToggleSpotlight={() => setSpotlightId(self.id)}
                onSelectProfile={(p) => setSelectedProfileParticipant(p)}
              />

              {/* Remote Participants Camera / Avatar Tiles */}
              {room.participants
                .filter((p) => p.id !== self.id)
                .map((p) => (
                  <VideoTile
                    key={`grid-cam-${p.id}`}
                    participant={p}
                    isSelf={false}
                    isHostViewer={self.isHost}
                    stream={remoteStreamsRef.current.get(p.id)}
                    audioLevel={p.audioLevel}
                    lowResourceMode={preferences.lowResourceMode}
                    userVolume={participantVolumes[p.id] ?? 100}
                    masterVoiceVolume={masterVoiceVolume}
                    currentVoiceChannelId={activeVoiceChannelId}
                    onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
                    onToggleSpotlight={() => setSpotlightId(p.id)}
                    onHostMute={handleHostMuteUser}
                    onHostKick={handleHostKickUser}
                    onSelectProfile={(part) => setSelectedProfileParticipant(part)}
                    onVolumeChange={handleVolumeChange}
                  />
                ))}
            </div>
          )}
        </main>

        {/* Discord Channels & Text Chat Drawer */}
        <DiscordChatAndChannels
          isOpen={isChatOpen}
          channels={room.channels && room.channels.length > 0 ? room.channels : defaultTextChannels}
          activeChannelId={activeChannelId}
          onSelectChannel={(chId) => setActiveChannelId(chId)}
          messages={messages}
          self={self}
          onClose={() => setIsChatOpen(false)}
          onSendMessage={handleSendMessage}
        />

        {/* Discord Member List Drawer */}
        {isMemberListOpen && (
          <MemberList
            participants={room.participants}
            selfId={self.id}
            selfIsHost={self.isHost}
            pendingKnocks={pendingKnocks}
            onApproveKnock={handleApproveKnock}
            onRejectKnock={handleRejectKnock}
            onSelectParticipant={(p) => setSelectedProfileParticipant(p)}
          />
        )}
      </div>

      {/* Bottom Control Bar */}
      <ControlBar
        self={self}
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        isScreenSharing={isScreenSharing}
        screenQualityPreset={screenQualityPreset}
        isDeafened={isDeafened}
        isChatOpen={isChatOpen}
        isMemberListOpen={isMemberListOpen}
        unreadChatCount={unreadChatCount}
        lowResourceMode={preferences.lowResourceMode}
        allowScreenShare={room.settings.allowScreenShare}
        masterVoiceVolume={masterVoiceVolume}
        pendingKnocksCount={pendingKnocks.length}
        isMaster={isUserMaster}
        onVolumeChange={setMasterVoiceVolume}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onChangeScreenQuality={handleChangeScreenQuality}
        onToggleDeafen={handleToggleDeafen}
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen);
          if (!isChatOpen) setUnreadChatCount(0);
        }}
        onToggleMemberList={() => setIsMemberListOpen(!isMemberListOpen)}
        onToggleLowResource={handleToggleLowResource}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHostPanel={() => setIsHostPanelOpen(true)}
        onOpenAdmissionModal={() => setIsAdmissionOpen(true)}
        onLeaveCall={onLeaveRoom}
        onOpenSelfProfile={() => setSelectedProfileParticipant(self)}
      />

      {/* Discord User Profile Popover / Modal */}
      {selectedProfileParticipant && (
        <UserProfileCard
          participant={selectedProfileParticipant}
          isSelf={selectedProfileParticipant.id === self.id}
          isHostViewer={Boolean(isMaster)}
          userVolume={participantVolumes[selectedProfileParticipant.id] ?? 100}
          onVolumeChange={(newVol) => handleVolumeChange(selectedProfileParticipant.id, newVol)}
          onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
          onMuteParticipant={handleHostMuteUser}
          onKickParticipant={handleHostKickUser}
          onOpenOwnerProfileEditor={() => setIsOwnerProfileOpen(true)}
          onOpenGrantVip={(p) => {
            setTargetVipParticipant(p);
            setIsGrantVipOpen(true);
          }}
          onOpenGrantBadges={(p) => {
            setTargetBadgeParticipant(p);
            setIsGrantBadgesOpen(true);
          }}
          onGiveCoins={handleHostGiveCoins}
          onClose={() => setSelectedProfileParticipant(null)}
        />
      )}

      {/* Profile Editor Modal (For Owner, VIP and Members) */}
      {isOwnerProfileOpen && (
        <EditOwnerProfileModal
          isOpen={isOwnerProfileOpen}
          self={self}
          isMaster={isMaster}
          onClose={() => setIsOwnerProfileOpen(false)}
          onSave={handleUpdateSelfProfile}
        />
      )}

      {/* Grant / Manage VIP Modal (For Master and Host) */}
      {(isMaster || self.isHost) && isGrantVipOpen && targetVipParticipant && (
        <GrantVipModal
          isOpen={isGrantVipOpen}
          targetParticipant={targetVipParticipant}
          onClose={() => {
            setIsGrantVipOpen(false);
            setTargetVipParticipant(null);
          }}
          onGrantVip={handleHostGrantVip}
          onRevokeVip={handleHostRevokeVip}
        />
      )}

      {/* Grant / Manage Custom Badges Modal (For Master and Host) */}
      {(isMaster || self.isHost) && isGrantBadgesOpen && targetBadgeParticipant && (
        <GrantBadgesModal
          isOpen={isGrantBadgesOpen}
          targetParticipant={targetBadgeParticipant}
          onClose={() => {
            setIsGrantBadgesOpen(false);
            setTargetBadgeParticipant(null);
          }}
          onAssignBadges={handleHostAssignBadges}
        />
      )}

      {/* Owner Admission / Portaria Modal */}
      {self.isHost && (
        <AdmissionModal
          isOpen={isAdmissionOpen}
          pendingKnocks={pendingKnocks}
          requireKnockApproval={room.settings.requireKnockApproval}
          onClose={() => setIsAdmissionOpen(false)}
          onApprove={handleApproveKnock}
          onReject={handleRejectKnock}
          onApproveAll={handleApproveAllKnocks}
          onToggleRequireApproval={(requireApproval) =>
            handleHostUpdateSettings({ requireKnockApproval: requireApproval })
          }
        />
      )}

      {/* Modals */}
      <InviteModal
        isOpen={isInviteOpen}
        room={room}
        onClose={() => setIsInviteOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        preferences={preferences}
        audioTestLevel={localAudioLevel}
        onClose={() => setIsSettingsOpen(false)}
        onUpdatePreferences={(updates) => {
          setPreferences((prev) => ({ ...prev, ...updates }));
          saveUserPreferences(updates);
        }}
      />

      <HostPanelModal
        isOpen={isHostPanelOpen}
        room={room}
        self={self}
        socket={socket}
        pendingKnocks={pendingKnocks}
        onClose={() => setIsHostPanelOpen(false)}
        onToggleLock={handleHostToggleLock}
        onMuteAll={handleHostMuteAll}
        onMuteUser={handleHostMuteUser}
        onKickUser={handleHostKickUser}
        onUpdateSettings={handleHostUpdateSettings}
        onClaimHost={handleClaimHost}
        onApproveKnock={handleApproveKnock}
        onRejectKnock={handleRejectKnock}
        onOpenAdmissionModal={() => setIsAdmissionOpen(true)}
        onCloseRoomForAll={self.isHost ? handleCloseRoomForAll : undefined}
        onGiveCoins={handleHostGiveCoins}
        onOpenGrantBadges={(p) => {
          setTargetBadgeParticipant(p);
          setIsGrantBadgesOpen(true);
        }}
      />

      {/* Koki Coins & Perks Store Modal */}
      <StoreModal
        isOpen={isStoreOpen}
        onClose={() => setIsStoreOpen(false)}
        self={self}
        isMaster={isMaster}
        onOpenProfileEditor={() => setIsOwnerProfileOpen(true)}
        onPerkPurchased={handlePerkPurchased}
      />
    </div>
  );
};
