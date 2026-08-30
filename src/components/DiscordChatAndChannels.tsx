import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Hash,
  Sparkles,
  Dice5,
  Coins,
  MessageSquare,
  ChevronRight,
  Info,
  Crown,
  ShieldAlert,
} from "lucide-react";
import { ChatMessage, Participant, TextChannel } from "../types";

interface DiscordChatAndChannelsProps {
  isOpen: boolean;
  channels: TextChannel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  messages: ChatMessage[];
  self: Participant;
  onClose: () => void;
  onSendMessage: (text: string, channelId: string) => void;
}

const QUICK_EMOJIS = ["👍", "🔥", "😂", "🎮", "👏", "🚀", "🎯", "❤️", "💀", "👑"];

export const DiscordChatAndChannels: React.FC<DiscordChatAndChannelsProps> = ({
  isOpen,
  channels,
  activeChannelId,
  onSelectChannel,
  messages,
  self,
  onClose,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0] || {
    id: "geral",
    name: "geral",
    description: "Canal principal de texto",
  };

  const channelMessages = messages.filter((m) => (m.channelId || "geral") === activeChannel.id);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [channelMessages.length, isOpen, activeChannelId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), activeChannel.id);
    setInputText("");
  };

  const handleSendEmoji = (emoji: string) => {
    onSendMessage(emoji, activeChannel.id);
  };

  const handleRollDice = () => {
    onSendMessage("/roll 20", activeChannel.id);
  };

  const handleFlipCoin = () => {
    onSendMessage("/coin", activeChannel.id);
  };

  return (
    <aside className="w-96 bg-[#090e1a] border-l border-[#1b253b] flex flex-col h-full z-10 select-none">
      {/* Top Header: Channel Selector & Close Button */}
      <div className="h-14 px-3 border-b border-[#1b253b] flex items-center justify-between bg-[#080d18]">
        <div className="flex items-center gap-2 overflow-hidden">
          <Hash className="w-5 h-5 text-slate-400 shrink-0" />
          <div className="truncate">
            <h3 className="font-bold text-white text-xs truncate">
              {activeChannel.name}
            </h3>
            <p className="text-[10px] text-slate-400 truncate">
              {activeChannel.description}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Horizontal Channels Bar (Quick Switcher) */}
      <div className="flex items-center gap-1.5 p-2 bg-[#060a12] border-b border-[#1b253b] overflow-x-auto scrollbar-none">
        {channels.map((ch) => {
          const isActive = ch.id === activeChannel.id;
          return (
            <button
              key={ch.id}
              onClick={() => onSelectChannel(ch.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#121a2d]"
              }`}
            >
              <Hash className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
              <span>{ch.name}</span>
            </button>
          );
        })}
      </div>

      {/* Message List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3.5 bg-[#080d19]">
        {/* Welcome Channel Banner */}
        <div className="p-3 bg-[#0d1424] border border-[#1b253b] rounded-xl text-center space-y-1">
          <div className="w-10 h-10 rounded-full bg-cyan-950/70 border border-cyan-800/40 flex items-center justify-center mx-auto text-cyan-300">
            <Hash className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-xs">
            Bem-vindo ao canal #{activeChannel.name}!
          </h4>
          <p className="text-[11px] text-slate-400">
            {activeChannel.description}
          </p>
        </div>

        {channelMessages.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            Nenhuma mensagem enviada neste canal ainda. Comece a conversa!
          </div>
        ) : (
          channelMessages.map((msg) => {
            const isMe = msg.senderId === self.id;
            const isSystem = msg.isSystem;

            if (isSystem || msg.isSecurityWarning) {
              return (
                <div
                  key={msg.id}
                  className={`rounded-xl px-3 py-2 text-xs flex items-start gap-2 select-text ${
                    msg.isSecurityWarning
                      ? "bg-rose-950/40 border border-rose-600/50 text-rose-200"
                      : "bg-cyan-950/20 border border-cyan-500/20 text-cyan-200"
                  }`}
                >
                  <span className="text-base leading-none">
                    {msg.isSecurityWarning ? <ShieldAlert className="w-4 h-4 text-rose-400" /> : (msg.senderAvatarEmoji || "🤖")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`font-bold ${msg.isSecurityWarning ? "text-rose-400" : "text-cyan-300"}`}>
                      {msg.senderName}:{" "}
                    </span>
                    <span className="text-slate-200">{msg.text}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className="flex items-start gap-2.5 group select-text hover:bg-slate-900/40 -mx-1.5 px-1.5 py-1 rounded-lg transition-colors"
              >
                {/* Avatar (Photo, Animated GIF or Emoji) */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm ring-1 ring-white/10 overflow-hidden"
                  style={{
                    backgroundColor: msg.senderAvatarColor || (isMe ? self.avatarColor : "#38bdf8"),
                  }}
                >
                  {(msg.senderAvatarUrl || (isMe && self.avatarUrl)) ? (
                    <img
                      src={msg.senderAvatarUrl || self.avatarUrl}
                      alt={msg.senderName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{msg.senderAvatarEmoji || (isMe ? self.avatarEmoji : "🎮")}</span>
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={`text-xs font-bold ${
                        msg.senderIsHost || (isMe && self.isHost) ? "text-amber-300" : "text-white"
                      }`}
                    >
                      {isMe ? "Você" : msg.senderName}
                    </span>

                    {(msg.senderIsHost || (isMe && self.isHost)) && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <Crown className="w-2.5 h-2.5" /> DONO
                      </span>
                    )}

                    <span className="text-[10px] text-slate-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="text-xs text-slate-200 break-words leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Interactive Bots and Quick Emojis Dock */}
      <div className="px-3 py-1.5 border-t border-[#1b253b] bg-[#070b14] flex items-center justify-between gap-1 overflow-x-auto">
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleRollDice}
            className="flex items-center gap-1 px-2 py-1 bg-[#131b2c] hover:bg-[#1a253d] border border-[#253550] rounded-lg text-[11px] font-medium text-cyan-300 transition-colors cursor-pointer"
            title="Rolar um dado d20"
          >
            <Dice5 className="w-3.5 h-3.5 text-cyan-400" />
            <span>d20</span>
          </button>

          <button
            onClick={handleFlipCoin}
            className="flex items-center gap-1 px-2 py-1 bg-[#131b2c] hover:bg-[#1a253d] border border-[#253550] rounded-lg text-[11px] font-medium text-amber-300 transition-colors cursor-pointer"
            title="Jogar moeda (cara ou coroa)"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Moeda</span>
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSendEmoji(emoji)}
              className="p-1 hover:bg-[#162032] rounded-lg transition-transform hover:scale-125 text-xs cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Input Field */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#1b253b] bg-[#060a12]">
        <div className="flex items-center gap-2 bg-[#101726] border border-[#253550] rounded-xl px-3 py-2 focus-within:border-cyan-500 transition-colors">
          <input
            type="text"
            placeholder={`Conversar em #${activeChannel.name}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            maxLength={500}
            className="bg-transparent text-white text-xs w-full focus:outline-none placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="text-cyan-400 disabled:text-slate-600 hover:text-cyan-300 transition-colors shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
};
