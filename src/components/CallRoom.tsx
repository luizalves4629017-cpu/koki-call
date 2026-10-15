import { esquecerSala } from "../utils/conta";
import { AnuncioBanner } from "./AnuncioBanner";
import { ChuvaMoedas } from "./ChuvaMoedas";
import { SalaDiversao, TemaFundo } from "./SalaDiversao";
import { MissoesModal } from "./MissoesModal";
import { RoletaModal } from "./RoletaModal";
import { RankCoinsModal } from "./RankCoinsModal";
import { RankSubiuAviso } from "./RankSubiuAviso";
import { PainelExtrasMaster, AbaExtras } from "./PainelExtrasMaster";
import { somarMissao } from "../utils/missoes";
import { savePurchasedPerks as salvarPerksExtras } from "../utils/storage";
import { getMemberSince } from "../utils/storage";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Ghost, Eye, Mic } from "lucide-react";
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
import { coletarStats, lerTelaAec, salvarTelaAec, TelaAec } from "../utils/audioStats";
import { priorizarAudio, limitarVideoTela, tetoTelaPorPessoa, saudeConexao, proximoFator } from "../utils/rtpTuning";
import { MicProcessor } from "../utils/micProcessor";
import { HostPanelModal } from "./HostPanelModal";
import { InviteModal } from "./InviteModal";
import { EditOwnerProfileModal } from "./EditOwnerProfileModal";
import { AdmissionModal } from "./AdmissionModal";
import { FloatingAdmissionBanner } from "./FloatingAdmissionBanner";
import { GrantVipModal } from "./GrantVipModal";
import { GrantBadgesModal } from "./GrantBadgesModal";
import { StoreModal } from "./StoreModal";
import { notify } from "./Toast";
import { PunirModal } from "./PunirModal";
import { AmigosPainel } from "./AmigosPainel";
import { AudioDiagnostico } from "./AudioDiagnostico";
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

const DEMO_PARTICIPANTS: Participant[] = [
  {
    id: "demo-ana",
    name: "Ana Silva",
    tag: "2041",
    isHost: false,
    hasAudio: true,
    hasVideo: false,
    isScreenSharing: false,
    isDeafened: false,
    isMutedByHost: false,
    avatarColor: "#0284c7",
    avatarEmoji: "🎨",
    customStatus: "UI/UX em tons de azul",
    audioLevel: 28,
    joinedAt: Date.now() - 360000,
    voiceChannelId: "voice-geral",
  },
  {
    id: "demo-lucas",
    name: "Lucas Gamer",
    tag: "8832",
    isHost: false,
    hasAudio: true,
    hasVideo: false,
    isScreenSharing: false,
    isDeafened: false,
    isMutedByHost: false,
    avatarColor: "#6366f1",
    avatarEmoji: "⚡",
    customStatus: "Ecrã 1080p 90 FPS",
    audioLevel: 0,
    joinedAt: Date.now() - 120000,
    voiceChannelId: "voice-geral",
  },
  {
    id: "demo-sofia",
    name: "Sofia Dev",
    tag: "1920",
    isHost: false,
    hasAudio: false,
    hasVideo: false,
    isScreenSharing: false,
    isDeafened: false,
    isMutedByHost: false,
    avatarColor: "#059669",
    avatarEmoji: "💻",
    customStatus: "Desktop layout limpo",
    audioLevel: 0,
    joinedAt: Date.now() - 60000,
    voiceChannelId: "voice-geral",
  },
];

interface CallRoomProps {
  socket: Socket;
  initialRoom: RoomState;
  initialSelf: Participant;
  isMaster?: boolean;
  hasVipBadge?: boolean;
  masterToken?: string | null;
  onLeaveRoom: () => void;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  salasSlot?: React.ReactNode;
  /** Entrou pelo modo invisível (Dono Master / Co-fundador; o servidor confere) */
  entrouInvisivel?: boolean;
  /** Entrar invisível em outra sala (só chega pra Dono Master / Co-fundador) */
  onEntrarInvisivel?: (roomId: string) => void;
  /** Saiu do modo invisível (App atualiza a reconexão) */
  onRevelado?: () => void;
}

// Mensagens automáticas do servidor (ids "sys-...") ficam fora do chat
const ehAvisoAutomatico = (m: { id?: string }) => typeof m?.id === "string" && m.id.startsWith("sys-");

