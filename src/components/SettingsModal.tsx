import React, { useState, useEffect } from "react";
import {
  X,
  Mic,
  Video,
  Volume2,
  Cpu,
  Sliders,
  Radio,
  Check,
  ShieldCheck,
} from "lucide-react";
import { UserPreferences, VideoQuality } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  preferences: UserPreferences;
  audioTestLevel: number;
  onClose: () => void;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  preferences,
  audioTestLevel,
  onClose,
  onUpdatePreferences,
}) => {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [recordingKey, setRecordingKey] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
        setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
        setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
      } catch (err) {
        console.warn("Could not enumerate media devices:", err);
      }
    };

    getDevices();
  }, [isOpen]);

  // Keybind listener for Push-to-Talk
  useEffect(() => {
    if (!recordingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      onUpdatePreferences({ pushToTalkKey: e.code });
      setRecordingKey(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recordingKey, onUpdatePreferences]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0b101e] border border-[#22304c] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1b253b] flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <span>Configurações de Áudio & Vídeo</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Audio Inputs */}
          <div className="space-y-3">
            <label className="font-semibold text-white flex items-center gap-2">
              <Mic className="w-4 h-4 text-cyan-400" />
              Dispositivo de Microfone
            </label>
            <select
              value={preferences.selectedAudioInput}
              onChange={(e) => onUpdatePreferences({ selectedAudioInput: e.target.value })}
              className="w-full bg-[#121a2d] border border-[#253550] text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="">Padrão do Sistema</option>
              {audioInputs.map((d, index) => (
                <option key={d.deviceId || index} value={d.deviceId}>
                  {d.label || `Microfone ${index + 1}`}
                </option>
              ))}
            </select>

            {/* Mic Test Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Teste do Microfone (Fale para testar)</span>
                <span className="font-mono text-cyan-400">{audioTestLevel}%</span>
              </div>
              <div className="w-full h-2 bg-[#121a2d] rounded-full overflow-hidden border border-[#253550]">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-rose-500 transition-all duration-75"
                  style={{ width: `${audioTestLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* Video Devices & Resolution */}
          <div className="space-y-3">
            <label className="font-semibold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-cyan-400" />
              Câmera & Resolução
            </label>
            <select
              value={preferences.selectedVideoInput}
              onChange={(e) => onUpdatePreferences({ selectedVideoInput: e.target.value })}
              className="w-full bg-[#121a2d] border border-[#253550] text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="">Padrão do Sistema</option>
              {videoInputs.map((d, index) => (
                <option key={d.deviceId || index} value={d.deviceId}>
                  {d.label || `Câmera ${index + 1}`}
                </option>
              ))}
            </select>

            {/* Quality Preset Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(["low", "medium", "high"] as VideoQuality[]).map((quality) => (
                <button
                  key={quality}
                  type="button"
                  onClick={() => onUpdatePreferences({ videoQuality: quality })}
                  className={`p-2 rounded-lg border text-center font-medium capitalize transition-all ${
                    preferences.videoQuality === quality
                      ? "bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-sm"
                      : "bg-[#121a2d] border-[#253550] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {quality === "low" ? "Econômico (360p)" : quality === "medium" ? "Balanceado (720p)" : "Alta (1080p)"}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Activation / Push to Talk */}
          <div className="bg-[#121a2d] border border-[#253550] rounded-xl p-4 space-y-3">
            <span className="font-semibold text-white block">
              Modo de Transmissão de Voz
            </span>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-200 block">Push-to-Talk (Aperte para Falar)</span>
                <span className="text-[11px] text-slate-400">O microfone só abre enquanto a tecla estiver pressionada</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.isPushToTalk}
                onChange={(e) => onUpdatePreferences({ isPushToTalk: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            {preferences.isPushToTalk && (
              <div className="flex items-center justify-between pt-2 border-t border-[#1e293b]">
                <span className="text-slate-300">Tecla de Ativação:</span>
                <button
                  onClick={() => setRecordingKey(true)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                    recordingKey
                      ? "bg-rose-950/60 border-rose-500 text-rose-300 animate-pulse"
                      : "bg-[#090e1a] border-[#253550] text-cyan-300 hover:border-cyan-500"
                  }`}
                >
                  {recordingKey ? "Pressione qualquer tecla..." : preferences.pushToTalkKey || "Space"}
                </button>
              </div>
            )}
          </div>

          {/* Audio Enhancements (Noise suppression) */}
          <div className="bg-[#121a2d] border border-[#253550] rounded-xl p-4 space-y-3">
            <span className="font-semibold text-white block">
              Otimizações de Áudio
            </span>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-200 block">Supressão de Ruído de Fundo</span>
                <span className="text-[11px] text-slate-400">Filtra teclados, ventiladores e ruídos ambientes</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.noiseSuppression}
                onChange={(e) => onUpdatePreferences({ noiseSuppression: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1e293b]">
              <div>
                <span className="font-medium text-slate-200 block">Cancelamento de Eco</span>
                <span className="text-[11px] text-slate-400">Evita retorno de áudio das caixas de som</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.echoCancellation}
                onChange={(e) => onUpdatePreferences({ echoCancellation: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Low Resource Mode Toggle */}
          <div className="bg-[#121a2d] border border-[#253550] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <div>
                  <span className="font-medium text-slate-200 block">Modo Baixo Consumo (Gamer)</span>
                  <span className="text-[11px] text-slate-400">Desativa decodificação de vídeo para 0% lag em jogos pesados</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.lowResourceMode}
                onChange={(e) => onUpdatePreferences({ lowResourceMode: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>
          </div>
          {/* Quick Shortcuts info */}
          <div className="bg-[#090e1a] border border-[#1e2a3f] rounded-xl p-3 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Atalho Rápido de Microfone:</span>
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-0.5 bg-[#141e30] border border-[#2b3c58] rounded text-cyan-300 font-mono font-bold">
                0
              </kbd>
              <span className="text-slate-300">Mutar / Desmutar Mic</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1b253b] bg-[#090e1a] flex justify-end">
          <button
            onClick={onClose}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-5 py-2 rounded-xl text-xs transition-colors"
          >
            Salvar & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
