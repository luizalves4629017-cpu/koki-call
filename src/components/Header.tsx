import React, { useState, useRef, useEffect } from "react";
import { 
  Share2, 
  Copy, 
  Check, 
  ChevronDown,
  ShieldCheck,
  UserCheck,
  LayoutGrid,
  Camera,
  Crown,
  Target,
  Disc3,
  Trophy,
  Users,
} from "lucide-react";
import { Participant, RoomState } from "../types";
import { getEffectiveInviteUrl } from "../utils/inviteUrl";
import { copyToClipboardSafe } from "../utils/clipboard";
import { getEcoCoins, formatCoinDisplay } from "../utils/storage";
import { EcoCoinIcon } from "./EcoCoinIcon";
import { BlackHoleBadge } from "./BlackHoleBadge";
import { EcoLogo } from "./EcoLogo";

interface HeaderProps {
  room: RoomState;
  self: Participant;
  isMaster?: boolean;
  isCofundador?: boolean;
  hasVipBadge?: boolean;
  lowResourceMode?: boolean;
  pingMs: number;
  pendingKnocksCount?: number;
  kokiCoins?: number;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
  isMockupDemoActive?: boolean;
  onToggleMockupDemo?: () => void;
  onOpenStore?: () => void;
  onOpenMissoes?: () => void;
  onOpenRoleta?: () => void;
  onOpenRank?: () => void;
  /** Abre Amigos (lista, pedidos e conversa privada) */
  onOpenAmigos?: () => void;
  /** Pedidos de amizade + mensagens não lidas */
  amigosPendentes?: number;
  onOpenExtras?: (aba: "raiox" | "anuncio" | "chuva") => void;
  onOpenInvite: () => void;
  onOpenHostPanel: () => void;
  onOpenAdmissionModal?: () => void;
  onOpenSecurityAudit?: () => void;
  onOpenOwnerProfile?: () => void;
  isChannelsOpen?: boolean;
  onToggleChannels?: () => void;
  onToggleLowResource?: () => void;
  onLeaveRoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  self,
  isMaster = false,
  isCofundador = false,
  pingMs,
  pendingKnocksCount = 0,
  kokiCoins,
  onOpenStore,
  onOpenMissoes,
  onOpenRoleta,
  onOpenRank,
  onOpenAmigos,
  amigosPendentes = 0,
  onOpenExtras,
  onOpenHostPanel,
  onOpenAdmissionModal,
  onOpenOwnerProfile,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = useState(false);
  const ownerMenuRef = useRef<HTMLDivElement | null>(null);

