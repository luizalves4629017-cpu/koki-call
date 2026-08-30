import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  Sparkles,
  Film,
  Link as LinkIcon,
  RotateCcw,
  Check,
  Sliders,
  Eye,
  Trash2,
} from "lucide-react";
import {
  LobbyBackgroundConfig,
  LOBBY_VIDEO_WALLPAPER_PRESETS,
  LOBBY_GIF_WALLPAPER_PRESETS,
  isVideoMedia,
  compressImage,
  saveLobbyBackground,
} from "../utils/storage";

interface LobbyBackgroundModalProps {
  currentConfig: LobbyBackgroundConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: LobbyBackgroundConfig) => void;
}

export const LobbyBackgroundModal: React.FC<LobbyBackgroundModalProps> = ({
  currentConfig,
  isOpen,
  onClose,
  onSave,
}) => {
  const [config, setConfig] = useState<LobbyBackgroundConfig>(currentConfig);
  const [activeTab, setActiveTab] = useState<"video" | "gif" | "link" | "adjust">("video");
  const [customLink, setCustomLink] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      // Process video (MP4/WebM) or Image/GIF
      const dataUri = await compressImage(file, 1920, 1080, 0.85);
      const isVid =
        file.type.startsWith("video/") ||
        file.name.toLowerCase().endsWith(".mp4") ||
        file.name.toLowerCase().endsWith(".webm") ||
        file.name.toLowerCase().endsWith(".mov");

      const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

      setConfig((prev) => ({
        ...prev,
        type: isVid ? "video" : isGif ? "gif" : "image",
        url: dataUri,
      }));
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao carregar o arquivo de mídia.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyLink = () => {
    if (!customLink.trim()) return;
    const cleanUrl = customLink.trim();
    const isVid = isVideoMedia(cleanUrl);
    const isGif = cleanUrl.toLowerCase().includes(".gif") || cleanUrl.includes("giphy");

    setConfig((prev) => ({
      ...prev,
      type: isVid ? "video" : isGif ? "gif" : "image",
      url: cleanUrl,
    }));
    setCustomLink("");
  };

  const handleSelectPreset = (presetUrl: string, type: "video" | "gif") => {
    setConfig((prev) => ({
      ...prev,
      type,
      url: presetUrl,
    }));
  };

  const handleResetDefault = () => {
    setConfig({
      type: "default",
      url: undefined,
      overlayDarkness: 60,
      blur: 0,
    });
  };

  const handleSaveAndApply = () => {
    saveLobbyBackground(config);
    onSave(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-[#0b101e] border border-[#233550] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-[#080d19] border-b border-[#1b253b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                Fundo da Tela Inicial (Lobby)
                <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-600/50 px-2 py-0.5 rounded-full font-bold uppercase">
                  MP4 & GIF Animado
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Personalize o papel de parede com seu vídeo MP4 baixado, GIFs ou presets animados
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

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {errorMsg && (
            <div className="bg-rose-950/80 border border-rose-600/60 text-rose-200 text-xs p-2.5 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Live Mini Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                Prévia ao Vivo do Fundo da Tela:
              </span>
              {config.type !== "default" && (
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar Fundo Padrão</span>
                </button>
              )}
            </div>

            <div className="relative h-40 w-full rounded-xl overflow-hidden border border-[#233550] bg-[#060a16] shadow-inner flex items-center justify-center">
              {/* Wallpaper Renderer */}
              {config.url && config.type === "video" && (
                <video
                  src={config.url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: `blur(${config.blur}px)` }}
                />
              )}

              {config.url && (config.type === "gif" || config.type === "image") && (
                <div
                  className="absolute inset-0 w-full h-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${config.url})`,
                    filter: `blur(${config.blur}px)`,
                  }}
                />
              )}

              {/* Dark overlay for contrast */}
              <div
                className="absolute inset-0 transition-colors pointer-events-none"
                style={{
                  backgroundColor: `rgba(6, 10, 22, ${config.overlayDarkness / 100})`,
                }}
              />

              {/* Sample card inside to demonstrate legibility */}
              <div className="relative z-10 bg-[#0b101e]/90 border border-[#202f48] rounded-xl p-3 max-w-xs w-full text-center shadow-xl backdrop-blur-xs">
                <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-300 mx-auto flex items-center justify-center font-bold text-xs mb-1">
                  K
                </div>
                <div className="text-xs font-bold text-white">Koki Call Lobby</div>
                <div className="text-[10px] text-slate-300">
                  {config.type === "video"
                    ? "🎥 Vídeo MP4 em Loop Ativo"
                    : config.type === "gif"
                    ? "✨ GIF Animado Ativo"
                    : config.type === "image"
                    ? "🖼️ Imagem Personalizada Ativa"
                    : "🌑 Tema Escuro Original"}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Upload Button */}
          <div className="p-3 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-cyan-950/40 border border-purple-500/30 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-300">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Upload do seu Vídeo MP4 ou GIF
                </span>
                <span className="text-[10px] text-slate-300">
                  Selecione o arquivo MP4 que você baixou no PC ou Celular
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isProcessing ? "Carregando..." : "Escolher MP4 / GIF"}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,image/*,.gif"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-[#090e1a] border border-[#1b253b] rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("video")}
              className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "video"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Vídeos MP4</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("gif")}
              className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "gif"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>GIFs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("link")}
              className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "link"
                  ? "bg-cyan-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Link URL</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("adjust")}
              className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "adjust"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Ajustes</span>
            </button>
          </div>

          {/* Tab 1: Video MP4 Loop Presets */}
          {activeTab === "video" && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Galeria de Vídeos MP4 Dinâmicos em Loop:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LOBBY_VIDEO_WALLPAPER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url, "video")}
                    className={`group relative h-20 rounded-xl overflow-hidden border transition-all cursor-pointer bg-slate-950 flex flex-col justify-end p-2 ${
                      config.url === preset.url
                        ? "border-purple-400 ring-2 ring-purple-500/40"
                        : "border-[#202f48] hover:border-purple-400/80"
                    }`}
                  >
                    <video
                      src={preset.url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all"
                    />
                    <div className="relative z-10 bg-black/70 backdrop-blur-xs rounded px-1.5 py-0.5 text-[9px] font-bold text-white leading-tight truncate flex items-center gap-1">
                      <Film className="w-2.5 h-2.5 text-purple-400" />
                      {preset.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: GIF Presets */}
          {activeTab === "gif" && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Galeria de GIFs Animados Populares:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LOBBY_GIF_WALLPAPER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url, "gif")}
                    className={`group relative h-20 rounded-xl overflow-hidden border transition-all cursor-pointer bg-slate-950 flex flex-col justify-end p-2 bg-cover bg-center ${
                      config.url === preset.url
                        ? "border-amber-400 ring-2 ring-amber-500/40"
                        : "border-[#202f48] hover:border-amber-400/80"
                    }`}
                    style={{ backgroundImage: `url(${preset.url})` }}
                  >
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors" />
                    <div className="relative z-10 bg-black/70 backdrop-blur-xs rounded px-1.5 py-0.5 text-[9px] font-bold text-white leading-tight truncate flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      {preset.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Direct Link URL Input */}
          {activeTab === "link" && (
            <div className="space-y-2.5 p-3 bg-[#090e1a] border border-[#1e2b42] rounded-xl">
              <label className="text-xs font-semibold text-slate-200 block">
                Inserir Link Direto de Vídeo (.mp4) ou GIF (.gif):
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-[#121a2d] border border-[#253550] rounded-xl px-3 py-2 text-slate-100 text-xs focus-within:border-cyan-400">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="url"
                    placeholder="https://exemplo.com/fundo-animado.mp4 ou .gif"
                    value={customLink}
                    onChange={(e) => setCustomLink(e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyLink}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer shadow-md transition-all shrink-0"
                >
                  Aplicar
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Suporta links diretos de vídeos MP4 (WebM/MOV) e URLs do Tenor, Giphy, Imgur ou seu próprio servidor.
              </p>
            </div>
          )}

          {/* Tab 4: Sliders for Overlay Darkness & Blur */}
          {activeTab === "adjust" && (
            <div className="space-y-3.5 p-3 bg-[#090e1a] border border-[#1e2b42] rounded-xl">
              {/* Overlay Darkness */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Escurecimento do Fundo (Contraste):
                  </span>
                  <span className="font-mono text-cyan-300 font-bold">{config.overlayDarkness}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={config.overlayDarkness}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      overlayDarkness: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">
                  Aumente para destacar mais os botões e formulários sobre o vídeo.
                </span>
              </div>

              {/* Blur / Desfoque */}
              <div className="space-y-1.5 pt-2 border-t border-[#1b253b]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Efeito de Desfoque (Blur Suave):
                  </span>
                  <span className="font-mono text-purple-300 font-bold">{config.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={config.blur}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      blur: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">
                  Desfoque de 0px (vídeo 100% nítido) até 10px (efeito bokeh moderno).
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-3.5 bg-[#080d19] border-t border-[#1b253b] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveAndApply}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-950/50 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Salvar e Aplicar no Fundo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
