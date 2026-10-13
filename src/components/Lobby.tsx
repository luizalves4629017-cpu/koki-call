import { ContaSalas } from "./ContaSalas";
import React, { useState, useEffect, useRef } from "react";
import {
  Crown,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
  X,
  Edit2,
  Key,
} from "lucide-react";
import {
  getSavedUserProfile,
  saveUserProfile,
  resolveUserTag,
  generateStandardUserTag,
  MASTER_DEFAULT_TAG,
  MASTER_DEFAULT_USERNAME,
  getEcoCoins,
} from "../utils/storage";
import { EcoLogo } from "./EcoLogo";
import { MasterLoginModal } from "./MasterLoginModal";
import { EcoAvatar } from "./EcoAvatar";
import { EditOwnerProfileModal } from "./EditOwnerProfileModal";
import { generateUniqueRoomId } from "../utils/roomId";

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
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
}

type TabType = "join" | "create" | "master";

// Fundo da tela inicial: buraco negro verde-água/lilás
const FUNDO_BURACO_NEGRO: React.CSSProperties = {
  backgroundImage: "linear-gradient(rgba(22,23,27,0.25), rgba(22,23,27,0.45)), url('/fundo-call.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

export const Lobby: React.FC<LobbyProps> = ({
  initialRoomId = "",
  initialRole = "",
  isMaster = false,
  masterToken = null,
  isWaitingApproval = false,
  approvalError = null,
  onCancelApproval,
  onCreateRoom,
  onJoinRoom,
  onMasterLogin,
  onMasterLogout,
}) => {
  // Entrada escondida do Dono: 5 cliques seguidos no logo
  const [isMasterLoginOpen, setIsMasterLoginOpen] = useState(false);
  const logoClicksRef = useRef<{ count: number; last: number }>({ count: 0, last: 0 });
  const handleLogoClick = () => {
    const now = Date.now();
    const c = logoClicksRef.current;
    c.count = now - c.last < 800 ? c.count + 1 : 1;
    c.last = now;
    if (c.count >= 5) {
      c.count = 0;
      setIsMasterLoginOpen(true);
    }
  };
  const isCustomRoomInvite = Boolean(initialRoomId && initialRoomId.trim().length > 0);

  // Default tab selection
  const [tab, setTab] = useState<TabType>(() => {
    if (isCustomRoomInvite || initialRole === "guest") return "join";
    if (isMaster && masterToken) return "master";
    return "join";
  });

  // Saved user profile
  const [savedProfile] = useState(() => getSavedUserProfile());
  const [nickname, setNickname] = useState(() => {
    if (savedProfile.name && savedProfile.name.trim().length > 0) {
      return savedProfile.name;
    }
    return `Convidado ${savedProfile.tag ? savedProfile.tag.slice(0, 4) : Math.floor(100 + Math.random() * 900)}`;
  });
  const [avatarColor] = useState(savedProfile.avatarColor);
  const [avatarUrl] = useState<string | undefined>(savedProfile.avatarUrl);
  const [bannerColor] = useState(savedProfile.bannerColor);
  const [bannerUrl] = useState<string | undefined>(savedProfile.bannerUrl);
  const [customStatus] = useState(savedProfile.customStatus);
  const [bio] = useState(savedProfile.bio);
  const [tag] = useState(savedProfile.tag || generateStandardUserTag());
  const [badges] = useState<string[]>(savedProfile.badges || []);

  const isSelfMaster = Boolean(isMaster && masterToken);
  const effectiveTag = resolveUserTag(nickname, isSelfMaster, tag);

  // Form Inputs: Join
  const [joinRoomId, setJoinRoomId] = useState(initialRoomId || "");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showCodigo, setShowCodigo] = useState(isCustomRoomInvite);
  const [joinPasscode, setJoinPasscode] = useState("");

  // Form Inputs: Create
  const [createRoomName, setCreateRoomName] = useState("");
  const [createCustomId, setCreateCustomId] = useState("");
  const [createPasscode, setCreatePasscode] = useState("");

  // Form Inputs: Master
  const [masterRoomName, setMasterRoomName] = useState("Sala Oficial do Dono");
  const [masterCustomId, setMasterCustomId] = useState("");
  const [masterPin, setMasterPin] = useState("");
  const [lowBandwidthPreset, setLowBandwidthPreset] = useState(false);

  // Modals
  const [showEditOwnerProfile, setShowEditOwnerProfile] = useState(false);

  // Media preview state

  useEffect(() => {
    if (initialRoomId) {
      setJoinRoomId(initialRoomId);
      setShowCodigo(true);
      setTab("join");
    }
  }, [initialRoomId]);

  // Persist username automatically
  useEffect(() => {
    if (nickname && nickname.trim().length > 0) {
      saveUserProfile({
        name: nickname.trim(),
        avatarColor,
        avatarUrl,
        bannerColor,
        bannerUrl,
        customStatus,
        bio,
        tag: effectiveTag,
        badges,
        rememberLogin: true,
      });
    }
  }, [nickname, avatarColor, avatarUrl, bannerColor, bannerUrl, customStatus, bio, badges, effectiveTag]);


  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoom = (joinRoomId || "").trim().toLowerCase();
    entrarDireto(cleanRoom || generateUniqueRoomId("eco"), joinPasscode.trim() || undefined);
  };

  // Entrar com 1 clique (usado por "Minhas salas")
  const entrarDireto = (targetRoomId: string, senhaSala?: string) => {
    onJoinRoom({
      roomId: targetRoomId,
      name: nickname.trim() || `Convidado ${Math.floor(100 + Math.random() * 900)}`,
      passcode: senhaSala,
      profile: {
        avatarEmoji: isSelfMaster ? "👑" : "",
        avatarColor,
        avatarUrl,
        bannerColor,
        bannerUrl,
        customStatus: customStatus || (isSelfMaster ? "👑 Dono Master do eco" : "🟢 Conectado ao eco"),
        bio: bio || (isSelfMaster ? "Criador e moderador oficial do eco." : "Voz, vídeo e tela com seus amigos."),
        tag: effectiveTag,
        badges,
      },
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRoomId = createCustomId.trim()
      ? createCustomId.trim().toLowerCase().replace(/\s+/g, "-")
      : generateUniqueRoomId("eco");

    onCreateRoom({
      roomName: createRoomName.trim() || `Sala de ${nickname.trim()}`,
      roomId: finalRoomId,
      hostName: nickname.trim() || "Anfitrião",
      hostPasscode: createPasscode.trim(),
      lowBandwidthDefault: false,
      profile: {
        avatarEmoji: isSelfMaster ? "👑" : "",
        avatarColor,
        avatarUrl,
        bannerColor,
        bannerUrl,
        customStatus: customStatus || "🟢 Conectado na Call",
        bio: bio || "Criou esta sala no eco.",
        tag: effectiveTag,
        badges,
      },
    });
  };

  const handleMasterCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRoomId = masterCustomId.trim()
      ? masterCustomId.trim().toLowerCase().replace(/\s+/g, "-")
      : generateUniqueRoomId("eco-master");

    onCreateRoom({
      roomName: masterRoomName.trim() || "Sala Oficial do Dono",
      roomId: finalRoomId,
      hostName: nickname.trim() || MASTER_DEFAULT_USERNAME,
      hostPasscode: masterPin.trim(),
      lowBandwidthDefault: lowBandwidthPreset,
      profile: {
        avatarEmoji: "👑",
        avatarColor: "#A78BFA",
        avatarUrl,
        bannerColor,
        bannerUrl,
        customStatus: customStatus || "👑 Dono Master do eco",
        bio: bio || "Criador e moderador oficial do eco.",
        tag: MASTER_DEFAULT_TAG,
        badges: Array.from(new Set([...badges, "owner_supreme", "eco_creator", "vip_nitro"])),
      },
    });
  };

  // If waiting for approval from the Owner (Portaria)
  if (isWaitingApproval) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#16171B] text-[#ECECEC] select-none" style={FUNDO_BURACO_NEGRO}>
        {/* Glow behind */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[450px] h-[450px] bg-[#5EEAD4]/10 rounded-full blur-[120px]" />
          <div className="w-[450px] h-[450px] bg-[#C4B5FD]/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-md bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-8 text-center shadow-2xl flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#5EEAD4]/10 border border-[#5EEAD4]/30 flex items-center justify-center text-[#5EEAD4] mb-4 relative">
            <Loader2 className="w-7 h-7 animate-spin text-[#5EEAD4]" />
          </div>

          <h2 className="text-xl font-bold text-[#ECECEC] tracking-tight">
            Aguardando aprovação
          </h2>
          <p className="text-xs text-[#8B8F98] mt-2 mb-6 max-w-xs">
            Esta sala possui Portaria ativada. O Dono ou moderador da sala foi notificado sobre sua entrada.
          </p>

          <div className="w-full p-3.5 rounded-xl bg-[#16171B] border border-[#2A2D35] flex items-center justify-between text-xs mb-6">
            <span className="text-[#8B8F98]">Código da Sala:</span>
            <span className="font-mono font-semibold text-[#5EEAD4]">
              {joinRoomId || "sala-privada"}
            </span>
          </div>

          {onCancelApproval && (
            <button
              type="button"
              onClick={onCancelApproval}
              className="py-2.5 px-6 rounded-xl bg-transparent hover:bg-[#F43F5E]/10 border border-[#2A2D35] hover:border-[#F43F5E]/40 text-[#F43F5E] text-xs font-semibold transition-all duration-150 cursor-pointer"
            >
              Cancelar solicitação
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#16171B] text-[#ECECEC] select-none overflow-x-hidden font-sans" style={FUNDO_BURACO_NEGRO}>
      {/* Background radial ambient glow: Cyan-teal on left, Lavender on right (matching Image 3) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[420px] sm:w-[540px] h-[420px] sm:h-[540px] -translate-x-32 bg-[#5EEAD4]/15 rounded-full blur-[130px]" />
        <div className="w-[420px] sm:w-[540px] h-[420px] sm:h-[540px] translate-x-32 bg-[#C4B5FD]/15 rounded-full blur-[130px]" />
      </div>

      {/* Main Centered Card (Matches Image 3) */}
      <div className="relative z-10 w-full max-w-[440px] bg-[#1E2026] border border-[#2A2D35] rounded-2xl shadow-2xl p-6 sm:p-7 flex flex-col transition-all duration-150">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div onClick={handleLogoClick} className="cursor-default">
            <EcoLogo size="lg" showWordmark={false} className="mb-2.5" />
          </div>
          <h1 className="text-2xl font-black lowercase tracking-tight text-[#ECECEC]">
            eco
          </h1>
          <p className="text-xs text-[#8B8F98] mt-1 font-normal">
            Voz, vídeo e tela com seus amigos
          </p>
        </div>

        {/* Rejection / Error Alert */}
        {approvalError && (
          <div className="mb-4 p-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E] text-xs text-center flex items-center justify-between">
            <span>{approvalError}</span>
          </div>
        )}

        {/* Master Active Notice (when owner is logged in) */}
        {isSelfMaster && (
          <div className="mb-4 p-2.5 rounded-xl bg-[#C4B5FD]/10 border border-[#C4B5FD]/30 flex items-center justify-between text-xs text-[#C4B5FD]">
            <div className="flex items-center gap-1.5 font-semibold">
              <Crown className="w-3.5 h-3.5 fill-current" />
              <span>Dono reconhecido neste dispositivo</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#C4B5FD] text-[#16171B] font-bold text-[10px]">
              Master ativo
            </span>
          </div>
        )}

        {/* Login salvo + Minhas salas */}
        <ContaSalas onEntrarSala={(id) => entrarDireto(id)} />

        {/* TAB 1: ENTRAR (Matches Image 3) */}
        {tab === "join" && (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            {/* Row: Avatar + Seu nome */}
            <div>
              <label className="text-[11px] font-medium text-[#8B8F98] block mb-1.5">
                Seu nome
              </label>
              <div className="flex items-center gap-2.5">
                <EcoAvatar
                  name={nickname}
                  avatarUrl={avatarUrl}
                  avatarColor={avatarColor}
                  size="md"
                  isMaster={isSelfMaster}
                />
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="João Silva"
                    maxLength={32}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#16171B] border border-[#2A2D35] focus:border-[#5EEAD4] focus:ring-1 focus:ring-[#5EEAD4] rounded-xl text-sm text-[#ECECEC] placeholder-[#8B8F98] outline-none transition-all duration-150"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#8B8F98]">
                    #{effectiveTag}
                  </span>
                </div>
              </div>
            </div>

            {/* Ação principal: Criar sala */}
            <button
              type="button"
              onClick={() => setTab("create")}
              className="w-full py-3 px-4 rounded-xl bg-[#5EEAD4] hover:bg-[#4dd6c0] text-[#16171B] font-bold text-sm tracking-tight transition-all duration-150 cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2 teal-glow"
            >
              Criar sala
            </button>

            {/* Tenho um código ou link (recolhido) */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowCodigo(!showCodigo)}
                className="text-xs text-[#8B8F98] hover:text-[#5EEAD4] inline-flex items-center gap-1 transition-colors cursor-pointer select-none"
              >
                <span>Tenho um código ou link</span>
                {showCodigo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showCodigo && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="Código ou link da sala"
                  className="w-full px-3.5 py-2.5 bg-[#16171B] border border-[#2A2D35] focus:border-[#5EEAD4] focus:ring-1 focus:ring-[#5EEAD4] rounded-xl text-sm text-[#ECECEC] placeholder-[#8B8F98] outline-none transition-all duration-150 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordInput(!showPasswordInput)}
                  className="text-xs text-[#8B8F98] hover:text-[#5EEAD4] flex items-center gap-1 transition-colors cursor-pointer select-none"
                >
                  <span>Sala com senha?</span>
                  {showPasswordInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showPasswordInput && (
                  <input
                    type="password"
                    value={joinPasscode}
                    onChange={(e) => setJoinPasscode(e.target.value)}
                    placeholder="Digite a senha da sala"
                    className="w-full px-3.5 py-2 bg-[#16171B] border border-[#2A2D35] focus:border-[#5EEAD4] rounded-xl text-xs text-[#ECECEC] placeholder-[#8B8F98] outline-none"
                  />
                )}
                <button
                  type="submit"
                  disabled={!joinRoomId.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#252830] hover:bg-[#2c303a] border border-[#2A2D35] text-[#ECECEC] font-semibold text-sm transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Entrar na sala
                </button>
              </div>
            )}

            {isSelfMaster && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setTab("master")}
                  className="text-xs text-[#C4B5FD]/80 hover:text-[#C4B5FD] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Crown className="w-3 h-3 fill-current" />
                  <span>Sala Master</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* TAB 2: CRIAR SALA */}
        {tab === "create" && (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-[#8B8F98] block mb-1.5">
                Nome da sala
              </label>
              <input
                type="text"
                value={createRoomName}
                onChange={(e) => setCreateRoomName(e.target.value)}
                placeholder="Ex: Sala de Jogos"
                maxLength={40}
                className="w-full px-3.5 py-2.5 bg-[#16171B] border border-[#2A2D35] focus:border-[#5EEAD4] focus:ring-1 focus:ring-[#5EEAD4] rounded-xl text-sm text-[#ECECEC] placeholder-[#8B8F98] outline-none transition-all duration-150"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-[#8B8F98] block mb-1.5">
                ID personalizado (opcional)
              </label>
              <input
                type="text"
                value={createCustomId}
                onChange={(e) => setCreateCustomId(e.target.value)}
                placeholder="eco-jogos (gerado se vazio)"
                className="w-full px-3.5 py-2.5 bg-[#16171B] border border-[#2A2D35] focus:border-[#5EEAD4] focus:ring-1 focus:ring-[#5EEAD4] rounded-xl text-sm text-[#ECECEC] placeholder-[#8B8F98] outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-[#8B8F98] block mb-1.5">
                Senha de acesso (opcional)
              </label>
              <input
                type="password"
                value={createPasscode}
                onChange={(e) => setCreatePasscode(e.target.value)}
                placeholder="Deixe em branco para sala aberta"
                className="w-full px-3.5 py-2.5 bg-[#16171B] border border-[#2A2D35] focus:border-[#5EEAD4] rounded-xl text-sm text-[#ECECEC] placeholder-[#8B8F98] outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-[#5EEAD4] hover:bg-[#4dd6c0] text-[#16171B] font-bold text-sm tracking-tight transition-all duration-150 cursor-pointer shadow-md mt-2 teal-glow"
            >
              Criar sala
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setTab("join")}
                className="text-xs text-[#8B8F98] hover:text-[#ECECEC] transition-colors cursor-pointer"
              >
                Voltar
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: SALA MASTER (quando Dono está ativo) */}
        {tab === "master" && isSelfMaster && (
          <form onSubmit={handleMasterCreateSubmit} className="space-y-4">
            {/* Bloco Perfil do Dono */}
            <div className="p-3 rounded-xl bg-[#16171B] border border-[#2A2D35] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <EcoAvatar
                  name={nickname}
                  avatarUrl={avatarUrl}
                  avatarColor="#A78BFA"
                  size="md"
                  isMaster={true}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#ECECEC]">
                    <span className="truncate">{nickname || MASTER_DEFAULT_USERNAME}</span>
                    <span className="text-[10px] font-mono text-[#C4B5FD] font-semibold">
                      #{MASTER_DEFAULT_TAG}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#8B8F98] truncate block">
                    {customStatus || "👑 Dono Master do eco"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditOwnerProfile(true)}
                className="px-2.5 py-1 rounded-lg bg-[#1E2026] hover:bg-[#2A2D35] border border-[#2A2D35] text-[11px] text-[#C4B5FD] font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Personalizar</span>
              </button>
            </div>

            <div>
              <label className="text-[11px] font-medium text-[#8B8F98] block mb-1">
                Nome da Sala Master
              </label>
              <input
                type="text"
                value={masterRoomName}
                onChange={(e) => setMasterRoomName(e.target.value)}
                placeholder="Sala Oficial do Dono"
                className="w-full px-3 py-2 bg-[#16171B] border border-[#2A2D35] focus:border-[#C4B5FD] rounded-xl text-xs text-[#ECECEC] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-[#8B8F98] block mb-1">
                  ID personalizado
                </label>
                <input
                  type="text"
                  value={masterCustomId}
                  onChange={(e) => setMasterCustomId(e.target.value)}
                  placeholder="sala-master"
                  className="w-full px-3 py-2 bg-[#16171B] border border-[#2A2D35] focus:border-[#C4B5FD] rounded-xl text-xs text-[#ECECEC] font-mono outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#8B8F98] block mb-1">
                  PIN Master (opcional)
                </label>
                <input
                  type="password"
                  value={masterPin}
                  onChange={(e) => setMasterPin(e.target.value)}
                  placeholder="PIN secreto"
                  className="w-full px-3 py-2 bg-[#16171B] border border-[#2A2D35] focus:border-[#C4B5FD] rounded-xl text-xs text-[#ECECEC] outline-none"
                />
              </div>
            </div>

            {/* Interruptor Modo Gamer / Baixo consumo */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#16171B] border border-[#2A2D35]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#5EEAD4]" />
                <div>
                  <span className="text-xs font-semibold text-[#ECECEC] block">
                    Modo Gamer / Baixo consumo
                  </span>
                  <span className="text-[10px] text-[#8B8F98]">
                    Otimiza áudio e reduz uso de CPU
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={lowBandwidthPreset}
                onChange={(e) => setLowBandwidthPreset(e.target.checked)}
                className="w-4 h-4 rounded border-[#2A2D35] bg-[#16171B] text-[#5EEAD4] focus:ring-[#5EEAD4] accent-[#5EEAD4] cursor-pointer"
              />
            </div>

            {/* Botão lilás Criar Sala Master */}
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-[#C4B5FD] hover:bg-[#d8b4fe] text-[#16171B] font-bold text-sm tracking-tight transition-all duration-150 cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2 lavender-glow"
            >
              <Crown className="w-4 h-4 fill-current" />
              <span>Criar Sala Master</span>
            </button>

            {/* Sub-opção Voltar */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setTab("join")}
                className="text-xs text-[#8B8F98] hover:text-[#C4B5FD] transition-colors cursor-pointer"
              >
                Voltar
              </button>
            </div>
          </form>
        )}

      </div>

      {/* Edit Owner Profile Modal */}
      {showEditOwnerProfile && (
        <EditOwnerProfileModal
          isOpen={showEditOwnerProfile}
          currentProfile={{
            name: nickname,
            tag: effectiveTag,
            avatarEmoji: "👑",
            avatarColor,
            avatarUrl,
            bannerColor,
            bannerUrl,
            customStatus,
            bio,
            badges,
            kokiCoins: getEcoCoins(),
            rememberLogin: true,
          }}
          onClose={() => setShowEditOwnerProfile(false)}
          onSaveProfile={(updated) => {
            saveUserProfile(updated);
            if (updated.name) setNickname(updated.name);
            setShowEditOwnerProfile(false);
          }}
        />
      )}
      <MasterLoginModal
        isOpen={isMasterLoginOpen}
        isMaster={Boolean(isMaster && masterToken)}
        onClose={() => setIsMasterLoginOpen(false)}
        onLoginSuccess={(token) => onMasterLogin?.(token)}
        onLogout={() => onMasterLogout?.()}
      />
    </div>
  );
};
