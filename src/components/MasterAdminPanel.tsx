import { BadgeIcon } from "./BadgeIcon";
import React, { useState } from "react";
import {
  LayoutGrid,
  Users,
  Award,
  Coins,
  Palette,
  MessageSquare,
  Settings,
  ArrowLeft,
  Search,
  MoreVertical,
  Plus,
  Send,
  Trash2,
  Lock,
  Unlock,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  Copy,
  Check,
  Crown,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Key,
  LogOut,
  X,
  Volume2,
  ShoppingBag,
  Film,
} from "lucide-react";
import { Participant, RoomState, KnockRequest, StorePerk } from "../types";
import { EcoLogo } from "./EcoLogo";
import { EcoAvatar } from "./EcoAvatar";
import {
  addEcoCoins,
  setEcoCoins,
  getEcoCoins,
  getStoreItems,
  saveStoreItems,
  getStoreRewardSettings,
  saveStoreRewardSettings,
  getStorePriceAuditLogs,
  addStorePriceAuditLog,
  StoreRewardSettings,
  StorePriceAuditItem,
} from "../utils/storage";
import { BlackHoleBadge } from "./BlackHoleBadge";
import { EcoCoinIcon } from "./EcoCoinIcon";
import { ALL_BADGES } from "../data/badges";

interface MasterAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  room?: RoomState | null;
  self?: Participant;
  participants: Participant[];
  socket?: any;
  onMuteUser?: (userId: string) => void;
  onKickUser?: (userId: string) => void;
  onMoveToVoiceChannel?: (targetSocketId: string, targetChannelId: string) => void;
  onCloseRoomForAll?: () => void;
  onUpdateSettings?: (settings: Partial<RoomState["settings"]>) => void;
  onGiveCoins?: (targetSocketId: string, amount: number) => void;
  onAssignBadges?: (targetSocketId: string, badges: string[]) => void;
  onLogoutMaster?: () => void;
}

type AdminTab =
  | "visao_geral"
  | "membros"
  | "insignias"
  | "moedas"
  | "loja"
  | "sala_atual"
  | "salas"
  | "aparencia"
  | "configuracoes";

interface AuditLogItem {
  id: string;
  action: string;
  target: string;
  amount?: number;
  timestamp: number;
}

