import React, { useState } from "react";
import { tagVisivel } from "../utils/tagExibida";
import {
  Hash,
  Volume2,
  ChevronDown,
  ChevronRight,
  Megaphone,
  Radio,
  Lock,
  Mic,
  MicOff,
  Headphones,
  Settings,
  GripVertical,
  ArrowRightLeft,
  Share2,
  ChevronLeft,
} from "lucide-react";
import { Participant, TextChannel } from "../types";
import { BlackHoleBadge } from "./BlackHoleBadge";

export interface VoiceChannel {
  id: string;
  name: string;
  isVip?: boolean;
  userLimit?: number;
}

interface ChannelSidebarProps {
  roomName: string;
  roomId: string;
  isLocked?: boolean;
  textChannels: TextChannel[];
  voiceChannels: VoiceChannel[];
  activeTextChannelId: string;
  activeVoiceChannelId: string;
  onSelectTextChannel: (channelId: string) => void;
  onSelectVoiceChannel: (channelId: string) => void;
  self: Participant;
  participants: Participant[];
  isAudioMuted: boolean;
  isDeafened: boolean;
  pingMs?: number;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onOpenSettings: () => void;
  onOpenSelfProfile: () => void;
  onOpenStore?: () => void;
  onOpenInvite?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  isMaster?: boolean;
  isDarkTheme?: boolean;
  onMoveMember?: (targetSocketId: string, targetChannelId: string) => void;
  /** barra recolhida pro lado (só ícones e fotos) */
  recolhida?: boolean;
  onAlternarRecolhida?: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  roomName,
  roomId,
  isLocked = false,
  textChannels,
  voiceChannels,
  activeTextChannelId,
  activeVoiceChannelId,
  onSelectTextChannel,
  onSelectVoiceChannel,
  self,
  participants,
  isAudioMuted,
  isDeafened,
  onToggleMic,
  onToggleDeafen,
  onOpenSettings,
  onOpenSelfProfile,
  onOpenInvite,
  isOpen = true,
  isMaster = false,
  onMoveMember,
  recolhida = false,
  onAlternarRecolhida,
}) => {
  const [textCollapsed, setTextCollapsed] = useState(false);
  const [voiceCollapsed, setVoiceCollapsed] = useState(false);
  const [lockWarning, setLockWarning] = useState<string | null>(null);
  const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(null);
  const [moveMenuMemberId, setMoveMenuMemberId] = useState<string | null>(null);

  const isSpeaking = !isAudioMuted && (self.audioLevel || 0) > 15;
  const isSelfMaster = Boolean(isMaster || self.isMaster || self.tag === "0001");

  const handleVoiceChannelClick = (channel: VoiceChannel) => {
    if (channel.isVip && !isSelfMaster && !self.vipPermissions?.hasVipBadge && self.voiceChannelId !== "voice-vip") {
      setLockWarning("Canal VIP restrito ao Dono e VIPs");
      setTimeout(() => setLockWarning(null), 3500);
      return;
    }
    onSelectVoiceChannel(channel.id);
  };

  const resolvedTextChannels: TextChannel[] =
    textChannels.length > 0
      ? textChannels
      : [
          { id: "geral", name: "geral", description: "Canal principal de texto" },
          { id: "anuncios", name: "anúncios", description: "Avisos importantes" },
          { id: "links-e-midia", name: "links-e-mídia", description: "Mídias e links compartilhados" },
          { id: "comandos-bots", name: "comandos-bots", description: "Comandos e interações" },
        ];

  const resolvedVoiceChannels: VoiceChannel[] =
    voiceChannels.length > 0
      ? voiceChannels
      : [
          { id: "voice-geral", name: "Geral", isVip: false },
          { id: "voice-vip", name: "Call VIP", isVip: true },
        ];

  const initials = roomName
    ? roomName
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("") || "SA"
    : "SA";

  const fotinha = (p: Participant, tam: string) => (
    <div
      className={`${tam} rounded-full flex items-center justify-center text-[10px] font-bold text-white overflow-hidden shrink-0`}
      style={{ backgroundColor: p.avatarColor || "#2DD4BF" }}
    >
      {p.avatarUrl ? (
        <img src={p.avatarUrl} alt={p.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
      ) : (
        <span>{p.name ? p.name.slice(0, 1).toUpperCase() : "E"}</span>
      )}
    </div>
  );

  if (recolhida) {
    const naMinhaCall = participants.filter((p) => (p.voiceChannelId || "voice-geral") === (activeVoiceChannelId || "voice-geral"));
    return (
      <aside className="relative w-[58px] flex flex-col items-center h-full select-none shrink-0 z-20 bg-[#1E2026] border-r border-[#2A2D35] text-[#ECECEC] py-3 gap-2">
        <div className="w-9 h-9 rounded-full bg-[#2A2D35] border border-[#3A3D46] flex items-center justify-center font-bold text-[11px]" title={roomName}>
          {initials}
        </div>
        <div className="w-8 h-px bg-[#2A2D35] my-1" />
        <button type="button" onClick={() => onSelectTextChannel(activeTextChannelId || resolvedTextChannels[0]?.id)} className="p-2 rounded-lg text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#252830] cursor-pointer" title="Chat de texto">
          <Hash className="w-4 h-4" />
        </button>
        {resolvedVoiceChannels.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => handleVoiceChannelClick(c)}
            className={`p-2 rounded-lg cursor-pointer transition-colors ${activeVoiceChannelId === c.id ? "bg-[#5EEAD4] text-[#16171B]" : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#252830]"}`}
            title={c.name}
          >
            <Volume2 className="w-4 h-4" />
          </button>
        ))}
        <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-2 pt-1 [scrollbar-width:none]">
          {naMinhaCall.map((p) => {
            const falando = p.hasAudio && (p.audioLevel || 0) > 15;
            return (
              <div key={p.id} title={p.name} className={`rounded-full ${falando ? "ring-2 ring-[#5EEAD4]" : ""}`}>
                {fotinha(p, "w-7 h-7")}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={onToggleMic} className={`p-1.5 rounded-lg cursor-pointer ${isAudioMuted ? "text-[#F43F5E] bg-[#F43F5E]/15" : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#252830]"}`} title={isAudioMuted ? "Desmutar microfone" : "Mutar microfone"}>
          {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onOpenSelfProfile} className={`rounded-full cursor-pointer ${isSpeaking ? "ring-2 ring-[#5EEAD4]" : ""}`} title="Meu perfil">
          {fotinha(self, "w-9 h-9")}
        </button>
        {onAlternarRecolhida && (
          <button type="button" onClick={onAlternarRecolhida} className="absolute top-1/2 -right-4 -translate-y-1/2 w-4 h-10 rounded-r-md bg-[#252830] border border-l-0 border-[#2A2D35] text-[#ECECEC] flex items-center justify-center cursor-pointer hover:bg-[#2c303a] z-30" title="Abrir barra">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside
      className={`w-60 sm:w-64 flex flex-col h-full select-none shrink-0 z-20 bg-[#1E2026] border-r border-[#2A2D35] text-[#ECECEC] transition-all ${
        isOpen ? "flex" : "hidden md:flex"
      }`}
    >
      {/* 1. CABEÇALHO DA LATERAL: Iniciais em círculo cinza, nome da sala, Aberta/Trancada e X na call em cinza pequeno */}
      <div className="h-14 px-3.5 flex items-center justify-between border-b border-[#2A2D35] bg-[#1E2026]">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Círculo cinza com iniciais */}
          <div className="w-8 h-8 rounded-full bg-[#2A2D35] border border-[#3A3D46] flex items-center justify-center font-bold text-xs text-[#ECECEC] shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-xs sm:text-sm text-[#ECECEC] truncate block">
              {roomName || "eco"}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-[#8B8F98]">
              <span>{isLocked ? "Trancada" : "Aberta"}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {participants.length} na chamada
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
        {onOpenInvite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenInvite();
            }}
            className="p-1.5 rounded-lg text-[#8B8F98] hover:text-[#5EEAD4] hover:bg-[#2A2D35] transition-colors cursor-pointer"
            title="Convidar amigos para a sala"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        )}
        {onAlternarRecolhida && (
          <button
            onClick={onAlternarRecolhida}
            className="p-1.5 rounded-lg text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#2A2D35] transition-colors cursor-pointer"
            title="Recolher barra"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        </div>
      </div>

      {/* Alerta temporário de canal trancado */}
      {lockWarning && (
        <div className="mx-2 mt-2 p-2 rounded-xl bg-[#C4B5FD]/10 border border-[#C4B5FD]/30 text-[#C4B5FD] text-xs font-semibold flex items-center gap-2 shadow-sm animate-in fade-in">
          <Lock className="w-3.5 h-3.5 text-[#C4B5FD] shrink-0" />
          <span className="leading-tight">{lockWarning}</span>
        </div>
      )}

      {/* 2. LISTA DE CANAIS (Texto e Voz) */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {/* CANAIS DE TEXTO */}
        <div>
          <button
            type="button"
            onClick={() => setTextCollapsed(!textCollapsed)}
            className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold text-[#8B8F98] hover:text-[#ECECEC] tracking-wider uppercase transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-1">
              {textCollapsed ? (
                <ChevronRight className="w-3 h-3 text-[#8B8F98]" />
              ) : (
                <ChevronDown className="w-3 h-3 text-[#8B8F98]" />
              )}
              <span>Canais de Texto</span>
            </div>
            <span className="text-[10px] font-mono text-[#8B8F98]">
              ({resolvedTextChannels.length})
            </span>
          </button>

          {!textCollapsed && (
            <div className="space-y-1 mt-1">
              {resolvedTextChannels.map((channel) => {
                const isActive = activeTextChannelId === channel.id;
                const isAnnouncements =
                  channel.id === "anuncios" ||
                  channel.name.toLowerCase().includes("anúncio") ||
                  channel.name.toLowerCase().includes("anuncio");

                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => onSelectTextChannel(channel.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all group cursor-pointer relative ${
                      isActive
                        ? "bg-[#2A2D35] text-[#ECECEC] font-semibold"
                        : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#252830]"
                    }`}
                  >
                    {/* Barrinha verde-água à esquerda no canal ativo */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[#5EEAD4]" />
                    )}

                    <div className="flex items-center gap-2 min-w-0 pl-1">
                      {isAnnouncements ? (
                        <Megaphone
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? "text-[#C4B5FD]" : "text-[#8B8F98] group-hover:text-[#ECECEC]"
                          }`}
                        />
                      ) : (
                        <Hash
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? "text-[#5EEAD4]" : "text-[#8B8F98] group-hover:text-[#ECECEC]"
                          }`}
                        />
                      )}
                      <span className="truncate">{channel.name}</span>
                    </div>

                    {isAnnouncements && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#C4B5FD]/15 text-[#C4B5FD] border border-[#C4B5FD]/30">
                        Avisos
                      </span>
                    )}

                    {Boolean(channel.unreadCount && channel.unreadCount > 0) && (
                      <span className="w-2 h-2 rounded-full bg-[#5EEAD4] shadow-xs" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CANAIS DE VOZ */}
        <div>
          <button
            type="button"
            onClick={() => setVoiceCollapsed(!voiceCollapsed)}
            className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold text-[#8B8F98] hover:text-[#ECECEC] tracking-wider uppercase transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-1">
              {voiceCollapsed ? (
                <ChevronRight className="w-3 h-3 text-[#8B8F98]" />
              ) : (
                <ChevronDown className="w-3 h-3 text-[#8B8F98]" />
              )}
              <span>Canais de Voz</span>
            </div>
            <span className="text-[10px] font-mono text-[#8B8F98]">
              ({resolvedVoiceChannels.length})
            </span>
          </button>

          {!voiceCollapsed && (
            <div className="space-y-1.5 mt-1">
              {resolvedVoiceChannels.map((channel) => {
                const isActiveVoice = activeVoiceChannelId === channel.id;
                const channelParticipants = participants.filter((p) => {
                  const targetChannel = p.voiceChannelId || "voice-geral";
                  return targetChannel === channel.id;
                });
                const isDragOver = dragOverChannelId === channel.id;

                return (
                  <div
                    key={channel.id}
                    className={`rounded-xl transition-all ${
                      isDragOver
                        ? "ring-2 ring-[#5EEAD4] bg-[#5EEAD4]/10"
                        : ""
                    }`}
                    onDragOver={(e) => {
                      if (isSelfMaster) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverChannelId(channel.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (isSelfMaster) {
                        setDragOverChannelId(null);
                      }
                    }}
                    onDrop={(e) => {
                      if (isSelfMaster) {
                        e.preventDefault();
                        const memberId = e.dataTransfer.getData("text/plain");
                        if (memberId && onMoveMember) {
                          onMoveMember(memberId, channel.id);
                        }
                        setDragOverChannelId(null);
                      }
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleVoiceChannelClick(channel)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all group cursor-pointer relative ${
                        isActiveVoice
                          ? "bg-[#2A2D35] text-[#ECECEC] font-semibold"
                          : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#252830]"
                      }`}
                    >
                      {/* Barrinha verde-água à esquerda no canal de voz ativo */}
                      {isActiveVoice && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#5EEAD4]" />
                      )}

                      <div className="flex items-center gap-2 min-w-0 pl-1">
                        <Volume2
                          className={`w-4 h-4 shrink-0 ${
                            isActiveVoice
                              ? channel.isVip
                                ? "text-[#C4B5FD] animate-pulse"
                                : "text-[#5EEAD4] animate-pulse"
                              : channel.isVip
                              ? "text-[#C4B5FD]"
                              : "text-[#8B8F98] group-hover:text-[#ECECEC]"
                          }`}
                        />
                        <span className="truncate">{channel.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {channel.isVip && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#C4B5FD]/15 text-[#C4B5FD] border border-[#C4B5FD]/30">
                            <Lock className="w-2.5 h-2.5 text-[#C4B5FD]" />
                            <span>VIP</span>
                          </span>
                        )}
                        {channelParticipants.length > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full font-bold bg-[#16171B] text-[#ECECEC] border border-[#2A2D35]">
                            {channelParticipants.length}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Membros conectados no canal de voz */}
                    {channelParticipants.length > 0 && (
                      <div className="pl-3 pr-1 py-1 space-y-1">
                        {channelParticipants.map((p) => {
                          const isPartSpeaking =
                            p.id === self.id
                              ? isSpeaking
                              : (p.audioLevel || 0) > 15 && p.hasAudio !== false;
                          const isMe = p.id === self.id;
                          const isMuted = isMe
                            ? isAudioMuted
                            : p.isMutedByHost || !p.hasAudio;
                          const canMoveThisMember = Boolean(isSelfMaster && !isMe);
                          const isMemberMaster = Boolean(p.isMaster || p.tag === "0001");

                          return (
                            <div
                              key={p.id}
                              draggable={canMoveThisMember}
                              onDragStart={(e) => {
                                if (canMoveThisMember) {
                                  e.dataTransfer.setData("text/plain", p.id);
                                  e.dataTransfer.effectAllowed = "move";
                                }
                              }}
                              className={`relative group/member flex items-center justify-between px-2 py-1.5 rounded-xl text-[11px] transition-all ${
                                canMoveThisMember ? "cursor-grab active:cursor-grabbing hover:bg-[#252830]" : "cursor-default"
                              } ${
                                isMe
                                  ? "bg-[#252830]/80 text-[#ECECEC] border border-[#2A2D35]"
                                  : "bg-[#16171B]/50 hover:bg-[#252830] text-[#8B8F98] hover:text-[#ECECEC]"
                              }`}
                              title={canMoveThisMember ? "Arraste para mover para outro canal" : undefined}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {canMoveThisMember && (
                                  <GripVertical className="w-3 h-3 text-[#8B8F98] opacity-0 group-hover/member:opacity-100 transition-opacity shrink-0" />
                                )}
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all text-white ${
                                    isPartSpeaking ? "ring-2 ring-[#5EEAD4]" : ""
                                  }`}
                                  style={{ backgroundColor: p.avatarColor || "#2DD4BF" }}
                                >
                                  {p.avatarUrl ? (
                                    <img
                                      src={p.avatarUrl}
                                      alt={p.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <span>{p.name ? p.name.slice(0, 1).toUpperCase() : "E"}</span>
                                  )}
                                </div>
                                <span className={`truncate ${isMemberMaster ? "text-[#C4B5FD] font-semibold" : ""}`}>
                                  {p.name} {isMe ? "(Você)" : ""}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {isMemberMaster && (
                                  <BlackHoleBadge type="singularidade" size={13} />
                                )}
                                {isMuted ? (
                                  <MicOff className="w-3 h-3 text-[#F43F5E]" />
                                ) : isPartSpeaking ? (
                                  <Radio className="w-3 h-3 text-[#5EEAD4] animate-pulse" />
                                ) : (
                                  <Mic className="w-3 h-3 text-[#8B8F98] opacity-60" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. PAINEL DO USUÁRIO EMBAIXO: avatar, nome e tag com ícones mic, fone e engrenagem perfeitamente alinhados */}
      <div className="h-14 border-t border-[#2A2D35] px-3 flex items-center justify-between bg-[#1E2026] shrink-0">
        <button
          type="button"
          onClick={onOpenSelfProfile}
          className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#252830] transition-colors text-left min-w-0 max-w-[130px] sm:max-w-[140px] cursor-pointer group"
          title="Ver e editar meu perfil Órbita"
        >
          <div className="relative shrink-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all overflow-hidden ${
                isSpeaking ? "ring-2 ring-[#5EEAD4]" : "border border-[#2A2D35]"
              }`}
              style={{ backgroundColor: self.avatarColor || "#2DD4BF" }}
            >
              {self.avatarUrl ? (
                <img
                  src={self.avatarUrl}
                  alt={self.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{self.name ? self.name.slice(0, 1).toUpperCase() : "E"}</span>
              )}
            </div>

            {/* Status Indicator */}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1E2026] ${
                isDeafened ? "bg-[#F43F5E]" : isAudioMuted ? "bg-[#F43F5E]" : "bg-emerald-400"
              }`}
            />
          </div>

          <div className="truncate min-w-0">
            <div className="flex items-center gap-1">
              <span className={`font-bold text-xs truncate transition-colors ${isSelfMaster ? "text-[#C4B5FD]" : "text-[#ECECEC] group-hover:text-[#5EEAD4]"}`}>
                {self.name}
              </span>
              {isSelfMaster && (
                <BlackHoleBadge type="singularidade" size={13} />
              )}
            </div>
            <span className="text-[10px] text-[#8B8F98] font-mono block truncate">
              #{tagVisivel(self, "0001")}
            </span>
          </div>
        </button>

        {/* Três botões de controle alinhados: mic, fone e engrenagem */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleMic}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isAudioMuted
                ? "text-[#F43F5E] bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25"
                : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#252830]"
            }`}
            title={isAudioMuted ? "Desmutar microfone" : "Mutar microfone"}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleDeafen}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDeafened
                ? "text-[#F43F5E] bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25"
                : "text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#252830]"
            }`}
            title={isDeafened ? "Desativar ensurdecer" : "Ensurdecer áudio"}
          >
            <Headphones className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#252830] transition-colors cursor-pointer"
            title="Configurações (Modo Gamer, Tema, Dispositivos)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