export const CallRoom: React.FC<CallRoomProps> = ({
  socket,
  initialRoom,
  initialSelf,
  isMaster = false,
  hasVipBadge: initialHasVipBadge = false,
  masterToken = null,
  onLeaveRoom,
  audioRef,
  salasSlot,
  entrouInvisivel = false,
  onEntrarInvisivel,
  onRevelado,
}) => {
  const [room, setRoom] = useState<RoomState>(initialRoom);
  const [self, setSelf] = useState<Participant>(initialSelf);

  // ---------------- Modo invisível ----------------
  // invisivelRef é lido na hora (dentro da sinalização WebRTC), o estado só redesenha a tela.
  const [invisivel, setInvisivel] = useState<boolean>(Boolean(entrouInvisivel));
  const invisivelRef = useRef<boolean>(Boolean(entrouInvisivel));
  // "Falar invisível": microfone enviado só no slot de áudio, sem aparecer na lista
  const vozInvisivelRef = useRef<MediaStream | null>(null);
  const [vozInvisivel, setVozInvisivel] = useState<"off" | "on" | "mudo">("off");
  // Lado de quem está visível: ids de invisíveis com quem temos conexão só-envio (sem card, fora da lista)
  const espectadoresRef = useRef<Set<string>>(new Set());
  // Dono Master / Co-fundador: quem mais está invisível nesta sala (o servidor só manda pra eles)
  const [invisiveisNaSala, setInvisiveisNaSala] = useState<Participant[]>([]);

  useEffect(() => {
    if (initialRoom) {
      setRoom((prev) => ({
        ...prev,
        ...initialRoom,
        participants: initialRoom.participants && initialRoom.participants.length > 0
          ? initialRoom.participants
          : prev.participants,
      }));
    }
  }, [initialRoom]);

  useEffect(() => {
    if (initialSelf) {
      setSelf((prev) => ({ ...prev, ...initialSelf }));
    }
  }, [initialSelf]);
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
        channelName: (defaultVoiceChannels as any[]).find((c) => c.id === targetChannelId)?.name,
        masterToken,
        roomId: room.roomId,
      },
      (res: { success: boolean; message?: string }) => {
        if (res && !res.success && res.message) {
          notify(res.message, "error");
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
  // Painel de diagnóstico de áudio: Ctrl+Shift+D ou botão nas Configurações
  const [diagAberto, setDiagAberto] = useState<boolean>(false);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setDiagAberto((v) => !v);
      }
    };
    const evento = () => setDiagAberto(true);
    window.addEventListener("keydown", tecla);
    window.addEventListener("eco:diag", evento);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("eco:diag", evento);
    };
  }, []);
  const [isHostPanelOpen, setIsHostPanelOpen] = useState<boolean>(false);
  const [temaSala, setTemaSala] = useState<string>("padrao");
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
  const [isOwnerProfileOpen, setIsOwnerProfileOpen] = useState<boolean>(false);
  const [isAdmissionOpen, setIsAdmissionOpen] = useState<boolean>(false);
  const [isGrantVipOpen, setIsGrantVipOpen] = useState<boolean>(false);
  const [isGrantBadgesOpen, setIsGrantBadgesOpen] = useState<boolean>(false);
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(false);
  const [isMissoesOpen, setIsMissoesOpen] = useState<boolean>(false);
  const [isRoletaOpen, setIsRoletaOpen] = useState<boolean>(false);
  const [isRankOpen, setIsRankOpen] = useState<boolean>(false);
  const [abaExtras, setAbaExtras] = useState<AbaExtras | null>(null);
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

      // Avisa o servidor (e todo mundo na call) do item comprado
      socket.emit("user:update-profile", {
        masterToken,
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

  // ---- Moedas ganhas/gastas em Missões e Roleta ----
  const ganharMoedas = (qtd: number, motivo: string) => {
    if (!qtd) return;
    const atual = getKokiCoins();
    const novo = setKokiCoins(atual + Math.floor(qtd));
    setSelf((prev) => ({ ...prev, kokiCoins: novo }));
    socket.emit("room:state-update", { kokiCoins: novo });
    notify(`+${qtd} Eco Coins · ${motivo}`, "success");
  };

  const gastarMoedas = (qtd: number): boolean => {
    // Co-fundador tem moedas infinitas (igual ao Dono): gasta sem perder
    if (selfRef.current?.isCofundador) return true;
    const atual = getKokiCoins();
    if (atual < qtd) return false;
    const novo = setKokiCoins(atual - qtd);
    setSelf((prev) => ({ ...prev, kokiCoins: novo }));
    socket.emit("room:state-update", { kokiCoins: novo });
    return true;
  };

  const ganharItem = (perkId: string, horas: number) => {
    const perks = getPurchasedPerks();
    const ate = Math.max(perks[perkId] || 0, Date.now()) + horas * 3600 * 1000;
    salvarPerksExtras({ ...perks, [perkId]: ate });
    handlePerkPurchased(perkId as StorePerkId, ate);
    notify(`Você ganhou um item na roleta! Vale por ${horas}h.`, "success");
  };

  // Missão "Ficar 30 min em call": conta 1 minuto por minuto na sala
  useEffect(() => {
    const t = setInterval(() => somarMissao("call", 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Pending Knock Requests (Owner Portaria)
  const [pendingKnocks, setPendingKnocks] = useState<KnockRequest[]>([]);

  // Spotlight participant
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  // Connection ping
  const [pingMs, setPingMs] = useState<number>(24);

  // Media and Control states
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(Boolean(entrouInvisivel));
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
      aiNoiseSuppression: saved.aiNoiseSuppression,
      autoSensitivity: saved.autoSensitivity,
      sensitivityDb: saved.sensitivityDb,
      lowResourceMode: saved.lowResourceMode || initialRoom.settings.lowBandwidthDefault,
      videoQuality: saved.videoQuality || "medium",
      volume: saved.volume ?? 100,
    };
  });

  // Media Streams refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);

  // Microfone com IA (RNNoise + noise gate). localStreamRef guarda a trilha PROCESSADA,
  // então tudo que lê localStreamRef (slots WebRTC, reconexão, mute) já usa o áudio limpo.
  const micProcessorRef = useRef<MicProcessor | null>(null);
  const [micProcessor, setMicProcessor] = useState<MicProcessor | null>(null);
  const micOptionsRef = useRef({
    aiNoiseSuppression: preferences.aiNoiseSuppression,
    autoSensitivity: preferences.autoSensitivity,
    sensitivityDb: preferences.sensitivityDb,
  });
  micOptionsRef.current = {
    aiNoiseSuppression: preferences.aiNoiseSuppression,
    autoSensitivity: preferences.autoSensitivity,
    sensitivityDb: preferences.sensitivityDb,
  };

  // Vigia do microfone mudo: depois que ele precisou pegar o mic SEM cancelamento de eco, continua assim nesta sessão
  const micSemEcoRef = useRef(false);
  // Restrições do navegador (continuam ligadas por baixo da IA)
  const buildMicConstraints = (withDevice = true): MediaTrackConstraints => ({
    echoCancellation: micSemEcoRef.current ? false : preferences.echoCancellation,
    noiseSuppression: preferences.noiseSuppression,
    // AGC do navegador DESLIGADO: no Windows ele abaixa o volume do microfone do sistema aos poucos
    // (principalmente com som do jogo/vídeo vazando no mic ao compartilhar a tela). O ganho de
    // compensação agora é feito no noise gate (só para cima, nunca abaixa).
    autoGainControl: false,
    ...(withDevice && preferences.selectedAudioInput ? { deviceId: { exact: preferences.selectedAudioInput } } : {}),
  });

  const closeMicProcessor = () => {
    if (micProcessorRef.current) {
      micProcessorRef.current.close();
      micProcessorRef.current = null;
    }
    setMicProcessor(null);
  };

  // Passa a trilha crua pelo pipeline de IA. Se falhar, devolve a crua (a call nunca quebra).
  const createProcessedMic = async (rawTrack: MediaStreamTrack): Promise<{ track: MediaStreamTrack; proc: MicProcessor | null }> => {
    const proc = await MicProcessor.create(rawTrack, micOptionsRef.current);
    if (!proc) {
      console.warn("[mic-ia] usando microfone sem IA (fallback com filtros do navegador).");
      return { track: rawTrack, proc: null };
    }
    try { (proc.track as any).contentHint = "speech"; } catch { /* ignore */ }
    return { track: proc.track, proc };
  };

  // ---------------------------------------------------------------------------
  // PROTEÇÃO DO ÁUDIO (principalmente ao iniciar/parar o compartilhamento de tela)
  // Nada pode deixar o microfone, o áudio da tela ou as vozes dos outros em volume 0 / desligados
  // sem o usuário ter pedido (mute, ensurdecer, volume 0 no slider).
  // ---------------------------------------------------------------------------
  const reconstruindoMicRef = useRef(false);
  const reconstruirMic = async (motivo: string, opts?: { semEco?: boolean }): Promise<boolean> => {
    if (reconstruindoMicRef.current || invisivelRef.current) return false;
    reconstruindoMicRef.current = true;
    console.warn(`[audio-guard] refazendo o microfone (${motivo})`);
    try {
      const restricoes = buildMicConstraints(true);
      if (opts?.semEco) restricoes.echoCancellation = false;
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: restricoes, video: false });
      } catch (e: any) {
        // Dispositivo escolhido sumiu: tenta o microfone padrão com as mesmas opções
        if (e?.name !== "OverconstrainedError" && e?.name !== "NotFoundError") throw e;
        const semDisp = { ...restricoes };
        delete (semDisp as any).deviceId;
        micStream = await navigator.mediaDevices.getUserMedia({ audio: semDisp, video: false });
      }
      const raw = micStream.getAudioTracks()[0];
      if (!raw) return false;
      const antigo = micProcessorRef.current;
      const { track, proc } = await createProcessedMic(raw);
      micProcessorRef.current = proc;
      setMicProcessor(proc);
      if (antigo && antigo !== proc) antigo.close();
      const stream = localStreamRef.current || new MediaStream();
      stream.getAudioTracks().forEach((t) => {
        stream.removeTrack(t);
        if (t !== track) { try { t.stop(); } catch { /* ignore */ } }
      });
      stream.addTrack(track);
      localStreamRef.current = stream;
      track.enabled = !isAudioMutedRef.current && !selfRef.current.isMutedByHost;
      syncLocalTracksToAllPeers();
      if (audioTrackerRef.current) audioTrackerRef.current.start(stream);
      return true;
    } catch (e) {
      console.warn("[audio-guard] não consegui refazer o microfone:", e);
      return false;
    } finally {
      reconstruindoMicRef.current = false;
    }
  };

  const garantirAudioVivo = (motivo = "verificação") => {
    if (invisivelRef.current) return;
    // 1) Microfone: pipeline da IA vivo e acordado; trilha ligada conforme o mute do usuário
    const proc = micProcessorRef.current;
    const micTrack = localStreamRef.current?.getAudioTracks()[0] || null;
    const procVivo = proc ? proc.ensureAlive() : true;
    const micEncerrado = Boolean(micTrack && micTrack.readyState === "ended");
    if (localStreamRef.current && (!procVivo || micEncerrado)) {
      reconstruirMic(`${motivo}: ${!procVivo ? "pipeline da IA parou" : "trilha do microfone encerrada"}`);
    } else if (micTrack) {
      const querLigado = !isAudioMutedRef.current && !selfRef.current.isMutedByHost;
      if (micTrack.enabled !== querLigado) micTrack.enabled = querLigado;
    }
    // 2) Áudio da tela: sempre ligado enquanto compartilha
    localScreenStreamRef.current?.getAudioTracks().forEach((t) => {
      if (!t.enabled) t.enabled = true;
    });
    // 3) Trilhas certas em todas as conexões (replaceTrack só se mudou) + banda (áudio na frente)
    syncLocalTracksToAllPeers();
    void ajustarBandaTodos();
    // 4) Vozes dos outros: tocando, sem mute e com volume > 0 (a não ser que o usuário tenha pedido)
    if (!isDeafenedRef.current) {
      remoteAudioElementsRef.current.forEach((el, id) => {
        const userVol = participantVolumesRef.current[id] ?? 100;
        const alvo = Math.max(0, Math.min(1, (userVol / 100) * (masterVoiceVolumeRef.current / 100)));
        if (el.muted) el.muted = false;
        if (Math.abs(el.volume - alvo) > 0.01) el.volume = alvo;
        if (el.paused && el.srcObject) el.play().catch(() => {});
      });
    }
  };
  const garantirAudioVivoRef = useRef(garantirAudioVivo);
  garantirAudioVivoRef.current = garantirAudioVivo;

  // ---------------------------------------------------------------------------
  // VIGIA DO MICROFONE MUDO (visto no app Windows: a trilha fica "live", mas o Windows/Chromium
  // passa a entregar silêncio digital assim que a captura do som do sistema começa).
  // Enquanto compartilha a tela, com o mic ligado pelo usuário: se o pico do mic CRU (antes da IA e
  // do gate) ficar abaixo de -80 dB por ~3 s, pega o microfone de novo (getUserMedia) e troca a trilha
  // em todas as conexões (replaceTrack). 1ª tentativa: mesmas opções; depois: sem cancelamento de eco.
  // ---------------------------------------------------------------------------
  const vigiaLogRef = useRef<Array<{ hora: string; msg: string }>>([]);
  const vigiaRef = useRef<{ mudoDesde: number | null; tentativas: number; carenciaAte: number; sessaoTela: string | null; ocupado: boolean }>(
    { mudoDesde: null, tentativas: 0, carenciaAte: 0, sessaoTela: null, ocupado: false }
  );
  const logVigia = (msg: string) => {
    const hora = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    vigiaLogRef.current = [...vigiaLogRef.current, { hora, msg }].slice(-8);
    console.warn(`[mic-vigia] ${msg}`);
  };
  const vigiarMic = () => {
    const v = vigiaRef.current;
    const tela = localScreenStreamRef.current;
    if (!tela || invisivelRef.current) {
      v.mudoDesde = null;
      v.sessaoTela = null;
      return;
    }
    // Nova sessão de compartilhamento: zera as tentativas e dá 1 s pro áudio do sistema começar
    if (v.sessaoTela !== tela.id) {
      v.sessaoTela = tela.id;
      v.tentativas = 0;
      v.mudoDesde = null;
      v.carenciaAte = Date.now() + 1000;
    }
    const mic = localStreamRef.current?.getAudioTracks()[0] || null;
    const proc = micProcessorRef.current;
    const ligadoPeloUsuario = !isAudioMutedRef.current && !selfRef.current.isMutedByHost;
    if (!mic || mic.readyState !== "live" || !ligadoPeloUsuario || !proc || v.ocupado || Date.now() < v.carenciaAte) {
      v.mudoDesde = null;
      return;
    }
    if (proc.contextState !== "running") { v.mudoDesde = null; return; }
    const pico = proc.rawPeakDb();
    if (pico === null) return;
    if (pico >= -80) {
      if (v.mudoDesde !== null && v.tentativas > 0) logVigia(`microfone voltou (${Math.round(pico)} dB)`);
      v.mudoDesde = null;
      return;
    }
    const agora = Date.now();
    if (v.mudoDesde === null) { v.mudoDesde = agora; return; }
    if (agora - v.mudoDesde < 3000) return;
    if (v.tentativas >= 3) {
      if (v.tentativas === 3) { logVigia("mic continua mudo após 3 tentativas; parei de tentar neste compartilhamento"); v.tentativas++; }
      return;
    }
    v.tentativas++;
    const semEco = v.tentativas >= 2;
    v.ocupado = true;
    v.mudoDesde = null;
    logVigia(`mic cru mudo (${Math.round(pico)} dB) por 3 s → pegando o microfone de novo${semEco ? " SEM cancelamento de eco" : ""} (tentativa ${v.tentativas})`);
    reconstruirMic("vigia: microfone mudo durante o compartilhamento", { semEco })
      .then((ok) => {
        if (ok && semEco) micSemEcoRef.current = true;
        logVigia(ok ? `microfone trocado em todas as conexões${semEco ? " (sem cancelamento de eco)" : ""}` : "falhou ao pegar o microfone de novo");
      })
      .finally(() => {
        v.ocupado = false;
        v.carenciaAte = Date.now() + 1500;
      });
  };
  const vigiarMicRef = useRef(vigiarMic);
  vigiarMicRef.current = vigiarMic;
  useEffect(() => {
    const id = window.setInterval(() => vigiarMicRef.current(), 300);
    return () => window.clearInterval(id);
  }, []);

  // Verificação contínua leve (a cada 3 s) + estado exposto para diagnóstico/teste: window.__ecoAudio.estado()
  useEffect(() => {
    const id = window.setInterval(() => garantirAudioVivoRef.current("intervalo"), 3000);
    (window as any).__ecoAudio = {
      garantir: () => garantirAudioVivoRef.current("manual"),
      stats: () => coletarStats(peerConnectionsRef.current, peerTransceiversRef.current),
      telaAec: (v?: TelaAec) => {
        if (v) {
          salvarTelaAec(v);
          const t = localScreenStreamRef.current?.getAudioTracks()[0];
          // Automático = desligado
          if (t) t.applyConstraints({ echoCancellation: v === "on" } as any).catch(() => {});
        }
        return { pref: lerTelaAec(), atual: (localScreenStreamRef.current?.getAudioTracks()[0]?.getSettings() as any)?.echoCancellation ?? null };
      },
      estado: () => {
        const mic = localStreamRef.current?.getAudioTracks()[0] || null;
        const scr = localScreenStreamRef.current?.getAudioTracks()[0] || null;
        const senders: any[] = [];
        peerTransceiversRef.current.forEach((slots, peer) => {
          senders.push({
            peer,
            micSender: slots.audioTransceiver?.sender.track?.id || null,
            micSenderEnabled: slots.audioTransceiver?.sender.track?.enabled ?? null,
            telaAudioSender: slots.screenAudioTransceiver?.sender.track?.id || null,
          });
        });
        const remotos: any[] = [];
        remoteAudioElementsRef.current.forEach((el, peer) => remotos.push({ peer, muted: el.muted, volume: el.volume, paused: el.paused }));
        return {
          compartilhando: Boolean(localScreenStreamRef.current),
          nomes: Object.fromEntries((roomRef.current?.participants || []).map((p: any) => [p.id, p.name])),
          mic: mic ? { id: mic.id, enabled: mic.enabled, readyState: mic.readyState, label: mic.label } : null,
          micIA: micProcessorRef.current ? micProcessorRef.current.diagnostico() : null,
          micVigia: { log: vigiaLogRef.current, tentativas: vigiaRef.current.tentativas, semEco: micSemEcoRef.current },
          telaAudio: scr ? { id: scr.id, enabled: scr.enabled, readyState: scr.readyState, settings: scr.getSettings?.() } : null,
          senders,
          remotos,
        };
      },
    };
    return () => {
      window.clearInterval(id);
      try { delete (window as any).__ecoAudio; } catch { /* ignore */ }
    };
  }, []);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteScreenStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const incomingStreamTypeRef = useRef<Map<string, "camera" | "screen">>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteAudioTrackersRef = useRef<Map<string, AudioVolumeTracker>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const isSettingRemoteAnswerPendingRef = useRef<Map<string, boolean>>(new Map());
  const peerTransceiversRef = useRef<Map<string, {
    audioTransceiver?: RTCRtpTransceiver;
    cameraTransceiver?: RTCRtpTransceiver;
    screenTransceiver?: RTCRtpTransceiver;
    screenAudioTransceiver?: RTCRtpTransceiver;
  }>>(new Map());
  const knownScreenTrackIdsRef = useRef<Map<string, string>>(new Map());
  const remoteScreenHasAudioRef = useRef<Map<string, boolean>>(new Map());
  const offerFallbackTimersRef = useRef<Map<string, number>>(new Map());

  // ---------------------------------------------------------------------------
  // Slots fixos de mídia por conexão (mesma ordem nos dois lados):
  //   0 = microfone, 1 = câmera, 2 = vídeo da tela, 3 = áudio da tela
  // Só UM lado cria os slots (o "ofertante", definido pelo socket id maior).
  // O outro lado adota os slots que chegam na oferta. Assim, ligar/desligar
  // microfone, câmera ou tela é só replaceTrack, sem renegociar e sem colisão.
  // ---------------------------------------------------------------------------
  const SLOT_KINDS: Array<"audio" | "video"> = ["audio", "video", "video", "audio"];

  const isDesignatedOfferer = (targetId: string) => (socket.id || "") > targetId;

  const getNegotiatedTransceivers = (pc: RTCPeerConnection) =>
    pc.getTransceivers().filter((t) => t.mid !== null && !(t as any).stopped);

  const safeReplaceTrack = (tr: RTCRtpTransceiver | undefined, track: MediaStreamTrack | null) => {
    if (!tr) return;
    if (tr.sender.track === track) return;
    tr.sender.replaceTrack(track).catch((e) => console.warn("[webrtc] replaceTrack falhou:", e));
  };

  // Coloca as trilhas locais atuais nos slots da conexão com targetId
  const syncLocalTracksToPeer = (targetId: string) => {
    const slots = peerTransceiversRef.current.get(targetId);
    if (!slots) return;
    // Invisível nunca coloca trilha nenhuma nas conexões
    if (invisivelRef.current) return;
    const mic = localStreamRef.current?.getAudioTracks()[0] || null;
    const cam = localStreamRef.current?.getVideoTracks().find((t) => t.readyState === "live") || null;
    const scr = localScreenStreamRef.current?.getVideoTracks()[0] || null;
    const scrAudio = localScreenStreamRef.current?.getAudioTracks()[0] || null;
    const telaNova = Boolean(scr && slots.screenTransceiver && slots.screenTransceiver.sender.track !== scr);
    safeReplaceTrack(slots.audioTransceiver, mic);
    safeReplaceTrack(slots.cameraTransceiver, cam);
    safeReplaceTrack(slots.screenTransceiver, scr);
    safeReplaceTrack(slots.screenAudioTransceiver, scrAudio);
    if (telaNova) {
      console.log(`[tela] track da tela atribuída ao slot de tela do peer ${targetId}`);
    }
    ajustarBandaPeer(targetId);
    // A primeira negociação pode ainda não ter "encodings": tenta de novo logo depois
    if (telaNova) [400, 1500].forEach((ms) => setTimeout(() => ajustarBandaPeer(targetId), ms));
  };

  // ---------------------------------------------------------------------------
  // BANDA: áudio sempre na frente, vídeo da tela com orçamento total e corte adaptativo.
  // (ver src/utils/rtpTuning.ts — causa provável do áudio "sumindo aos poucos" ao compartilhar)
  // ---------------------------------------------------------------------------
  const fatorRedeRef = useRef<Map<string, number>>(new Map());
  const screenPresetRef = useRef<ScreenSharePresetId>(DEFAULT_SCREEN_PRESET_ID);
  screenPresetRef.current = screenQualityPreset;
  const ultimoTetoRef = useRef<Map<string, number>>(new Map());
  const rttBaseRef = useRef<Map<string, number>>(new Map());
  const [rotaConexao, setRotaConexao] = useState<{ relay: number; total: number; rttMs: number }>({ relay: 0, total: 0, rttMs: 0 });
  const ajustarBandaPeer = (targetId: string, disponivelBps = 0) => {
    const slots = peerTransceiversRef.current.get(targetId);
    if (!slots || invisivelRef.current) return;
    priorizarAudio(slots);
    const scr = localScreenStreamRef.current?.getVideoTracks()[0];
    if (!scr) {
      fatorRedeRef.current.delete(targetId);
      return;
    }
    const preset = SCREEN_SHARE_PRESETS[screenPresetRef.current] || SCREEN_SHARE_PRESETS[DEFAULT_SCREEN_PRESET_ID];
    const fator = fatorRedeRef.current.get(targetId) ?? 1;
    const pessoas = Array.from(peerConnectionsRef.current.entries()).filter(([id, pc]) => id !== socket.id && pc.connectionState !== "closed" && pc.connectionState !== "failed").length;
    let teto = tetoTelaPorPessoa(screenPresetRef.current, pessoas, fator);
    // Nunca passa de ~70% do que a rede diz ter (sobra para o áudio e para a fila não crescer)
    if (disponivelBps > 0) teto = Math.max(250_000, Math.min(teto, Math.round(disponivelBps * 0.7 - 200_000)));
    // Com pouca banda, menos quadros por segundo (o áudio e a nitidez valem mais)
    const fps = teto < 450_000 ? Math.min(preset.frameRate, 20) : teto < 1_000_000 ? Math.min(preset.frameRate, 30) : Math.min(preset.frameRate, 60);
    limitarVideoTela(slots, teto, fps);
    const antes = ultimoTetoRef.current.get(targetId) || 0;
    if (Math.abs(antes - teto) > antes * 0.15) {
      ultimoTetoRef.current.set(targetId, teto);
      console.log(`[banda] tela → ${targetId}: ${Math.round(teto / 1000)} kbps, ${fps} fps (fator ${fator.toFixed(2)})`);
    }
  };
  const ajustarBandaTodos = async () => {
    const compartilhando = Boolean(localScreenStreamRef.current);
    let relay = 0, total = 0, rttMax = 0;
    for (const [targetId, pc] of peerConnectionsRef.current) {
      if (pc.connectionState === "closed" || pc.connectionState === "failed") continue;
      const saude = await saudeConexao(pc);
      if (saude && saude.rttMs > 0) {
        total++;
        if (saude.relay) relay++;
        rttMax = Math.max(rttMax, saude.rttMs);
        const base = rttBaseRef.current.get(targetId);
        rttBaseRef.current.set(targetId, base ? Math.min(base, saude.rttMs) : saude.rttMs);
      }
      if (compartilhando) {
        fatorRedeRef.current.set(targetId, proximoFator(fatorRedeRef.current.get(targetId) ?? 1, saude, rttBaseRef.current.get(targetId) || 0));
        ajustarBandaPeer(targetId, saude?.disponivelBps || 0);
      } else {
        ajustarBandaPeer(targetId);
      }
    }
    setRotaConexao((prev) => (prev.relay === relay && prev.total === total && Math.abs(prev.rttMs - rttMax) < 25 ? prev : { relay, total, rttMs: Math.round(rttMax) }));
  };

  const syncLocalTracksToAllPeers = () => {
    peerConnectionsRef.current.forEach((_pc, targetId) => syncLocalTracksToPeer(targetId));
  };

  // Lado ofertante: cria os 4 slots
  const createOwnSlots = (targetId: string, pc: RTCPeerConnection) => {
    const [audioTransceiver, cameraTransceiver, screenTransceiver, screenAudioTransceiver] = SLOT_KINDS.map((kind) =>
      // Invisível: slots só-recebe (o servidor também reescreve a oferta pra recvonly)
      pc.addTransceiver(kind, { direction: invisivelRef.current && !(kind === "audio" && vozInvisivelRef.current) ? "recvonly" : "sendrecv" })
    );
    const vozTrack = invisivelRef.current ? vozInvisivelRef.current?.getAudioTracks()[0] : null;
    if (vozTrack) audioTransceiver.sender.replaceTrack(vozTrack).catch(() => {});
    peerTransceiversRef.current.set(targetId, {
      audioTransceiver,
      cameraTransceiver,
      screenTransceiver,
      screenAudioTransceiver,
    });
    syncLocalTracksToPeer(targetId);
  };

  // Lado que recebe a oferta: adota os slots na ordem em que vieram
  const adoptRemoteSlots = (targetId: string, pc: RTCPeerConnection) => {
    const negotiated = getNegotiatedTransceivers(pc);
    // Para slots criados por este lado que nunca foram negociados (ex.: colisão), descarta
    pc.getTransceivers().forEach((t) => {
      if (t.mid === null) {
        try { t.stop(); } catch { /* ignore */ }
      }
    });
    if (negotiated.length < 4) {
      console.warn(`[webrtc] oferta de ${targetId} veio com ${negotiated.length} slots (esperado 4)`);
    }
    negotiated.slice(0, 4).forEach((t) => {
      t.direction = "sendrecv";
    });
    peerTransceiversRef.current.set(targetId, {
      audioTransceiver: negotiated[0],
      cameraTransceiver: negotiated[1],
      screenTransceiver: negotiated[2],
      screenAudioTransceiver: negotiated[3],
    });
    syncLocalTracksToPeer(targetId);
  };

  // Monta (com objetos novos, para os players atualizarem) os streams remotos de câmera e tela
  const rebuildRemoteStreams = (targetId: string) => {
    const pc = peerConnectionsRef.current.get(targetId);
    if (!pc) return;
    const negotiated = getNegotiatedTransceivers(pc);
    const micTrack = negotiated[0]?.receiver.track || null;
    const camTrack = negotiated[1]?.receiver.track || null;
    const scrTrack = negotiated[2]?.receiver.track || null;
    const scrAudioTrack = negotiated[3]?.receiver.track || null;

    const camTracks = [micTrack, camTrack].filter(Boolean) as MediaStreamTrack[];
    if (camTracks.length > 0) {
      remoteStreamsRef.current.set(targetId, new MediaStream(camTracks));
    }

    if (scrTrack) {
      const includeAudio = remoteScreenHasAudioRef.current.get(targetId) !== false;
      // Segurança: o player da tela NUNCA toca uma trilha local (seu próprio microfone)
      const idsLocais = new Set<string>([
        ...(localStreamRef.current?.getTracks().map((t) => t.id) || []),
        ...(localScreenStreamRef.current?.getTracks().map((t) => t.id) || []),
      ]);
      const audioTela = includeAudio && scrAudioTrack && !idsLocais.has(scrAudioTrack.id) ? scrAudioTrack : null;
      const scrTracks = [scrTrack, audioTela].filter(Boolean) as MediaStreamTrack[];
      remoteScreenStreamsRef.current.set(targetId, new MediaStream(scrTracks));
    }
  };

  const sendOffer = async (targetId: string, pc: RTCPeerConnection, iceRestart = false) => {
    try {
      makingOfferRef.current.set(targetId, true);
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      if (pc.signalingState !== "stable" && !iceRestart) return;
      await pc.setLocalDescription(offer);
      socket.emit("signal:offer", {
        targetId,
        to: targetId,
        offer: pc.localDescription,
        streamType: "camera",
      });
    } catch (err) {
      console.warn("[webrtc] erro ao criar oferta:", err);
    } finally {
      makingOfferRef.current.set(targetId, false);
    }
  };
  const [forceUpdate, setForceUpdate] = useState(0);

  // Theme state: defaults to true (Dark Mode suave descansativo para a vista)
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("koki_theme");
      if (stored === "light_blue" || stored === "light") return false;
      return true;
    } catch {
      return true;
    }
  });

  const handleToggleTheme = () => {
    setIsDarkTheme((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("koki_theme", next ? "dark" : "light_blue");
        if (next) {
          document.body.classList.add("theme-dark");
        } else {
          document.body.classList.remove("theme-dark");
        }
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (isDarkTheme) {
      document.body.classList.add("theme-dark");
    } else {
      document.body.classList.remove("theme-dark");
    }
  }, [isDarkTheme]);

  // Interactive Desktop UI/UX Mockup Demo Mode state
  const [isMockupDemoActive, setIsMockupDemoActive] = useState<boolean>(false);

  const roomRef = useRef(room);
  roomRef.current = room;
  const selfRef = useRef(self);
  selfRef.current = self;
  const participantVolumesRef = useRef(participantVolumes);
  participantVolumesRef.current = participantVolumes;
  const masterVoiceVolumeRef = useRef(masterVoiceVolume);
  masterVoiceVolumeRef.current = masterVoiceVolume;
  const isAudioMutedRef = useRef(isAudioMuted);
  isAudioMutedRef.current = isAudioMuted;
  const isDeafenedRef = useRef(isDeafened);
  isDeafenedRef.current = isDeafened;

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
      // Invisível não abre microfone nem câmera (nada pra mandar). Ao Aparecer, ligar o mic pede de novo.
      if (invisivelRef.current) return;
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: buildMicConstraints(true),
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
            audio: buildMicConstraints(false),
            video: false,
          });
        }

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Microfone → IA (RNNoise) → noise gate → trilha que vai pra call
        const rawAudio = stream.getAudioTracks()[0];
        if (rawAudio) {
          const { track, proc } = await createProcessedMic(rawAudio);
          if (!active) {
            proc?.close();
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          if (proc) {
            micProcessorRef.current = proc;
            setMicProcessor(proc);
            stream = new MediaStream([track, ...stream.getVideoTracks()]);
          }
        }

        localStreamRef.current = stream;

        // Apply mute state to local audio track
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks[0].enabled = !isAudioMuted && !self.isMutedByHost;
        }

        // Coloca microfone/câmera nos slots de todas as conexões (sem renegociar)
        syncLocalTracksToAllPeers();

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
      // Fecha o AudioContext da IA e o microfone cru (ao sair da call ou trocar de microfone)
      closeMicProcessor();
    };
  }, [preferences.echoCancellation, preferences.noiseSuppression, preferences.selectedAudioInput, preferences.selectedVideoInput]);

  // IA / sensibilidade mudam ao vivo (sem pedir o microfone de novo nem renegociar)
  useEffect(() => {
    micProcessorRef.current?.setOptions({
      aiNoiseSuppression: preferences.aiNoiseSuppression,
      autoSensitivity: preferences.autoSensitivity,
      sensitivityDb: preferences.sensitivityDb,
    });
  }, [preferences.aiNoiseSuppression, preferences.autoSensitivity, preferences.sensitivityDb, micProcessor]);

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
    // Nunca abre conexão consigo mesmo (acontecia quando self.id ainda não era o socket.id:
    // ficava uma conexão morta que contava como "pessoa" na divisão da banda)
    if (!targetId || targetId === socket.id) {
      return undefined as unknown as RTCPeerConnection;
    }
    if (peerConnectionsRef.current.has(targetId)) {
      return peerConnectionsRef.current.get(targetId)!;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(targetId, pc);

    // Só o ofertante designado cria os slots e manda a oferta inicial.
    // O outro lado espera a oferta; se ela não chegar em 4s, assume o papel.
    // Modo invisível: o invisível SEMPRE oferece (só-recebe); quem está visível só responde a ele.
    const ehEspectador = espectadoresRef.current.has(targetId);
    const souOfertante = invisivelRef.current || (!ehEspectador && isDesignatedOfferer(targetId));
    if (souOfertante) {
      createOwnSlots(targetId, pc);
    } else if (!ehEspectador) {
      const timer = window.setTimeout(() => {
        offerFallbackTimersRef.current.delete(targetId);
        const current = peerConnectionsRef.current.get(targetId);
        if (current === pc && !pc.remoteDescription && pc.signalingState === "stable" && !peerTransceiversRef.current.has(targetId)) {
          console.warn(`[webrtc] oferta de ${targetId} não chegou, criando a conexão por este lado`);
          createOwnSlots(targetId, pc);
          sendOffer(targetId, pc);
        }
      }, 4000);
      offerFallbackTimersRef.current.set(targetId, timer);
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
    pc.ontrack = (event) => {
      // Conexão com um invisível: dele não vem nada (e se vier, ignora)
      const track = event.track;
      const slotIndex = getNegotiatedTransceivers(pc).indexOf(event.transceiver);
      // De um invisível só pode vir a voz (slot 0), quando ele liga "falar invisível"
      if (espectadoresRef.current.has(targetId) && !(track.kind === "audio" && slotIndex === 0)) return;

      console.log(`[tela] ontrack recebido: kind = ${track.kind}, id = ${track.id}, slot = ${slotIndex} de peer ${targetId}`);

      // Slots 2 e 3 = tela (vídeo e áudio)
      if (slotIndex === 2 || slotIndex === 3) {
        rebuildRemoteStreams(targetId);
        track.onunmute = () => {
          console.log(`[tela] trilha da tela (${track.kind}) começou a receber dados de ${targetId}`);
          rebuildRemoteStreams(targetId);
          setForceUpdate((prev) => prev + 1);
        };
        setForceUpdate((prev) => prev + 1);
        return;
      }

      if (track.kind === "audio") {
        const stream = new MediaStream([track]);
        // Direct binding to global background <audio id="remote-audio"> and call .play()
        const remoteAudioEl = (document.getElementById("remote-audio") as HTMLAudioElement) || (audioRef && audioRef.current);
        if (remoteAudioEl) {
          try {
            if (remoteAudioEl.srcObject !== stream) {
              remoteAudioEl.srcObject = stream;
            }
            remoteAudioEl.play().catch((err) => {
              console.warn("remote-audio autoplay pending interaction:", err);
            });
          } catch (e) {
            console.warn("Error attaching stream to remote-audio:", e);
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
            peerAudioEl.setAttribute("autoplay", "true");
            peerAudioEl.setAttribute("playsinline", "true");
            peerAudioEl.style.display = "none";
            document.body.appendChild(peerAudioEl);
          }
          remoteAudioElementsRef.current.set(targetId, peerAudioEl);
        }

        if (peerAudioEl) {
          peerAudioEl.srcObject = stream;
          const userVol = participantVolumesRef.current[targetId] ?? 100;
          peerAudioEl.volume = Math.max(0, Math.min(1, (userVol / 100) * (masterVoiceVolumeRef.current / 100)));
          peerAudioEl.play().catch((err) => {
            console.warn(`Autoplay audio for peer ${targetId} pending user interaction:`, err);
          });
        }

        // Real-time audio volume tracker for remote user speaking indicator
        const oldTracker = remoteAudioTrackersRef.current.get(targetId);
        if (oldTracker) oldTracker.stop();
        const tracker = new AudioVolumeTracker((level) => {
          setRoom((prev) => ({
            ...prev,
            participants: prev.participants.map((p) =>
              p.id === targetId ? { ...p, audioLevel: level } : p
            ),
          }));
        });
        tracker.start(stream);
        remoteAudioTrackersRef.current.set(targetId, tracker);
      }

      // Slot 0 (microfone) e slot 1 (câmera) formam o stream de câmera
      rebuildRemoteStreams(targetId);
      if (track.kind === "video") {
        track.onunmute = () => {
          rebuildRemoteStreams(targetId);
          setForceUpdate((prev) => prev + 1);
        };
        // Câmera desligada do outro lado: volta a mostrar o avatar
        track.onmute = () => {
          setForceUpdate((prev) => prev + 1);
        };
      }
      setForceUpdate((prev) => prev + 1);
    };

    // Handle Connection State
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        if (peerConnectionsRef.current.get(targetId) === pc) espectadoresRef.current.delete(targetId);
        const audioEl = remoteAudioElementsRef.current.get(targetId);
        if (audioEl) {
          audioEl.pause();
          audioEl.srcObject = null;
          audioEl.remove();
          remoteAudioElementsRef.current.delete(targetId);
        }
        peerConnectionsRef.current.delete(targetId);
        peerTransceiversRef.current.delete(targetId);
        knownScreenTrackIdsRef.current.delete(targetId);
        remoteStreamsRef.current.delete(targetId);
        remoteScreenStreamsRef.current.delete(targetId);
        setForceUpdate((prev) => prev + 1);
      }
    };

    // Handle ICE Connection State and Auto-Recover with ICE Restart
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        console.warn(`ICE failed for peer ${targetId}, restarting ICE...`);
        // Só o ofertante reinicia, para não causar colisão de ofertas
        // (com invisível no meio, só o invisível reinicia)
        if (espectadoresRef.current.has(targetId)) return;
        if (invisivelRef.current || isDesignatedOfferer(targetId) || !pc.remoteDescription) {
          sendOffer(targetId, pc, true);
        }
      } else if (pc.iceConnectionState === "closed") {
        const audioEl = remoteAudioElementsRef.current.get(targetId);
        if (audioEl) {
          audioEl.pause();
          audioEl.srcObject = null;
          audioEl.remove();
          remoteAudioElementsRef.current.delete(targetId);
        }
        peerConnectionsRef.current.delete(targetId);
        peerTransceiversRef.current.delete(targetId);
        remoteStreamsRef.current.delete(targetId);
        remoteScreenStreamsRef.current.delete(targetId);
        setForceUpdate((prev) => prev + 1);
      }
    };

    // Ofertante designado (ou o invisível) manda a oferta inicial
    if (souOfertante) {
      sendOffer(targetId, pc);
    }

    return pc;
  }, [socket, isAudioMuted, isVideoMuted, preferences.lowResourceMode, self.isMutedByHost, audioRef]);

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

      // Clean up remote audio element and volume tracker
      const audioEl = remoteAudioElementsRef.current.get(data.id);
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
        remoteAudioElementsRef.current.delete(data.id);
      }
      const tracker = remoteAudioTrackersRef.current.get(data.id);
      if (tracker) {
        tracker.stop();
        remoteAudioTrackersRef.current.delete(data.id);
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
      peerTransceiversRef.current.delete(data.id);
      remoteScreenHasAudioRef.current.delete(data.id);
      const fallbackTimer = offerFallbackTimersRef.current.get(data.id);
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        offerFallbackTimersRef.current.delete(data.id);
      }

      if (spotlightId === data.id) {
        setSpotlightId(null);
      }

      if (selectedProfileParticipant?.id === data.id) {
        setSelectedProfileParticipant(null);
      }

      setForceUpdate((prev) => prev + 1);
    };

    const handleUserUpdated = (updatedUser: Participant) => {
      const antes = roomRef.current.participants.find((p) => p.id === updatedUser.id);
      setRoom((prev) => ({
        ...prev,
        participants: prev.participants.map((p) => (p.id === updatedUser.id ? { ...p, ...updatedUser } : p)),
      }));

      if (updatedUser.id === self.id) {
        setSelf((prev) => ({ ...prev, ...updatedUser }));
        // Guarda no aparelho a data mais antiga que o servidor conhece
        const desde = Number((updatedUser as any).memberSince);
        if (Number.isFinite(desde) && desde > 1600000000000 && desde < getMemberSince()) {
          try { localStorage.setItem("eco_member_since_v1", String(desde)); } catch {}
        }
      }

      if (selectedProfileParticipant?.id === updatedUser.id) {
        setSelectedProfileParticipant((prev) => (prev ? { ...prev, ...updatedUser } : null));
      }

      // If user started screen sharing, auto spotlight if none set
      // (só quando começou agora: atualização de perfil não pode puxar o destaque de volta)
      if (updatedUser.isScreenSharing && !antes?.isScreenSharing && !spotlightId) {
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
      // Invisível não aceita oferta de ninguém (o servidor já barra; aqui é só garantia)
      if (invisivelRef.current) return;
      // Oferta de um invisível (marcada pelo SERVIDOR): conexão só-envio, sem card e fora da lista
      if ((payload as any).espectador === true) {
        const atual = peerConnectionsRef.current.get(senderId);
        if (atual && !espectadoresRef.current.has(senderId)) {
          try { atual.close(); } catch { /* ignore */ }
          peerConnectionsRef.current.delete(senderId);
          peerTransceiversRef.current.delete(senderId);
        }
        espectadoresRef.current.add(senderId);
      }

      const isScreen = payload.isScreen || payload.streamType === "screen";
      incomingStreamTypeRef.current.set(senderId, isScreen ? "screen" : "camera");

      const pc = createPeerConnection(senderId, false);
      const isPolite = (socket.id || "") < senderId;
      const isMakingOffer = Boolean(makingOfferRef.current.get(senderId));
      const isSettingRemoteAnswerPending = Boolean(isSettingRemoteAnswerPendingRef.current.get(senderId));

      const readyForOffer = !isMakingOffer && (pc.signalingState === "stable" || isSettingRemoteAnswerPending);
      const isOfferCollision = !readyForOffer;

      ignoreOfferRef.current.set(senderId, !isPolite && isOfferCollision);
      if (ignoreOfferRef.current.get(senderId)) {
        console.warn(`[WebRTC] Glare handled: Impolite peer ignoring colliding offer from ${senderId}`);
        // Impolite peer must renegotiate after glare once signaling returns to stable
        setTimeout(async () => {
          const activePc = peerConnectionsRef.current.get(senderId);
          if (activePc && activePc.signalingState === "stable") {
            try {
              makingOfferRef.current.set(senderId, true);
              await activePc.setLocalDescription();
              socket.emit("signal:offer", {
                targetId: senderId,
                to: senderId,
                offer: activePc.localDescription,
                streamType: localScreenStreamRef.current ? "screen" : "camera",
                isScreen: Boolean(localScreenStreamRef.current),
              });
            } catch (retryErr) {
              console.warn("[WebRTC] Erro ao refazer oferta após colisão:", retryErr);
            } finally {
              makingOfferRef.current.set(senderId, false);
            }
          }
        }, 400);
        return;
      }

      try {
        if (isOfferCollision) {
          // Polite peer rolls back local offer to resolve glare
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

        // Oferta chegou: cancela o plano B e adota os slots (se ainda não temos)
        const fallbackTimer = offerFallbackTimersRef.current.get(senderId);
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          offerFallbackTimersRef.current.delete(senderId);
        }
        if (!peerTransceiversRef.current.has(senderId) || isOfferCollision) {
          adoptRemoteSlots(senderId, pc);
        } else {
          syncLocalTracksToPeer(senderId);
        }
        rebuildRemoteStreams(senderId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("signal:answer", {
          targetId: senderId,
          to: senderId,
          answer: pc.localDescription,
          streamType: payload.streamType || "camera",
          isScreen: Boolean(payload.isScreen),
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
            isSettingRemoteAnswerPendingRef.current.set(senderId, true);
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
        } finally {
          isSettingRemoteAnswerPendingRef.current.set(senderId, false);
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
      // Avisos automáticos (entrou, moveu, insígnias, VIP, moedas...) não aparecem no chat
      if (ehAvisoAutomatico(msg)) return;
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
      notify(data.reason || "Você foi desconectado pelo anfitrião.", "warning");
      onLeaveRoom();
    };

    const handleRoomClosed = (data: { reason?: string }) => {
      notify(data.reason || "A sala foi encerrada pelo Dono da chamada.", "info");
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

    // Junta (não substitui): substituir apagava campos locais (stream, nível de áudio...)
    const handleVipGranted = (data: { participant: Participant; message?: string }) => {
      setRoom((prev) => ({
        ...prev,
        participants: prev.participants.map((p) => (p.id === data.participant.id ? { ...p, ...data.participant } : p)),
      }));
      if (data.participant.id === self.id) {
        setSelf((prev) => ({ ...prev, ...data.participant }));
      }
      if (selectedProfileParticipant && selectedProfileParticipant.id === data.participant.id) {
        setSelectedProfileParticipant((prev) => (prev ? { ...prev, ...data.participant } : data.participant));
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

    const handleCoinsReceived = (_data: { amount: number; senderName?: string; newBalance?: number; message?: string }) => {
      // Só aviso: o saldo é ajustado uma única vez em "coins:updated" (antes somava aqui E lá = dobrava)
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

      // Para mim: aplica só a diferença enviada (saldo real fica no meu aparelho)
      if (!targetId || targetId === self.id) {
        if (typeof data.amount === "number" && data.amount !== 0) {
          const atual = getKokiCoins();
          const updated = setKokiCoins(Math.max(0, atual + Math.floor(data.amount)));
          setSelf((prev) => ({ ...prev, kokiCoins: updated }));
          socket.emit("room:state-update", { kokiCoins: updated });
        } else if (typeof newCoins === "number") {
          setKokiCoins(newCoins);
          setSelf((prev) => ({ ...prev, kokiCoins: newCoins }));
        }
        return;
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
        // a lista do Dono substitui a guardada (assim insígnia removida some de vez)
        try { localStorage.setItem("eco_insignias_recebidas", JSON.stringify(data.badges)); } catch {}
      }
    };

    // O Dono removeu itens da loja: apaga daqui também, junto com o que eles liberavam
    const handleItensRemovidos = (data: { itens: string[]; limpar?: { avatar?: boolean; banner?: boolean; titulo?: boolean }; badges?: string[] }) => {
      if (!Array.isArray(data?.itens) || !data.itens.length) return;
      const perks = { ...getPurchasedPerks() };
      for (const id of data.itens) delete perks[id];
      salvarPerksExtras(perks);
      const mudancas: any = {};
      if (data.limpar?.avatar) mudancas.avatarUrl = undefined;
      if (data.limpar?.banner) mudancas.bannerUrl = undefined;
      if (data.limpar?.titulo) mudancas.customTitle = undefined;
      setSelf((prev) => {
        const badges = Array.isArray(data.badges) ? data.badges : data.itens.includes("vip_role") ? (prev.badges || []).filter((b) => b !== "vip_role") : prev.badges;
        return { ...prev, ...mudancas, purchasedPerks: perks, badges };
      });
      saveUserProfile({ ...mudancas, ...(Array.isArray(data.badges) ? { badges: data.badges } : {}) });
      notify("O Dono removeu um item da sua loja.", "info");
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
      if (!list) return;

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

      const selfInList = list.find((p) => p.id === self.id);
      if (selfInList) {
        setSelf((prev) => ({ ...prev, ...selfInList }));
      }

      // Mesh WebRTC Audio Connections:
      // When room:participants or voice:participants is received, create a new RTCPeerConnection for each remote participant
      list.forEach((p: Participant) => {
        if (p.id !== self.id && !peerConnectionsRef.current.has(p.id)) {
          createPeerConnection(p.id, true);
        }
      });

      // Clean up stale peer connections and audio elements for peers who left
      const activeIds = new Set(list.map((p) => p.id));
      peerConnectionsRef.current.forEach((pc, pId) => {
        // Conexão com invisível não está na lista de propósito: não fecha
        if (espectadoresRef.current.has(pId)) return;
        if (!activeIds.has(pId)) {
          pc.close();
          peerConnectionsRef.current.delete(pId);
          const audioEl = remoteAudioElementsRef.current.get(pId);
          if (audioEl) {
            audioEl.pause();
            audioEl.srcObject = null;
            audioEl.remove();
            remoteAudioElementsRef.current.delete(pId);
          }
          const tracker = remoteAudioTrackersRef.current.get(pId);
          if (tracker) {
            tracker.stop();
            remoteAudioTrackersRef.current.delete(pId);
          }
          remoteStreamsRef.current.delete(pId);
          remoteScreenStreamsRef.current.delete(pId);
          peerTransceiversRef.current.delete(pId);
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
          peerTransceiversRef.current.delete(peerId);
          createPeerConnection(peerId, true);
        }
      });
    };

    // Invisível saiu ou apareceu: fecha a conexão só-envio com ele
    const handleEspectadorFim = (data: { id?: string }) => {
      const id = data?.id;
      if (!id || !espectadoresRef.current.has(id)) return;
      espectadoresRef.current.delete(id);
      const elVoz = remoteAudioElementsRef.current.get(id);
      if (elVoz) { elVoz.pause(); elVoz.srcObject = null; elVoz.remove(); remoteAudioElementsRef.current.delete(id); }
      const pc = peerConnectionsRef.current.get(id);
      if (pc) {
        try { pc.close(); } catch { /* ignore */ }
        peerConnectionsRef.current.delete(id);
      }
      peerTransceiversRef.current.delete(id);
      pendingCandidatesRef.current.delete(id);
      makingOfferRef.current.delete(id);
      ignoreOfferRef.current.delete(id);
      isSettingRemoteAnswerPendingRef.current.delete(id);
      remoteStreamsRef.current.delete(id);
      remoteScreenStreamsRef.current.delete(id);
    };
    const handleInvisiveis = (data: { roomId?: string; invisiveis?: Participant[] }) => {
      if (data?.roomId && data.roomId !== roomRef.current.roomId) return;
      setInvisiveisNaSala(Array.isArray(data?.invisiveis) ? data.invisiveis.filter((g) => g.id !== socket.id) : []);
    };
    socket.on("espectador:fim", handleEspectadorFim);
    socket.on("sala:invisiveis", handleInvisiveis);

    socket.on("connect", handleSocketReconnect);
    socket.on("room:user-joined", handleUserJoined);
    socket.on("room:user_joined", handleUserJoined);
    socket.on("user-connected", handleUserJoined);
    socket.on("user_connected", handleUserJoined);
    socket.on("room:user-left", handleUserLeft);
    socket.on("room:user_left", handleUserLeft);
    socket.on("user-disconnected", handleUserLeft);
    socket.on("user_disconnected", handleUserLeft);
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
    const handleScreenShareStarted = (data: { userId: string; streamId?: string; trackId?: string; hasAudio?: boolean }) => {
      console.log(`[tela] Evento screen-share-started recebido de ${data.userId}, áudio: ${data.hasAudio}`);
      if (data.trackId) {
        knownScreenTrackIdsRef.current.set(data.userId, data.trackId);
      }
      if (typeof data.hasAudio === "boolean") {
        remoteScreenHasAudioRef.current.set(data.userId, data.hasAudio);
      }
      // A tela chega sempre pelo slot 2 da conexão com essa pessoa
      rebuildRemoteStreams(data.userId);
      if (!remoteScreenStreamsRef.current.has(data.userId)) {
        console.warn(`[tela] ainda não há conexão pronta com ${data.userId}; a tela aparece quando ela conectar`);
      }

      setRoom((prev) => ({
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === data.userId ? { ...p, isScreenSharing: true } : p
        ),
      }));

      setSpotlightId(`screen-${data.userId}`);
      setForceUpdate((prev) => prev + 1);
    };

    const handleScreenShareStopped = (data: { userId: string }) => {
      console.log(`[tela] Evento screen-share-stopped recebido de ${data.userId}`);
      knownScreenTrackIdsRef.current.delete(data.userId);
      // Mantém o stream do slot 2 (será reutilizado no próximo compartilhamento);
      // o card some porque isScreenSharing vira false.
      if (spotlightId === `screen-${data.userId}`) {
        setSpotlightId(null);
      }

      setRoom((prev) => ({
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === data.userId ? { ...p, isScreenSharing: false } : p
        ),
      }));
      setForceUpdate((prev) => prev + 1);
    };

    socket.on("screen-share-started", handleScreenShareStarted);
    socket.on("screen-share-stopped", handleScreenShareStopped);
    socket.on("host:knock-request", handleKnockRequest);
    socket.on("host:knock-cancelled", handleKnockCancelled);
    socket.on("vip:granted", handleVipGranted);
    socket.on("vip:revoked", handleVipRevoked);
    socket.on("vip:expired", handleVipRevoked);
    socket.on("coins:received", handleCoinsReceived);
    socket.on("coins:updated", handleCoinsUpdated);
    socket.on("badges:assigned", handleBadgesAssigned);
    socket.on("loja:itens-removidos", handleItensRemovidos);
    socket.on("voice:forced-channel-change", handleForcedChannelChange);

    if (isMaster || ((self as any).poderes || []).includes("porta")) {
      socket.emit("host:get-pending-knocks", (res: any) => {
        const knocks = Array.isArray(res) ? res : res?.knocks;
        if (Array.isArray(knocks)) setPendingKnocks(knocks);
      });
    }

    // Connect to all existing participants upon joining
    room.participants.forEach((p) => {
      if (p.id !== self.id) {
        createPeerConnection(p.id, true);
      }
    });

    return () => {
      socket.off("room:user-joined", handleUserJoined);
      socket.off("room:user_joined", handleUserJoined);
      socket.off("user-connected", handleUserJoined);
      socket.off("user_connected", handleUserJoined);
      socket.off("room:user-left", handleUserLeft);
      socket.off("room:user_left", handleUserLeft);
      socket.off("user-disconnected", handleUserLeft);
      socket.off("user_disconnected", handleUserLeft);
      socket.off("room:user-updated", handleUserUpdated);
      socket.off("room:user_updated", handleUserUpdated);
      socket.off("room:users-list", handleSyncUsersList);
      socket.off("room:users_list", handleSyncUsersList);
      socket.off("room:participants", handleSyncUsersList);
      socket.off("voice:participants", handleSyncUsersList);
      socket.off("room:sync", handleRoomSync);
      socket.off("espectador:fim", handleEspectadorFim);
      socket.off("sala:invisiveis", handleInvisiveis);
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
      socket.off("screen-share-started", handleScreenShareStarted);
      socket.off("screen-share-stopped", handleScreenShareStopped);
      socket.off("coins:received", handleCoinsReceived);
      socket.off("coins:updated", handleCoinsUpdated);
      socket.off("badges:assigned", handleBadgesAssigned);
      socket.off("loja:itens-removidos", handleItensRemovidos);
      socket.off("voice:forced-channel-change", handleForcedChannelChange);
      socket.off("connect", handleSocketReconnect);
    };
  }, [socket, self.id, self.isHost, isMaster, ((self as any).poderes || []).join(), isChatOpen, createPeerConnection, onLeaveRoom, selectedProfileParticipant?.id, spotlightId]);

  // 5.1 Desmutado pelo Dono + anti-spam do chat
  const [chatBloqueadoAte, setChatBloqueadoAte] = useState<number>(0);
  useEffect(() => {
    const handleForcedUnmute = (data?: { por?: string }) => {
      // Só libera: o mic continua desligado até a pessoa ligar
      setSelf((prev) => ({ ...prev, isMutedByHost: false }));
      notify(`${data?.por || "O Dono"} liberou seu microfone. Ligue quando quiser.`, "info");
    };
    const handleChatTimeout = (data: { segundos?: number; escopo?: string; mensagem?: string }) => {
      const seg = Math.max(1, Math.floor(Number(data?.segundos) || 30));
      if (data?.escopo !== "dm") setChatBloqueadoAte(Date.now() + seg * 1000);
    };
    socket.on("host:forced-unmute", handleForcedUnmute);
    socket.on("chat:timeout", handleChatTimeout);
    return () => {
      socket.off("host:forced-unmute", handleForcedUnmute);
      socket.off("chat:timeout", handleChatTimeout);
    };
  }, [socket]);

  // 6. Broadcast local media state changes (o nível do áudio não vai mais pro servidor: cada um mede o seu)
  useEffect(() => {
    if (invisivelRef.current) return;
    socket.emit("room:state-update", {
      hasAudio: !isAudioMuted && !self.isMutedByHost,
      hasVideo: !isVideoMuted && !preferences.lowResourceMode,
      isScreenSharing,
      isDeafened,
    });
  }, [isAudioMuted, isVideoMuted, isScreenSharing, isDeafened, preferences.lowResourceMode, self.isMutedByHost, socket]);

  // Toggle Microphone
  const avisarInvisivel = () => notify("Você está invisível. Clique em Aparecer para falar ou ligar câmera/tela.", "info");
  const handleToggleAudio = async () => {
    if (invisivelRef.current) return avisarInvisivel();
    if (self.isMutedByHost) return;

    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);

    // If activating/unmuting, re-acquire audio track if missing
    if (!nextMuted) {
      if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: buildMicConstraints(true),
            video: false,
          });
          const rawAudioTrack = micStream.getAudioTracks()[0];
          let newAudioTrack: MediaStreamTrack | undefined = rawAudioTrack;
          if (rawAudioTrack) {
            // Mesmo pipeline de IA do início da call
            if (micProcessorRef.current) micProcessorRef.current.close();
            const { track, proc } = await createProcessedMic(rawAudioTrack);
            micProcessorRef.current = proc;
            setMicProcessor(proc);
            newAudioTrack = track;
          }
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

      // Garante o microfone (trilha processada pela IA) no slot 0 de todas as conexões (sem renegociar)
      if (!nextMuted && audioTracks.length > 0) {
        syncLocalTracksToAllPeers();
        // Indicador de fala lê o sinal processado (depois da IA e do gate)
        if (!audioTrackerRef.current) {
          audioTrackerRef.current = new AudioVolumeTracker((level) => setLocalAudioLevel(level));
        }
        audioTrackerRef.current.start(localStreamRef.current);
      }
    }

    setSelf((prev) => ({ ...prev, hasAudio: !nextMuted }));
    socket.emit("room:state-update", { hasAudio: !nextMuted });
  };

  // Toggle Video Camera
  const handleToggleVideo = async () => {
    if (invisivelRef.current) return avisarInvisivel();
    if (preferences.lowResourceMode) return;

    if (!isVideoMuted) {
      // Turn off video
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
      }

      // Tira a câmera do slot 1 (sem renegociar)
      syncLocalTracksToAllPeers();

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

          // Coloca a câmera no slot 1 de todas as conexões (sem renegociar)
          syncLocalTracksToAllPeers();
        } else if (newVideoTrack) {
          localStreamRef.current = new MediaStream([newVideoTrack]);
          syncLocalTracksToAllPeers();
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
      await applyScreenShareQuality(localScreenStreamRef.current, presetId);
      void ajustarBandaTodos();
      setForceUpdate((prev) => prev + 1);
    }
  };

  // Toggle Screen Share with dedicated transceivers & instant replaceTrack (Default: 1080p @ 90 FPS)
  const stopScreenShare = () => {
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
        localScreenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      if (spotlightId === `screen-${self.id}` || spotlightId === self.id) {
        setSpotlightId(null);
      }

      // Esvazia os slots de tela (sem renegociar)
      syncLocalTracksToAllPeers();
      garantirAudioVivo("fim da tela");
      setTimeout(() => garantirAudioVivoRef.current("fim da tela +1s"), 1000);

      socket.emit("screen-share-stopped", { userId: self.id, roomId: room.roomId });
      socket.emit("room:state-update", { isScreenSharing: false });
      setForceUpdate((prev) => prev + 1);
  };

  const handleToggleScreenShare = async () => {
    if (invisivelRef.current && !localScreenStreamRef.current) return avisarInvisivel();
    if (isScreenSharing || localScreenStreamRef.current) {
      stopScreenShare();
    } else {
      try {
        const constraints = getDisplayMediaConstraints(screenQualityPreset);
        let screenStream: MediaStream;
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        } catch (errOpcoes: any) {
          // Navegador antigo que não entende alguma opção: tenta de novo com o básico
          if (errOpcoes?.name === "TypeError" || errOpcoes?.name === "OverconstrainedError") {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: (constraints as any).video, audio: true });
          } else {
            throw errOpcoes;
          }
        }

        const screenVideoTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];

        if (!screenVideoTrack) {
          screenStream.getTracks().forEach((t) => t.stop());
          return;
        }

        console.log(`[tela] compartilhamento iniciado: track id = ${screenVideoTrack.id}`);
        // "motion": o encoder prioriza movimento fluido (jogos, vídeos) em vez de nitidez parada
        try { (screenVideoTrack as any).contentHint = "motion"; } catch { /* ignore */ }

        // Áudio da tela: trilha própria (slot 3), tratada como música, nunca misturada no microfone
        if (screenAudioTrack) {
          try { (screenAudioTrack as any).contentHint = "music"; } catch { /* ignore */ }
          screenAudioTrack.enabled = true;
          const cfg: any = screenAudioTrack.getSettings ? screenAudioTrack.getSettings() : {};
          console.log("[tela] áudio da tela:", cfg);
          // Cancelamento de eco no áudio da tela: só quando o usuário escolheu "Ligado" no diagnóstico.
          // Automático = Desligado (no app Windows/Chromium antigo o AEC na trilha da tela calava o microfone).
          const querAec = lerTelaAec() === "on";
          if (cfg && typeof cfg.echoCancellation === "boolean" && cfg.echoCancellation !== querAec) {
            screenAudioTrack.applyConstraints({ echoCancellation: querAec } as any).catch(() => {});
          }
        }

        localScreenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        setSpotlightId(`screen-${self.id}`);


        // Native browser stop button listener (e.g. Chrome's "Stop sharing" ribbon)
        screenVideoTrack.onended = () => {
          console.log("[tela] compartilhamento encerrado pelo botão nativo do navegador.");
          stopScreenShare();
        };

        // Coloca a tela nos slots 2/3 de todas as conexões (sem renegociar)
        syncLocalTracksToAllPeers();
        somarMissao("tela", 1);
        // Proteção: microfone e vozes dos outros continuam vivos depois de começar a compartilhar
        garantirAudioVivo("início da tela");
        [800, 2500, 6000].forEach((ms) => setTimeout(() => garantirAudioVivoRef.current("início da tela +" + ms), ms));

        // Aplica qualidade depois que a trilha já está nos senders
        setTimeout(() => {
          applyScreenShareQuality(screenStream, screenQualityPreset);
          void ajustarBandaTodos();
        }, 300);

        // ONLY emit screen-share-started and room:state-update AFTER getDisplayMedia succeeds
        socket.emit("screen-share-started", {
          userId: self.id,
          streamId: screenStream.id,
          trackId: screenVideoTrack.id,
          hasAudio: Boolean(screenAudioTrack),
          roomId: room.roomId,
        });
        socket.emit("room:state-update", { isScreenSharing: true });

        const presetObj = SCREEN_SHARE_PRESETS[screenQualityPreset];
        setForceUpdate((prev) => prev + 1);
      } catch (err: any) {
        // User cancelled picker or permission denied: do not alert or tell other peers
        if (
          err?.name === "NotAllowedError" ||
          err?.name === "PermissionDeniedError" ||
          (err?.message && (err.message.includes("denied") || err.message.includes("cancelled") || err.message.includes("canceled")))
        ) {
          console.log("[tela] Usuário cancelou a janela de escolha de tela.");
        } else {
          console.warn("[tela] Falha ao capturar tela:", err);
        }
        setIsScreenSharing(false);
        return;
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
    if (invisivelRef.current) {
      notify("Você está invisível. Apareça para mandar mensagens.", "info");
      return;
    }
    somarMissao("mensagens", 1);
    const targetChannel = channelId || activeChannelId || "geral";
    socket.emit(
      "room:chat-message",
      {
        text: text.trim(),
        channelId: targetChannel,
        roomId: room.roomId,
      },
      (res: { success: boolean; message?: ChatMessage | string; error?: string; segundos?: number }) => {
        if (res && !res.success && typeof res.message === "string") {
          if (typeof res.segundos === "number") setChatBloqueadoAte(Date.now() + res.segundos * 1000);
          notify(res.message, "warning");
          return;
        }
        if (res && res.message && typeof res.message !== "string") {
          const nova = res.message as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === nova.id)) return prev;
            return [...prev, nova];
          });
        }
      }
    );
  };

  // Enviar print/foto/vídeo no chat
  const handleSendMedia = (
    files: { uploadId: string; name: string; width?: number; height?: number; spoiler?: boolean }[],
    text: string,
    channelId: string
  ): Promise<boolean> =>
    new Promise((resolve) => {
      socket
        .timeout(20000)
        .emit(
          "room:chat-media",
          { files, text: text.trim(), channelId: channelId || activeChannelId || "geral" },
          (err: any, res: { success: boolean; message?: ChatMessage | string }) => {
            if (err) {
              notify("O servidor não respondeu. Tente de novo.", "warning");
              return resolve(false);
            }
            if (!res?.success) {
              notify(typeof res?.message === "string" ? res.message : "Não deu pra enviar.", "warning");
              return resolve(false);
            }
            if (res.message && typeof res.message !== "string") {
              const nova = res.message as ChatMessage;
              setMessages((prev) => (prev.some((m) => m.id === nova.id) ? prev : [...prev, nova]));
            }
            resolve(true);
          }
        );
    });

  // Saldo real de moedas vai pro servidor ao entrar (evita saldo errado quando o Dono manda moedas)
  const enviarPerfilDaEntrada = () => {
    socket.emit("room:state-update", { kokiCoins: getKokiCoins() });
    // Itens da loja comprados antes continuam valendo ao entrar na call
    const perks = getPurchasedPerks();
    // "Membro desde" salvo: manda a data do primeiro acesso pra todos verem
    socket.emit("user:update-profile", { masterToken, memberSince: getMemberSince(), purchasedPerks: getPurchasedPerks() });
    if (perks && Object.keys(perks).length > 0) {
      socket.emit("user:update-profile", {
        masterToken,
        purchasedPerks: perks,
        avatarUrl: self.avatarUrl,
        bannerUrl: self.bannerUrl,
        customTitle: (self as any).customTitle,
        badges: perks["vip_role"] && perks["vip_role"] > Date.now() ? Array.from(new Set([...(self.badges || []), "vip_role"])) : self.badges,
      });
    }
  };
  useEffect(() => {
    // Invisível: o servidor ignora (não está na lista); manda quando Aparecer
    if (!invisivelRef.current) enviarPerfilDaEntrada();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Falar invisível: liga o microfone (1º clique) e depois alterna mudo/falando, sem aparecer
  const handleFalarInvisivel = async () => {
    if (!invisivelRef.current) return;
    const atual = vozInvisivelRef.current?.getAudioTracks()[0];
    if (atual) {
      atual.enabled = !atual.enabled;
      setVozInvisivel(atual.enabled ? "on" : "mudo");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: buildMicConstraints(true) });
    } catch {
      notify("Não consegui acessar o microfone.", "error");
      return;
    }
    const ok = await new Promise<boolean>((r) => socket.emit("invisivel:voz", { ligar: true }, (res: any) => r(Boolean(res?.ok))));
    if (!ok || !invisivelRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      notify("Não deu pra ligar a voz agora.", "error");
      return;
    }
    vozInvisivelRef.current = stream;
    const track = stream.getAudioTracks()[0];
    peerConnectionsRef.current.forEach((pc, id) => {
      const tr = peerTransceiversRef.current.get(id)?.audioTransceiver;
      if (!tr) return;
      try { tr.direction = "sendrecv"; } catch { /* ignore */ }
      tr.sender.replaceTrack(track).catch(() => {});
      sendOffer(id, pc);
    });
    setVozInvisivel("on");
    notify("Falando invisível: todos te ouvem, mas ninguém te vê na lista.", "success");
  };

  // Aparecer: sai do modo invisível. O servidor põe na lista e só então os outros criam conexão/card.
  const [revelando, setRevelando] = useState(false);
  const handleAparecer = (falarJa = false) => {
    if (!invisivelRef.current || revelando) return;
    setRevelando(true);
    socket.emit("sala:revelar", { masterToken }, (res: { success: boolean; message?: string; self?: Participant; room?: RoomState }) => {
      setRevelando(false);
      if (!res?.success) {
        notify(res?.message || "Não deu pra aparecer agora.", "error");
        return;
      }
      // Antes da lista nova chegar: fecha as conexões só-recebe (a entrada normal recria tudo)
      invisivelRef.current = false;
      vozInvisivelRef.current?.getTracks().forEach((t) => t.stop());
      vozInvisivelRef.current = null;
      setVozInvisivel("off");
      peerConnectionsRef.current.forEach((pc) => {
        try { pc.close(); } catch { /* ignore */ }
      });
      peerConnectionsRef.current.clear();
      peerTransceiversRef.current.clear();
      remoteStreamsRef.current.clear();
      remoteScreenStreamsRef.current.clear();
      pendingCandidatesRef.current.clear();
      makingOfferRef.current.clear();
      ignoreOfferRef.current.clear();
      isSettingRemoteAnswerPendingRef.current.clear();
      offerFallbackTimersRef.current.forEach((t) => clearTimeout(t));
      offerFallbackTimersRef.current.clear();
      remoteAudioElementsRef.current.forEach((el) => {
        el.pause();
        el.srcObject = null;
        el.remove();
      });
      remoteAudioElementsRef.current.clear();
      remoteAudioTrackersRef.current.forEach((t) => t.stop());
      remoteAudioTrackersRef.current.clear();
      setInvisivel(false);
      if (res.self) setSelf((prev) => ({ ...prev, ...res.self!, invisivel: false } as Participant));
      onRevelado?.();
      socket.emit("room:state-update", { hasAudio: false, hasVideo: false, isScreenSharing: false, isDeafened });
      enviarPerfilDaEntrada();
      setForceUpdate((prev) => prev + 1);
      notify("Agora você aparece para todos na sala.", "success");
      if (falarJa) window.setTimeout(() => handleToggleAudio(), 150);
    });
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

  const avisarSeFalhou = (res: { success?: boolean; message?: string } | undefined) => {
    if (res && res.success === false && res.message) notify(res.message, "error");
  };

  // Mutar / Desmutar: o mesmo botão alterna conforme a pessoa já está mutada pelo Dono
  const handleHostMuteUser = (targetUserId: string) => {
    const alvo = room.participants.find((p) => p.id === targetUserId);
    if (alvo && !alvoModeravel(alvo)) {
      notify("Você não pode fazer isso com essa pessoa.", "error");
      return;
    }
    socket.emit("host:action", { type: alvo?.isMutedByHost ? "unmute-user" : "mute-user", targetUserId }, avisarSeFalhou);
  };

  const handleHostUnmuteUser = (targetUserId: string) => {
    socket.emit("host:action", { type: "unmute-user", targetUserId }, avisarSeFalhou);
  };

  // Expulsar da call agora (sem prazo) — segue o poder "expulsar" do cargo
  const handleHostKickNow = (targetUserId: string) => {
    socket.emit("host:action", { type: "kick-user", targetUserId }, avisarSeFalhou);
  };

  // "Expulsar" abre a janela com as 3 opções: tirar da call, suspender ou banir do app
  const [alvoPunir, setAlvoPunir] = useState<Participant | null>(null);
  const handleHostKickUser = (targetUserId: string) => {
    const alvo = room.participants.find((p) => p.id === targetUserId) || (selectedProfileParticipant?.id === targetUserId ? selectedProfileParticipant : null);
    if (alvo && !alvoModeravel(alvo)) {
      notify("Você não pode fazer isso com essa pessoa.", "error");
      return;
    }
    if (alvo) setAlvoPunir(alvo);
    else handleHostKickNow(targetUserId);
  };

  // Expulsar da call / Banir do servidor-sala / Banir do app (online ou offline: alvo.id pode ser "membro:<chave>")
  const handlePunir = (alvo: Participant, acao: "expulsar" | "sala" | "app", minutos: number | null, motivo: string) =>
    new Promise<{ ok: boolean; mensagem?: string }>((resolve) => {
      const timer = window.setTimeout(() => resolve({ ok: false, mensagem: "O servidor não respondeu. Tente de novo." }), 10000);
      const fim = (res: { success?: boolean; message?: string } | undefined, okPadrao: string) => {
        window.clearTimeout(timer);
        const ok = res ? res.success !== false : true;
        if (ok) notify(res?.message || okPadrao, "success");
        resolve({ ok, mensagem: res?.message });
      };
      const naSala = room.participants.some((p) => p.id === alvo.id);
      // Cargo com poder "expulsar" (não é Dono/Co-fundador): usa o expulsar da sala, que confere o poder no servidor
      if (acao === "expulsar" && naSala && !podeBanir) {
        socket.emit("host:action", { type: "kick-user", targetUserId: alvo.id }, (res: any) => fim(res, `${alvo.name} foi expulso da call.`));
        return;
      }
      socket.emit(
        "host:punir",
        { alvo: alvo.id, acao, minutos: minutos ?? null, permanente: acao !== "expulsar" && minutos === null, motivo, salaId: room.roomId, masterToken },
        (res: { success: boolean; message?: string }) => fim(res, "Feito.")
      );
    });

  const handleHostUpdateSettings = (settings: Partial<RoomState["settings"]>) => {
    socket.emit("host:action", { type: "update-settings", settings });
  };

  const handleCloseRoomForAll = () => {
    socket.emit("host:action", { type: "close-room" }, (res: { success: boolean; message?: string }) => {
      if (res && res.success) {
        notify("Sala encerrada com sucesso.", "info");
        onLeaveRoom();
      } else if (res && res.message) {
        notify(res.message, "error");
      }
    });
  };

  const handleClaimHost = (passcode: string) => {
    socket.emit("host:action", { type: "claim-host", passcode }, (res: { success: boolean; message?: string }) => {
      notify(res.message || (res.success ? "Controle Master assumido com sucesso!" : "Erro ao assumir controle"), res.success ? "success" : "error");
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
          notify("Permissões VIP concedidas!", "success");
          if (res.participant) {
            setRoom((prev) => ({
              ...prev,
              participants: prev.participants.map((p) => (p.id === res.participant!.id ? res.participant! : p)),
            }));
          }
        } else if (res && res.message) {
          notify(res.message, "error");
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
          notify(res.message, "error");
        } else {
          notify("VIP revogado.", "info");
        }
      }
    );
  };

  // Host Give Eco Coins directly to participant
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
          notify(res.message, "error");
        } else if (res && res.success) {
          notify("Moedas concedidas com sucesso!", "success");
        }
      }
    );
  };

  // Dono Master dá ou tira cargo
  // Portinha: sai do servidor (some da lista de membros e de "Minhas salas") e sai da call
  // Barras laterais recolhidas pro lado (lembra no aparelho)
  const [esquerdaRecolhida, setEsquerdaRecolhida] = useState(() => localStorage.getItem("eco:barraEsq") === "1");
  const [direitaRecolhida, setDireitaRecolhida] = useState(() => localStorage.getItem("eco:barraDir") === "1");
  const alternarEsquerda = () => setEsquerdaRecolhida((v) => { localStorage.setItem("eco:barraEsq", v ? "0" : "1"); return !v; });
  const alternarDireita = () => setDireitaRecolhida((v) => { localStorage.setItem("eco:barraDir", v ? "0" : "1"); return !v; });

  const handleSairServidor = () => {
    const rid = room.roomId;
    socket.emit("sala:sair", { roomId: rid }, () => {
      esquecerSala(rid);
      onLeaveRoom();
    });
  };

  const handleDefinirCargo = (alvo: string, cargo: string, poderes: string[]) => {
    socket.emit("membros:cargo", { alvo, cargo, poderes, masterToken }, (res: { success: boolean; message?: string; cargo?: string; poderes?: string[] }) => {
      if (res?.success) {
        notify(res.cargo ? `Cargo definido: ${res.cargo}` : "Cargo removido.", "success");
        setMembrosVersao((v) => v + 1);
        if (selectedProfileParticipant?.id === alvo) setSelectedProfileParticipant((prev) => (prev ? ({ ...prev, cargo: res.cargo || undefined, poderes: res.poderes || [] } as any) : null));
      } else if (res?.message) notify(res.message, "error");
    });
  };

  // Dono Master / Co-fundador libera (ou tira) a troca de aura do card (online ou offline "membro:<chave>")
  const handleLiberarAura = (alvo: string, liberado: boolean) =>
    new Promise<{ success: boolean; message?: string; auraLiberadaPor?: "dono" | "cofundador" }>((ok) => {
      const t = setTimeout(() => ok({ success: false, message: "O servidor não respondeu." }), 8000);
      socket.emit("membros:aura-liberar", { alvo, liberado, masterToken }, (res: any) => {
        clearTimeout(t);
        if (res?.success) {
          notify(liberado ? "Aura liberada." : "Aura bloqueada e removida.", "success");
          setMembrosVersao((v) => v + 1);
          if (selectedProfileParticipant?.id === alvo)
            setSelectedProfileParticipant((prev) =>
              prev ? ({ ...prev, auraLiberada: Boolean(res.auraLiberada), auraLiberadaPor: res.auraLiberadaPor, ...(liberado ? {} : { auraCard: undefined }) } as any) : null
            );
        }
        ok(res || { success: false });
      });
    });

  // Dono Master tira um item comprado na loja de alguém (online ou offline)
  const handleRemoverItemLoja = (alvo: string, itemId: string) => {
    socket.emit("loja:remover-item", { alvo, itemId, masterToken }, (res: { success: boolean; message?: string }) => {
      if (res?.success) {
        notify("Item removido.", "success");
        setMembrosVersao((v) => v + 1);
      } else if (res?.message) notify(res.message, "error");
    });
  };

  // Host / Master Assign Custom Badges directly to member
  const [membrosVersao, setMembrosVersao] = useState(0);
  const handleHostAssignBadges = (targetSocketId: string, badges: string[]) => {
    // Membro offline ou em outra sala: muda pela chave da pessoa
    if (targetSocketId.startsWith("membro:")) {
      socket.emit(
        "membros:insignias",
        { chave: targetSocketId.slice(7), badges, masterToken },
        (res: { success: boolean; message?: string; badges?: string[] }) => {
          if (res?.success) {
            notify("Insígnias atualizadas!", "success");
            setMembrosVersao((v) => v + 1);
            if (selectedProfileParticipant?.id === targetSocketId) setSelectedProfileParticipant((prev) => (prev ? { ...prev, badges: res.badges || [] } : null));
          } else if (res?.message) notify(res.message, "error");
        }
      );
      return;
    }
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
          notify("Insígnias atualizadas!", "success");
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
          notify(res.message, "error");
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

  // Se o servidor diz que você está em outro canal (ex.: foi arrastado), acompanha
  useEffect(() => {
    const eu = room.participants.find((p) => p.id === self.id);
    if (eu?.voiceChannelId && eu.voiceChannelId !== activeVoiceChannelId) {
      setActiveVoiceChannelId(eu.voiceChannelId);
    }
  }, [room.participants, self.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Só mostra na tela quem está no MESMO canal de voz que você
  const meuCanalDeVoz = activeVoiceChannelId || self.voiceChannelId || "voice-geral";
  const mesmoCanalDeVoz = (p: Participant) =>
    p.id === self.id || (p.voiceChannelId || "voice-geral") === meuCanalDeVoz;

  const activeScreenShares: ScreenShareItem[] = [
    ...(isScreenSharing && localScreenStreamRef.current
      ? [{ participant: self, isSelf: true, stream: localScreenStreamRef.current }]
      : []),
    ...room.participants
      .filter(
        (p) =>
          p.id !== self.id &&
          p.isScreenSharing &&
          mesmoCanalDeVoz(p)
      )
      .map((p) => ({
        participant: p,
        isSelf: false,
        stream: remoteScreenStreamsRef.current.get(p.id) || null,
      })),
  ];

  // When someone shares screen, the transmission occupies center large and avatars/cameras thumbnail below
  const activeSpotlightScreen = spotlightId?.startsWith("screen-")
    ? activeScreenShares.find(
        (s) => s.participant.id === spotlightId.replace("screen-", "")
      )
    : activeScreenShares.length > 0
    ? activeScreenShares[0]
    : null;

  // Active Spotlight Participant Camera (if not screen spotlight)
  const activeSpotlight =
    spotlightId && !activeSpotlightScreen
      ? room.participants.find((p) => p.id === spotlightId && mesmoCanalDeVoz(p)) ||
        (spotlightId === self.id ? self : null)
      : null;

  const displayParticipants = isMockupDemoActive
    ? [
        ...room.participants,
        ...DEMO_PARTICIPANTS.filter((dp) => !room.participants.some((p) => p.id === dp.id)),
      ]
    : room.participants.filter(mesmoCanalDeVoz);

  const totalGridTiles = activeScreenShares.length + displayParticipants.length;

  const isUserMaster = Boolean(isMaster);
  // Poderes do cargo (Moderador etc.)
  const meusPoderes: string[] = Array.isArray((self as any).poderes) ? (self as any).poderes : [];
  const ehCofundador = Boolean(self.isCofundador && !isMaster);
  const podeMutar = Boolean(isMaster || ehCofundador || meusPoderes.includes("mutar"));
  const podeExpulsar = Boolean(isMaster || ehCofundador || meusPoderes.includes("expulsar"));
  const podePorta = Boolean(isMaster || ehCofundador || meusPoderes.includes("porta"));
  const podeBanir = Boolean(isMaster || ehCofundador);
  // Em quem posso agir: nunca no Dono Master; o Co-fundador não age em outro Co-fundador; cargo não age em cargo
  const alvoModeravel = (p: Participant | null | undefined) => {
    if (!p || p.id === self.id || String(p.id).startsWith("membro:")) return false;
    if (p.isMaster || (p as any).invisivel) return false;
    if (isMaster) return true;
    if (p.isCofundador) return false;
    if (ehCofundador) return true;
    return !(p as any).cargo;
  };
  // Banir (sala/app): só Dono Master e Co-fundador. Vale pra quem está offline ("membro:<chave>") também.
  const alvoBanivel = (p: Participant | null | undefined) => {
    if (!podeBanir || !p || p.id === self.id) return false;
    if ((p as any).invisivel && !String(p.id).startsWith("membro:")) return false;
    if (p.isMaster || (p as any).ehDono) return false;
    if (String(p.id).startsWith("membro:") && p.name === self.name && String(p.tag || "") === String(self.tag || "")) return false;
    if (isMaster) return true;
    return !p.isCofundador;
  };
  /** Pode abrir a janela Punir (expulsar da call pelo cargo, ou banir) */
  const alvoPunivel = (p: Participant | null | undefined) => Boolean((podeExpulsar && alvoModeravel(p)) || alvoBanivel(p));
  // Amigos e conversas privadas
  const [isAmigosOpen, setIsAmigosOpen] = useState(false);
  const [conversaInicial, setConversaInicial] = useState<{ uid: string; nome: string } | null>(null);
  const [amigosPendentes, setAmigosPendentes] = useState(0);
  const podeModerar = podeMutar || podeExpulsar || isUserMaster;
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
    <div
      className={`h-screen w-full flex flex-col overflow-hidden relative isolate transition-colors duration-200 ${
        isDarkTheme
          ? "bg-[#070b14] text-slate-100"
          : "bg-gradient-to-br from-[#f0f6ff] via-[#e8f2fe] to-[#edf5fd] text-slate-800"
      }`}
    >
      <TemaFundo tema={temaSala} />
      {/* Floating Admission Banner for Master when users are knocking */}
      {podePorta && (
        <FloatingAdmissionBanner
          pendingKnocks={pendingKnocks}
          onApprove={handleApproveKnock}
          onReject={handleRejectKnock}
          onOpenAdmissionModal={() => setIsAdmissionOpen(true)}
        />
      )}

      {/* Top Header */}
      <Header
        room={{ ...room, participants: displayParticipants }}
        self={self}
        isMaster={isUserMaster}
        isCofundador={Boolean(self.isCofundador)}
        hasVipBadge={hasVipBadge}
        lowResourceMode={preferences.lowResourceMode}
        pingMs={pingMs}
        pendingKnocksCount={pendingKnocks.length}
        kokiCoins={self.kokiCoins}
        isDarkTheme={isDarkTheme}
        onToggleTheme={handleToggleTheme}
        isMockupDemoActive={isMockupDemoActive}
        onToggleMockupDemo={() => setIsMockupDemoActive(!isMockupDemoActive)}
        isChannelsOpen={isChannelsSidebarOpen}
        onToggleChannels={() => setIsChannelsSidebarOpen(!isChannelsSidebarOpen)}
        onOpenStore={() => setIsStoreOpen(true)}
        onOpenMissoes={() => setIsMissoesOpen(true)}
        onOpenRoleta={() => setIsRoletaOpen(true)}
        onOpenRank={() => setIsRankOpen(true)}
        onOpenAmigos={() => setIsAmigosOpen(true)}
        amigosPendentes={amigosPendentes}
        onOpenExtras={(aba) => setAbaExtras(aba)}
        onOpenInvite={() => setIsInviteOpen(true)}
        onOpenHostPanel={() => setIsHostPanelOpen(true)}
        onOpenAdmissionModal={() => setIsAdmissionOpen(true)}
        onOpenOwnerProfile={() => setIsOwnerProfileOpen(true)}
        onToggleLowResource={handleToggleLowResource}
        onLeaveRoom={onLeaveRoom}
      />

      {/* Aviso do Dono Master + Chuva de moedas */}
      <AnuncioBanner socket={socket} />
      <ChuvaMoedas socket={socket} />
      <SalaDiversao
        socket={socket}
        selfId={self.id}
        podeTema={Boolean(self.isHost || isUserMaster)}
        isMaster={Boolean(isUserMaster)}
        masterToken={masterToken}
        participantes={room.participants.map((p) => ({ id: p.id, name: p.name }))}
        onTema={setTemaSala}
      />

      {rotaConexao.total > 0 && (
        <div
          className="fixed bottom-24 left-3 z-[60] px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/60 backdrop-blur text-white/90 border border-white/10 pointer-events-auto"
          title={rotaConexao.relay > 0 ? "Parte da call passa por um servidor de retransmissão (TURN). É mais lento que a conexão direta." : "Conexão direta entre vocês (P2P), a mais rápida."}
        >
          <span className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${rotaConexao.relay > 0 ? "bg-amber-400" : "bg-emerald-400"}`} />
          {rotaConexao.relay > 0 ? `Via servidor (${rotaConexao.relay}/${rotaConexao.total})` : "Conexão direta"} · {rotaConexao.rttMs} ms
        </div>
      )}
      {/* Modo invisível: só quem está invisível vê este aviso */}
      {invisivel && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] max-w-[92vw]">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-2xl border border-[#C4B5FD]/40 bg-[#1E2026]/95 backdrop-blur-md px-3 sm:px-4 py-2 shadow-2xl">
            <span className="flex items-center gap-2 text-[12px] sm:text-[13px] font-semibold text-[#ECECEC]">
              <span className="w-7 h-7 rounded-full bg-[#C4B5FD]/15 border border-[#C4B5FD]/40 flex items-center justify-center text-[#C4B5FD]">
                <Ghost className="w-4 h-4" />
              </span>
              <span>
                Você está invisível nesta sala
                <span className="block text-[10px] sm:text-[11px] font-normal text-[#8B8F98]">{vozInvisivel === "off" ? "Você vê e ouve todos. Ninguém vê, ouve ou sabe que você está aqui." : "Todos ouvem sua voz, mas ninguém te vê na lista."}</span>
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={revelando}
                onClick={handleFalarInvisivel}
                className={`flex items-center gap-1.5 rounded-xl text-xs font-bold px-3 py-1.5 cursor-pointer disabled:opacity-60 border ${vozInvisivel === "on" ? "bg-[#C4B5FD] text-[#16171B] border-[#C4B5FD]" : "border-[#C4B5FD]/50 text-[#C4B5FD] hover:bg-[#C4B5FD]/10"}`}
                title={vozInvisivel === "off" ? "Falar sem aparecer na lista" : vozInvisivel === "on" ? "Mutar" : "Desmutar"}
              >
                <Ghost className="w-3.5 h-3.5" />
                <span>{vozInvisivel === "off" ? "Falar invisível" : vozInvisivel === "on" ? "Falando… (mutar)" : "Mudo (falar)"}</span>
              </button>
              <button
                type="button"
                disabled={revelando}
                onClick={() => handleAparecer(false)}
                className="flex items-center gap-1.5 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-xs font-black px-3 py-1.5 cursor-pointer disabled:opacity-60"
                title="Sair do modo invisível e entrar normalmente"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{revelando ? "Aparecendo..." : "Aparecer"}</span>
              </button>
              <button
                type="button"
                disabled={revelando}
                onClick={() => handleAparecer(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[#C4B5FD]/50 text-[#C4B5FD] hover:bg-[#C4B5FD]/10 text-xs font-bold px-3 py-1.5 cursor-pointer disabled:opacity-60"
                title="Aparecer e já ligar o microfone"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Aparecer e falar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area: Channel Navigation Sidebar, Video Grid & Drawers */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Text and Voice Channels */}
        <ChannelSidebar
          recolhida={esquerdaRecolhida}
          onAlternarRecolhida={alternarEsquerda}
          roomName={room.roomName}
          roomId={room.roomId}
          textChannels={room.channels && room.channels.length > 0 ? room.channels : defaultTextChannels}
          voiceChannels={defaultVoiceChannels}
          activeTextChannelId={activeChannelId}
          activeVoiceChannelId={activeVoiceChannelId}
          onSelectTextChannel={handleSelectTextChannel}
          onSelectVoiceChannel={handleSelectVoiceChannel}
          self={self}
          participants={displayParticipants}
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
          isDarkTheme={isDarkTheme}
          onMoveMember={handleMoveToVoiceChannel}
        />

        <main className="flex-1 p-3 sm:p-5 pb-28 sm:pb-32 overflow-y-auto flex flex-col justify-center items-center">
          {/* Mockup Demo mode active banner */}
          {isMockupDemoActive && (
            <div className="mb-3 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-300 text-sky-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping shrink-0" />
              <span>Mockup Desktop: layout limpo em tons de azul-claro confortável com cards e barra flutuante</span>
              <button
                onClick={() => setIsMockupDemoActive(false)}
                className="ml-2 text-sky-600 hover:text-sky-900 underline text-[11px] font-bold cursor-pointer"
              >
                Fechar Demo
              </button>
            </div>
          )}

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
                  onStopScreenShare={handleToggleScreenShare}
                />
              </div>

              {/* Mini participant ribbon below spotlight containing ALL camera feeds */}
              <div className="h-28 flex items-center gap-2.5 overflow-x-auto pb-1 px-1">
                {/* Self camera tile */}
                <div className="w-44 h-full shrink-0">
                  <VideoTile
                    participant={self}
                    isSelf={true}
                    isHostViewer={podeModerar}
                    stream={localStreamRef.current}
                    audioLevel={localAudioLevel}
                    lowResourceMode={preferences.lowResourceMode}
                    isDarkTheme={isDarkTheme}
                    onToggleSpotlight={() => setSpotlightId(self.id)}
                    onSelectProfile={(p) => setSelectedProfileParticipant(p)}
                  />
                </div>

                {/* Other participants' camera feeds */}
                {displayParticipants
                  .filter((p) => p.id !== self.id)
                  .map((p) => (
                    <div key={p.id} className="w-44 h-full shrink-0">
                      <VideoTile
                        participant={p}
                        isSelf={false}
                        isHostViewer={podeModerar}
                        stream={remoteStreamsRef.current.get(p.id)}
                        audioLevel={p.audioLevel}
                        lowResourceMode={preferences.lowResourceMode}
                        userVolume={participantVolumes[p.id] ?? 100}
                        masterVoiceVolume={masterVoiceVolume}
                        currentVoiceChannelId={activeVoiceChannelId}
                        isDarkTheme={isDarkTheme}
                        onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
                        onToggleSpotlight={() => setSpotlightId(p.id)}
                        onHostMute={podeMutar ? handleHostMuteUser : undefined}
                        onHostKick={podeExpulsar ? handleHostKickUser : undefined}
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
                  isHostViewer={podeModerar}
                  stream={activeSpotlight.id === self.id ? localStreamRef.current : remoteStreamsRef.current.get(activeSpotlight.id)}
                  audioLevel={activeSpotlight.id === self.id ? localAudioLevel : 0}
                  lowResourceMode={preferences.lowResourceMode}
                  isSpotlight={true}
                  userVolume={participantVolumes[activeSpotlight.id] ?? 100}
                  masterVoiceVolume={masterVoiceVolume}
                  currentVoiceChannelId={activeVoiceChannelId}
                  isDarkTheme={isDarkTheme}
                  onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
                  onToggleSpotlight={() => setSpotlightId(null)}
                  onHostMute={podeMutar ? handleHostMuteUser : undefined}
                  onHostKick={podeExpulsar ? handleHostKickUser : undefined}
                  onSelectProfile={(p) => setSelectedProfileParticipant(p)}
                  onVolumeChange={handleVolumeChange}
                />
              </div>

              {/* Mini participant ribbon below spotlight */}
              <div className="h-28 flex items-center gap-2.5 overflow-x-auto pb-1 px-1">
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

                {activeSpotlight.id !== self.id && (
                  <div className="w-44 h-full shrink-0">
                    <VideoTile
                      participant={self}
                      isSelf={true}
                      isHostViewer={podeModerar}
                      stream={localStreamRef.current}
                      audioLevel={localAudioLevel}
                      lowResourceMode={preferences.lowResourceMode}
                      isDarkTheme={isDarkTheme}
                      onToggleSpotlight={() => setSpotlightId(self.id)}
                      onSelectProfile={(p) => setSelectedProfileParticipant(p)}
                    />
                  </div>
                )}

                {displayParticipants
                  .filter((p) => p.id !== self.id && p.id !== activeSpotlight.id)
                  .map((p) => (
                    <div key={p.id} className="w-44 h-full shrink-0">
                      <VideoTile
                        participant={p}
                        isSelf={false}
                        isHostViewer={podeModerar}
                        stream={remoteStreamsRef.current.get(p.id)}
                        audioLevel={p.audioLevel}
                        lowResourceMode={preferences.lowResourceMode}
                        userVolume={participantVolumes[p.id] ?? 100}
                        masterVoiceVolume={masterVoiceVolume}
                        currentVoiceChannelId={activeVoiceChannelId}
                        isDarkTheme={isDarkTheme}
                        onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
                        onToggleSpotlight={() => setSpotlightId(p.id)}
                        onHostMute={podeMutar ? handleHostMuteUser : undefined}
                        onHostKick={podeExpulsar ? handleHostKickUser : undefined}
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
              className={`w-full h-full max-w-7xl mx-auto grid gap-4 items-center content-center ${
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
                isHostViewer={podeModerar}
                stream={localStreamRef.current}
                audioLevel={localAudioLevel}
                lowResourceMode={preferences.lowResourceMode}
                isDarkTheme={isDarkTheme}
                onToggleSpotlight={() => setSpotlightId(self.id)}
                onSelectProfile={(p) => setSelectedProfileParticipant(p)}
              />

              {/* Remote Participants Camera / Avatar Tiles */}
              {displayParticipants
                .filter((p) => p.id !== self.id)
                .map((p) => (
                  <VideoTile
                    key={`grid-cam-${p.id}`}
                    participant={p}
                    isSelf={false}
                    isHostViewer={podeModerar}
                    stream={remoteStreamsRef.current.get(p.id)}
                    audioLevel={p.audioLevel}
                    lowResourceMode={preferences.lowResourceMode}
                    userVolume={participantVolumes[p.id] ?? 100}
                    masterVoiceVolume={masterVoiceVolume}
                    currentVoiceChannelId={activeVoiceChannelId}
                    isDarkTheme={isDarkTheme}
                    onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
                    onToggleSpotlight={() => setSpotlightId(p.id)}
                    onHostMute={podeMutar ? handleHostMuteUser : undefined}
                    onHostKick={podeExpulsar ? handleHostKickUser : undefined}
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
          isDarkTheme={isDarkTheme}
          onClose={() => setIsChatOpen(false)}
          onSendMessage={handleSendMessage}
          bloqueadoAte={chatBloqueadoAte}
          onSendMedia={handleSendMedia}
          socketId={socket.id}
          roomId={room.roomId}
        />

        {/* Discord Member List Drawer */}
        {isMemberListOpen && (
          <MemberList
            participants={isMockupDemoActive ? displayParticipants : room.participants}
            selfId={self.id}
            selfIsHost={podePorta}
            pendingKnocks={pendingKnocks}
            isDarkTheme={isDarkTheme}
            onApproveKnock={handleApproveKnock}
            onRejectKnock={handleRejectKnock}
            onSelectParticipant={(p) => setSelectedProfileParticipant(p)}
            onClose={() => setIsMemberListOpen(false)}
            socket={socket}
            roomId={room.roomId}
            versao={membrosVersao}
            mostrarOffline={Boolean(isMaster || ehCofundador)}
            podePunir={(p) => alvoPunivel(p)}
            onPunir={(p) => setAlvoPunir(p)}
            onSairServidor={handleSairServidor}
            recolhida={direitaRecolhida}
            onAlternarRecolhida={alternarDireita}
            masterToken={masterToken}
            podeGerenciar={Boolean(isMaster || self.isCofundador)}
            onAbrirInsignias={(p) => {
              setTargetBadgeParticipant(p);
              setIsGrantBadgesOpen(true);
            }}
            invisiveis={isMaster || self.isCofundador ? invisiveisNaSala : undefined}
            souInvisivel={invisivel}
            onEntrarInvisivel={onEntrarInvisivel}
          />
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <ControlBar
        salasSlot={salasSlot}
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
        isMaster={Boolean(isMaster)}
        isDarkTheme={isDarkTheme}
        onToggleTheme={handleToggleTheme}
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
          isHostViewer={Boolean(isMaster || self.isCofundador)}
          onToggleCofundador={isMaster ? (pp: Participant, ativo: boolean) => socket.emit("master:set-cofundador", { targetSocketId: pp.id, ativo, masterToken }) : undefined}
          userVolume={participantVolumes[selectedProfileParticipant.id] ?? 100}
          onVolumeChange={(newVol) => handleVolumeChange(selectedProfileParticipant.id, newVol)}
          onMoveToVoiceChannel={isUserMaster ? handleMoveToVoiceChannel : undefined}
          onMuteParticipant={podeMutar && alvoModeravel(selectedProfileParticipant) ? handleHostMuteUser : undefined}
          onKickParticipant={podeExpulsar && alvoModeravel(selectedProfileParticipant) ? handleHostKickUser : undefined}
          onPunirParticipant={alvoPunivel(selectedProfileParticipant) ? (p) => setAlvoPunir(p) : undefined}
          onEntrarInvisivel={(() => {
            if (!onEntrarInvisivel || selectedProfileParticipant.id === self.id) return undefined;
            const alvo: any = selectedProfileParticipant;
            if (alvo.invisivel && !String(alvo.id).startsWith("membro:")) return undefined;
            // Online nesta sala = esta sala; offline/outra sala = a sala dele (vem do servidor só pro Dono/Co-fundador)
            const sala: string | undefined = String(alvo.id).startsWith("membro:") ? alvo.salaInvisivel : room.roomId;
            if (!sala || (invisivel && sala === room.roomId)) return undefined;
            return () => {
              setSelectedProfileParticipant(null);
              onEntrarInvisivel(sala);
            };
          })()}
          socket={socket}
          onAbrirConversa={(uid, nome) => {
            setConversaInicial({ uid, nome });
            setIsAmigosOpen(true);
            setSelectedProfileParticipant(null);
          }}
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
      {(isMaster || self.isCofundador) && isGrantVipOpen && targetVipParticipant && (
        <GrantVipModal
          isOpen={isGrantVipOpen}
          targetParticipant={targetVipParticipant}
          onClose={() => {
            setIsGrantVipOpen(false);
            setTargetVipParticipant(null);
          }}
          onGrantVip={handleHostGrantVip}
          podeRemover={Boolean(isMaster)}
          onRevokeVip={handleHostRevokeVip}
        />
      )}

      {/* Grant / Manage Custom Badges Modal (For Master and Host) */}
      {(isMaster || self.isCofundador) && isGrantBadgesOpen && targetBadgeParticipant && (
        <GrantBadgesModal
          isOpen={isGrantBadgesOpen}
          targetParticipant={targetBadgeParticipant}
          onClose={() => {
            setIsGrantBadgesOpen(false);
            setTargetBadgeParticipant(null);
          }}
          onAssignBadges={handleHostAssignBadges}
          podeRemover={Boolean(isMaster || self.isCofundador)}
          ehDono={Boolean(isMaster)}
          onRemoverItem={isMaster ? handleRemoverItemLoja : undefined}
          onDefinirCargo={isMaster ? handleDefinirCargo : undefined}
          onLiberarAura={isMaster || self.isCofundador ? handleLiberarAura : undefined}
          quemLiberaAura={isMaster ? "dono" : "cofundador"}
          onDarMoedas={handleHostGiveCoins}
          onPunir={alvoPunivel(targetBadgeParticipant) ? (p) => setAlvoPunir(p) : undefined}
          buscarCompras={
            isMaster
              ? (alvo) =>
                  new Promise((ok) => {
                    socket.emit("membros:compras", { alvo, masterToken }, (res: { success: boolean; compras?: any }) => ok(res?.success ? res.compras || {} : {}));
                    setTimeout(() => ok({}), 6000);
                  })
              : undefined
          }
        />
      )}

      {/* Owner Admission / Portaria Modal */}
      {podePorta && (
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

      {diagAberto && <AudioDiagnostico onFechar={() => setDiagAberto(false)} />}
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
        isDarkTheme={isDarkTheme}
        onToggleTheme={handleToggleTheme}
        isMockupDemoActive={isMockupDemoActive}
        onToggleMockupDemo={() => setIsMockupDemoActive(!isMockupDemoActive)}
        micProcessor={micProcessor}
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
        onUnmuteUser={handleHostUnmuteUser}
        onKickUser={handleHostKickNow}
        onPunirUser={(p) => setAlvoPunir(p)}
        podePunir={(p) => alvoPunivel(p)}
        onUpdateSettings={handleHostUpdateSettings}
        onClaimHost={handleClaimHost}
        onApproveKnock={handleApproveKnock}
        onRejectKnock={handleRejectKnock}
        onOpenAdmissionModal={() => setIsAdmissionOpen(true)}
        onCloseRoomForAll={isMaster ? handleCloseRoomForAll : undefined}
        isCofundador={Boolean(self.isCofundador)}
        onGiveCoins={handleHostGiveCoins}
        onOpenGrantBadges={(p) => {
          setTargetBadgeParticipant(p);
          setIsGrantBadgesOpen(true);
        }}
        isMaster={Boolean(isMaster)}
        masterToken={masterToken}
      />

      {isRankOpen && <RankCoinsModal socket={socket} onClose={() => setIsRankOpen(false)} />}

      {/* Expulsar da call / Suspender / Banir */}
      {alvoPunir && (
        <PunirModal
          alvo={alvoPunir}
          alvoOnline={!(alvoPunir as any).isOffline}
          podeExpulsarDaCall={Boolean(podeBanir || (podeExpulsar && alvoModeravel(alvoPunir)))}
          podeBanir={alvoBanivel(alvoPunir)}
          salaNome={room.roomName}
          onPunir={handlePunir}
          onClose={() => setAlvoPunir(null)}
        />
      )}

      {/* Amigos + conversa privada (fica montado pra contar pedidos e mensagens não lidas) */}
      <AmigosPainel
        socket={socket}
        aberto={isAmigosOpen}
        onFechar={() => {
          setIsAmigosOpen(false);
          setConversaInicial(null);
        }}
        conversaInicial={conversaInicial}
        onPendentes={setAmigosPendentes}
      />
      <RankSubiuAviso socket={socket} moedas={self.kokiCoins || 0} ativo={!isUserMaster && !self.isCofundador} onAbrirRank={() => setIsRankOpen(true)} />
      {isMissoesOpen && <MissoesModal onClose={() => setIsMissoesOpen(false)} onGanhar={ganharMoedas} />}
      {isRoletaOpen && (
        <RoletaModal
          socket={socket}
          saldo={getKokiCoins()}
          isMaster={Boolean(isUserMaster)}
          onClose={() => setIsRoletaOpen(false)}
          onGastar={gastarMoedas}
          onGanharMoedas={ganharMoedas}
          onGanharItem={ganharItem}
        />
      )}
      {abaExtras && isUserMaster && (
        <PainelExtrasMaster socket={socket} masterToken={masterToken} abaInicial={abaExtras} onClose={() => setAbaExtras(null)} />
      )}

      {/* Eco Coins & Perks Store Modal */}
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