export const MasterAdminPanel: React.FC<MasterAdminPanelProps> = ({
  isOpen,
  onClose,
  room,
  self,
  participants = [],
  socket,
  onMuteUser,
  onKickUser,
  onMoveToVoiceChannel,
  onCloseRoomForAll,
  onUpdateSettings,
  onGiveCoins,
  onAssignBadges,
  onLogoutMaster,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>("membros");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(() => {
    return participants[0]?.id || "";
  });

  // Coins moderation state
  const [coinMode, setCoinMode] = useState<"add" | "deduct">("add");
  const [coinTargetId, setCoinTargetId] = useState<string>("");
  const [coinAmountInput, setCoinAmountInput] = useState<string>("500");
  const [drawerRewardAmount, setDrawerRewardAmount] = useState<string>("500");
  const [coinNotice, setCoinNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Insígnias state
  const [customBadgeName, setCustomBadgeName] = useState("");
  const [customBadgeIcon, setCustomBadgeIcon] = useState("Award");
  const [customBadgeColor, setCustomBadgeColor] = useState("#C4B5FD");
  const [showAddBadgeModal, setShowAddBadgeModal] = useState(false);

  // Invite copy
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [confirmEndRoom, setConfirmEndRoom] = useState(false);

  // Audit Log
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([
    {
      id: "1",
      action: "Moedas enviadas",
      target: "Luiz",
      amount: 500,
      timestamp: Date.now() - 1000 * 60 * 15,
    },
    {
      id: "2",
      action: "Insígnia atribuída: Criador do App",
      target: "Luiz",
      timestamp: Date.now() - 1000 * 60 * 60 * 2,
    },
  ]);

  // Loja & Editable Pricing State
  const [panelStoreItems, setPanelStoreItems] = useState<StorePerk[]>(() => getStoreItems());
  const [rewardSettings, setRewardSettings] = useState<StoreRewardSettings>(() => getStoreRewardSettings());
  const [priceAuditLogs, setPriceAuditLogs] = useState<StorePriceAuditItem[]>(() => getStorePriceAuditLogs());
  const [storeNotice, setStoreNotice] = useState<string | null>(null);

  const handleUpdateItemPrice = (itemId: string, newPriceStr: string) => {
    const newPrice = parseInt(newPriceStr, 10);
    if (isNaN(newPrice) || newPrice < 0) return;

    const oldItem = panelStoreItems.find((p) => p.id === itemId);
    if (!oldItem) return;
    const oldPrice = oldItem.price;

    const updated = panelStoreItems.map((p) => (p.id === itemId ? { ...p, price: newPrice } : p));
    setPanelStoreItems(updated);
    saveStoreItems(updated);

    addStorePriceAuditLog({
      itemId,
      itemName: oldItem.name,
      oldPrice,
      newPrice,
    });
    setPriceAuditLogs(getStorePriceAuditLogs());
    setStoreNotice(`Preço de "${oldItem.name}" atualizado de ${oldPrice} para ${newPrice} Eco Coins.`);
    setTimeout(() => setStoreNotice(null), 3000);
  };

  const handleUpdateItemDuration = (itemId: string, durationStr: string) => {
    const hours = parseInt(durationStr, 10);
    if (isNaN(hours) || hours <= 0) return;
    const updated = panelStoreItems.map((p) => (p.id === itemId ? { ...p, durationHours: hours } : p));
    setPanelStoreItems(updated);
    saveStoreItems(updated);
    setStoreNotice(`Duração atualizada para ${hours} horas.`);
    setTimeout(() => setStoreNotice(null), 3000);
  };

  const handleToggleItemActive = (itemId: string) => {
    const updated = panelStoreItems.map((p) => (p.id === itemId ? { ...p, isActive: p.isActive === false ? true : false } : p));
    setPanelStoreItems(updated);
    saveStoreItems(updated);
  };

  const handleToggleItemFeatured = (itemId: string) => {
    const updated = panelStoreItems.map((p) => ({ ...p, isFeatured: p.id === itemId ? !p.isFeatured : false }));
    setPanelStoreItems(updated);
    saveStoreItems(updated);
  };

  const handleUpdateRewardSetting = (key: keyof StoreRewardSettings, valStr: string) => {
    const num = parseInt(valStr, 10);
    if (isNaN(num) || num < 0) return;
    const next = { ...rewardSettings, [key]: num };
    setRewardSettings(next);
    saveStoreRewardSettings(next);
    setStoreNotice("Configurações de recompensa salvas.");
    setTimeout(() => setStoreNotice(null), 3000);
  };

  // Demo participant pool to mirror Image 1 mockup if in empty room
  const demoMembers: Participant[] =
    participants.length > 0
      ? participants
      : [
          {
            id: "m-1",
            name: "Marlia",
            tag: "4820",
            isHost: false,
            hasAudio: true,
            hasVideo: false,
            isScreenSharing: false,
            isDeafened: false,
            isMutedByHost: false,
            avatarColor: "#F472B6",
            kokiCoins: 500,
            badges: ["star"],
            joinedAt: Date.now(),
          },
          {
            id: "m-2",
            name: "Omela",
            tag: "3910",
            isHost: false,
            hasAudio: false,
            hasVideo: false,
            isScreenSharing: false,
            isDeafened: false,
            isMutedByHost: false,
            avatarColor: "#FBBF24",
            kokiCoins: 500,
            badges: ["star"],
            joinedAt: Date.now(),
          },
          {
            id: "m-3",
            name: "Luiz",
            tag: "0001",
            isHost: true,
            isMaster: true,
            hasAudio: true,
            hasVideo: true,
            isScreenSharing: false,
            isDeafened: false,
            isMutedByHost: false,
            avatarColor: "#A78BFA",
            kokiCoins: 999999,
            badges: ["owner_supreme", "eco_creator", "vip_nitro"],
            joinedAt: Date.now(),
          },
          {
            id: "m-4",
            name: "Lauria",
            tag: "7721",
            isHost: false,
            hasAudio: false,
            hasVideo: false,
            isScreenSharing: false,
            isDeafened: false,
            isMutedByHost: false,
            avatarColor: "#38BDF8",
            kokiCoins: 500,
            badges: ["star", "lightning"],
            joinedAt: Date.now(),
          },
          {
            id: "m-5",
            name: "Danha",
            tag: "1829",
            isHost: false,
            hasAudio: true,
            hasVideo: false,
            isScreenSharing: false,
            isDeafened: false,
            isMutedByHost: false,
            avatarColor: "#34D399",
            kokiCoins: 500,
            badges: ["star"],
            joinedAt: Date.now(),
          },
        ];

  const currentMembersList = participants.length > 0 ? participants : demoMembers;
  const filteredMembers = currentMembersList.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMember =
    currentMembersList.find((m) => m.id === selectedMemberId) || currentMembersList[0];

  if (!isOpen) return null;

  const handleSendCoins = (targetId: string, amountStr: string, isDeduct: boolean = false) => {
    const val = parseInt(amountStr, 10);
    if (isNaN(val) || val <= 0) {
      setCoinNotice({ type: "error", text: "Informe um valor válido de Eco Coins." });
      return;
    }

    const finalAmount = isDeduct ? -val : val;
    const target = currentMembersList.find((m) => m.id === targetId) || selectedMember;

    if (onGiveCoins && target) {
      onGiveCoins(target.id, finalAmount);
    } else if (socket && target) {
      socket.emit("host:moderate-coins", {
        targetSocketId: target.id,
        amount: finalAmount,
      });
    }

    // Add to audit log
    setAuditLogs((prev) => [
      {
        id: Math.random().toString(36).slice(2, 8),
        action: isDeduct ? "Moedas removidas" : "Moedas enviadas",
        target: target?.name || "Membro",
        amount: val,
        timestamp: Date.now(),
      },
      ...prev,
    ]);

    setCoinNotice({
      type: "success",
      text: `${val} Eco Coins ${isDeduct ? "removidas de" : "enviadas para"} ${target?.name || "membro"} com sucesso!`,
    });
    setTimeout(() => setCoinNotice(null), 3500);
  };

  const handleCopyInvite = () => {
    if (!room) return;
    const url = `${window.location.origin}/?room=${encodeURIComponent(room.roomId)}&role=guest`;
    navigator.clipboard.writeText(url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16171B]/90 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full h-full max-w-[1400px] max-h-[920px] m-0 sm:m-4 bg-[#16171B] border border-[#2A2D35] rounded-none sm:rounded-2xl shadow-2xl flex overflow-hidden">
        {/* ========================================================
            LEFT SIDEBAR NAVIGATION (Matches Image 1 exactly)
           ======================================================== */}
        <aside className="w-56 sm:w-60 bg-[#16171B] border-r border-[#2A2D35] flex flex-col justify-between shrink-0 p-4">
          <div>
            {/* Top Logo */}
            <div className="flex flex-col items-start mb-6">
              <EcoLogo size="md" showWordmark={false} className="mb-2" />
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-[#ECECEC]">Painel do Dono</span>
                <span className="p-0.5 rounded-md bg-[#C4B5FD]/10 text-[#C4B5FD]">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                </span>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab("visao_geral")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === "visao_geral"
                    ? "bg-[#252830] text-[#5EEAD4]"
                    : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026]"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Visão geral</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("membros")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === "membros"
                    ? "bg-[#252830] text-[#5EEAD4]"
                    : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4" />
                  <span>Membros</span>
                </div>
                {activeTab === "membros" && (
                  <span className="w-1 h-3.5 rounded-full bg-[#5EEAD4]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("insignias")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === "insignias"
                    ? "bg-[#252830] text-[#5EEAD4]"
                    : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026]"
                }`}
              >
                <Award className="w-4 h-4" />
                <span>Insígnias</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("moedas")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === "moedas"
                    ? "bg-[#252830] text-[#5EEAD4]"
                    : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026]"
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>Moedas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("loja")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === "loja"
                    ? "bg-[#252830] text-[#5EEAD4]"
                    : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026]"
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Loja (Preços & Itens)</span>
              </button>

              {room && (
                <button
                  type="button"
                  onClick={() => setActiveTab("sala_atual")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    activeTab === "sala_atual"
                      ? "bg-[#252830] text-[#5EEAD4]"
                      : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026]"
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Sala atual</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab("aparencia")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === "aparencia"
                    ? "bg-[#252830] text-[#5EEAD4]"
                    : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026]"
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Aparência</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("salas")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === "salas"
                    ? "bg-[#252830] text-[#5EEAD4]"
                    : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026]"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Salas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("configuracoes")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === "configuracoes"
                    ? "bg-[#252830] text-[#5EEAD4]"
                    : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026]"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Configurações</span>
              </button>
            </nav>
          </div>

          {/* Bottom Back Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026] rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao app</span>
          </button>
        </aside>

        {/* ========================================================
            MAIN WORKSPACE CONTENT AREA (Matches Image 1)
           ======================================================== */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#16171B] overflow-hidden">
          {/* Top Header with Tab Title and KPI Badges */}
          <header className="h-16 px-6 border-b border-[#2A2D35] flex items-center justify-between shrink-0 bg-[#16171B]">
            <h1 className="text-xl font-bold text-[#ECECEC] capitalize">
              {activeTab === "visao_geral"
                ? "Visão geral"
                : activeTab === "membros"
                ? "Membros"
                : activeTab === "insignias"
                ? "Insígnias"
                : activeTab === "moedas"
                ? "Eco Coins"
                : activeTab === "sala_atual"
                ? "Gerenciamento da Sala"
                : activeTab === "aparencia"
                ? "Aparência"
                : activeTab === "salas"
                ? "Salas da Comunidade"
                : "Configurações do Dono"}
            </h1>

            {/* Top Right KPI Cards (Exact match to Image 1) */}
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-1.5 rounded-xl bg-[#1E2026] border border-[#2A2D35] flex flex-col items-center">
                <span className="text-[10px] text-[#8B8F98] font-medium leading-none">Membros</span>
                <span className="text-sm font-bold text-[#ECECEC] font-mono mt-0.5">
                  {currentMembersList.length}
                </span>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-[#1E2026] border border-[#2A2D35] flex flex-col items-center">
                <span className="text-[10px] text-[#8B8F98] font-medium leading-none">Online</span>
                <span className="text-sm font-bold text-[#5EEAD4] font-mono mt-0.5">
                  {currentMembersList.filter((m) => m.hasAudio || m.hasVideo || m.isHost).length || 1}
                </span>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-[#1E2026] border border-[#2A2D35] flex flex-col items-center">
                <span className="text-[10px] text-[#8B8F98] font-medium leading-none">Moedas distribuídas</span>
                <span className="text-sm font-bold text-[#C4B5FD] font-mono mt-0.5">
                  12.400
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 ml-2 rounded-xl text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026] transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Body Content based on activeTab */}
          <div className="flex-1 flex overflow-hidden">
            {/* -----------------------------------------------------------------
                TAB: MEMBROS (Exact reproduction of User's Image 1)
               ----------------------------------------------------------------- */}
            {activeTab === "membros" && (
              <div className="flex-1 flex overflow-hidden">
                {/* Center table area */}
                <div className="flex-1 p-6 flex flex-col overflow-y-auto">
                  {/* Search Bar */}
                  <div className="relative mb-5 max-w-md">
                    <Search className="w-4 h-4 text-[#8B8F98] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar membro"
                      className="w-full pl-10 pr-4 py-2 bg-[#1E2026] border border-[#2A2D35] focus:border-[#5EEAD4] rounded-xl text-xs text-[#ECECEC] placeholder-[#8B8F98] outline-none"
                    />
                  </div>

                  {coinNotice && (
                    <div
                      className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                        coinNotice.type === "success"
                          ? "bg-[#5EEAD4]/10 border border-[#5EEAD4]/30 text-[#5EEAD4]"
                          : "bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E]"
                      }`}
                    >
                      <span>{coinNotice.text}</span>
                    </div>
                  )}

                  {/* Table (Image 1) */}
                  <div className="w-full rounded-2xl bg-[#1E2026] border border-[#2A2D35] overflow-hidden">
                    <div className="grid grid-cols-12 px-4 py-2.5 border-b border-[#2A2D35] text-[11px] font-semibold text-[#8B8F98]">
                      <span className="col-span-4">Nome</span>
                      <span className="col-span-3 text-center">Insígnias</span>
                      <span className="col-span-3 text-center">coins amount</span>
                      <span className="col-span-1 text-center">status</span>
                      <span className="col-span-1 text-right"></span>
                    </div>

                    <div className="divide-y divide-[#2A2D35]/50">
                      {filteredMembers.map((member) => {
                        const isSelected = selectedMember?.id === member.id;
                        return (
                          <div
                            key={member.id}
                            onClick={() => setSelectedMemberId(member.id)}
                            className={`grid grid-cols-12 px-4 py-3 items-center text-xs transition-all duration-150 cursor-pointer ${
                              isSelected
                                ? "bg-[#252830] border-l-2 border-[#5EEAD4]"
                                : "hover:bg-[#1E2026]/70"
                            }`}
                          >
                            {/* Nome & Avatar */}
                            <div className="col-span-4 flex items-center gap-3 min-w-0">
                              <EcoAvatar
                                name={member.name}
                                avatarUrl={member.avatarUrl}
                                avatarColor={member.avatarColor}
                                size="sm"
                                isMaster={member.isMaster}
                              />
                              <div className="truncate">
                                <span className="font-semibold text-[#ECECEC] truncate block">
                                  {member.name}
                                </span>
                                <span className="text-[10px] font-mono text-[#8B8F98]">
                                  #{member.tag || "0000"}
                                </span>
                              </div>
                            </div>

                            {/* Insígnias */}
                            <div className="col-span-3 flex items-center justify-center gap-1.5">
                              {member.isMaster && (
                                <span className="w-5 h-5 rounded-full bg-[#C4B5FD]/20 border border-[#C4B5FD]/40 text-[#C4B5FD] flex items-center justify-center">
                                  <Crown className="w-3 h-3 fill-current" />
                                </span>
                              )}
                              {(member.badges || []).map((b, idx) => (
                                <span
                                  key={idx}
                                  className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]"
                                  title={b}
                                >
                                  ★
                                </span>
                              ))}
                              {(!member.badges || member.badges.length === 0) && !member.isMaster && (
                                <span className="text-[#8B8F98] text-[11px]">—</span>
                              )}
                            </div>

                            {/* Coins amount */}
                            <div className="col-span-3 flex items-center justify-center gap-1 text-[#ECECEC] font-mono font-medium">
                              <span className="text-[#C4B5FD]">©</span>
                              <span>{(member.kokiCoins ?? 500).toLocaleString()}</span>
                            </div>

                            {/* Status dot */}
                            <div className="col-span-1 flex items-center justify-center">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  member.hasAudio || member.hasVideo || member.isHost
                                    ? "bg-[#5EEAD4] shadow-[0_0_8px_#5EEAD4]"
                                    : "bg-[#8B8F98]"
                                }`}
                              />
                            </div>

                            {/* Actions button */}
                            <div className="col-span-1 flex items-center justify-end">
                              <button
                                type="button"
                                className="p-1 rounded-lg text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#2A2D35] transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Drawer / Card: Selected Member Detail (Image 1) */}
                {selectedMember && (
                  <aside className="w-72 sm:w-80 border-l border-[#2A2D35] bg-[#1E2026] p-5 flex flex-col justify-between overflow-y-auto shrink-0">
                    <div className="space-y-5">
                      {/* Banner + Avatar */}
                      <div className="relative rounded-2xl overflow-hidden bg-[#16171B] border border-[#2A2D35]">
                        <div
                          className="h-24 w-full bg-cover bg-center"
                          style={{
                            backgroundColor: selectedMember.bannerColor || "#1E2026",
                            backgroundImage: selectedMember.bannerUrl
                              ? `url(${selectedMember.bannerUrl})`
                              : undefined,
                          }}
                        />
                        <div className="p-4 pt-0 -mt-8 flex items-end justify-between">
                          <EcoAvatar
                            name={selectedMember.name}
                            avatarUrl={selectedMember.avatarUrl}
                            avatarColor={selectedMember.avatarColor}
                            size="lg"
                            isMaster={selectedMember.isMaster}
                            className="ring-4 ring-[#1E2026]"
                          />
                          <div className="flex flex-col gap-1.5 pb-1">
                            <button
                              type="button"
                              className="px-2.5 py-1 rounded-lg bg-[#252830] hover:bg-[#2c303a] text-[10px] font-medium text-[#ECECEC] transition-colors"
                            >
                              Trocar avatar
                            </button>
                            <button
                              type="button"
                              className="px-2.5 py-1 rounded-lg bg-[#252830] hover:bg-[#2c303a] text-[10px] font-medium text-[#ECECEC] transition-colors"
                            >
                              Trocar banner
                            </button>
                          </div>
                        </div>

                        <div className="px-4 pb-4">
                          <h3 className="font-bold text-base text-[#ECECEC] flex items-center gap-1.5">
                            <span>{selectedMember.name}</span>
                            {selectedMember.isMaster && (
                              <Crown className="w-3.5 h-3.5 fill-current text-[#C4B5FD]" />
                            )}
                          </h3>
                          <span className="text-xs text-[#8B8F98] font-mono">
                            #{selectedMember.tag || "0000"}
                          </span>
                        </div>
                      </div>

                      {/* Insígnias Section */}
                      <div>
                        <h4 className="text-xs font-semibold text-[#ECECEC] mb-2.5">
                          Insígnias
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {selectedMember.badges?.includes("horizonte") ? (
                            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-[#16171B] border border-slate-400/50">
                              <BlackHoleBadge type="horizonte" size={18} />
                              <span className="text-[10px] text-[#ECECEC] font-bold">Horizonte</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onAssignBadges) {
                                    const next = (selectedMember.badges || []).filter((b) => b !== "horizonte");
                                    onAssignBadges(selectedMember.id, next);
                                  }
                                }}
                                className="text-[#F43F5E] text-xs hover:opacity-80 ml-1 cursor-pointer"
                                title="Remover Horizonte"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (onAssignBadges) {
                                  const current = selectedMember.badges || [];
                                  onAssignBadges(selectedMember.id, [...current, "horizonte"]);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[#16171B] hover:bg-[#252830] border border-slate-400/40 text-xs font-bold text-[#ECECEC] flex items-center gap-1.5 cursor-pointer"
                              title="Conceder Insígnia Horizonte"
                            >
                              <BlackHoleBadge type="horizonte" size={16} />
                              <span>+ Dar Horizonte</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Moedas Section */}
                      <div>
                        <h4 className="text-xs font-semibold text-[#ECECEC] mb-1.5">
                          Moedas
                        </h4>
                        <div className="mb-3">
                          <input
                            type="number"
                            value={drawerRewardAmount}
                            onChange={(e) => setDrawerRewardAmount(e.target.value)}
                            placeholder="Amount"
                            className="w-full px-3 py-2 bg-[#16171B] border border-[#2A2D35] focus:border-[#5EEAD4] rounded-xl text-xs text-[#ECECEC] font-mono outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSendCoins(selectedMember.id, drawerRewardAmount, false)}
                          className="w-full py-2.5 px-4 rounded-xl bg-[#5EEAD4] hover:bg-[#4dd6c0] text-[#16171B] font-bold text-xs tracking-tight transition-all duration-150 cursor-pointer shadow-md teal-glow"
                        >
                          Enviar recompensa
                        </button>
                      </div>

                      {/* Moderation Quick Actions */}
                      {room && (
                        <div className="pt-3 border-t border-[#2A2D35] space-y-2">
                          <button
                            type="button"
                            onClick={() => onMoveToVoiceChannel && onMoveToVoiceChannel(selectedMember.id, "voice-vip")}
                            className="w-full py-1.5 px-3 rounded-lg bg-[#252830] hover:bg-[#2c303a] text-xs font-medium text-[#C4B5FD] transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            <span>Mover para Call VIP</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onMuteUser && onMuteUser(selectedMember.id)}
                            className="w-full py-1.5 px-3 rounded-lg bg-[#252830] hover:bg-[#2c303a] text-xs font-medium text-[#ECECEC] transition-colors flex items-center justify-center gap-1.5"
                          >
                            <MicOff className="w-3.5 h-3.5 text-[#F43F5E]" />
                            <span>Mutar no microfone</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Desconectar ${selectedMember.name} da chamada?`)) {
                                if (onKickUser) onKickUser(selectedMember.id);
                              }
                            }}
                            className="w-full py-1.5 px-3 rounded-lg bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 text-xs font-medium text-[#F43F5E] transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover da sala</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </aside>
                )}
              </div>
            )}

            {/* -----------------------------------------------------------------
                TAB: VISÃO GERAL
               ----------------------------------------------------------------- */}
            {activeTab === "visao_geral" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-[#1E2026] border border-[#2A2D35]">
                    <span className="text-xs text-[#8B8F98]">Total de Membros</span>
                    <div className="text-2xl font-bold font-mono text-[#ECECEC] mt-1">
                      {currentMembersList.length}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#1E2026] border border-[#2A2D35]">
                    <span className="text-xs text-[#8B8F98]">Online Agora</span>
                    <div className="text-2xl font-bold font-mono text-[#5EEAD4] mt-1">
                      {currentMembersList.length}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#1E2026] border border-[#2A2D35]">
                    <span className="text-xs text-[#8B8F98]">Eco Coins em Circulação</span>
                    <div className="text-2xl font-bold font-mono text-[#C4B5FD] mt-1">
                      12.400
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#1E2026] border border-[#2A2D35]">
                    <span className="text-xs text-[#8B8F98]">Salas Ativas</span>
                    <div className="text-2xl font-bold font-mono text-[#ECECEC] mt-1">
                      {room ? 1 : 0}
                    </div>
                  </div>
                </div>

                {/* Audit Activity */}
                <div className="p-5 rounded-2xl bg-[#1E2026] border border-[#2A2D35]">
                  <h3 className="text-sm font-bold text-[#ECECEC] mb-3">
                    Histórico Recente do Dono
                  </h3>
                  <div className="divide-y divide-[#2A2D35]">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#5EEAD4]" />
                          <span className="text-[#ECECEC] font-medium">{log.action}</span>
                          <span className="text-[#8B8F98]">({log.target})</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#8B8F98]">
                          {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------
                TAB: MOEDAS (Eco Coins Moderation)
               ----------------------------------------------------------------- */}
            {activeTab === "moedas" && (
              <div className="flex-1 p-6 overflow-y-auto max-w-2xl space-y-6">
                <div className="p-5 rounded-2xl bg-[#1E2026] border border-[#2A2D35] space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setCoinMode("add")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        coinMode === "add"
                          ? "bg-[#5EEAD4] text-[#16171B]"
                          : "bg-[#16171B] text-[#8B8F98]"
                      }`}
                    >
                      Dar moedas
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoinMode("deduct")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        coinMode === "deduct"
                          ? "bg-[#F43F5E] text-white"
                          : "bg-[#16171B] text-[#8B8F98]"
                      }`}
                    >
                      Tirar moedas
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#ECECEC] block mb-1.5">
                      Participante
                    </label>
                    <select
                      value={coinTargetId || selectedMember.id}
                      onChange={(e) => setCoinTargetId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#16171B] border border-[#2A2D35] focus:border-[#5EEAD4] rounded-xl text-xs text-[#ECECEC] outline-none"
                    >
                      {currentMembersList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (#{m.tag || "0000"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#ECECEC] block mb-1.5">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      value={coinAmountInput}
                      onChange={(e) => setCoinAmountInput(e.target.value)}
                      className="w-full px-3 py-2 bg-[#16171B] border border-[#2A2D35] focus:border-[#5EEAD4] rounded-xl text-xs text-[#ECECEC] font-mono outline-none"
                    />

                    {/* Shortcuts */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {[50, 100, 250, 500, 1000, 2500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCoinAmountInput(amt.toString())}
                          className="px-2.5 py-1 rounded-lg bg-[#16171B] border border-[#2A2D35] text-[11px] font-mono text-[#8B8F98] hover:text-[#5EEAD4] hover:border-[#5EEAD4]/40 cursor-pointer"
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleSendCoins(
                        coinTargetId || selectedMember.id,
                        coinAmountInput,
                        coinMode === "deduct"
                      )
                    }
                    className={`w-full py-2.5 rounded-xl font-bold text-xs tracking-tight transition-all cursor-pointer shadow-md ${
                      coinMode === "add"
                        ? "bg-[#5EEAD4] hover:bg-[#4dd6c0] text-[#16171B] teal-glow"
                        : "bg-[#F43F5E] hover:bg-[#e11d48] text-white"
                    }`}
                  >
                    {coinMode === "add" ? "Enviar Eco Coins" : "Remover Eco Coins"}
                  </button>
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------
                TAB: SALA ATUAL (Gerenciamento)
               ----------------------------------------------------------------- */}
            {activeTab === "sala_atual" && room && (
              <div className="flex-1 p-6 overflow-y-auto max-w-2xl space-y-5">
                <div className="p-5 rounded-2xl bg-[#1E2026] border border-[#2A2D35] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#2A2D35]">
                    <div>
                      <h3 className="text-sm font-bold text-[#ECECEC]">{room.roomName}</h3>
                      <span className="text-xs text-[#8B8F98] font-mono">ID: {room.roomId}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="px-3 py-1.5 rounded-xl bg-[#252830] hover:bg-[#2c303a] text-xs font-semibold text-[#5EEAD4] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedInvite ? "Copiado!" : "Copiar link"}</span>
                    </button>
                  </div>

                  {/* Permissions toggles */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-[#ECECEC]">Permissões de Convidados</h4>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#16171B]">
                      <span className="text-xs text-[#ECECEC]">Câmera de convidados</span>
                      <input
                        type="checkbox"
                        checked={room.settings?.allowVideo ?? true}
                        onChange={(e) =>
                          onUpdateSettings && onUpdateSettings({ allowVideo: e.target.checked })
                        }
                        className="w-4 h-4 rounded accent-[#5EEAD4] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#16171B]">
                      <span className="text-xs text-[#ECECEC]">Compartilhar tela</span>
                      <input
                        type="checkbox"
                        checked={room.settings?.allowScreenShare ?? true}
                        onChange={(e) =>
                          onUpdateSettings && onUpdateSettings({ allowScreenShare: e.target.checked })
                        }
                        className="w-4 h-4 rounded accent-[#5EEAD4] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#16171B]">
                      <span className="text-xs text-[#ECECEC]">Chat de texto</span>
                      <input
                        type="checkbox"
                        checked={room.settings?.allowGuestChat ?? true}
                        onChange={(e) =>
                          onUpdateSettings && onUpdateSettings({ allowGuestChat: e.target.checked })
                        }
                        className="w-4 h-4 rounded accent-[#5EEAD4] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Danger Zone: Close Room */}
                  <div className="pt-4 border-t border-[#2A2D35]">
                    {confirmEndRoom ? (
                      <div className="p-3.5 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 space-y-2">
                        <p className="text-xs text-[#F43F5E] font-medium">
                          Tem certeza de que deseja encerrar a sala para todos os participantes?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (onCloseRoomForAll) onCloseRoomForAll();
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#F43F5E] text-white text-xs font-bold hover:bg-[#e11d48] cursor-pointer"
                          >
                            Sim, encerrar sala
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmEndRoom(false)}
                            className="px-3 py-1.5 rounded-xl bg-[#252830] text-[#ECECEC] text-xs font-medium cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmEndRoom(true)}
                        className="w-full py-2.5 rounded-xl bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border border-[#F43F5E]/30 text-[#F43F5E] text-xs font-bold transition-colors cursor-pointer"
                      >
                        Encerrar sala para todos
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------
                TAB: INSÍGNIAS
               ----------------------------------------------------------------- */}
            {activeTab === "insignias" && (
              <div className="flex-1 p-6 overflow-y-auto max-w-2xl space-y-5">
                <div className="p-5 rounded-2xl bg-[#1E2026] border border-[#2A2D35] space-y-4">
                  <h3 className="text-sm font-bold text-[#ECECEC]">Insígnias do Sistema</h3>
                  <div className="space-y-2">
                    {[
                      { id: "owner_supreme", name: "Dono Supremo", icon: "👑", color: "#C4B5FD" },
                      { id: "eco_creator", name: "Criador do App", icon: "🪐", color: "#5EEAD4" },
                      { id: "vip_nitro", name: "VIP Nitro", icon: "⚡", color: "#C4B5FD" },
                      { id: "pioneer_member", name: "Pioneiro eco", icon: "★", color: "#FBBF24" },
                    ].map((badge) => (
                      <div
                        key={badge.id}
                        className="p-3 rounded-xl bg-[#16171B] border border-[#2A2D35] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg"><BadgeIcon icon={badge.icon} alt={badge.name} /></span>
                          <div>
                            <span className="text-xs font-bold text-[#ECECEC] block">
                              {badge.name}
                            </span>
                            <span className="text-[10px] font-mono text-[#8B8F98]">
                              ID: {badge.id}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#252830] text-[10px] text-[#ECECEC] font-mono">
                          Ativa
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------
                TAB: LOJA (Preços editáveis pelo Dono, Recompensas e Histórico)
               ----------------------------------------------------------------- */}
            {activeTab === "loja" && (
              <div className="flex-1 p-6 overflow-y-auto max-w-4xl space-y-6">
                {storeNotice && (
                  <div className="p-3 rounded-xl bg-[#5EEAD4]/15 border border-[#5EEAD4]/40 text-[#5EEAD4] text-xs font-semibold flex items-center justify-between animate-in fade-in">
                    <span>{storeNotice}</span>
                    <button onClick={() => setStoreNotice(null)} className="underline cursor-pointer">
                      Fechar
                    </button>
                  </div>
                )}

                {/* Bloco 1: Itens da Loja com Preços Editáveis Direto na Linha */}
                <div className="p-5 rounded-2xl bg-[#1E2026] border border-[#2A2D35] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#ECECEC]">
                        Catálogo de Itens da Loja Órbita
                      </h3>
                      <p className="text-xs text-[#8B8F98]">
                        Altere os preços e durações em tempo real. A Loja atualiza imediatamente para todos os membros.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {panelStoreItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#16171B] border border-[#2A2D35] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#1E2026] border border-[#2A2D35] flex items-center justify-center text-[#5EEAD4] shrink-0">
                            {item.category === "vip" ? (
                              <Crown className="w-5 h-5 text-[#C4B5FD]" />
                            ) : item.category === "banners" ? (
                              <Film className="w-5 h-5 text-[#C4B5FD]" />
                            ) : (
                              <Sparkles className="w-5 h-5 text-[#5EEAD4]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#ECECEC] truncate">
                                {item.name}
                              </span>
                              {item.isFeatured && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/40">
                                  Destaque
                                </span>
                              )}
                              {!item.isActive && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#F43F5E]/20 text-[#F43F5E] border border-[#F43F5E]/40">
                                  Desativado
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#8B8F98] block truncate max-w-xs">
                              {item.description}
                            </span>
                          </div>
                        </div>

                        {/* Controles de Preço, Duração e Ações */}
                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                          {/* Preço editável na linha */}
                          <div className="flex items-center gap-1.5 bg-[#1E2026] border border-[#2A2D35] px-2.5 py-1 rounded-xl">
                            <EcoCoinIcon size={14} />
                            <input
                              type="number"
                              defaultValue={item.price}
                              onBlur={(e) => handleUpdateItemPrice(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateItemPrice(item.id, (e.target as HTMLInputElement).value);
                              }}
                              className="w-16 bg-transparent text-xs font-bold text-[#ECECEC] font-mono outline-none text-right"
                              title="Pressione Enter ou clique fora para salvar preço"
                            />
                            <span className="text-[10px] text-[#8B8F98]">coins</span>
                          </div>

                          {/* Duração em Horas */}
                          <select
                            value={item.durationHours || 72}
                            onChange={(e) => handleUpdateItemDuration(item.id, e.target.value)}
                            className="bg-[#1E2026] border border-[#2A2D35] text-[11px] font-semibold text-[#ECECEC] rounded-xl px-2 py-1.5 outline-none cursor-pointer"
                          >
                            <option value="24">24h</option>
                            <option value="72">72h</option>
                            <option value="168">7 dias</option>
                            <option value="720">30 dias</option>
                          </select>

                          {/* Alternar Destaque */}
                          <button
                            type="button"
                            onClick={() => handleToggleItemFeatured(item.id)}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              item.isFeatured
                                ? "bg-[#5EEAD4]/20 border-[#5EEAD4]/40 text-[#5EEAD4]"
                                : "bg-[#1E2026] border-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC]"
                            }`}
                            title={item.isFeatured ? "Remover de Destaque da Semana" : "Marcar como Destaque da Semana"}
                          >
                            ★
                          </button>

                          {/* Ligar / Desligar Item */}
                          <button
                            type="button"
                            onClick={() => handleToggleItemActive(item.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              item.isActive !== false
                                ? "bg-[#5EEAD4]/15 border-[#5EEAD4]/40 text-[#5EEAD4]"
                                : "bg-[#252830] border-[#2A2D35] text-[#8B8F98]"
                            }`}
                          >
                            {item.isActive !== false ? "Ativo" : "Inativo"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bloco 2: Valores de Recompensa Editáveis */}
                <div className="p-5 rounded-2xl bg-[#1E2026] border border-[#2A2D35] space-y-4">
                  <h3 className="text-sm font-bold text-[#ECECEC]">
                    Valores de Recompensa do Sistema
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-[#16171B] border border-[#2A2D35] space-y-2">
                      <span className="font-semibold text-[#ECECEC] block">
                        Moedas por hora em call
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          defaultValue={rewardSettings.coinsPerHour}
                          onBlur={(e) => handleUpdateRewardSetting("coinsPerHour", e.target.value)}
                          className="w-24 px-2.5 py-1.5 rounded-lg bg-[#1E2026] border border-[#2A2D35] font-mono text-xs text-[#ECECEC] outline-none"
                        />
                        <span className="text-[#8B8F98]">coins / hora</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#16171B] border border-[#2A2D35] space-y-2">
                      <span className="font-semibold text-[#ECECEC] block">
                        Bônus diário de presença
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          defaultValue={rewardSettings.dailyBonusAmount}
                          onBlur={(e) => handleUpdateRewardSetting("dailyBonusAmount", e.target.value)}
                          className="w-24 px-2.5 py-1.5 rounded-lg bg-[#1E2026] border border-[#2A2D35] font-mono text-xs text-[#ECECEC] outline-none"
                        />
                        <span className="text-[#8B8F98]">coins / dia</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bloco 3: Histórico de Alterações de Preço (Visível só para o Dono) */}
                <div className="p-5 rounded-2xl bg-[#1E2026] border border-[#2A2D35] space-y-3">
                  <h3 className="text-sm font-bold text-[#ECECEC]">
                    Histórico de Mudanças de Preço (Audit Log)
                  </h3>
                  <div className="space-y-1.5">
                    {priceAuditLogs.length > 0 ? (
                      priceAuditLogs.slice(0, 10).map((log) => (
                        <div
                          key={log.id}
                          className="px-3 py-2 rounded-xl bg-[#16171B] border border-[#2A2D35] text-xs flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#ECECEC]">{log.itemName}:</span>
                            <span className="text-[#8B8F98] line-through">{log.oldPrice} coins</span>
                            <span className="text-[#5EEAD4] font-bold">→ {log.newPrice} coins</span>
                          </div>
                          <span className="text-[10px] text-[#8B8F98] font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-[#8B8F98] block py-2">
                        Nenhuma alteração de preço registrada ainda.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------
                TAB: CONFIGURAÇÕES DO DONO
               ----------------------------------------------------------------- */}
            {activeTab === "configuracoes" && (
              <div className="flex-1 p-6 overflow-y-auto max-w-2xl space-y-5">
                <div className="p-5 rounded-2xl bg-[#1E2026] border border-[#2A2D35] space-y-4">
                  <h3 className="text-sm font-bold text-[#ECECEC]">Segurança & Dispositivos</h3>
                  <p className="text-xs text-[#8B8F98]">
                    Gerencie o acesso administrativo e revogue sessões ativas do Dono Master.
                  </p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Deseja sair da conta de Dono em todos os dispositivos?")) {
                          if (onLogoutMaster) onLogoutMaster();
                          onClose();
                        }
                      }}
                      className="py-2.5 px-4 rounded-xl bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border border-[#F43F5E]/30 text-[#F43F5E] text-xs font-bold transition-colors cursor-pointer"
                    >
                      Sair de todos os dispositivos
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
