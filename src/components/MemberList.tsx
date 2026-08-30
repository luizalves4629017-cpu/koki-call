import React from "react";
import {
  Crown,
  MicOff,
  Headphones,
  Video,
  Monitor,
  Check,
  UserX,
  ShieldCheck,
} from "lucide-react";
import { Participant, KnockRequest } from "../types";

interface MemberListProps {
  participants: Participant[];
  selfId: string;
  selfIsHost?: boolean;
  pendingKnocks?: KnockRequest[];
  onApproveKnock?: (socketId: string) => void;
  onRejectKnock?: (socketId: string) => void;
  onSelectParticipant: (participant: Participant) => void;
}

export const MemberList: React.FC<MemberListProps> = ({
  participants,
  selfId,
  selfIsHost,
  pendingKnocks = [],
  onApproveKnock,
  onRejectKnock,
  onSelectParticipant,
}) => {
  const hosts = participants.filter((p) => p.isHost);
  const guests = participants.filter((p) => !p.isHost);

  const renderMemberRow = (participant: Participant) => {
    const isSelf = participant.id === selfId;
    const isSpeaking = participant.hasAudio && (participant.audioLevel || 0) > 15;

    return (
      <button
        key={participant.id}
        onClick={() => onSelectParticipant(participant)}
        className={`w-full group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
          isSpeaking
            ? "bg-emerald-950/20 hover:bg-emerald-950/30"
            : "hover:bg-[#151c2d]"
        }`}
      >
        {/* Avatar with speaking ring */}
        <div className="relative shrink-0">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow-md transition-all overflow-hidden ${
              isSpeaking
                ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#090e1a] scale-105"
                : "ring-1 ring-white/10"
            }`}
            style={{
              backgroundColor: participant.avatarColor || "#38bdf8",
            }}
          >
            {participant.avatarUrl ? (
              <img
                src={participant.avatarUrl}
                alt={participant.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{participant.avatarEmoji || (participant.isHost ? "👑" : "🎮")}</span>
            )}
          </div>

          {/* Status Indicator Dot */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#090e1a] ${
              isSpeaking
                ? "bg-emerald-400"
                : participant.isDeafened
                ? "bg-rose-500"
                : !participant.hasAudio
                ? "bg-slate-500"
                : "bg-emerald-500"
            }`}
          />
        </div>

        {/* Member Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-semibold truncate ${
                participant.isHost ? "text-amber-300" : "text-slate-200 group-hover:text-white"
              }`}
            >
              {participant.name}
            </span>

            {participant.tag === "0001" || participant.badges?.includes("owner_supreme") ? (
              <Crown className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400/20" />
            ) : participant.isHost ? (
              <span className="text-[9px] font-bold text-cyan-400 bg-cyan-950/60 px-1 rounded border border-cyan-800/40 shrink-0">Host</span>
            ) : null}

            {isSelf && (
              <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider bg-cyan-950/60 px-1 rounded border border-cyan-800/40">
                Você
              </span>
            )}
          </div>

          {/* Custom Status text */}
          <p className="text-[11px] text-slate-400 truncate mt-0.5 leading-tight">
            {participant.customStatus || (isSpeaking ? "Falando..." : "🟢 Online")}
          </p>
        </div>

        {/* Device Badges (Mute, Deafen, Screen, Video) */}
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {participant.isScreenSharing && (
            <div title="Transmitindo tela" className="p-1 rounded bg-purple-950/50 text-purple-400 border border-purple-800/40">
              <Monitor className="w-3 h-3" />
            </div>
          )}

          {participant.hasVideo && (
            <div title="Câmera ligada" className="p-1 rounded bg-cyan-950/50 text-cyan-400 border border-cyan-800/40">
              <Video className="w-3 h-3" />
            </div>
          )}

          {participant.isDeafened && (
            <div title="Fone desativado" className="p-1 rounded bg-rose-950/50 text-rose-400 border border-rose-800/40">
              <Headphones className="w-3 h-3" />
            </div>
          )}

          {!participant.hasAudio && !participant.isDeafened && (
            <div title="Microfone mutado" className="p-1 rounded bg-slate-800/60 text-slate-400">
              <MicOff className="w-3 h-3" />
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="w-60 bg-[#090e1a] border-l border-[#1b253b] flex flex-col h-full select-none">
      {/* Header */}
      <div className="h-12 px-4 border-b border-[#1b253b] flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Membros na Call ({participants.length})
        </span>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Waiting Room / Knocking Category (Exclusive for Host) */}
        {selfIsHost && pendingKnocks.length > 0 && (
          <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-2 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Portaria ({pendingKnocks.length})
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            </div>

            <div className="space-y-1.5">
              {pendingKnocks.map((knock) => (
                <div
                  key={knock.socketId}
                  className="bg-[#0b101e] border border-amber-500/30 rounded-lg p-2 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                      style={{ backgroundColor: knock.avatarColor || "#0284c7" }}
                    >
                      {knock.avatarUrl ? (
                        <img src={knock.avatarUrl} alt={knock.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{knock.avatarEmoji || "🎮"}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{knock.name}</div>
                      <div className="text-[10px] text-amber-300/80">Quer entrar</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 pt-1">
                    {onRejectKnock && (
                      <button
                        onClick={() => onRejectKnock(knock.socketId)}
                        className="flex-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600/50 text-[10px] font-bold py-1 rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Recusar"
                      >
                        <UserX className="w-3 h-3" />
                        <span>Recusar</span>
                      </button>
                    )}
                    {onApproveKnock && (
                      <button
                        onClick={() => onApproveKnock(knock.socketId)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black py-1 rounded flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                        title="Permitir Entrada"
                      >
                        <Check className="w-3 h-3 font-bold" />
                        <span>Permitir</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Host Category */}
        {hosts.length > 0 && (
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-amber-400" />
              <span>Dono da Sala — {hosts.length}</span>
            </div>
            <div className="space-y-0.5">
              {hosts.map(renderMemberRow)}
            </div>
          </div>
        )}

        {/* Guests Category */}
        {guests.length > 0 && (
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Convidados — {guests.length}</span>
            </div>
            <div className="space-y-0.5">
              {guests.map(renderMemberRow)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
