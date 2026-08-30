import React, { useState, useRef, useEffect } from "react";
import { X, Send, Smile, MessageSquare } from "lucide-react";
import { ChatMessage, Participant } from "../types";

interface ChatSidebarProps {
  isOpen: boolean;
  messages: ChatMessage[];
  self: Participant;
  onClose: () => void;
  onSendMessage: (text: string) => void;
}

const QUICK_EMOJIS = ["👍", "🔥", "😂", "🎮", "👏", "🚀", "🎯", "❤️"];

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  messages,
  self,
  onClose,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleSendEmoji = (emoji: string) => {
    onSendMessage(emoji);
  };

  return (
    <aside className="w-80 bg-[#090e1a] border-l border-[#1b253b] flex flex-col h-full z-10 select-none">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#1b253b] flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span>Chat da Chamada</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center px-4">
            <MessageSquare className="w-8 h-8 stroke-1 mb-2 text-slate-600" />
            <p>Nenhuma mensagem ainda.</p>
            <p className="text-[11px] text-slate-600 mt-1">Envie uma mensagem ou reação rápida para o grupo!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === self.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-300">
                    {isMe ? "Você" : msg.senderName}
                  </span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div
                  className={`px-3 py-2 rounded-xl text-xs max-w-[85%] break-words select-text ${
                    isMe
                      ? "bg-cyan-600 text-white rounded-br-none"
                      : "bg-[#162032] border border-[#253550] text-slate-200 rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emojis */}
      <div className="px-3 py-1.5 border-t border-[#1b253b] flex items-center justify-between gap-1 overflow-x-auto">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSendEmoji(emoji)}
            className="p-1 hover:bg-[#162032] rounded-lg transition-transform hover:scale-125 text-sm"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#1b253b] bg-[#070b14]">
        <div className="flex items-center gap-2 bg-[#121b2c] border border-[#253550] rounded-xl px-3 py-2 focus-within:border-cyan-500 transition-colors">
          <input
            type="text"
            placeholder="Enviar mensagem..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            maxLength={300}
            className="bg-transparent text-white text-xs w-full focus:outline-none placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="text-cyan-400 disabled:text-slate-600 hover:text-cyan-300 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
};
