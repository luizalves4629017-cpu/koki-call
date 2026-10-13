import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Film,
  Award,
  Crown,
  Check,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { StorePerk, StorePerkId, Participant } from "../types";
import {
  getStoreItems,
  getEcoCoins,
  purchaseStorePerk,
  isPerkActive,
  getPerkRemainingTime,
  formatCoinDisplay,
} from "../utils/storage";
import { AnelPerk } from "./AnelPerk";
import { EcoCoinIcon } from "./EcoCoinIcon";
import { BlackHoleBadge } from "./BlackHoleBadge";

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  self?: Participant;
  isMaster?: boolean;
  onOpenProfileEditor?: () => void;
  onPerkPurchased?: (perkId: StorePerkId, activeUntil: number) => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({
  isOpen,
  onClose,
  self,
  isMaster = false,
  onOpenProfileEditor,
  onPerkPurchased,
}) => {
  const [coins, setCoins] = useState<number>(() => getEcoCoins());
  const [storeItems, setStoreItems] = useState<StorePerk[]>(() => getStoreItems());
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [confirmItem, setConfirmItem] = useState<StorePerk | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const syncState = () => {
      setCoins(getEcoCoins());
      setStoreItems(getStoreItems());
    };
    syncState();

    const handleCoinsEvent = (e: any) => {
      if (e?.detail?.coins !== undefined) setCoins(e.detail.coins);
    };
    const handleStoreItemsEvent = (e: any) => {
      if (e?.detail?.items) setStoreItems(e.detail.items);
    };

    window.addEventListener("eco_coins_updated", handleCoinsEvent);
    window.addEventListener("eco_store_items_updated", handleStoreItemsEvent);

    return () => {
      window.removeEventListener("eco_coins_updated", handleCoinsEvent);
      window.removeEventListener("eco_store_items_updated", handleStoreItemsEvent);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Dono Master e Co-fundador: moedas infinitas (∞) e compram sem gastar
  const isUserMaster = Boolean(isMaster || self?.isMaster || self?.tag === "0001" || self?.isCofundador);

  const categories = [
    { id: "all", label: "Tudo" },
    { id: "avatars", label: "Avatares" },
    { id: "banners", label: "Banners" },
    { id: "rings", label: "Anéis" },
    { id: "titles", label: "Títulos" },
    { id: "vip", label: "VIP" },
    { id: "auras", label: "Auras" },
  ];

  const featuredItem = storeItems.find((item) => item.isFeatured && item.isActive !== false) || storeItems[0];

  // Sem itens repetidos: o destaque não aparece de novo na grade, e ids iguais aparecem uma vez só
  const vistos = new Set<string>();
  const filteredItems = storeItems
    .filter((item) => item.isActive !== false)
    .filter((item) => (vistos.has(item.id) ? false : (vistos.add(item.id), true)))
    .filter((item) => (activeCategory === "all" ? item.id !== featuredItem?.id : item.category === activeCategory));

  const handleConfirmPurchase = () => {
    if (!confirmItem) return;
    setFeedback(null);
    try {
      const res = purchaseStorePerk(confirmItem.id, { semCusto: isUserMaster });
      if (res.success) {
        setCoins(res.newBalance);
        const comoUsar: Record<string, string> = {
          gif_avatar: " Agora vá em Editar perfil e troque sua foto por um GIF.",
          custom_banner: " Agora vá em Editar perfil e coloque seu banner em GIF ou vídeo.",
          custom_title: " Agora vá em Editar perfil e escreva seu título.",
          ring_nebulosa: " O anel já aparece em volta do seu avatar pra todo mundo.",
          ring_aurora: " O anel já aparece em volta do seu avatar pra todo mundo.",
          banner_nebulosa: " A capa já aparece no seu perfil (se você não tiver banner próprio).",
          vip_role: " O emblema VIP já aparece pra todo mundo.",
          aura_card: " Abra o seu card de perfil e toque em Mudar aura pra escolher a cor.",
        };
        setFeedback({
          type: "success",
          msg: `"${confirmItem.name}" ativado por ${confirmItem.durationHours || 72}h.${comoUsar[confirmItem.id] || ""}`,
        });
        if (onPerkPurchased) {
          onPerkPurchased(confirmItem.id, res.activeUntil);
        }
        setConfirmItem(null);
      } else {
        setFeedback({
          type: "error",
          msg: res.error || `Saldo insuficiente. Faltam moedas.`,
        });
      }
    } catch {
      setFeedback({ type: "error", msg: "Não foi possível concluir a transação." });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#16171B]/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-4xl bg-[#1E2026] border border-[#2A2D35] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* CABEÇALHO DA LOJA ÓRBITA */}
        <div className="p-5 sm:p-6 pb-4 border-b border-[#2A2D35] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold text-[#ECECEC] tracking-tight">
              Loja
            </h2>
            <p className="text-xs text-[#8B8F98] mt-0.5">
              Itens por 72h
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Pílula Carteira no topo direito: ícone SVG moeda + saldo */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#16171B] border border-[#2A2D35] text-[#ECECEC] shadow-inner">
              <EcoCoinIcon size={20} />
              <span className="font-extrabold text-sm font-mono text-[#ECECEC]">
                {formatCoinDisplay(coins, isUserMaster)} Eco Coins
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FEEDBACK NOTICE */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between ${
              feedback.type === "success"
                ? "bg-[#5EEAD4]/15 text-[#5EEAD4] border-b border-[#5EEAD4]/30"
                : "bg-[#F43F5E]/15 text-[#F43F5E] border-b border-[#F43F5E]/30"
            }`}
          >
            <span>{feedback.msg}</span>
            <button
              onClick={() => setFeedback(null)}
              className="underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* FILTROS EM PÍLULAS */}
        <div className="px-5 sm:px-6 pt-4 flex items-center gap-2 overflow-x-auto shrink-0 pb-1">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#5EEAD4] text-[#16171B] shadow-sm shadow-[#5EEAD4]/20"
                    : "bg-[#16171B] hover:bg-[#2A2D35] text-[#ECECEC] border border-[#2A2D35]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* CORPO: DESTAQUE DA SEMANA + GRADE DE ITENS */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* DESTAQUE DA SEMANA: CARD LARGO CONFORME IMAGEM 1 */}
          {featuredItem && activeCategory === "all" && (
            <div className="relative rounded-2xl bg-[#16171B] border border-[#2A2D35] p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl overflow-hidden">
              <div className="flex items-center gap-5">
                {/* Visual da Singularidade / Anel Nebulosa grande */}
                <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center relative">
                  <div className="w-24 h-24 rounded-full bg-[#050507] border-2 border-[#5EEAD4]/60 flex items-center justify-center relative shadow-2xl">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#16171B] to-[#201736]" />
                    {/* Anel inclinado neon */}
                    <div
                      className="absolute inset-0 rounded-full border-2 border-[#5EEAD4] pointer-events-none"
                      style={{ transform: "rotate(-25deg) scale(1.3, 0.45)" }}
                    />
                    <div
                      className="absolute inset-0 rounded-full border border-[#C4B5FD] pointer-events-none opacity-75"
                      style={{ transform: "rotate(-25deg) scale(1.4, 0.55)" }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-[#8B8F98]">
                    Destaque da semana:
                  </span>
                  <h3 className="text-lg sm:text-xl font-extrabold text-[#ECECEC]">
                    {featuredItem.name}
                  </h3>
                  <p className="text-xs text-[#8B8F98]">
                    Sai em 2d 14h
                  </p>
                </div>
              </div>

              <button
                onClick={() => setConfirmItem(featuredItem)}
                className="px-6 py-2.5 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] font-extrabold text-sm transition-transform active:scale-95 cursor-pointer shadow-lg shadow-[#5EEAD4]/20 shrink-0"
              >
                Comprar · {featuredItem.price}
              </button>
            </div>
          )}

          {/* GRADE DE ITENS (Cards 16px com prévias fiéis às referências) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const isVipCard = item.category === "vip" || item.id === "vip_role";
              const isPurchased = isPerkActive(item.id, self?.purchasedPerks);

              return (
                <div
                  key={item.id}
                  className={`relative rounded-2xl p-4 bg-[#1E2026] border transition-all flex flex-col justify-between group ${
                    isVipCard
                      ? "border-[#C4B5FD]/50 shadow-lg shadow-[#C4B5FD]/10 hover:border-[#C4B5FD]"
                      : "border-[#2A2D35] hover:border-[#383C47]"
                  }`}
                >
                  {/* Etiqueta de duração no canto superior direito */}
                  <div className="absolute top-3 right-3 text-[10px] font-bold text-[#8B8F98] bg-[#16171B] px-2 py-0.5 rounded-full border border-[#2A2D35]">
                    {item.durationHours || 72}h
                  </div>

                  {/* Prévia do Item */}
                  <div className="h-32 flex items-center justify-center p-2 mb-3">
                    {item.id === "vip_role" ? (
                      <div className="text-3xl font-extrabold tracking-widest text-[#C4B5FD] drop-shadow-[0_0_12px_rgba(196,181,253,0.5)]">
                        VIP
                      </div>
                    ) : item.id === "aura_card" || item.category === "auras" ? (
                      /* Mini card com brilho suave (bem mais simples que a aura do Dono) */
                      <div className="relative w-16 h-20">
                        <div className="absolute -inset-1.5 rounded-2xl eco-aura-loja" style={{ boxShadow: "0 0 14px 3px #F472B699, 0 0 26px 6px #60A5FA55" }} />
                        <div className="relative w-16 h-20 rounded-xl bg-[#1E2026] border border-[#F472B6]/60 flex flex-col items-center justify-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-[#2A2D35]" />
                          <div className="w-9 h-1.5 rounded-full bg-[#2A2D35]" />
                        </div>
                      </div>
                    ) : item.category === "rings" ? (
                      /* Mini anel de órbita, cor de cada anel */
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-[#050507] border border-[#2A2D35]" />
                        <AnelPerk tipo={item.previewValue === "aurora" || item.id === "ring_aurora" ? "aurora" : "nebulosa"} escala={1.35} />
                      </div>
                    ) : item.id === "custom_banner" ? (
                      /* Banner próprio em GIF/vídeo */
                      <div className="w-full h-20 rounded-xl bg-[#16171B] border border-dashed border-[#C4B5FD]/50 flex flex-col items-center justify-center gap-1">
                        <Film className="w-6 h-6 text-[#C4B5FD]" />
                        <span className="text-[10px] font-bold text-[#C4B5FD]">Seu GIF ou vídeo</span>
                      </div>
                    ) : item.category === "banners" ? (
                      /* Banner Nebulosa pronto */
                      <div
                        className="w-full h-20 rounded-xl border border-[#2A2D35] overflow-hidden relative bg-[#0b0c10]"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle at 30% 40%, #5EEAD455 0, transparent 40%), radial-gradient(circle at 70% 60%, #C4B5FD66 0, transparent 45%), radial-gradient(1px 1px at 15% 25%, #fff, transparent), radial-gradient(1px 1px at 80% 30%, #fff, transparent), radial-gradient(1px 1px at 55% 80%, #fff, transparent)",
                        }}
                      />
                    ) : item.category === "titles" ? (
                      <div className="px-3 py-1 rounded-full bg-[#16171B] border border-[#2A2D35] text-xs font-bold text-[#8B8F98]">
                        Título em tag
                      </div>
                    ) : (
                      /* Avatar animado */
                      <div className="w-16 h-16 rounded-full border-2 border-[#C4B5FD]/60 flex items-center justify-center bg-[#16171B]">
                        <Sparkles className="w-6 h-6 text-[#5EEAD4]" />
                      </div>
                    )}
                  </div>

                  {/* Informações e Botão */}
                  <div className="space-y-3">
                    <span className="font-bold text-sm text-[#ECECEC] block truncate">
                      {item.name}
                    </span>

                    <div className="flex items-center justify-between pt-2 border-t border-[#2A2D35]/80">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-[#ECECEC]">
                        <EcoCoinIcon size={16} />
                        <span>{item.price}</span>
                      </div>

                      <button
                        onClick={() => setConfirmItem(item)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isPurchased && !isUserMaster
                            ? "bg-[#2A2D35] hover:bg-[#343842] text-[#5EEAD4]"
                            : "bg-[#2A2D35] hover:bg-[#5EEAD4] text-[#ECECEC] hover:text-[#16171B]"
                        }`}
                      >
                        {isPurchased && !isUserMaster ? "Ativo · Estender" : "Comprar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODAL DE CONFIRMAÇÃO DE COMPRA */}
        {confirmItem && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#1E2026] border border-[#2A2D35] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-base text-[#ECECEC]">
                  Confirmar compra
                </h4>
                <button
                  onClick={() => setConfirmItem(null)}
                  className="text-[#8B8F98] hover:text-[#ECECEC] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#16171B] border border-[#2A2D35] space-y-2">
                <div className="font-bold text-sm text-[#5EEAD4]">{confirmItem.name}</div>
                <div className="text-xs text-[#8B8F98]">{confirmItem.description}</div>
                <div className="text-xs font-semibold text-[#C4B5FD]">
                  Duração: {confirmItem.durationHours || 72} horas
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-[#8B8F98]">
                <div className="flex justify-between">
                  <span>Preço do item:</span>
                  <span className="font-bold text-[#ECECEC]">{confirmItem.price} Eco Coins</span>
                </div>
                <div className="flex justify-between">
                  <span>Seu saldo atual:</span>
                  <span className="font-bold text-[#ECECEC]">
                    {formatCoinDisplay(coins, isUserMaster)} Eco Coins
                  </span>
                </div>
                {!isUserMaster && (
                  <div className="flex justify-between pt-1 border-t border-[#2A2D35] font-bold">
                    <span>Saldo após a compra:</span>
                    <span className={coins >= confirmItem.price ? "text-[#5EEAD4]" : "text-[#F43F5E]"}>
                      {Math.max(0, coins - confirmItem.price)} Eco Coins
                    </span>
                  </div>
                )}
              </div>

              {!isUserMaster && coins < confirmItem.price ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl bg-[#2A2D35] text-[#8B8F98] text-xs font-bold cursor-not-allowed"
                >
                  Faltam {confirmItem.price - coins} Eco Coins
                </button>
              ) : (
                <button
                  onClick={handleConfirmPurchase}
                  className="w-full py-2.5 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-xs font-extrabold transition-colors cursor-pointer shadow-md"
                >
                  Confirmar e Ativar Agora
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
