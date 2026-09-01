import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Share2,
  Sparkles,
  MessageCircle,
  Globe,
  AlertTriangle,
  Settings2,
  ExternalLink,
} from "lucide-react";
import { RoomState } from "../types";
import {
  getEffectiveInviteUrl,
  generateInviteMessage,
  isLocalhost,
  getCustomPublicBaseUrl,
  setCustomPublicBaseUrl,
} from "../utils/inviteUrl";
import { copyToClipboardSafe, openExternalSafe } from "../utils/clipboard";

interface InviteModalProps {
  isOpen: boolean;
  room: RoomState;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  room,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedFullMsg, setCopiedFullMsg] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerInput, setCustomServerInput] = useState(() => getCustomPublicBaseUrl());
  const [serverSavedMsg, setServerSavedMsg] = useState(false);

  if (!isOpen) return null;

  const isLocal = isLocalhost();
  const inviteUrl = getEffectiveInviteUrl(room.roomId);
  const fullInviteMessage = generateInviteMessage(room.roomId, room.roomName);

  const handleCopyLink = async () => {
    await copyToClipboardSafe(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = async () => {
    await copyToClipboardSafe(room.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyFullMessage = async () => {
    await copyToClipboardSafe(fullInviteMessage);
    setCopiedFullMsg(true);
    setTimeout(() => setCopiedFullMsg(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullInviteMessage)}`;
    openExternalSafe(whatsappUrl);
  };

  const handleSaveCustomServer = () => {
    setCustomPublicBaseUrl(customServerInput);
    setServerSavedMsg(true);
    setTimeout(() => setServerSavedMsg(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="bg-[#0b101e] border border-[#22304c] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1b253b] flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            <Share2 className="w-5 h-5 text-cyan-400" />
            <span>Convidar para a Chamada</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-300 max-h-[80vh] overflow-y-auto">
          {/* Informational banner */}
          <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3.5 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[11px] text-cyan-200 leading-relaxed">
                <strong className="text-white">Acesso Global sem Instalação</strong>: Seus amigos podem entrar diretamente pelo navegador no computador ou no celular, sem precisar de cadastro.
              </p>
            </div>
          </div>

          {/* Localhost / Private IP Notice */}
          {isLocal && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
              <div className="flex items-start gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="text-[11px] leading-relaxed">
                  <p className="font-semibold text-amber-200">
                    Você está executando em ambiente Local (localhost)
                  </p>
                  <p className="text-amber-300/80 mt-0.5">
                    Para amigos em redes/casas diferentes conectarem, use o <strong className="text-amber-100">Código da Sala</strong> no site publicado ou configure seu link público abaixo.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowServerConfig(!showServerConfig)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {showServerConfig ? "Ocultar configuração de Domínio" : "Definir Domínio/URL Pública da Aplicação"}
              </button>

              {showServerConfig && (
                <div className="pt-2 space-y-2 border-t border-amber-500/20">
                  <label className="text-[11px] text-slate-300 block">
                    URL Pública do Servidor / App (Ex: https://meu-app.com ou Cloud Run):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://seu-dominio-ou-cloud.app"
                      value={customServerInput}
                      onChange={(e) => setCustomServerInput(e.target.value)}
                      className="bg-[#121a2d] border border-[#253550] text-slate-200 text-xs rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <button
                      onClick={handleSaveCustomServer}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1.5 rounded-lg shrink-0 cursor-pointer font-medium"
                    >
                      {serverSavedMsg ? "Salvo!" : "Aplicar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Link Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-white block">Link Direto de Convidado</label>
              <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-mono">
                <Globe className="w-3 h-3" /> Conexão Automática
              </span>
            </div>
            <div className="flex items-center gap-2 bg-[#121a2d] border border-[#253550] rounded-xl p-2 focus-within:border-cyan-500">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="bg-transparent text-cyan-300 text-xs w-full focus:outline-none font-mono truncate px-1"
              />
              <button
                onClick={handleCopyLink}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-sm"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          {/* Room Code */}
          <div className="space-y-1.5">
            <label className="font-semibold text-white block">Código Universal da Sala</label>
            <div className="flex items-center justify-between bg-[#121a2d] border border-[#253550] rounded-xl p-2.5">
              <span className="font-mono text-sm font-bold text-white tracking-widest pl-2">
                {room.roomId}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{copiedCode ? "Copiado!" : "Copiar Código"}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Qualquer amigo pode colar este código ou o link completo no campo de busca do Lobby para entrar.
            </p>
          </div>

          {/* Quick Share Buttons */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyFullMessage}
              className="p-2.5 bg-[#121a2d] hover:bg-[#1a253f] border border-[#253550] text-slate-200 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer"
            >
              {copiedFullMsg ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedFullMsg ? "Copiado!" : "Copiar Convite Formatado"}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="p-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Enviar no WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1b253b] bg-[#090e1a] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#162032] hover:bg-[#1e2c44] border border-[#253550] text-slate-200 px-4 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
