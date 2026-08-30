import React from "react";
import {
  ShieldCheck,
  X,
  Check,
  UserX,
  Clock,
  Crown,
  Users,
  Shield,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Volume2,
} from "lucide-react";
import { KnockRequest, RoomState } from "../types";

interface AdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingKnocks: KnockRequest[];
  room: RoomState;
  onApprove: (socketId: string) => void;
  onReject: (socketId: string) => void;
  onApproveAll: () => void;
  onToggleRequireApproval: (requireApproval: boolean) => void;
}

export const AdmissionModal: React.FC<AdmissionModalProps> = ({
  isOpen,
  onClose,
  pendingKnocks,
  room,
  onApprove,
  onReject,
  onApproveAll,
  onToggleRequireApproval,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="bg-[#0b101e] border border-[#243654] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-amber-950/40 via-[#0d1424] to-[#080d19] border-b border-[#1b253b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-md">
              <ShieldCheck className="w-5 h-5 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">
                  Portaria & Permissão de Entrada
                </h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.2 rounded-full font-bold">
                  Exclusivo do Dono 👑
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Apenas você decide quem entra na sala ou no app
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {/* Gatekeeper Mode Selector */}
          <div className="bg-[#101728] border border-[#202f48] rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Exigir Autorização do Dono para Entrar</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {room.settings.requireKnockApproval
                  ? "Ativado: Novos convidados ficam na sala de espera até você permitir."
                  : "Desativado: Convidados entram diretamente na chamada sem pedir permissão."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onToggleRequireApproval(!room.settings.requireKnockApproval)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                room.settings.requireKnockApproval
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-950/40"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {room.settings.requireKnockApproval ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Portaria Ativa</span>
                </>
              ) : (
                <span>Acesso Livre</span>
              )}
            </button>
          </div>

          {/* Pending Knock List Header */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Pessoas Aguardando Sua Permissão ({pendingKnocks.length})
              </span>
              {pendingKnocks.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>

            {pendingKnocks.length > 1 && (
              <button
                type="button"
                onClick={onApproveAll}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Permitir Todos ({pendingKnocks.length})</span>
              </button>
            )}
          </div>

          {/* List of Pending Guests */}
          {pendingKnocks.length === 0 ? (
            <div className="bg-[#090e1a] border border-[#1b263b] rounded-xl p-8 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-400 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-slate-500" />
              </div>
              <div className="text-xs font-bold text-slate-300">
                Nenhum participante aguardando no momento
              </div>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Quando alguém clicar no seu link de convite e tentar entrar, aparecerá aqui e em uma notificação para você autorizar.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingKnocks.map((knock) => (
                <div
                  key={knock.socketId}
                  className="bg-[#0e1526] border border-[#233550] hover:border-amber-500/40 rounded-xl p-3 flex items-center justify-between gap-3 shadow-md transition-all animate-in fade-in"
                >
                  {/* Participant Info */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 overflow-hidden relative shadow-sm"
                      style={{ backgroundColor: knock.avatarColor || "#0284c7" }}
                    >
                      {knock.avatarUrl ? (
                        <img
                          src={knock.avatarUrl}
                          alt={knock.name}
                          className="w-full h-full object-cover"
                        />
                      ) : knock.avatarEmoji ? (
                        <span className="text-base">{knock.avatarEmoji}</span>
                      ) : (
                        knock.name.slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs truncate">
                          {knock.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          #{knock.tag}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-300 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-amber-400" />
                        Aguardando autorização...
                      </span>
                    </div>
                  </div>

                  {/* Decision Buttons (Only Host Can Click) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onReject(knock.socketId)}
                      className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600/50 hover:border-rose-500 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                      title="Recusar entrada deste convidado"
                    >
                      <UserX className="w-3.5 h-3.5 text-rose-400" />
                      <span>Recusar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onApprove(knock.socketId)}
                      className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-black px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/50 cursor-pointer"
                      title="Permitir entrada imediata na chamada"
                    >
                      <Check className="w-4 h-4 text-white" />
                      <span>Permitir Entrada</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#080d19] border-t border-[#1b253b] flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Controle Master do Dono Ativo</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
