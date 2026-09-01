import React, { useState } from "react";
import {
  Hash,
  Volume2,
  ChevronDown,
  ChevronRight,
  Crown,
  Sparkles,
  ShieldCheck,
  Megaphone,
  Radio,
  Lock,
  Mic,
  MicOff,
  Headphones,
  Settings,
  Coins,
  Signal,
  Share2,
} from "lucide-react";
import { Participant, TextChannel } from "../types";
import { getKokiCoins, formatCoinDisplay } from "../utils/storage";

export interface VoiceChannel {
  id: string;
  name: string;
  isVip?: boolean;
  userLimit?: number;
}

interface ChannelSidebarProps {
  roomName: string;
  roomId: string;
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
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  roomName,
  roomId,
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
  pingMs = 28,
  onToggleMic,
  onToggleDeafen,
  onOpenSettings,
  onOpenSelfProfile,
  onOpenStore,
  onOpenInvite,
  isOpen = true,
  onClose,
  isMaster = false,
}) => {
  const [textCollapsed, setTextCollapsed] = useState(false);
  const [voiceCollapsed, setVoiceCollapsed] = useState(false);
  const [lockWarning, setLockWarning] = useState<string | null>(null);

  const isSpeaking = !isAudioMuted && (self.audioLevel || 0) > 15;
  const coins = typeof self.kokiCoins === "number" ? self.kokiCoins : getKokiCoins();

  const handleVoiceChannelClick = (channel: VoiceChannel) => {
    if (channel.isVip && !isMaster && self.voiceChannelId !== "voice-vip") {
      setLockWarning("Canal restrito ao Dono Master");
      setTimeout(() => setLockWarning(null), 3500);
      return;
    }
    onSelectVoiceChannel(channel.id);
  };

  // Filter default 2 text channels and 2 voice channels if not provided
  const resolvedTextChannels: TextChannel[] = textChannels.length > 0 ? textChannels : [
    { id: "geral", name: "geral", description: "Canal principal de texto da call" },
    { id: "anuncios", name: "anúncios", description: "Avisos importantes e novidades da comunidade" },
  ];

  const resolvedVoiceChannels: VoiceChannel[] = voiceChannels.length > 0 ? voiceChannels : [
    { id: "voice-geral", name: "Geral", isVip: false },
    { id: "voice-vip", name: "Call VIP", isVip: true },
  ];

  return (
    <aside
      className={`w-60 sm:w-64 bg-[#080d19] border-r border-[#1a253c] flex flex-col h-full select-none shrink-0 z-20 transition-all ${
        isOpen ? "flex" : "hidden md:flex"
      }`}
    >
      {/* 1. Discord Server / Room Header */}
      <div className="h-14 px-3.5 border-b border-[#1a253c] flex items-center justify-between bg-[#0a101f] shadow-sm hover:bg-[#0e162a] transition-colors cursor-pointer group">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center font-black text-white text-xs shadow-md shadow-indigo-950/50 shrink-0">
            {roomName ? roomName.substring(0, 2).toUpperCase() : "KC"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-white text-xs sm:text-sm truncate">
                {roomName || "Koki Call"}
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              {participants.length} online
            </span>
          </div>
        </div>

        {onOpenInvite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenInvite();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2742] transition-colors cursor-pointer"
            title="Convidar amigos para a call"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Warning banner for restricted channels */}
      {lockWarning && (
        <div className="mx-2 mt-2 p-2 rounded-xl bg-amber-950/90 border border-amber-500/60 text-amber-200 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2 duration-150 shadow-lg">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="leading-tight">{lockWarning}</span>
        </div>
      )}

      {/* 2. Channel List (Scrollable Discord Navigation) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        {/* TEXT CHANNELS CATEGORY */}
        <div>
          <button
            type="button"
            onClick={() => setTextCollapsed(!textCollapsed)}
            className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 tracking-wider uppercase transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-1">
              {textCollapsed ? (
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-transform" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-transform" />
              )}
              <span>Canais de Texto</span>
            </div>
            <span className="text-[10px] text-slate-500 group-hover:text-slate-400 font-mono">
              ({resolvedTextChannels.length})
            </span>
          </button>

          {!textCollapsed && (
            <div className="space-y-0.5 mt-1">
              {resolvedTextChannels.map((channel) => {
                const isActive = activeTextChannelId === channel.id;
                const isAnnouncements = channel.id === "anuncios" || channel.name.toLowerCase().includes("anúncio") || channel.name.toLowerCase().includes("anuncio");

                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => onSelectTextChannel(channel.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all group cursor-pointer ${
                      isActive
                        ? "bg-[#18233c] text-white font-bold shadow-sm border border-cyan-500/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-[#11192b]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isAnnouncements ? (
                        <Megaphone className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-amber-400" : "text-slate-400 group-hover:text-amber-300"}`} />
                      ) : (
                        <Hash className={`w-4 h-4 shrink-0 ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                      )}
                      <span className="truncate">{channel.name}</span>
                    </div>

                    {isAnnouncements && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Avisos
                      </span>
                    )}

                    {Boolean(channel.unreadCount && channel.unreadCount > 0) && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* VOICE CHANNELS CATEGORY */}
        <div>
          <button
            type="button"
            onClick={() => setVoiceCollapsed(!voiceCollapsed)}
            className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 tracking-wider uppercase transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-1">
              {voiceCollapsed ? (
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-transform" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-transform" />
              )}
              <span>Canais de Voz</span>
            </div>
            <span className="text-[10px] text-slate-500 group-hover:text-slate-400 font-mono">
              ({resolvedVoiceChannels.length})
            </span>
          </button>

          {!voiceCollapsed && (
            <div className="space-y-1 mt-1">
              {resolvedVoiceChannels.map((channel) => {
                const isActiveVoice = activeVoiceChannelId === channel.id;
                // Channel users filtered strictly by their voiceChannelId
                const channelParticipants = participants.filter((p) => {
                  const pChannel = p.voiceChannelId || "voice-geral";
                  return pChannel === channel.id;
                });

                return (
                  <div key={channel.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => handleVoiceChannelClick(channel)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all group cursor-pointer ${
                        isActiveVoice
                          ? channel.isVip
                            ? "bg-gradient-to-r from-amber-950/80 to-[#2b2012] text-amber-300 border border-amber-500/50 shadow-sm"
                            : "bg-gradient-to-r from-emerald-950/80 to-[#12242b] text-emerald-300 border border-emerald-500/40 shadow-sm"
                          : channel.isVip
                          ? "text-amber-300/80 hover:text-amber-200 hover:bg-[#1a1520] border border-amber-500/20"
                          : "text-slate-400 hover:text-slate-200 hover:bg-[#11192b]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Volume2 className={`w-4 h-4 shrink-0 ${
                          isActiveVoice
                            ? channel.isVip ? "text-amber-400 animate-pulse" : "text-emerald-400 animate-pulse"
                            : channel.isVip ? "text-amber-400/70" : "text-slate-500 group-hover:text-slate-300"
                        }`} />
                        <span className="truncate">{channel.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {channel.isVip && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs">
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                            <span>VIP</span>
                          </span>
                        )}
                        {channelParticipants.length > 0 && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold border ${
                            channel.isVip
                              ? "text-amber-300 bg-amber-950/90 border-amber-700/60"
                              : "text-emerald-400 bg-emerald-950/90 border-emerald-800/60"
                          }`}>
                            {channelParticipants.length}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Connected Users List strictly for this voice channel */}
                    {channelParticipants.length > 0 && (
                      <div className="pl-4 pr-1 py-1 space-y-1">
                        {channelParticipants.map((p) => {
                          const isPartSpeaking = p.id === self.id ? isSpeaking : ((p.audioLevel || 0) > 15 && !p.hasAudio === false);
                          const isMe = p.id === self.id;
                          const isMuted = isMe ? isAudioMuted : (p.isMutedByHost || !p.hasAudio);

                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between px-2 py-1 rounded-lg text-[11px] transition-colors group cursor-default ${
                                isMe
                                  ? "bg-cyan-950/40 text-cyan-200 border border-cyan-800/30"
                                  : "bg-[#0c1322]/80 hover:bg-[#141f36] text-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                                    isPartSpeaking
                                      ? "ring-2 ring-emerald-400 shadow-sm shadow-emerald-500/50"
                                      : ""
                                  }`}
                                  style={{ backgroundColor: p.avatarColor || "#0284c7" }}
                                >
                                  {p.avatarUrl ? (
                                    <img
                                      src={p.avatarUrl}
                                      alt={p.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <span>{p.avatarEmoji || (p.isHost ? "👑" : "🎮")}</span>
                                  )}
                                </div>
                                <span className={`truncate ${isMe ? "font-bold text-white" : ""}`}>
                                  {p.name} {isMe ? "(Você)" : ""}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {p.isHost && (
                                  <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                                )}
                                {isMuted ? (
                                  <MicOff className="w-3 h-3 text-rose-400" />
                                ) : isPartSpeaking ? (
                                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                                ) : (
                                  <Mic className="w-3 h-3 text-slate-500 opacity-60" />
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

      {/* 3. Live Voice Connection Status Banner */}
      <div className="px-3 py-2 bg-[#060a12] border-t border-[#1a253c] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <Signal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="font-bold text-emerald-400 block text-[11px] leading-tight">
              Voz Conectada
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              WebRTC • {pingMs}ms
            </span>
          </div>
        </div>

        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50">
          HD Audio
        </span>
      </div>

      {/* 4. Bottom Discord Self Profile Bar */}
      <div className="h-14 bg-[#070b14] border-t border-[#1a253c] px-2.5 flex items-center justify-between">
        {/* Clickable Profile Area */}
        <button
          type="button"
          onClick={onOpenSelfProfile}
          className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#121b2d] transition-all text-left min-w-0 max-w-[130px] sm:max-w-[140px] cursor-pointer group"
          title="Ver ou editar seu perfil do Discord"
        >
          <div className="relative shrink-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-all ${
                isSpeaking
                  ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#070b14]"
                  : "ring-1 ring-white/10"
              }`}
              style={{ backgroundColor: self.avatarColor || "#0284c7" }}
            >
              {self.avatarUrl ? (
                <img
                  src={self.avatarUrl}
                  alt={self.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{self.avatarEmoji || (self.isHost ? "👑" : "🎮")}</span>
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#070b14] ${
                isDeafened
                  ? "bg-rose-600"
                  : isAudioMuted
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
            />
          </div>

          <div className="truncate min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-white text-xs truncate group-hover:text-cyan-300 transition-colors">
                {self.name}
              </span>
              {self.isHost && (
                <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono block truncate">
              #{self.tag || "1024"}
            </span>
          </div>
        </button>

        {/* Action Controls: Mic, Deafen, Settings, Store */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMic}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isAudioMuted
                ? "text-rose-400 hover:bg-rose-950/60 bg-rose-950/30"
                : "text-slate-400 hover:text-white hover:bg-[#152035]"
            }`}
            title={isAudioMuted ? "Desmutar Microfone (0)" : "Mutar Microfone (0)"}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleDeafen}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDeafened
                ? "text-rose-400 hover:bg-rose-950/60 bg-rose-950/30"
                : "text-slate-400 hover:text-white hover:bg-[#152035]"
            }`}
            title={isDeafened ? "Desativar Ensurdecer" : "Ensurdecer Áudio"}
          >
            <Headphones className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#152035] transition-colors cursor-pointer"
            title="Configurações de Áudio e Vídeo"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
