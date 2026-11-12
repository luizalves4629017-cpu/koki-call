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
import { Gaveta, GavetaLinha, GavetaSecao, gavetaInput } from "./ui/Gaveta";

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
  const isSelfMaster = Boolean(isMaster || (self as any).isMaster === true);
  const hasVip = Boolean(self.vipPermissions && Object.values(self.vipPermissions as any).some(Boolean));
  const perks = getPurchasedPerks();
  // Insígnias que a pessoa já recebeu do Dono (não dá pra se dar insígnia sozinho)
  const grantedBadgeIds: string[] = (() => {
    const atuais = Array.isArray(self.badges) ? self.badges : [];
    let salvas: string[] = [];
    try { salvas = JSON.parse(localStorage.getItem("eco_insignias_recebidas") || "[]"); } catch {}
    const todas = Array.from(new Set([...(Array.isArray(salvas) ? salvas : []), ...atuais]));
    try { localStorage.setItem("eco_insignias_recebidas", JSON.stringify(todas)); } catch {}
    return todas;
  })();

  const adv = Boolean(self.vipPermissions?.canEditAdvancedProfile) || isPerkActive("vip_role", perks) || (self.badges || []).some((b) => b === "nitro_owner" || b === "vip_granted");
  const hasGifAvatarPerk = isSelfMaster || adv || isPerkActive("gif_avatar", perks) || Boolean(self.vipPermissions?.canUseGifAvatar);
  // Banner: só VIP Nitro (ou Co-fundador / item Banner da loja). O VIP normal troca só a foto.
  const hasBannerMediaPerk = isSelfMaster || Boolean((self as any).isCofundador) || (self.badges || []).includes("nitro_owner") || isPerkActive("custom_banner", perks);
  const hasCustomTitlePerk = isSelfMaster || adv || isPerkActive("custom_title", perks);
  const hasVipRolePerk = isSelfMaster || isPerkActive("vip_role", perks) || hasVip;

  const canUseMedia = hasGifAvatarPerk || hasBannerMediaPerk || isSelfMaster || hasVip;

  const [name, setName] = useState(self.name);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(self.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(self.bannerUrl);
  const [avatarEmoji, setAvatarEmoji] = useState(self.avatarEmoji || (isSelfMaster ? "👑" : ""));
  const [avatarColor, setAvatarColor] = useState(self.avatarColor || DEFAULT_AVATAR_COLORS[0]);
  const [bannerColor, setBannerColor] = useState(self.bannerColor || DEFAULT_BANNER_COLORS[0]);
  const [customStatus, setCustomStatus] = useState(self.customStatus || (isSelfMaster ? "👑 Dono Master da Call" : "🟢 Conectado na Call"));
  const [bio, setBio] = useState(self.bio || (isSelfMaster ? "Criador e moderador oficial do eco." : "Participante do eco"));
  const [customTitle, setCustomTitle] = useState(self.customTitle || "");
  const [badges, setBadges] = useState<string[]>(
    self.badges && self.badges.length > 0
      ? self.badges
      : isSelfMaster
      ? ["singularidade", "horizonte"]
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

  type Pagina = "nome" | "status" | "titulo" | "bio" | "insignias" | "midia" | "cor";
  const [pagina, setPagina] = useState<Pagina | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size > 6 * 1024 * 1024) { setErrorMsg("Arquivo grande demais (máx. 6 MB). Tente um GIF ou vídeo menor."); return; }
    if (!file || !hasGifAvatarPerk) return;

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
    if (file && file.size > 6 * 1024 * 1024) { setErrorMsg("Arquivo grande demais (máx. 6 MB). Tente um GIF ou vídeo menor."); return; }
    if (!file || !hasBannerMediaPerk) return;

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;

    const finalTag = resolveUserTag(name, isSelfMaster, self.tag);

    const updates = {
      name: name.trim(),
      avatarUrl: hasGifAvatarPerk ? avatarUrl : undefined,
      bannerUrl: hasBannerMediaPerk ? bannerUrl : undefined,
      avatarEmoji,
      avatarColor,
      bannerColor,
      customStatus: customStatus.trim(),
      bio: bio.trim(),
      tag: finalTag,
      customTitle: hasCustomTitlePerk ? (customTitle.trim() || undefined) : undefined,
      badges: isSelfMaster ? badges : badges.filter((b) => grantedBadgeIds.includes(b)),
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

  const titulos: Record<Pagina, string> = {
    nome: "Nome",
    status: "Status",
    titulo: "Título do perfil",
    bio: "Bio",
    insignias: "Insígnias",
    midia: "Banner e avatar",
    cor: "Cor do avatar",
  };

  const bannerEhVideo = Boolean(bannerUrl && isVideoMedia(bannerUrl));
  const bannerEhGif = Boolean(bannerUrl && (bannerUrl.endsWith(".gif") || bannerUrl.includes("giphy")));
  const badgesVisiveis = isSelfMaster ? badges : badges.filter((b) => grantedBadgeIds.includes(b));

  // Banner + avatar (mesma prévia em todas as telas)
  const cabecalhoPerfil = (
    <div className="px-5 pt-4">
      <div className="relative">
        <div
          className="h-28 w-full rounded-xl relative bg-cover bg-center overflow-hidden"
          style={{
            backgroundColor: bannerColor,
            backgroundImage: bannerUrl && !bannerEhVideo ? `url(${bannerUrl})` : undefined,
          }}
        >
          {bannerEhVideo && (
            <video src={bannerUrl} autoPlay loop muted playsInline className="w-full h-full object-cover absolute inset-0 pointer-events-none" />
          )}
          {(bannerEhVideo || bannerEhGif) && (
            <span className="absolute top-2 left-2 bg-black/60 text-[#ECECEC] text-[9px] font-bold uppercase px-2 py-0.5 rounded-md backdrop-blur-sm flex items-center gap-1">
              {bannerEhVideo ? <Film className="w-3 h-3 text-[#C4B5FD]" /> : <Sparkles className="w-3 h-3 text-[#F5C76B]" />}
              {bannerEhVideo ? "Vídeo MP4" : "GIF"}
            </span>
          )}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-10">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-3xl ring-4 ring-[#1A1B20] font-bold relative group bg-cover bg-center"
              style={{ backgroundColor: avatarColor, backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined }}
            >
              {!avatarUrl && (avatarEmoji || (name ? name.slice(0, 1).toUpperCase() : "E"))}
              {hasGifAvatarPerk && (
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isProcessingImg}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-bold cursor-pointer"
                >
                  <Camera className="w-4 h-4 mb-0.5 text-[#5EEAD4]" />
                  <span>Mudar</span>
                </button>
              )}
            </div>
            {isSelfMaster && (
              <div className="absolute -top-1 -right-1 bg-[#F5C76B] text-[#16171B] p-1 rounded-full shadow-md">
                <Crown className="w-3.5 h-3.5 fill-current" />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-12" />
    </div>
  );

  const salvarBtn = (
    <button
      id="save-profile-btn"
      type="button"
      onClick={() => handleSubmit()}
      disabled={!name.trim() || isProcessingImg}
      className="w-full bg-[#5EEAD4] hover:bg-[#2DD4BF] disabled:opacity-50 text-[#16171B] font-bold py-3 rounded-xl text-[14px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
    >
      {isProcessingImg ? "Processando mídia..." : pagina ? "Pronto" : "Salvar"}
    </button>
  );

  return (
    <Gaveta
      aberta={isOpen}
      titulo={
        pagina ? titulos[pagina] : (
          <span className="inline-flex items-center gap-1.5">
            {isSelfMaster && <Crown className="w-4 h-4 text-[#F5C76B] fill-current" />}
            {isSelfMaster ? "Editar perfil do Dono" : "Editar perfil"}
          </span>
        )
      }
      onFechar={onClose}
      onVoltar={pagina ? () => setPagina(null) : undefined}
      rodape={
        pagina ? (
          <button
            type="button"
            onClick={() => setPagina(null)}
            className="w-full bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] font-bold py-3 rounded-xl text-[14px] transition-colors cursor-pointer"
          >
            Pronto
          </button>
        ) : salvarBtn
      }
    >
      {/* Arquivos (sempre montados, para o "Mudar" do avatar funcionar em qualquer tela) */}
      <div className="hidden">
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

      {errorMsg && (
        <div className="mx-5 mt-4 bg-rose-950/60 border border-rose-600/60 text-rose-300 p-2.5 rounded-xl text-[12px]">
          {errorMsg}
        </div>
      )}

      {/* ===== LISTA PRINCIPAL ===== */}
      {!pagina && (
        <>
          {cabecalhoPerfil}
          <div className="border-t border-[#2A2D35]">
            <GavetaLinha
              rotulo="Nome"
              valor={
                <span>
                  {name || "Sem nome"}{" "}
                  <span className={effectiveTag === "0001" ? "text-[#F5C76B] font-mono" : "font-mono"}>#{effectiveTag}</span>
                </span>
              }
              onClick={() => setPagina("nome")}
            />
            <GavetaLinha rotulo="Status" valor={customStatus || "Sem status"} onClick={() => setPagina("status")} />
            <GavetaLinha
              rotulo="Título do perfil"
              valor={hasCustomTitlePerk ? customTitle || "Sem título" : "Disponível na Loja (400 moedas)"}
              direita={!hasCustomTitlePerk ? <Lock className="w-3.5 h-3.5 text-[#C4B5FD]" /> : undefined}
              onClick={() => setPagina("titulo")}
              bloqueada={!hasCustomTitlePerk}
            />
            <GavetaLinha rotulo="Bio" valor={bio || "Sem bio"} onClick={() => setPagina("bio")} />
            <GavetaLinha
              rotulo="Insígnias"
              direita={`${badgesVisiveis.length} de 6`}
              onClick={() => setPagina("insignias")}
            />
            <GavetaLinha
              rotulo="Banner e avatar"
              valor={
                hasGifAvatarPerk || hasBannerMediaPerk
                  ? [hasBannerMediaPerk && "banner MP4/GIF", hasGifAvatarPerk && "foto ou GIF"].filter(Boolean).join(" · ")
                  : "Foto, GIF e banner vêm de itens da Loja"
              }
              direita={!hasGifAvatarPerk && !hasBannerMediaPerk ? <Lock className="w-3.5 h-3.5 text-[#C4B5FD]" /> : undefined}
              onClick={() => setPagina("midia")}
            />
            {!avatarUrl && (
              <GavetaLinha
                rotulo="Cor do avatar"
                direita={<span className="inline-block w-4 h-4 rounded-full align-middle" style={{ backgroundColor: avatarColor }} />}
                onClick={() => setPagina("cor")}
              />
            )}
          </div>

          <GavetaSecao>
            <div className="flex items-start gap-2.5 text-[12px] text-[#8B8F98]">
              {canUseMedia ? <Film className="w-4 h-4 text-[#C4B5FD] shrink-0 mt-0.5" /> : <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>
                {canUseMedia
                  ? isHost
                    ? "Como Dono, você pode usar vídeo MP4 no banner e GIF no avatar."
                    : "Você tem permissão VIP para usar GIF no avatar e banner animado."
                  : "Escolha seu nome, status, bio e insígnias para aparecer no seu perfil da call."}
              </span>
            </div>
          </GavetaSecao>
        </>
      )}

      {/* ===== NOME ===== */}
      {pagina === "nome" && (
        <GavetaSecao>
          <label className="block text-[12px] text-[#8B8F98]">
            {isSelfMaster ? "Nome do Dono Master" : "Seu nome na call"}
          </label>
          <div className="flex items-center bg-[#16171B] border border-[#2A2D35] focus-within:border-[#5EEAD4] rounded-xl px-3 py-2.5">
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSelfMaster ? MASTER_DEFAULT_USERNAME : "Ex: Seu nome"}
              className="w-full bg-transparent text-[#ECECEC] text-[13px] focus:outline-none"
            />
            <span className={`text-[13px] font-mono font-bold shrink-0 ml-2 ${effectiveTag === "0001" ? "text-[#F5C76B]" : "text-[#8B8F98]"}`}>
              #{effectiveTag}
            </span>
          </div>
          {!name.trim() && <p className="text-[11px] text-rose-400">O nome não pode ficar vazio.</p>}
          {effectiveTag === "0001" ? (
            <p className="text-[11px] text-[#F5C76B] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Tag #0001 protegida e reservada só para a sua conta Master.
            </p>
          ) : (
            <p className="text-[11px] text-[#8B8F98] flex items-center gap-1">
              <Lock className="w-3 h-3 shrink-0" />
              Sua tag é fixa: #{effectiveTag}
            </p>
          )}
        </GavetaSecao>
      )}

      {/* ===== STATUS ===== */}
      {pagina === "status" && (
        <GavetaSecao>
          <label className="block text-[12px] text-[#8B8F98]">Status personalizado</label>
          <input
            type="text"
            autoFocus
            value={customStatus}
            onChange={(e) => setCustomStatus(e.target.value)}
            placeholder="Ex: 👑 Dono Master da Sala • Ao Vivo"
            maxLength={60}
            className={gavetaInput}
          />
          <p className="text-[11px] text-[#8B8F98] text-right">{customStatus.length}/60</p>
        </GavetaSecao>
      )}

      {/* ===== TÍTULO ===== */}
      {pagina === "titulo" && (
        <GavetaSecao>
          <div className="flex items-center justify-between">
            <label className="text-[12px] text-[#8B8F98] flex items-center gap-1.5">
              <Gem className="w-3.5 h-3.5 text-[#5EEAD4]" />
              Título exclusivo
            </label>
            {hasCustomTitlePerk ? (
              <span className="text-[10.5px] bg-[#5EEAD4]/10 text-[#5EEAD4] border border-[#5EEAD4]/40 px-2 py-0.5 rounded-full font-bold">
                {isSelfMaster ? "👑 Permanente" : "✨ Ativo (Loja)"}
              </span>
            ) : (
              <span className="text-[10.5px] bg-[#2A2D35] text-[#F5C76B] border border-[#F5C76B]/40 px-2 py-0.5 rounded-full">
                🪙 Na Loja (400 moedas)
              </span>
            )}
          </div>
          <input
            type="text"
            autoFocus
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Ex: PRO GAMER • STREAMER VIP"
            maxLength={30}
            disabled={!hasCustomTitlePerk}
            className={`${gavetaInput} ${!hasCustomTitlePerk ? "opacity-50 cursor-not-allowed" : ""}`}
          />
          <p className="text-[11px] text-[#8B8F98]">
            {hasCustomTitlePerk
              ? "Aparece em destaque no seu card de perfil e na lista de membros da call."
              : "Compre o item Título na Loja para liberar."}
          </p>
        </GavetaSecao>
      )}

      {/* ===== BIO ===== */}
      {pagina === "bio" && (
        <GavetaSecao>
          <label className="block text-[12px] text-[#8B8F98]">Sobre você</label>
          <textarea
            autoFocus
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={4}
            placeholder="Conte um pouco sobre você ou as regras da sua chamada..."
            className={`${gavetaInput} resize-none`}
          />
          <p className="text-[11px] text-[#8B8F98] text-right">{bio.length}/160</p>
        </GavetaSecao>
      )}

      {/* ===== INSÍGNIAS ===== */}
      {pagina === "insignias" && (
        <GavetaSecao>
          <BadgeSelector
            selectedBadgeIds={badges}
            onChange={setBadges}
            isHost={isSelfMaster}
            hasVip={hasVip}
            maxSelectable={6}
            allowedBadgeIds={grantedBadgeIds}
          />
        </GavetaSecao>
      )}

      {/* ===== COR DO AVATAR ===== */}
      {pagina === "cor" && (
        <GavetaSecao>
          {!avatarUrl && (
            <div className="bg-[#1E2026] border border-[#2A2D35] rounded-xl p-3 space-y-2">
              <span className="text-[11px] font-bold text-[#8B8F98] uppercase tracking-wider block">
                Cor de Fundo do Avatar (Iniciais):
              </span>
              <div className="flex flex-wrap gap-2 items-center">
                {DEFAULT_AVATAR_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      setAvatarColor(col);
                      setAvatarEmoji("");
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all cursor-pointer ${
                      avatarColor === col ? "ring-2 ring-[#5EEAD4] scale-110 shadow-md" : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: col }}
                    title={col}
                  >
                    {name ? name.slice(0, 1).toUpperCase() : "E"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </GavetaSecao>
      )}

      {/* ===== BANNER E AVATAR ===== */}
      {pagina === "midia" && (
        <>
          {cabecalhoPerfil}

          {/* Banner */}
          <GavetaSecao titulo="Banner" className="border-t border-[#2A2D35]">
            {!hasBannerMediaPerk ? (
              <div className="flex items-center gap-1.5 text-[12px] text-[#8B8F98] bg-[#16171B] border border-[#2A2D35] rounded-xl px-3 py-2.5">
                <Lock className="w-3.5 h-3.5 text-[#C4B5FD]" />
                <span>Banner animado: item da Loja</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBannerMediaPicker(!showBannerMediaPicker)}
                  className="px-3 py-2 rounded-xl border border-[#2A2D35] hover:border-[#5EEAD4]/60 text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#F5C76B]" />
                  {showBannerMediaPicker ? "Fechar galeria" : "Galeria MP4/GIF"}
                </button>
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={isProcessingImg}
                  className="px-3 py-2 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Enviar MP4 ou foto
                </button>
                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl(undefined)}
                    className="p-2 rounded-xl border border-rose-600/50 text-rose-300 hover:bg-rose-950/60 cursor-pointer"
                    title="Remover banner"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </GavetaSecao>
          <div className="rounded-xl overflow-hidden mx-5">
            {/* Banner Media Preset & URL Selector Drawer */}
            {hasBannerMediaPerk && showBannerMediaPicker && (
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
          </div>

          {/* Avatar */}
          <GavetaSecao titulo="Avatar" className="border-t border-[#2A2D35] mt-2">
            {!hasGifAvatarPerk ? (
              <div className="flex items-center gap-1.5 text-[12px] text-[#8B8F98] bg-[#16171B] border border-[#2A2D35] rounded-xl px-3 py-2.5">
                <Lock className="w-3.5 h-3.5 text-[#C4B5FD]" />
                <span>Foto e GIF de perfil: item da Loja</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGifAvatarPicker(!showGifAvatarPicker)}
                  className="px-3 py-2 rounded-xl border border-[#2A2D35] hover:border-[#5EEAD4]/60 text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#F5C76B]" />
                  {showGifAvatarPicker ? "Fechar GIFs" : "GIF de avatar"}
                </button>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isProcessingImg}
                  className="px-3 py-2 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Enviar foto ou GIF
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(undefined)}
                    className="p-2 rounded-xl border border-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC] cursor-pointer"
                    title="Remover foto/GIF e usar iniciais"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </GavetaSecao>
          <div className="rounded-xl overflow-hidden mx-5 mb-4">
            {/* Avatar GIF Preset & URL Selector Drawer */}
            {hasGifAvatarPerk && showGifAvatarPicker && (
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
          </div>
        </>
      )}
    </Gaveta>
  );
};
