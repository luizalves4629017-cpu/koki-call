import React, { useState, useRef } from "react";
import {
  X,
  Camera,
  Crown,
  Upload,
  Trash2,
  Sparkles,
  Check,
  ShieldCheck,
  Palette,
  Image as ImageIcon,
  Link as LinkIcon,
  Flame,
  Film,
  Video,
  Gem,
  Hash,
  Lock,
} from "lucide-react";
import { Participant } from "../types";
import {
  DEFAULT_AVATARS,
  DEFAULT_AVATAR_COLORS,
  DEFAULT_BANNER_COLORS,
  OWNER_GIF_AVATAR_PRESETS,
  OWNER_GIF_BANNER_PRESETS,
  OWNER_VIDEO_BANNER_PRESETS,
  isVideoMedia,
  compressImage,
  saveUserProfile,
  resolveUserTag,
  MASTER_DEFAULT_TAG,
  MASTER_DEFAULT_USERNAME,
  isMasterIdentity,
  isPerkActive,
  getPerkRemainingTime,
  getPurchasedPerks,
} from "../utils/storage";
import { BadgeSelector } from "./BadgeSelector";

interface EditOwnerProfileModalProps {
  isOpen: boolean;
  self: Participant;
  isMaster?: boolean;
  onClose: () => void;
  onSave: (updates: {
    name?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    avatarEmoji?: string;
    avatarColor?: string;
    bannerColor?: string;
    customStatus?: string;
    bio?: string;
    tag?: string;
    customTitle?: string;
    badges?: string[];
  }) => void;
}

