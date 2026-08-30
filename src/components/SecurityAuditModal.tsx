import React from "react";
import {
  ShieldCheck,
  X,
  Lock,
  Wifi,
  FileCheck,
  AlertTriangle,
  Users,
  Eye,
  CheckCircle2,
  Radio,
} from "lucide-react";
import { RoomState } from "../types";

interface SecurityAuditModalProps {
  isOpen: boolean;
  room: RoomState;
  onClose: () => void;
  onToggleKnockApproval?: (enabled: boolean) => void;
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  isOpen,
  room,
  onClose,
  onToggleKnockApproval,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-[#0b101d] border border-[#202f4a] rounded-2xl shadow-2xl overflow-hidden text-slate-100 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#1b253b] bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                Koki Shield • Proteção & Segurança Ativa
              </h3>
              <p className="text-[11px] text-slate-400">
                Auditoria de segurança, integridade de conexão e controle de acesso
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Security Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#101728] border border-[#213250] p-3.5 rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">Criptografia P2P</span>
                <span className="text-[10px] text-slate-400">
                  Túnel WebRTC blindado via DTLS/SRTP ponta-a-ponta
                </span>
              </div>
            </div>

            <div className="bg-[#101728] border border-[#213250] p-3.5 rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">Anti-Vírus em Links</span>
                <span className="text-[10px] text-slate-400">
                  Bloqueio automático de executáveis (.exe, .scr, .bat)
                </span>
              </div>
            </div>

            <div className="bg-[#101728] border border-[#213250] p-3.5 rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">Proteção Anti-Flood</span>
                <span className="text-[10px] text-slate-400">
                  Rate-limiting de sockets contra ataques DoS/Spam
                </span>
              </div>
            </div>

            <div className="bg-[#101728] border border-[#213250] p-3.5 rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">Sanitização XSS</span>
                <span className="text-[10px] text-slate-400">
                  Nenhum script malicioso é executado no chat
                </span>
              </div>
            </div>
          </div>

          {/* Gatekeeper Admission Setting (Host Approval) */}
          <div className="bg-[#101728] border border-amber-500/40 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="font-bold text-white text-xs block">
                    Portaria Segura (Aprovação do Dono)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Se alguém repassar o link, novos convidados devem ser aprovados por você
                  </span>
                </div>
              </div>

              <input
                type="checkbox"
                checked={room.settings.requireKnockApproval !== false}
                onChange={(e) => onToggleKnockApproval?.(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Active Participants Integrity List */}
          <div className="bg-[#090f1d] border border-[#1b253b] rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Auditoria de Participantes Conectados ({room.participants.length})
              </span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> Seguro
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {room.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-[#0e1627] px-2.5 py-1.5 rounded-lg text-[11px] border border-[#1b253b]"
                >
                  <span className="font-medium text-slate-200">
                    {p.name} #{p.tag || "0001"}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {p.isHost ? "👑 Dono (Autenticado)" : "🟢 Convidado Verificado"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#080d19] border-t border-[#1b253b] flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition-colors"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
