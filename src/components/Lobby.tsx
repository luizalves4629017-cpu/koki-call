import React, { useState, useEffect, useRef } from "react";
import {
  Crown,
  User,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
  ShieldCheck,
  Radio,
  Cpu,
  LogIn,
  PlusCircle,
  HelpCircle,
  Headphones,
  CheckCircle2,
  Smile,
  Palette,
  Edit2,
  Clock,
  XCircle,
  ShieldAlert,
  Film,
  Users,
  Home,
  RotateCcw,
  Coins,
} from "lucide-react";
import { AudioVolumeTracker } from "../utils/audioAnalyser";
import {
  getSavedUserProfile,
  saveUserProfile,
  DEFAULT_AVATARS,
  DEFAULT_AVATAR_COLORS,
  DEFAULT_BANNER_COLORS,
  getLobbyBackground,
  LobbyBackgroundConfig,
  resolveUserTag,
  MASTER_DEFAULT_TAG,
  MASTER_DEFAULT_USERNAME,
  isMasterIdentity,
  getKokiCoins,
} from "../utils/storage";
import { LobbyBackgroundModal } from "./LobbyBackgroundModal";
import { MasterLoginModal } from "./MasterLoginModal";
import { StoreModal } from "./StoreModal";

interface LobbyProps {
  initialRoomId?: string;
  initialRole?: string;
  isMaster?: boolean;
  masterToken?: string | null;
  machineInfo?: { username?: string; hostname?: string; authMethod?: string } | null;
  isWaitingApproval?: boolean;
  approvalError?: string | null;
  onCancelApproval?: () => void;
  onMasterLogin?: (token: string) => void;
  onMasterLogout?: () => void;
  onCreateRoom: (params: {
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
  }) => void;
  onJoinRoom: (params: {
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
  }) => void;
}

type LobbyTab = "master" | "member_create" | "guest";

