import React, { useState, useEffect } from "react";
import {
  X,
  Mic,
  Video,
  Volume2,
  Cpu,
  Sliders,
  Sun,
  Moon,
  Sparkles,
  Check,
  AudioLines,
} from "lucide-react";
import { UserPreferences, VideoQuality } from "../types";
import { MicProcessor, MicLevelInfo, MIC_DB_MIN, MIC_DB_MAX } from "../utils/micProcessor";

const dbToPct = (db: number) =>
  Math.max(0, Math.min(100, ((db - MIC_DB_MIN) / (MIC_DB_MAX - MIC_DB_MIN)) * 100));

// Medidor + slider de sensibilidade (estilo Discord): a barra mostra o volume da sua voz
// e o marcador mostra onde está o limite. Abaixo dele o microfone fica mudo.
const SensibilidadeMicrofone: React.FC<{
  micProcessor: MicProcessor | null;
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
}> = ({ micProcessor, preferences, onUpdatePreferences }) => {
  const [info, setInfo] = useState<MicLevelInfo | null>(() => (micProcessor ? micProcessor.level : null));

  useEffect(() => {
    if (!micProcessor) {
      setInfo(null);
      return;
    }
    return micProcessor.subscribe(setInfo);
  }, [micProcessor]);

  const auto = preferences.autoSensitivity;
  const thresholdDb = auto ? info?.thresholdDb ?? -55 : preferences.sensitivityDb;
  const levelPct = info ? dbToPct(info.levelDb) : 0;
  const thrPct = dbToPct(thresholdDb);
  const passando = !!info && info.open;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-[#ECECEC] block">Sensibilidade automática</span>
          <span className="text-[11px] text-[#8B8F98]">O eco decide sozinho quando é a sua voz</span>
        </div>
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => onUpdatePreferences({ autoSensitivity: e.target.checked })}
          className="w-4 h-4 accent-[#5EEAD4] rounded cursor-pointer"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-[#8B8F98]">
          <span>Sensibilidade do microfone</span>
          <span className="font-mono text-[#C4B5FD]">{Math.round(thresholdDb)} dB{auto ? " (auto)" : ""}</span>
        </div>

        {/* Medidor ao vivo com o limite marcado */}
        <div className="relative w-full h-2.5 rounded-full overflow-hidden bg-[#2A2D35]">
          <div
            className="absolute inset-y-0 left-0 bg-[#F5C76B]/25"
            style={{ width: `${thrPct}%` }}
          />
          <div
            className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${passando ? "bg-[#5EEAD4]" : "bg-[#F5C76B]"}`}
            style={{ width: `${levelPct}%` }}
          />
          <div
            className="absolute inset-y-[-2px] w-[2px] bg-[#ECECEC] shadow-[0_0_4px_rgba(255,255,255,0.8)]"
            style={{ left: `calc(${thrPct}% - 1px)` }}
          />
        </div>

        <input
          type="range"
          min={MIC_DB_MIN}
          max={MIC_DB_MAX}
          step={1}
          value={Math.round(thresholdDb)}
          disabled={auto}
          onChange={(e) => onUpdatePreferences({ sensitivityDb: Number(e.target.value) })}
          className={`w-full accent-[#C4B5FD] ${auto ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        />

        <div className="flex items-center justify-between text-[10px] text-[#8B8F98]">
          <span>-100 dB</span>
          <span className={passando ? "text-[#5EEAD4] font-semibold" : ""}>
            {!micProcessor
              ? "Medidor disponível durante a call"
              : passando
              ? "Sua voz está passando"
              : "Silenciado (abaixo da sensibilidade)"}
          </span>
          <span>0 dB</span>
        </div>
        {!auto && (
          <span className="text-[10px] text-[#8B8F98] block">
            Fale normalmente e deixe o marcador branco logo abaixo da barra verde da sua voz.
          </span>
        )}
      </div>
    </div>
  );
};

interface SettingsModalProps {
  isOpen: boolean;
  preferences: UserPreferences;
  audioTestLevel: number;
  onClose: () => void;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
  isMockupDemoActive?: boolean;
  onToggleMockupDemo?: () => void;
  micProcessor?: MicProcessor | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  preferences,
  audioTestLevel,
  onClose,
  onUpdatePreferences,
  isDarkTheme = true,
  onToggleTheme,
  isMockupDemoActive = false,
  onToggleMockupDemo,
  micProcessor = null,
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
    <div className="fixed inset-0 z-50 bg-[#16171B]/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="bg-[#1E2026] border border-[#2A2D35] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2A2D35] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#ECECEC] font-bold text-base">
            <Sliders className="w-5 h-5 text-[#5EEAD4]" />
            <span>Configurações</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#ECECEC]">
          {/* APARÊNCIA & RECURSOS: Modo Gamer, Tema claro/escuro e Ver Mockup */}
          <div className="bg-[#16171B] border border-[#2A2D35] rounded-xl p-4 space-y-3.5">
            <span className="font-bold text-[#8B8F98] uppercase tracking-wider text-[10px] block">
              Preferências do App
            </span>

            {/* Modo Gamer / Baixo Consumo */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-[#5EEAD4]" />
                <div>
                  <span className="font-semibold text-[#ECECEC] block">Modo Gamer / Baixo Consumo</span>
                  <span className="text-[11px] text-[#8B8F98]">Otimiza áudio e reduz uso de CPU e GPU</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.lowResourceMode}
                onChange={(e) => onUpdatePreferences({ lowResourceMode: e.target.checked })}
                className="w-4 h-4 accent-[#5EEAD4] rounded cursor-pointer"
              />
            </div>

            {/* Tema Claro / Escuro */}
            {onToggleTheme && (
              <div className="flex items-center justify-between pt-2.5 border-t border-[#2A2D35]">
                <div className="flex items-center gap-2.5">
                  {isDarkTheme ? <Moon className="w-4 h-4 text-[#C4B5FD]" /> : <Sun className="w-4 h-4 text-[#5EEAD4]" />}
                  <div>
                    <span className="font-semibold text-[#ECECEC] block">Tema do App</span>
                    <span className="text-[11px] text-[#8B8F98]">
                      {isDarkTheme ? "Tema Escuro padrão ativo" : "Tema Claro ativado"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onToggleTheme}
                  className="px-3 py-1 rounded-lg border border-[#2A2D35] hover:border-[#5EEAD4]/50 bg-[#1E2026] text-[#ECECEC] text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isDarkTheme ? "Mudar para Claro" : "Mudar para Escuro"}
                </button>
              </div>
            )}

            {/* Ver Mockup Demo */}
            {onToggleMockupDemo && (
              <div className="flex items-center justify-between pt-2.5 border-t border-[#2A2D35]">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#C4B5FD]" />
                  <div>
                    <span className="font-semibold text-[#ECECEC] block">Visualização de Mockup</span>
                    <span className="text-[11px] text-[#8B8F98]">
                      {isMockupDemoActive ? "Mockup de demonstração ativo" : "Exibir cards e dados de demonstração"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onToggleMockupDemo}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                    isMockupDemoActive
                      ? "bg-[#5EEAD4] text-[#16171B] border-[#5EEAD4]"
                      : "bg-[#1E2026] border-[#2A2D35] text-[#ECECEC] hover:border-[#5EEAD4]/50"
                  }`}
                >
                  {isMockupDemoActive ? "Desativar" : "Ver Mockup"}
                </button>
              </div>
            )}
          </div>

          {/* Dispositivos de Áudio */}
          <div className="space-y-3">
            <label className="font-semibold text-[#ECECEC] flex items-center gap-2">
              <Mic className="w-4 h-4 text-[#5EEAD4]" />
              Dispositivo de Microfone
            </label>
            <select
              value={preferences.selectedAudioInput}
              onChange={(e) => onUpdatePreferences({ selectedAudioInput: e.target.value })}
              className="w-full bg-[#16171B] border border-[#2A2D35] text-[#ECECEC] rounded-xl p-2.5 focus:outline-none focus:border-[#5EEAD4]"
            >
              <option value="">Padrão do Sistema</option>
              {audioInputs.map((d, index) => (
                <option key={d.deviceId || index} value={d.deviceId}>
                  {d.label || `Microfone ${index + 1}`}
                </option>
              ))}
            </select>

            {/* Teste de Microfone */}
            <div className="bg-[#16171B] border border-[#2A2D35] rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#8B8F98]">
                <span>Nível de captação do microfone:</span>
                <span className="font-mono text-[#5EEAD4]">{Math.round(audioTestLevel)}%</span>
              </div>
              <div className="w-full bg-[#2A2D35] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#5EEAD4] to-[#C4B5FD] transition-all duration-75"
                  style={{ width: `${Math.min(100, audioTestLevel)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Dispositivo de Saída de Áudio */}
          <div className="space-y-2">
            <label className="font-semibold text-[#ECECEC] flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#5EEAD4]" />
              Dispositivo de Saída (Alto-falante / Fone)
            </label>
            <select
              value={preferences.selectedAudioOutput}
              onChange={(e) => onUpdatePreferences({ selectedAudioOutput: e.target.value })}
              className="w-full bg-[#16171B] border border-[#2A2D35] text-[#ECECEC] rounded-xl p-2.5 focus:outline-none focus:border-[#5EEAD4]"
            >
              <option value="">Padrão do Sistema</option>
              {audioOutputs.map((d, index) => (
                <option key={d.deviceId || index} value={d.deviceId}>
                  {d.label || `Saída ${index + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Dispositivo de Vídeo */}
          <div className="space-y-2">
            <label className="font-semibold text-[#ECECEC] flex items-center gap-2">
              <Video className="w-4 h-4 text-[#5EEAD4]" />
              Câmera
            </label>
            <select
              value={preferences.selectedVideoInput}
              onChange={(e) => onUpdatePreferences({ selectedVideoInput: e.target.value })}
              className="w-full bg-[#16171B] border border-[#2A2D35] text-[#ECECEC] rounded-xl p-2.5 focus:outline-none focus:border-[#5EEAD4]"
            >
              <option value="">Padrão do Sistema</option>
              {videoInputs.map((d, index) => (
                <option key={d.deviceId || index} value={d.deviceId}>
                  {d.label || `Câmera ${index + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Otimizações de Áudio */}
          <div className="bg-[#16171B] border border-[#2A2D35] rounded-xl p-4 space-y-3">
            <span className="font-bold text-[#8B8F98] uppercase tracking-wider text-[10px] block">
              Processamento de Áudio
            </span>

            {/* Supressão de ruído com IA (RNNoise) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AudioLines className="w-4 h-4 text-[#5EEAD4]" />
                <div>
                  <span className="font-medium text-[#ECECEC] flex items-center gap-1.5">
                    Supressão de ruído (IA)
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#C4B5FD]/15 text-[#C4B5FD]">IA</span>
                  </span>
                  <span className="text-[11px] text-[#8B8F98]">Remove barulhos de fundo e deixa só a sua voz</span>
                  {preferences.aiNoiseSuppression && micProcessor && !micProcessor.aiAvailable && (
                    <span className="text-[10px] text-[#F5C76B] block">
                      IA indisponível neste navegador — usando o filtro básico.
                    </span>
                  )}
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.aiNoiseSuppression}
                onChange={(e) => onUpdatePreferences({ aiNoiseSuppression: e.target.checked })}
                className="w-4 h-4 accent-[#5EEAD4] rounded cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-[#2A2D35]">
              <SensibilidadeMicrofone
                micProcessor={micProcessor}
                preferences={preferences}
                onUpdatePreferences={onUpdatePreferences}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2A2D35]">
              <div>
                <span className="font-medium text-[#ECECEC] block">Supressão de ruído do navegador</span>
                <span className="text-[11px] text-[#8B8F98]">Filtro básico, funciona junto com a IA</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.noiseSuppression}
                onChange={(e) => onUpdatePreferences({ noiseSuppression: e.target.checked })}
                className="w-4 h-4 accent-[#5EEAD4] rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2A2D35]">
              <div>
                <span className="font-medium text-[#ECECEC] block">Cancelamento de Eco</span>
                <span className="text-[11px] text-[#8B8F98]">Evita retorno do áudio dos alto-falantes</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.echoCancellation}
                onChange={(e) => onUpdatePreferences({ echoCancellation: e.target.checked })}
                className="w-4 h-4 accent-[#5EEAD4] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#2A2D35] bg-[#16171B] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Salvar & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