export const EditOwnerProfileModal: React.FC<EditOwnerProfileModalProps> = ({
  isOpen,
  self,
  isMaster = false,
  onClose,
  onSave,
}) => {
  const isHost = self.isHost;
  const isSelfMaster = Boolean(isMaster || isMasterIdentity(self.name, self.tag));
  const hasVip = Boolean(self.vipPermissions);
  const perks = getPurchasedPerks();

  const hasGifAvatarPerk = isSelfMaster || isPerkActive("gif_avatar", perks) || Boolean(self.vipPermissions?.canUseGifAvatar);
  const hasBannerMediaPerk = isSelfMaster || isPerkActive("custom_banner", perks) || Boolean(self.vipPermissions?.canUseVideoMp4Banner);
  const hasCustomTitlePerk = isSelfMaster || isPerkActive("custom_title", perks);
  const hasVipRolePerk = isSelfMaster || isPerkActive("vip_role", perks) || hasVip;

  const canUseMedia = hasGifAvatarPerk || hasBannerMediaPerk || isSelfMaster || hasVip;

  const [name, setName] = useState(self.name);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(self.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(self.bannerUrl);
  const [avatarEmoji, setAvatarEmoji] = useState(self.avatarEmoji || (isSelfMaster ? "👑" : "🎮"));
  const [avatarColor, setAvatarColor] = useState(self.avatarColor || DEFAULT_AVATAR_COLORS[0]);
  const [bannerColor, setBannerColor] = useState(self.bannerColor || DEFAULT_BANNER_COLORS[0]);
  const [customStatus, setCustomStatus] = useState(self.customStatus || (isSelfMaster ? "👑 Dono Master da Call" : "🟢 Conectado na Call"));
  const [bio, setBio] = useState(self.bio || (isSelfMaster ? "Criador e moderador oficial desta sala." : "Participante do Koki Call"));
  const [customTitle, setCustomTitle] = useState(self.customTitle || "");
  const [badges, setBadges] = useState<string[]>(
    self.badges && self.badges.length > 0
      ? self.badges
      : isSelfMaster
      ? ["owner_supreme", "koki_creator", "nitro_owner"]
      : []
  );
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Computed fixed tag
  const effectiveTag = resolveUserTag(name, isSelfMaster, self.tag);

  // GIF & Video URL & Presets Popover states
  const [showGifAvatarPicker, setShowGifAvatarPicker] = useState(false);
  const [showBannerMediaPicker, setShowBannerMediaPicker] = useState(false);
  const [bannerTab, setBannerTab] = useState<"video" | "gif">("video");
  const [customGifAvatarUrl, setCustomGifAvatarUrl] = useState("");
  const [customBannerMediaUrl, setCustomBannerMediaUrl] = useState("");

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsProcessingImg(true);
    try {
      const compressed = await compressImage(file, 300, 300, 0.85);
      setAvatarUrl(compressed);
      setShowGifAvatarPicker(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao carregar foto ou GIF de perfil.");
    } finally {
      setIsProcessingImg(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsProcessingImg(true);
    try {
      const compressed = await compressImage(file, 800, 300, 0.85);
      setBannerUrl(compressed);
      setShowBannerMediaPicker(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao carregar vídeo MP4 ou imagem de banner.");
    } finally {
      setIsProcessingImg(false);
    }
  };

  const handleApplyCustomGifAvatar = () => {
    if (!customGifAvatarUrl.trim()) return;
    setAvatarUrl(customGifAvatarUrl.trim());
    setCustomGifAvatarUrl("");
    setShowGifAvatarPicker(false);
  };

  const handleApplyCustomBannerMedia = () => {
    if (!customBannerMediaUrl.trim()) return;
    setBannerUrl(customBannerMediaUrl.trim());
    setCustomBannerMediaUrl("");
    setShowBannerMediaPicker(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalTag = resolveUserTag(name, isSelfMaster, self.tag);

    const updates = {
      name: name.trim(),
      avatarUrl,
      bannerUrl,
      avatarEmoji,
      avatarColor,
      bannerColor,
      customStatus: customStatus.trim(),
      bio: bio.trim(),
      tag: finalTag,
      customTitle: customTitle.trim() || undefined,
      badges,
    };

    saveUserProfile({
      name: updates.name,
      avatarUrl: updates.avatarUrl,
      bannerUrl: updates.bannerUrl,
      avatarEmoji: updates.avatarEmoji,
      avatarColor: updates.avatarColor,
      bannerColor: updates.bannerColor,
      customStatus: updates.customStatus,
      bio: updates.bio,
      tag: updates.tag,
      customTitle: updates.customTitle,
      badges: updates.badges,
    });

    onSave(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-[#0c1220] border border-[#202f4a] rounded-2xl shadow-2xl overflow-hidden text-slate-100 relative max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#1b253b] bg-gradient-to-r from-amber-500/15 via-cyan-500/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
              <Crown className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                Editar Perfil do Dono (Master)
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-amber-950 text-amber-300 rounded border border-amber-700 font-bold flex items-center gap-1">
                  <Film className="w-3 h-3 text-amber-400" />
                  Vídeos MP4 & GIFs Liberados
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Upload de vídeo MP4 para o banner, GIFs animados e foto do Dono
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-600/60 text-rose-300 p-2.5 rounded-xl text-[11px]">
              {errorMsg}
            </div>
          )}

          {/* Interactive Live Banner Preview */}
          <div className="relative rounded-xl overflow-hidden border border-[#223352]">
            <div
              className="h-28 sm:h-36 w-full relative bg-cover bg-center transition-all overflow-hidden"
              style={{
                backgroundColor: bannerColor,
                backgroundImage:
                  bannerUrl && !isVideoMedia(bannerUrl) ? `url(${bannerUrl})` : undefined,
              }}
            >
              {/* Video Banner Renderer */}
              {bannerUrl && isVideoMedia(bannerUrl) && (
                <video
                  src={bannerUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover absolute inset-0 pointer-events-none"
                />
              )}

              {/* Banner Badge Indicator */}
              <div className="absolute top-2 left-2 z-10">
                {bannerUrl && isVideoMedia(bannerUrl) ? (
                  <span className="bg-purple-950/90 text-purple-200 border border-purple-500/50 text-[9px] font-bold uppercase px-2 py-0.5 rounded-md backdrop-blur-sm flex items-center gap-1 shadow-md">
                    <Film className="w-3 h-3 text-purple-400 animate-pulse" />
                    Vídeo MP4 Ativo
                  </span>
                ) : bannerUrl?.endsWith(".gif") || bannerUrl?.includes("giphy") ? (
                  <span className="bg-amber-950/90 text-amber-200 border border-amber-500/50 text-[9px] font-bold uppercase px-2 py-0.5 rounded-md backdrop-blur-sm flex items-center gap-1 shadow-md">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    GIF Animado
                  </span>
                ) : null}
              </div>

              {/* Top Banner Control Buttons */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                <button
                  type="button"
                  onClick={() => setShowBannerMediaPicker(!showBannerMediaPicker)}
                  className="bg-amber-950/85 hover:bg-amber-900 text-amber-300 text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-1 rounded-lg border border-amber-500/50 backdrop-blur-sm flex items-center gap-1 shadow-md cursor-pointer transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{showBannerMediaPicker ? "Fechar Galeria" : "Galeria MP4/GIF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={isProcessingImg}
                  className="bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-3 py-1 rounded-lg border border-white/20 backdrop-blur-sm flex items-center gap-1 shadow-md cursor-pointer transition-all"
                  title="Fazer upload do seu arquivo .mp4 ou imagem"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-200" />
                  <span>Upload MP4 / Foto</span>
                </button>

                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl(undefined)}
                    className="bg-rose-950/80 hover:bg-rose-900 text-rose-200 p-1.5 rounded-lg border border-rose-600/50 backdrop-blur-sm cursor-pointer"
                    title="Remover banner"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Banner Media Preset & URL Selector Drawer */}
            {showBannerMediaPicker && (
              <div className="p-3 bg-[#0a1020] border-b border-[#1b253b] space-y-2.5 animate-in fade-in">
                {/* Tabs: MP4 Video loops vs GIFs */}
                <div className="flex items-center justify-between border-b border-[#1b253b] pb-2">
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Banners Dinâmicos do Dono:
                  </span>
                  <div className="flex items-center gap-1 bg-[#121a2a] p-0.5 rounded-lg border border-[#202f48]">
                    <button
                      type="button"
                      onClick={() => setBannerTab("video")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        bannerTab === "video"
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Film className="w-3 h-3" />
                      Vídeos MP4
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerTab("gif")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        bannerTab === "gif"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      GIFs Animados
                    </button>
                  </div>
                </div>

                {/* Tab: Videos MP4 Loops */}
                {bannerTab === "video" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {OWNER_VIDEO_BANNER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setBannerUrl(preset.url);
                            setShowBannerMediaPicker(false);
                          }}
                          className="group relative h-16 rounded-lg overflow-hidden border border-[#233550] hover:border-purple-400 transition-all cursor-pointer bg-slate-900 flex flex-col justify-end p-1.5"
                        >
                          <video
                            src={preset.url}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all"
                          />
                          <div className="relative z-10 bg-black/70 backdrop-blur-xs rounded px-1.5 py-0.5 text-[8px] font-bold text-white leading-tight truncate flex items-center gap-1">
                            <Film className="w-2.5 h-2.5 text-purple-400" />
                            {preset.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab: GIFs */}
                {bannerTab === "gif" && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {OWNER_GIF_BANNER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setBannerUrl(preset.url);
                          setShowBannerMediaPicker(false);
                        }}
                        className="group relative h-12 rounded-lg overflow-hidden border border-[#233550] hover:border-amber-400 transition-all cursor-pointer bg-cover bg-center"
                        style={{ backgroundImage: `url(${preset.url})` }}
                      >
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-end p-1">
                          <span className="text-[8px] font-bold text-white leading-tight truncate">
                            {preset.name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Direct Video / GIF URL Input for Banner */}
                <div className="flex items-center gap-1.5 pt-1">
                  <div className="flex-1 flex items-center bg-[#131c2e] border border-[#233550] rounded-lg px-2.5 py-1 text-slate-100 text-[11px] focus-within:border-purple-400">
                    <LinkIcon className="w-3 h-3 text-slate-400 mr-1.5 shrink-0" />
                    <input
                      type="url"
                      placeholder="Colar link de vídeo MP4 (.mp4), WebM ou GIF..."
                      value={customBannerMediaUrl}
                      onChange={(e) => setCustomBannerMediaUrl(e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[11px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomBannerMedia}
                    className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    Aplicar Link
                  </button>
                </div>
              </div>
            )}

            {/* Avatar Row */}
            <div className="px-4 pb-3 pt-0 bg-[#090f1d] flex items-end justify-between">
              <div className="relative -mt-10 inline-block">
                {/* Real Photo / Animated GIF Avatar */}
                <div
                  className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-3xl shadow-xl ring-4 ring-[#0c1220] font-bold relative group bg-cover bg-center"
                  style={{
                    backgroundColor: avatarColor,
                    backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
                  }}
                >
                  {!avatarUrl && avatarEmoji}

                  {/* Upload Overlay Button */}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isProcessingImg}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-bold cursor-pointer"
                  >
                    <Camera className="w-4 h-4 mb-0.5 text-cyan-300" />
                    <span>Mudar</span>
                  </button>
                </div>

                {/* Dono Crown Badge */}
                <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow-md">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>

              {/* Photo & GIF Avatar Actions */}
              <div className="flex items-center gap-1.5 mb-1">
                {/* Animated GIF Button */}
                <button
                  type="button"
                  onClick={() => setShowGifAvatarPicker(!showGifAvatarPicker)}
                  className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-[10px] sm:text-[11px] font-black px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>{showGifAvatarPicker ? "Fechar GIFs" : "GIF Avatar"}</span>
                </button>

                {/* File Upload (Image or GIF file) */}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(undefined)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] p-1.5 rounded-lg border border-slate-700 cursor-pointer"
                    title="Remover foto/GIF e usar emoji"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Avatar GIF Preset & URL Selector Drawer */}
            {showGifAvatarPicker && (
              <div className="p-3 bg-[#0a1020] border-t border-[#1b253b] space-y-2.5 animate-in fade-in">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Escolher Avatar GIF Animado (Exclusivo do Dono):
                </span>

                <div className="grid grid-cols-6 gap-2">
                  {OWNER_GIF_AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setAvatarUrl(preset.url);
                        setShowGifAvatarPicker(false);
                      }}
                      className="group flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <div
                        className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#233550] group-hover:border-amber-400 transition-all bg-cover bg-center shadow-md group-hover:scale-105"
                        style={{ backgroundImage: `url(${preset.url})` }}
                      />
                      <span className="text-[8px] text-slate-400 group-hover:text-amber-300 font-medium truncate max-w-full">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Direct GIF URL Input for Avatar */}
                <div className="flex items-center gap-1.5 pt-1">
                  <div className="flex-1 flex items-center bg-[#131c2e] border border-[#233550] rounded-lg px-2.5 py-1 text-slate-100 text-[11px] focus-within:border-amber-400">
                    <LinkIcon className="w-3 h-3 text-slate-400 mr-1.5 shrink-0" />
                    <input
                      type="url"
                      placeholder="Colar link de GIF (Tenor/Giphy/URL)..."
                      value={customGifAvatarUrl}
                      onChange={(e) => setCustomGifAvatarUrl(e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-[11px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomGifAvatar}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            {/* Hidden File Inputs (Accepts MP4 videos, WebM, GIFs and images) */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*,.gif"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <input
              ref={bannerInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,image/*,.gif"
              className="hidden"
              onChange={handleBannerUpload}
            />
          </div>

          {/* Form fields */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold text-xs">
                  {isSelfMaster ? "Nome do Dono Master" : "Seu Nome na Call"} <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-1">
                  {effectiveTag === "0001" ? (
                    <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <Crown className="w-3 h-3 text-amber-400 fill-current" />
                      <Lock className="w-2.5 h-2.5 text-amber-400/80" />
                      <span>Tag Fixa: #0001</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-900/80 border border-slate-700/60 px-2 py-0.5 rounded-full">
                      Tag: #{effectiveTag}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center bg-[#121a2d] border border-[#253550] focus-within:border-amber-500 rounded-xl px-3 py-2 transition-colors">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isSelfMaster ? MASTER_DEFAULT_USERNAME : "Ex: Seu Nome"}
                  className="w-full bg-transparent text-slate-100 text-xs focus:outline-none font-medium"
                />
                <span
                  className={`text-xs font-mono font-bold shrink-0 ml-2 ${
                    effectiveTag === "0001" ? "text-amber-400" : "text-slate-500"
                  }`}
                >
                  #{effectiveTag}
                </span>
              </div>
              {effectiveTag === "0001" && (
                <p className="text-[10px] text-amber-400/90 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0" />
                  Tag #0001 protegida e reservada exclusivamente para a sua conta Master.
                </p>
              )}
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1 text-xs">
                Status Personalizado (Destaque)
              </label>
              <input
                type="text"
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="Ex: 👑 Dono Master da Sala • Ao Vivo"
                maxLength={60}
                className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                  <Gem className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Título de Perfil Exclusivo</span>
                </label>
                {hasCustomTitlePerk ? (
                  <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 px-2 py-0.5 rounded-full font-bold">
                    {isSelfMaster ? "👑 Permanente" : "✨ Ativo (Loja)"}
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-800 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-medium">
                    🪙 Disponível na Loja (400 Moedas)
                  </span>
                )}
              </div>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Ex: PRO GAMER • STREAMER VIP"
                maxLength={30}
                className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Aparece em destaque no seu card de perfil do Discord e lista de membros da call.
              </p>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1 text-xs">
                Biografia / Sobre
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={2}
                placeholder="Conte um pouco sobre você ou as regras da sua chamada..."
                className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl p-3 text-xs focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
          </div>

          {/* Optional Icon/Color selector if no photo or GIF is used */}
          {!avatarUrl && (
            <div className="bg-[#090f1d] border border-[#1b253b] rounded-xl p-3 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Ou escolha Ícone e Cor de Fundo:
              </span>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {DEFAULT_AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatarEmoji(emoji)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                      avatarEmoji === emoji
                        ? "bg-amber-900/80 border border-amber-400 scale-110"
                        : "bg-[#141e30] hover:bg-[#1f2d47]"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_AVATAR_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setAvatarColor(col)}
                    className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                      avatarColor === col ? "ring-2 ring-white scale-110" : ""
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Badge Selector Component */}
          <div className="bg-[#090f1d] border border-[#1b253b] rounded-xl p-3">
            <BadgeSelector
              selectedBadgeIds={badges}
              onChange={setBadges}
              isHost={isSelfMaster}
              hasVip={hasVip}
              maxSelectable={6}
            />
          </div>

          {/* Owner or VIP MP4 Video & GIF Permission Badge */}
          {canUseMedia ? (
            <div className="bg-gradient-to-r from-purple-950/40 via-amber-950/30 to-cyan-950/40 border border-purple-500/40 rounded-xl p-3 flex items-start gap-2.5 shadow-md">
              <Film className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-300">
                <span className="font-bold text-purple-300 block">
                  {isHost ? "👑 Permissão Exclusiva de Vídeo MP4 & GIFs do Dono" : "💎 Permissão VIP Ativa pelo Dono"}
                </span>
                {isHost
                  ? "Como Dono Master da sala, você pode fazer upload do seu arquivo de vídeo MP4 baixado para o banner, usar GIFs animados no avatar e exibir loops animados contínuos."
                  : "Você recebeu permissão VIP do Dono para utilizar avatares em GIF e banners com vídeos MP4 ou GIFs animados!"}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-400">
                <span className="font-bold text-slate-300 block">Personalização de Membro</span>
                Selecione seu nome, status, bio e insígnias para exibir no seu perfil da chamada.
              </div>
            </div>
          )}

          {/* Footer Save Button */}
          <div className="pt-1">
            <button
              id="save-profile-btn"
              type="submit"
              disabled={!name.trim() || isProcessingImg}
              className="w-full bg-gradient-to-r from-purple-600 via-amber-500 to-amber-600 hover:from-purple-500 hover:via-amber-400 hover:to-amber-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs transition-all shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Perfil com Vídeo MP4 / GIF do Dono</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