export const Lobby: React.FC<LobbyProps> = ({
  initialRoomId = "",
  initialRole = "",
  isMaster = false,
  masterToken = null,
  machineInfo = null,
  isWaitingApproval = false,
  approvalError = null,
  onCancelApproval,
  onMasterLogin,
  onMasterLogout,
  onCreateRoom,
  onJoinRoom,
}) => {
  const isInvitedLink = Boolean(initialRoomId && initialRoomId.trim().length > 0) || initialRole === "guest";
  
  // Set default tab based on whether it's an invite or if machine is Master
  const [tab, setTab] = useState<LobbyTab>(() => {
    if (isInvitedLink) return "guest";
    if (isMaster) return "master";
    return "guest";
  });

  // Master sub-action: Create room or Join friend's room with Master authority
  const [masterAction, setMasterAction] = useState<"create" | "join">("create");

  const [showMasterLoginModal, setShowMasterLoginModal] = useState(false);

  const handleResetHome = () => {
    setJoinRoomId("");
    setJoinPasscode("");
    setRoomName("");
    setCustomRoomId("");
    setHostPasscode("");
    setTab(isMaster ? "master" : "guest");
    setMasterAction("create");
    window.history.pushState({}, "", "/");
  };

  useEffect(() => {
    if (isInvitedLink) {
      setTab("guest");
    } else if (isMaster && tab !== "member_create" && tab !== "guest") {
      setTab("master");
    } else if (!isMaster && tab === "master") {
      setTab("guest");
    }
  }, [isInvitedLink, isMaster]);

  // Load saved profile
  const [savedProfile] = useState(() => getSavedUserProfile());
  const [nickname, setNickname] = useState(() => {
    if (savedProfile.name && savedProfile.name.trim().length > 0) {
      return savedProfile.name;
    }
    return `Convidado ${savedProfile.tag ? savedProfile.tag.slice(0, 4) : Math.floor(100 + Math.random() * 900)}`;
  });
  const [avatarEmoji, setAvatarEmoji] = useState(savedProfile.avatarEmoji);
  const [avatarColor, setAvatarColor] = useState(savedProfile.avatarColor);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(savedProfile.avatarUrl);
  const [bannerColor, setBannerColor] = useState(savedProfile.bannerColor);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(savedProfile.bannerUrl);
  const [customStatus, setCustomStatus] = useState(savedProfile.customStatus);
  const [bio, setBio] = useState(savedProfile.bio);
  const [tag] = useState(savedProfile.tag);
  // Dynamically resolve tag: Master Owner authenticated via passcode strictly gets #0001
  const isSelfMaster = Boolean(isMaster && masterToken);
  const effectiveTag = resolveUserTag(nickname, isSelfMaster, tag);

  const [badges, setBadges] = useState<string[]>(() => {
    if (isSelfMaster) {
      return savedProfile.badges || ["owner_supreme", "koki_creator", "nitro_owner"];
    }
    return (savedProfile.badges || ["pioneer_member"]).filter((b) => !b.includes("owner") && b !== "koki_creator");
  });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Background Wallpaper State (MP4 video, animated GIF or image)
  const [bgConfig, setBgConfig] = useState<LobbyBackgroundConfig>(() => getLobbyBackground());
  const [showBgModal, setShowBgModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [coins, setCoins] = useState<number>(() => getKokiCoins());

  useEffect(() => {
    const handleCoins = (e: any) => {
      if (e?.detail?.coins !== undefined) setCoins(e.detail.coins);
    };
    window.addEventListener("koki_coins_updated", handleCoins);
    return () => window.removeEventListener("koki_coins_updated", handleCoins);
  }, []);

  // Host inputs
  const [roomName, setRoomName] = useState("");
  const [customRoomId, setCustomRoomId] = useState("");
  const [hostPasscode, setHostPasscode] = useState("");
  const [lowBandwidthPreset, setLowBandwidthPreset] = useState(false);

  // Guest inputs
  const [joinRoomId, setJoinRoomId] = useState(initialRoomId);
  const [joinPasscode, setJoinPasscode] = useState("");

  // Media preview state
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioTrackerRef = useRef<AudioVolumeTracker | null>(null);

  useEffect(() => {
    if (initialRoomId) {
      setJoinRoomId(initialRoomId);
      setTab("guest");
    }
  }, [initialRoomId]);

  const persistCurrentProfile = (nameToSave: string) => {
    const resolvedTag = resolveUserTag(nameToSave, isSelfMaster, tag);
    saveUserProfile({
      name: nameToSave.trim(),
      avatarEmoji,
      avatarColor,
      avatarUrl,
      bannerColor,
      bannerUrl,
      customStatus: customStatus.trim(),
      bio: bio.trim(),
      tag: resolvedTag,
      badges,
      rememberLogin: true,
    });
  };

  useEffect(() => {
    let localStream: MediaStream | null = null;

    const startAudioPreview = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        streamRef.current = localStream;
        const tracker = new AudioVolumeTracker((vol) => {
          setMicLevel(vol);
        });
        tracker.start(localStream);
        audioTrackerRef.current = tracker;
      } catch {
        // mic unavailable or blocked
      }
    };

    startAudioPreview();

    return () => {
      if (audioTrackerRef.current) {
        audioTrackerRef.current.stop();
      }
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    let localStream: MediaStream | null = null;

    const startCameraPreview = async () => {
      if (!cameraActive) {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }
        return;
      }

      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, frameRate: 15 },
          audio: false,
        });

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = localStream;
        }
      } catch {
        setCameraActive(false);
      }
    };

    startCameraPreview();

    return () => {
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraActive]);

  const toggleMicPreview = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !micActive));
    }
    setMicActive(!micActive);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    persistCurrentProfile(nickname);

    const finalRoomId = customRoomId.trim()
      ? customRoomId.trim().toLowerCase().replace(/\s+/g, "-")
      : `koki-${Math.random().toString(36).substring(2, 8)}`;

    onCreateRoom({
      roomName: roomName.trim() || (tab === "master" ? `Sala Master de ${nickname.trim()}` : `Sala de ${nickname.trim()}`),
      roomId: finalRoomId,
      hostName: nickname.trim(),
      hostPasscode: hostPasscode.trim(),
      lowBandwidthDefault: lowBandwidthPreset,
      profile: {
        avatarEmoji: tab === "master" ? (avatarEmoji || "👑") : (avatarEmoji || "🎙️"),
        avatarColor,
        avatarUrl,
        bannerColor,
        bannerUrl,
        customStatus: customStatus || (tab === "master" ? "👑 Dono Master da Sala" : "Anfitrião da Sala"),
        bio,
        tag: effectiveTag,
        badges,
      },
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveRoomId = (joinRoomId || initialRoomId).trim().toLowerCase();
    if (!effectiveRoomId) return;

    const finalName = nickname.trim() || `Convidado ${Math.floor(100 + Math.random() * 900)}`;
    persistCurrentProfile(finalName);

    onJoinRoom({
      roomId: effectiveRoomId,
      name: finalName,
      passcode: joinPasscode.trim() || undefined,
      profile: {
        avatarEmoji,
        avatarColor,
        avatarUrl,
        bannerColor,
        bannerUrl,
        customStatus,
        bio,
        tag: effectiveTag,
        badges,
      },
    });
  };

  // Waiting for knock approval modal view
  if (isWaitingApproval) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden select-none bg-[#070b14]">
        {/* Background Wallpaper Container */}
        {bgConfig.type === "video" && bgConfig.videoUrl && (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 pointer-events-none"
            src={bgConfig.videoUrl}
          />
        )}
        {bgConfig.type === "image" && bgConfig.imageUrl && (
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center z-0 opacity-40 pointer-events-none"
            style={{ backgroundImage: `url(${bgConfig.imageUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/70 to-[#070b14]/90 z-0 pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm bg-[#0b101e]/95 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl backdrop-blur-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-cyan-950/60 border border-cyan-500/40 mx-auto flex items-center justify-center animate-pulse">
            <Clock className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-1">Aguardando Aprovação do Anfitrião</h2>
            <p className="text-xs text-slate-300">
              O anfitrião da sala foi notificado da sua solicitação de entrada. Por favor, aguarde...
            </p>
          </div>

          <div className="p-3 bg-[#111827] border border-[#1f293d] rounded-xl text-left space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Seu Perfil na Fila:</span>
            <div className="flex items-center gap-2">
              <span className="text-base">{avatarEmoji}</span>
              <span className="text-xs font-bold text-cyan-300">{nickname}</span>
              <span className="text-[10px] font-mono text-slate-500">#{tag}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancelApproval}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#141e30] hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-[#202f4a] hover:border-rose-500/50 transition-all cursor-pointer"
          >
            Cancelar Solicitação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden select-none bg-[#070b14]">
      {/* Background Wallpaper Container */}
      {bgConfig.type === "video" && bgConfig.videoUrl && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 pointer-events-none"
          src={bgConfig.videoUrl}
        />
      )}
      {bgConfig.type === "image" && bgConfig.imageUrl && (
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center z-0 opacity-40 pointer-events-none"
          style={{ backgroundImage: `url(${bgConfig.imageUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/70 to-[#070b14]/90 z-0 pointer-events-none" />

      {/* Brand Header */}
      <div className="relative z-10 text-center mb-6 flex flex-col items-center select-none">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400/30">
            K
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Koki Call
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              Seguro & Leve
            </span>
          </h1>
        </div>
        <p className="text-xs text-slate-300 max-w-sm drop-shadow-md mb-2.5">
          {isInvitedLink
            ? "Você recebeu um link de convite! Entre como convidado com conexão direta."
            : "Chamadas por voz, vídeo, compartilhamento de tela e canais com baixa latência."}
        </p>

        {/* Master Login / Status Badge Action + Store Button + Home Reset Button */}
        <div className="flex items-center gap-2">
          {/* Koki Coins & Store Access */}
          <button
            type="button"
            onClick={() => setShowStoreModal(true)}
            className="px-3 py-1 bg-[#101828]/90 hover:bg-[#16233b] border border-amber-500/50 hover:border-amber-400 text-amber-300 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-950/40 cursor-pointer group"
            title="Loja Koki Coins: Comprar avatares animados GIF, banners MP4, títulos e cargo VIP"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400/40 group-hover:scale-110 transition-transform" />
            <span className="font-mono">{coins.toLocaleString()}</span>
            <span className="text-[9px] uppercase font-black bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded border border-amber-500/30">
              Loja
            </span>
          </button>

          {isMaster ? (
            <button
              type="button"
              onClick={() => setShowMasterLoginModal(true)}
              className="px-3 py-1 bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/60 text-amber-300 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-950/30 cursor-pointer"
              title="Você está autenticado como Dono Master deste App"
            >
              <Crown className="w-3.5 h-3.5 fill-current text-amber-400" />
              <span>Dono Master Ativo</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowMasterLoginModal(true)}
              className="px-3 py-1 bg-[#101828]/80 hover:bg-[#16233b] border border-amber-500/40 text-amber-400 hover:text-amber-300 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Acesso exclusivo para o Dono Master do projeto"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Login Dono Master</span>
            </button>
          )}

          {(isInvitedLink || joinRoomId || roomName || customRoomId) && (
            <button
              type="button"
              onClick={handleResetHome}
              className="px-3 py-1 bg-[#101828]/80 hover:bg-[#16233b] border border-slate-700/60 text-slate-300 hover:text-white rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Voltar ao Menu Inicial limpo"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Menu Inicial</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0b101e]/90 border border-[#1b253b] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
        {approvalError && (
          <div className="bg-rose-950/80 border-b border-rose-600/60 text-rose-200 p-3 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{approvalError}</span>
          </div>
        )}

        {/* Dynamic Navigation Tabs */}
        {!isInvitedLink ? (
          <div
            className={`p-1.5 bg-[#080d19] border-b border-[#1b253b] grid ${
              isMaster ? "grid-cols-3" : "grid-cols-2"
            } gap-1`}
          >
            {/* Master Creation Tab - STRICTLY VISIBLE ONLY FOR VERIFIED MASTER */}
            {isMaster && (
              <button
                type="button"
                onClick={() => setTab("master")}
                className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  tab === "master"
                    ? "bg-[#141e30] text-amber-300 border border-amber-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Criar Sala com Privilégios do Dono Master"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Sala Master</span>
              </button>
            )}

            {/* Member Create Room Tab - VISIBLE FOR EVERYONE */}
            <button
              type="button"
              onClick={() => setTab("member_create")}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === "member_create"
                  ? "bg-[#141e30] text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Criar uma sala de voz própria para seus amigos"
            >
              <PlusCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{isMaster ? "Sala Comum" : "Criar Sala"}</span>
            </button>

            {/* Join Room Tab - VISIBLE FOR EVERYONE */}
            <button
              type="button"
              onClick={() => setTab("guest")}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === "guest"
                  ? "bg-[#141e30] text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Entrar em uma sala existente pelo código ou link"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Entrar em Sala</span>
            </button>
          </div>
        ) : (
          /* Invited banner */
          <div className="p-3 bg-gradient-to-r from-cyan-950/60 to-blue-950/40 border-b border-cyan-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-xs font-bold text-white block">Convite de Sala Detectado</span>
                <span className="text-[10px] text-cyan-300 font-mono">Sala: {initialRoomId}</span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-cyan-900/60 border border-cyan-700/50 text-cyan-200 rounded-full">
              Convidado
            </span>
          </div>
        )}

        {/* Form Container */}
        <div className="p-5 space-y-4">
          {/* ========================================================================= */}
          {/* TAB 1: MASTER HOST PROFILE & ROOM CREATION / JOIN (ONLY IF IS_MASTER) */}
          {/* ========================================================================= */}
          {tab === "master" && isMaster && !isInvitedLink && (
            <>
              {/* Sub-action Switcher inside Master Panel */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#090e1a] border border-amber-500/30 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMasterAction("create")}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    masterAction === "create"
                      ? "bg-amber-500 text-slate-950 shadow-md"
                      : "text-amber-300 hover:text-amber-200 hover:bg-amber-950/40"
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  <span>Criar Sala Master</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMasterAction("join")}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    masterAction === "join"
                      ? "bg-amber-500 text-slate-950 shadow-md"
                      : "text-amber-300 hover:text-amber-200 hover:bg-amber-950/40"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar em Sala de Amigo</span>
                </button>
              </div>

              <div className="bg-[#090e1a] border border-amber-500/30 rounded-xl p-3.5 space-y-3">
                {/* Machine Hardware Authorization Badge */}
                <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold text-amber-300 block">Máquina do Dono Reconhecida</span>
                      <span className="text-[10px] text-amber-400/80">
                        {machineInfo?.authMethod === "owner_key"
                          ? "Validado via owner.key local"
                          : machineInfo?.authMethod === "env_secret"
                          ? "Validado via chave de ambiente do Windows"
                          : "Acesso exclusivo com privilégios de Master"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-900/80 px-2 py-0.5 rounded border border-amber-500/60 text-amber-200 font-bold">
                    MASTER ATIVO
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    Perfil do Dono (Master)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Palette className="w-3 h-3" />
                    {showAvatarPicker ? "Fechar" : "Personalizar"}
                  </button>
                </div>

                {/* Avatar + Nickname Row */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-md ring-2 ring-amber-400/50 shrink-0 bg-cover bg-center"
                    style={{
                      backgroundColor: avatarColor,
                      backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
                    }}
                  >
                    {!avatarUrl && (avatarEmoji || "👑")}
                  </div>

                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Nome do Dono <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex items-center bg-[#121a2d] border border-[#253550] rounded-xl px-3 py-1.5 focus-within:border-amber-500 transition-colors">
                      <input
                        type="text"
                        required
                        placeholder="Ex: Koki u sujo"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="w-full bg-transparent text-slate-100 text-xs focus:outline-none font-medium"
                      />
                      <span className="text-[10px] text-amber-300 font-mono font-bold px-1.5 py-0.5 bg-amber-950/70 rounded border border-amber-500/40">
                        #0001
                      </span>
                    </div>
                  </div>
                </div>

                {/* Custom Status Input for Owner */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Status Personalizado do Dono
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 👑 Dono Master da Sala"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    maxLength={40}
                    className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Avatar & Color Picker popover for Owner */}
                {showAvatarPicker && !avatarUrl && (
                  <div className="pt-2 border-t border-[#1b253b] space-y-2 animate-in fade-in">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Escolher Ícone / Emoji do Dono:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_AVATARS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setAvatarEmoji(emoji)}
                            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                              avatarEmoji === emoji
                                ? "bg-amber-900/80 border border-amber-400 scale-110"
                                : "bg-[#151f33] hover:bg-[#1f2d47]"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Cor de Destaque:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_AVATAR_COLORS.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setAvatarColor(col)}
                            className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                              avatarColor === col ? "ring-2 ring-white scale-110" : ""
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION A: Create New Room as Master */}
              {masterAction === "create" ? (
                <form onSubmit={handleCreateSubmit} className="space-y-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Nome da Sala Master (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Squad Valorant / Call Oficial"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        ID Personalizado
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: call-vip"
                        value={customRoomId}
                        onChange={(e) => setCustomRoomId(e.target.value)}
                        className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        PIN Master (Opcional)
                      </label>
                      <input
                        type="password"
                        placeholder="Ex: 1234"
                        value={hostPasscode}
                        onChange={(e) => setHostPasscode(e.target.value)}
                        className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Preset Checkbox */}
                  <div className="bg-[#090e1a] border border-[#1e293b] rounded-xl p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                      <div>
                        <span className="text-xs font-medium text-slate-200 block">Modo Gamer / Baixo Consumo</span>
                        <span className="text-[10px] text-slate-400">Otimiza áudio e reduz consumo de CPU</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={lowBandwidthPreset}
                      onChange={(e) => setLowBandwidthPreset(e.target.checked)}
                      className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!nickname.trim()}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl text-xs transition-all shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Crown className="w-4 h-4 fill-current" />
                    <span>Criar Sala como Dono Master</span>
                  </button>
                </form>
              ) : (
                /* ACTION B: Join Friend's Room as Master */
                <form onSubmit={handleJoinSubmit} className="space-y-3.5 animate-in fade-in">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Código ou Link da Sala do Amigo <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: amigos-jogos ou link do convite"
                      value={joinRoomId}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes("?room=") || val.includes("&room=")) {
                          try {
                            const url = new URL(val.startsWith("http") ? val : `http://${val}`);
                            const extracted = url.searchParams.get("room");
                            if (extracted) {
                              setJoinRoomId(extracted);
                              return;
                            }
                          } catch {}
                        }
                        setJoinRoomId(val);
                      }}
                      className="w-full bg-[#121a2d] border border-amber-500/50 text-slate-100 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Senha da Sala (Se houver)
                    </label>
                    <input
                      type="password"
                      placeholder="Deixe em branco se a sala for pública"
                      value={joinPasscode}
                      onChange={(e) => setJoinPasscode(e.target.value)}
                      className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-200/90 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <Crown className="w-3.5 h-3.5 fill-current" />
                      <span>Entrando com Privilégios de Dono Master</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Você entrará na sala criada pelo seu amigo mantendo sua coroa dourada, autoridade master e badge de Dono do App.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={!((joinRoomId || initialRoomId).trim()) || !nickname.trim()}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl text-xs transition-all shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Crown className="w-4 h-4 fill-current" />
                    <span>Entrar na Sala como Dono Master</span>
                  </button>
                </form>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MEMBER / COMMUNITY ROOM CREATION (FOR EVERYONE) */}
          {/* ========================================================================= */}
          {tab === "member_create" && !isInvitedLink && (
            <>
              <div className="bg-[#090e1a] border border-cyan-500/30 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    Criar Minha Sala de Amigos
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Palette className="w-3 h-3" />
                    {showAvatarPicker ? "Fechar" : "Personalizar"}
                  </button>
                </div>

                {/* Avatar + Nickname Row */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-md ring-2 ring-cyan-400/50 shrink-0 bg-cover bg-center"
                    style={{
                      backgroundColor: avatarColor,
                      backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
                    }}
                  >
                    {!avatarUrl && (avatarEmoji || "🎙️")}
                  </div>

                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Seu Nome / Apelido <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex items-center bg-[#121a2d] border border-[#253550] rounded-xl px-3 py-1.5 focus-within:border-cyan-500 transition-colors">
                      <input
                        type="text"
                        required
                        placeholder="Ex: Luquinhas"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="w-full bg-transparent text-slate-100 text-xs focus:outline-none font-medium"
                      />
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                          effectiveTag === "0001"
                            ? "text-amber-300 bg-amber-950/70 border border-amber-500/40 font-bold"
                            : "text-slate-400 bg-slate-900/60"
                        }`}
                      >
                        #{effectiveTag}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Avatar & Color Picker popover */}
                {showAvatarPicker && !avatarUrl && (
                  <div className="pt-2 border-t border-[#1b253b] space-y-2 animate-in fade-in">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Escolher Ícone / Emoji:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_AVATARS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setAvatarEmoji(emoji)}
                            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                              avatarEmoji === emoji
                                ? "bg-cyan-900/80 border border-cyan-400 scale-110"
                                : "bg-[#151f33] hover:bg-[#1f2d47]"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Cor do Avatar:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_AVATAR_COLORS.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setAvatarColor(col)}
                            className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                              avatarColor === col ? "ring-2 ring-white scale-110" : ""
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Member Room Creation Form */}
              <form onSubmit={handleCreateSubmit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Nome da Sala (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Squad GTA / Resenha com Amigos"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      ID da Sala (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: amigos-jogos"
                      value={customRoomId}
                      onChange={(e) => setCustomRoomId(e.target.value)}
                      className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Senha (Opcional)
                    </label>
                    <input
                      type="password"
                      placeholder="Deixe em branco p/ pública"
                      value={hostPasscode}
                      onChange={(e) => setHostPasscode(e.target.value)}
                      className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Preset Checkbox */}
                <div className="bg-[#090e1a] border border-[#1e293b] rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-xs font-medium text-slate-200 block">Modo Gamer / Baixo Consumo</span>
                      <span className="text-[10px] text-slate-400">Otimiza áudio e reduz uso de CPU</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={lowBandwidthPreset}
                    onChange={(e) => setLowBandwidthPreset(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!nickname.trim()}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Criar Minha Sala de Amigos</span>
                </button>
              </form>
            </>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: GUEST JOIN FORM (ENTER EXISTING ROOM) */}
          {/* ========================================================================= */}
          {tab === "guest" && (
            <>
              <div className="bg-[#090e1a] border border-[#1b253b] rounded-xl p-3.5 space-y-2.5">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Identificação do Participante
                </span>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold bg-[#141e30] border border-[#202f4a] text-cyan-300 text-sm shrink-0">
                    {nickname.trim() ? nickname.trim().slice(0, 2).toUpperCase() : "G"}
                  </div>

                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Seu Apelido / Nome <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex items-center bg-[#121a2d] border border-[#253550] rounded-xl px-3 py-1.5 focus-within:border-cyan-500 transition-colors">
                      <input
                        type="text"
                        required
                        placeholder="Ex: Luquinhas ou Amigo"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="w-full bg-transparent text-slate-100 text-xs focus:outline-none font-medium"
                      />
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                          effectiveTag === "0001"
                            ? "text-amber-300 bg-amber-950/70 border border-amber-500/40 font-bold"
                            : "text-slate-400 bg-slate-900/60"
                        }`}
                      >
                        #{effectiveTag}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guest Join Form */}
              <form onSubmit={handleJoinSubmit} className="space-y-3.5">
                {!isInvitedLink && (
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Código ou Link da Sala <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: koki-abc123 ou link completo"
                      value={joinRoomId}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes("?room=") || val.includes("&room=")) {
                          try {
                            const url = new URL(val.startsWith("http") ? val : `http://${val}`);
                            const extracted = url.searchParams.get("room");
                            if (extracted) {
                              setJoinRoomId(extracted);
                              return;
                            }
                          } catch {
                            // ignore and set raw
                          }
                        }
                        setJoinRoomId(val);
                      }}
                      className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Senha da Sala (Se for privada)
                  </label>
                  <input
                    type="password"
                    placeholder="Opcional se a sala for pública"
                    value={joinPasscode}
                    onChange={(e) => setJoinPasscode(e.target.value)}
                    className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!((joinRoomId || initialRoomId).trim())}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Entrar na Chamada</span>
                </button>

                {/* Quick alternative button to create room */}
                {!isInvitedLink && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setTab("member_create")}
                      className="text-xs text-slate-400 hover:text-cyan-300 transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Quer criar sua própria sala? Clique aqui</span>
                    </button>
                  </div>
                )}
              </form>
            </>
          )}

          {/* Audio & Camera Quick Preview Dock */}
          <div className="pt-3 border-t border-[#1b253b] space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300 text-[11px]">Teste do Microfone</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleMicPreview}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    micActive
                      ? "bg-[#121a2d] border-[#253550] text-slate-200"
                      : "bg-rose-950/40 border-rose-600/50 text-rose-400"
                  }`}
                  title={micActive ? "Mutar microfone antes de entrar" : "Desmutar microfone"}
                >
                  {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setCameraActive(!cameraActive)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    cameraActive
                      ? "bg-cyan-950/50 border-cyan-500/50 text-cyan-300"
                      : "bg-[#121a2d] border-[#253550] text-slate-400"
                  }`}
                  title={cameraActive ? "Desligar câmera" : "Ligar prévia da câmera"}
                >
                  {cameraActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Mic Meter Bar */}
            <div className="w-full h-1.5 bg-[#121a2d] rounded-full overflow-hidden border border-[#253550]">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-75"
                style={{ width: `${micActive ? micLevel : 0}%` }}
              />
            </div>

            {/* Camera Preview Area */}
            {cameraActive && (
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-[#253550] relative mt-2">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 px-2 py-0.5 rounded text-slate-300">
                  Prévia da Câmera
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 mt-5 text-center text-xs text-slate-400 flex flex-wrap justify-center items-center gap-3">
        <span>Login Salvo Automático</span>
        <span>•</span>
        <span>Canais de Texto & Voz</span>
        {isMaster && (
          <>
            <span>•</span>
            <button
              type="button"
              onClick={() => setShowBgModal(true)}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer font-medium"
              title="Personalizar GIF / Vídeo de Fundo (Exclusivo do Dono Master)"
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span>Fundo Dono Master: {bgConfig.type === "default" ? "Padrão" : bgConfig.type === "video" ? "Vídeo MP4" : "GIF"}</span>
            </button>
          </>
        )}
      </div>

      {/* Lobby Background Customizer Modal (Strictly Master Only) */}
      {isMaster && (
        <LobbyBackgroundModal
          isOpen={showBgModal}
          currentConfig={bgConfig}
          onClose={() => setShowBgModal(false)}
          onSave={(newCfg) => setBgConfig(newCfg)}
        />
      )}

      {/* Master Authentication Modal */}
      <MasterLoginModal
        isOpen={showMasterLoginModal}
        isMaster={isMaster}
        onClose={() => setShowMasterLoginModal(false)}
        onLoginSuccess={(token) => {
          if (onMasterLogin) {
            onMasterLogin(token);
          }
          setTab("master");
        }}
        onLogout={() => {
          if (onMasterLogout) {
            onMasterLogout();
          }
          setTab("guest");
        }}
      />

      {/* Koki Coins & Perks Store Modal */}
      <StoreModal
        isOpen={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        isMaster={isMaster}
      />
    </div>
  );
};
