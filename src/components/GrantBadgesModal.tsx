import React, { useState } from "react";
import { Participant } from "../types";
import { ALL_BADGES, UserBadge } from "../data/badges";
import {
  Award,
  X,
  Check,
  Shield,
  Sparkles,
  Crown,
  Zap,
  Star,
  CheckCircle2,
  Trash2,
} from "lucide-react";

interface GrantBadgesModalProps {
  isOpen: boolean;
  targetParticipant: Participant;
  onClose: () => void;
  onAssignBadges: (targetSocketId: string, badges: string[]) => void;
}

export const GrantBadgesModal: React.FC<GrantBadgesModalProps> = ({
  isOpen,
  targetParticipant,
  onClose,
  onAssignBadges,
}) => {
  // Available assignable badges (excluding internal master creator badges)
  const assignableBadges = ALL_BADGES.filter(
    (b) => !b.id.includes("owner") && b.id !== "koki_creator"
  );

  const [selectedBadgeIds, setSelectedBadgeIds] = useState<string[]>(() => {
    return Array.isArray(targetParticipant.badges) ? [...targetParticipant.badges] : [];
  });

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleBadge = (badgeId: string) => {
    setSelectedBadgeIds((prev) =>
      prev.includes(badgeId)
        ? prev.filter((id) => id !== badgeId)
        : [...prev, badgeId]
    );
  };

  const handleSave = () => {
    onAssignBadges(targetParticipant.id, selectedBadgeIds);
    setFeedbackMessage("Insígnias salvas com sucesso!");
    setTimeout(() => {
      setFeedbackMessage(null);
      onClose();
    }, 1200);
  };

  const handleSelectAllCommunity = () => {
    const communityIds = assignableBadges
      .filter((b) => b.category === "community")
      .map((b) => b.id);
    setSelectedBadgeIds((prev) => Array.from(new Set([...prev, ...communityIds])));
  };

  const handleClearAll = () => {
    setSelectedBadgeIds([]);
  };

  return (
    <div
      id="grant-badges-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div
        id="grant-badges-modal"
        className="w-full max-w-lg bg-[#0d1220] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#141e33] to-[#0d1220] border-b border-[#202e48] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-black text-amber-300">
                  Gerenciar Insígnias do Membro
                </h3>
                <span className="text-[10px] font-extrabold uppercase bg-amber-950/80 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                  Master
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Atribua ou remova medalhas de honra para{" "}
                <strong className="text-slate-200">{targetParticipant.name}</strong> #{targetParticipant.tag || "0000"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-[#141e33] hover:bg-[#1f2e4d] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Member Preview Header */}
        <div className="bg-[#090e1a] border-b border-[#202e48] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shadow-md border border-[#202e48] overflow-hidden shrink-0"
              style={{
                backgroundColor: targetParticipant.avatarColor || "#162032",
              }}
            >
              {targetParticipant.avatarUrl ? (
                <img
                  src={targetParticipant.avatarUrl}
                  alt={targetParticipant.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : targetParticipant.avatarEmoji ? (
                <span>{targetParticipant.avatarEmoji}</span>
              ) : (
                <span>{targetParticipant.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <span>{targetParticipant.name}</span>
                <span className="font-mono text-xs text-slate-400">#{targetParticipant.tag || "0000"}</span>
              </div>
              <div className="text-xs text-amber-300 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>{selectedBadgeIds.length} insígnia(s) selecionada(s)</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectAllCommunity}
              className="text-[11px] font-semibold bg-[#141e33] hover:bg-[#1b2a47] text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              + Comunidade
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-semibold bg-[#141e33] hover:bg-rose-950/40 text-rose-300 border border-rose-500/30 px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedbackMessage && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-2 text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Badge Grid List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1 custom-scrollbar">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <Shield className="w-3 h-3 text-amber-400" />
            <span>Insígnias Disponíveis para Concessão</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {assignableBadges.map((badge) => {
              const isSelected = selectedBadgeIds.includes(badge.id);

              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => toggleBadge(badge.id)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                    isSelected
                      ? "bg-amber-950/30 border-amber-400 shadow-md shadow-amber-950/40"
                      : "bg-[#121a2d] border-[#202e48] hover:border-slate-600 hover:bg-[#16213a]"
                  }`}
                >
                  {/* Badge Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0 border ${
                      isSelected
                        ? "bg-amber-500/20 border-amber-400 shadow-inner"
                        : "bg-[#090e1a] border-[#202e48]"
                    }`}
                  >
                    <span>{badge.icon}</span>
                  </div>

                  {/* Badge Details */}
                  <div className="flex-1 min-w-0 pr-5">
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-bold truncate ${
                          isSelected ? "text-amber-200" : "text-slate-200"
                        }`}
                      >
                        {badge.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                      {badge.description}
                    </p>
                  </div>

                  {/* Checkbox indicator */}
                  <div
                    className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-amber-500 border-amber-400 text-slate-950"
                        : "border-slate-600 bg-[#090e1a]"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#090e1a] border-t border-[#202e48] p-3.5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-[#141e33] hover:bg-[#1f2e4d] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs px-5 py-2 rounded-xl transition-all shadow-md shadow-amber-950/60 flex items-center gap-2 cursor-pointer"
          >
            <Award className="w-4 h-4 fill-current" />
            <span>Salvar e Conceder Insígnias</span>
          </button>
        </div>
      </div>
    </div>
  );
};
