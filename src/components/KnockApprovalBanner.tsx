import React from "react";
import { ShieldAlert, Check, X, Clock, UserCheck } from "lucide-react";
import { KnockRequest } from "../types";

interface KnockApprovalBannerProps {
  requests: KnockRequest[];
  onApprove: (socketId: string) => void;
  onReject: (socketId: string) => void;
}

export const KnockApprovalBanner: React.FC<KnockApprovalBannerProps> = ({
  requests,
  onApprove,
  onReject,
}) => {
  if (!requests || requests.length === 0) return null;

  return (
    <aside aria-label="Controle de acesso à sala" className="fixed top-16 right-4 z-50 w-full max-w-md space-y-2 pointer-events-auto animate-in slide-in-from-top-4 duration-300">
      {requests.map((req) => (
        <div
          key={req.socketId}
          className="bg-[#0e1627] border-2 border-amber-500/60 rounded-2xl p-3.5 shadow-2xl text-slate-100 flex flex-col gap-2.5 backdrop-blur-md ring-4 ring-amber-500/10"
        >
          {/* Top Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
              <span>Solicitação de Entrada (Portaria Segura)</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Agora
            </span>
          </div>

          {/* User Preview */}
          <div className="flex items-center gap-3 bg-[#080d19] p-2.5 rounded-xl border border-[#1b253b]">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white shadow shrink-0 bg-cover bg-center"
              style={{
                backgroundColor: req.avatarColor || "#38bdf8",
                backgroundImage: req.avatarUrl ? `url(${req.avatarUrl})` : undefined,
              }}
            >
              {!req.avatarUrl && (req.avatarEmoji || "🎮")}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-white text-xs truncate">{req.name}</span>
                <span className="text-[10px] text-slate-400 font-semibold">#{req.tag}</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {req.customStatus || "Pedindo permissão para entrar na chamada"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onApprove(req.socketId)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Permitir Entrada</span>
            </button>
            <button
              onClick={() => onReject(req.socketId)}
              className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Recusar</span>
            </button>
          </div>
        </div>
      ))}
    </aside>
  );
};