  const currentCoins = typeof kokiCoins === "number" ? kokiCoins : getEcoCoins();
  const isUserMaster = Boolean(isMaster);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(e.target as Node)) {
        setIsOwnerMenuOpen(false);
      }
    };
    if (isOwnerMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOwnerMenuOpen]);

  const handleCopyLink = async () => {
    const inviteUrl = getEffectiveInviteUrl(room.roomId);
    await copyToClipboardSafe(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInvite = async () => {
    const inviteUrl = getEffectiveInviteUrl(room.roomId);
    await copyToClipboardSafe(inviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  return (
    <header className="h-14 px-3 sm:px-5 flex items-center justify-between select-none bg-[#1E2026] border-b border-[#2A2D35] text-[#ECECEC] z-30 shrink-0">
      {/* 1. ESQUERDA: Logo do eco, Nome da sala, Ícone pequeno de copiar link com ID no tooltip */}
      <div className="flex items-center gap-3">
        {/* Logo do eco que volta para a entrada */}
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-2 hover:opacity-85 transition-opacity cursor-pointer group"
          title="eco · Início (clique para voltar à tela inicial)"
        >
          <EcoLogo size="sm" showWordmark={false} />
          <span className="font-extrabold text-base tracking-tight text-[#ECECEC] group-hover:text-[#5EEAD4] transition-colors">
            eco
          </span>
        </button>

        <span className="text-[#2A2D35] select-none text-sm font-light">/</span>

        {/* Nome da Sala */}
        <div className="flex items-center gap-2 max-w-[200px] sm:max-w-xs md:max-w-md truncate">
          <span className="font-bold text-sm sm:text-base text-[#ECECEC] truncate">
            {room.roomName}
          </span>

          {/* Ícone pequeno de copiar link com tooltip do ID */}
          <button
            onClick={handleCopyLink}
            className="p-1 rounded-md text-[#8B8F98] hover:text-[#5EEAD4] hover:bg-[#2A2D35] transition-all cursor-pointer relative group"
            title={`ID: ${room.roomId} · Clique para copiar link`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#5EEAD4]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="sr-only">Copiar link</span>
          </button>
        </div>
      </div>

      {/* 2. DIREITA (Exatos 4/5 itens limpos): Ping verde, Saldo de moedas, Botão Dono (só pro Dono), Botão Convidar */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Amigos: sempre visível pra todo mundo (logado ou não) */}
        {onOpenAmigos && (
          <button
            onClick={onOpenAmigos}
            className="relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#16171B] border border-[#2A2D35] hover:border-[#5EEAD4]/40 text-[#5EEAD4] text-xs font-bold transition-all cursor-pointer"
            title="Amigos e conversas privadas"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Amigos</span>
            {amigosPendentes > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#F43F5E] text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                {amigosPendentes > 99 ? "99+" : amigosPendentes}
              </span>
            )}
          </button>
        )}

        {/* Ping verde pequeno */}
        <div
          className="flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400 select-none px-2 py-1 rounded-md bg-[#16171B]/60 border border-[#2A2D35]"
          title="Latência da conexão WebRTC em tempo real"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>{pingMs} ms</span>
        </div>

        {/* Missões do dia e Roleta da Sorte */}
        {onOpenMissoes && (
          <button
            onClick={onOpenMissoes}
            className="p-2 rounded-full bg-[#16171B] border border-[#2A2D35] hover:border-[#5EEAD4]/40 text-[#5EEAD4] transition-all cursor-pointer"
            title="Missões do dia"
          >
            <Target className="w-4 h-4" />
          </button>
        )}
        {onOpenRoleta && (
          <button
            onClick={onOpenRoleta}
            className="p-2 rounded-full bg-[#16171B] border border-[#2A2D35] hover:border-[#C4B5FD]/40 text-[#C4B5FD] transition-all cursor-pointer"
            title="Roleta da Sorte"
          >
            <Disc3 className="w-4 h-4" />
          </button>
        )}

        {onOpenRank && (
          <button
            onClick={onOpenRank}
            className="p-2 rounded-full bg-[#16171B] border border-[#2A2D35] hover:border-[#3B82F6]/60 text-[#60A5FA] transition-all cursor-pointer"
            title="Rank de Coins"
          >
            <Trophy className="w-4 h-4" />
          </button>
        )}

        {/* Saldo de Eco Coins com ícone SVG (clicar abre a Loja Órbita) */}
        {onOpenStore && (
          <button
            onClick={onOpenStore}
            className="flex items-center gap-2 bg-[#16171B] hover:bg-[#252830] border border-[#2A2D35] hover:border-[#5EEAD4]/40 text-[#ECECEC] px-3 py-1.5 rounded-full transition-all cursor-pointer group shadow-xs"
            title="Loja Eco Coins · Desbloqueie vantagens"
          >
            <EcoCoinIcon size={16} />
            <span className="font-bold text-xs text-[#ECECEC] group-hover:text-[#5EEAD4] transition-colors">
              {formatCoinDisplay(currentCoins, isUserMaster || isCofundador)}
            </span>
          </button>
        )}

        {/* Botão Co-fundador: abre o Painel Co-fundador (só membros) */}
        {isCofundador && !isUserMaster && (
          <button
            onClick={onOpenHostPanel}
            className="flex items-center gap-1.5 bg-[#5EEAD4]/15 hover:bg-[#5EEAD4]/25 border border-[#5EEAD4]/40 text-[#5EEAD4] text-xs font-bold px-3 py-1.5 rounded-full transition-all shadow-sm cursor-pointer"
            title="Painel Co-fundador · moedas, insígnias, VIP e cargos dos membros"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Painel Co-fundador</span>
          </button>
        )}

        {/* Botão Dono com Singularidade (abre menu dropdown) - só para o Dono */}
        {isUserMaster && (
          <div className="relative" ref={ownerMenuRef}>
            <button
              onClick={() => setIsOwnerMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 bg-[#C4B5FD]/15 hover:bg-[#C4B5FD]/25 border border-[#C4B5FD]/40 text-[#C4B5FD] text-xs font-bold px-3 py-1.5 rounded-full transition-all shadow-sm cursor-pointer"
              title="Menu do Dono · Painel Master, Portaria e Perfil"
            >
              <BlackHoleBadge type="singularidade" size={17} />
              <span>Dono</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOwnerMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu do Dono */}
            {isOwnerMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#1E2026] border border-[#2A2D35] rounded-xl shadow-2xl p-1.5 space-y-0.5 z-50 animate-in fade-in duration-100">
                <button
                  onClick={() => {
                    setIsOwnerMenuOpen(false);
                    onOpenHostPanel();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#ECECEC] hover:bg-[#252830] hover:text-[#C4B5FD] transition-colors text-left cursor-pointer"
                >
                  <LayoutGrid className="w-4 h-4 text-[#C4B5FD]" />
                  <span>Painel Master</span>
                </button>

                {onOpenAdmissionModal && (
                  <button
                    onClick={() => {
                      setIsOwnerMenuOpen(false);
                      onOpenAdmissionModal();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#ECECEC] hover:bg-[#252830] hover:text-[#C4B5FD] transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4 text-[#C4B5FD]" />
                      <span>Portaria</span>
                    </div>
                    {pendingKnocksCount > 0 && (
                      <span className="bg-[#F43F5E] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                        {pendingKnocksCount}
                      </span>
                    )}
                  </button>
                )}

                {onOpenOwnerProfile && (
                  <button
                    onClick={() => {
                      setIsOwnerMenuOpen(false);
                      onOpenOwnerProfile();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#ECECEC] hover:bg-[#252830] hover:text-[#C4B5FD] transition-colors text-left cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#C4B5FD]" />
                    <span>Perfil Master</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Botão verde-água Convidar */}
        <button
          onClick={handleCopyInvite}
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all shadow-md cursor-pointer bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] active:scale-95"
          title={`Copiar URL de convite da sala`}
        >
          {inviteCopied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />}
          <span>{inviteCopied ? "Copiado!" : "Convidar"}</span>
        </button>
      </div>
    </header>
  );
};
