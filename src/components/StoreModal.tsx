import React, { useState, useEffect } from "react";
import {
  X,
  Coins,
  Sparkles,
  Film,
  Award,
  Crown,
  CheckCircle2,
  Clock,
  Zap,
  Gift,
  Flame,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Plus,
  Lock,
  Check,
  Tag,
  Palette,
} from "lucide-react";
import { StorePerk, StorePerkId, Participant } from "../types";
import {
  STORE_PERKS,
  getKokiCoins,
  addKokiCoins,
  getPurchasedPerks,
  isPerkActive,
  getPerkRemainingTime,
  purchaseStorePerk,
  claimDailyBonus,
  getDailyBonusCooldownInfo,
  saveUserProfile,
  getSavedUserProfile,
  isMasterIdentity,
} from "../utils/storage";

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
  const [coins, setCoins] = useState<number>(() => getKokiCoins());
  const [purchasedPerks, setPurchasedPerks] = useState<Record<string, number>>(() => getPurchasedPerks());
  const [activeTab, setActiveTab] = useState<"all" | "active">("all");
  const [purchaseSuccessMessage, setPurchaseSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dailyClaimMsg, setDailyClaimMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [cooldownInfo, setCooldownInfo] = useState(() => getDailyBonusCooldownInfo());

  // Custom title editing for perk 'custom_title'
  const savedProfile = getSavedUserProfile();
  const [customTitleInput, setCustomTitleInput] = useState<string>(savedProfile.customTitle || self?.customTitle || "");
  const [savedTitleFeedback, setSavedTitleFeedback] = useState<boolean>(false);

  const isMasterUser = Boolean(isMaster || isMasterIdentity(self?.name, self?.tag));

  // Sync coins, perks and cooldown info on interval
  useEffect(() => {
    if (!isOpen) return;

    const syncState = () => {
      setCoins(getKokiCoins());
      setPurchasedPerks(getPurchasedPerks());
      setCooldownInfo(getDailyBonusCooldownInfo());
    };

    syncState();

    const timer = setInterval(() => {
      syncState();
    }, 1000); // 1s tick for live timer counting down

    const handleCoinsEvent = (e: any) => {
      if (e?.detail?.coins !== undefined) setCoins(e.detail.coins);
      setCooldownInfo(getDailyBonusCooldownInfo());
    };
    const handlePerksEvent = (e: any) => {
      if (e?.detail?.perks) setPurchasedPerks(e.detail.perks);
    };

    window.addEventListener("koki_coins_updated", handleCoinsEvent);
    window.addEventListener("koki_perks_updated", handlePerksEvent);

    return () => {
      clearInterval(timer);
      window.removeEventListener("koki_coins_updated", handleCoinsEvent);
      window.removeEventListener("koki_perks_updated", handlePerksEvent);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePurchase = (perk: StorePerk) => {
    setErrorMessage(null);
    setPurchaseSuccessMessage(null);
    setIsProcessing(perk.id);

    try {
      const res = purchaseStorePerk(perk.id);
      if (res.success) {
        setCoins(res.newBalance);
        setPurchasedPerks(getPurchasedPerks());
        setPurchaseSuccessMessage(
          `Vantagem "${perk.name}" ativada com sucesso! Válida por 72 horas.`
        );
        if (onPerkPurchased) {
          onPerkPurchased(perk.id, res.activeUntil);
        }
        setTimeout(() => setPurchaseSuccessMessage(null), 5000);
      } else {
        setErrorMessage(res.error || "Não foi possível completar a compra.");
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (err: any) {
      setErrorMessage("Erro ao processar compra. Tente novamente.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleClaimDaily = () => {
    setErrorMessage(null);
    setDailyClaimMsg(null);
    const res = claimDailyBonus();
    if (res.success) {
      setCoins(res.newBalance);
      setCooldownInfo(getDailyBonusCooldownInfo());
      setDailyClaimMsg(`+${res.reward} Koki Coins resgatados com sucesso! 🎉`);
      setTimeout(() => setDailyClaimMsg(null), 4000);
    } else {
      setErrorMessage(res.error || "Aguarde o tempo de recarga de 24h para resgatar.");
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const handleSaveCustomTitle = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customTitleInput.trim().slice(0, 30);
    saveUserProfile({ customTitle: clean });
    setSavedTitleFeedback(true);
    setTimeout(() => setSavedTitleFeedback(false), 3000);
  };

  const getPerkIcon = (id: StorePerkId) => {
    switch (id) {
      case "gif_avatar":
        return <Sparkles className="w-5 h-5 text-pink-400" />;
      case "custom_banner":
        return <Film className="w-5 h-5 text-violet-400" />;
      case "custom_title":
        return <Award className="w-5 h-5 text-cyan-400" />;
      case "vip_role":
        return <Crown className="w-5 h-5 text-amber-400" />;
    }
  };

  const activePerksCount = STORE_PERKS.filter((p) =>
    isMasterUser ? true : isPerkActive(p.id, purchasedPerks)
  ).length;

  const displayedPerks = activeTab === "active"
    ? STORE_PERKS.filter((p) => isMasterUser || isPerkActive(p.id, purchasedPerks))
    : STORE_PERKS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c1220] border border-[#223354] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient & glow */}
        <div className="relative p-4 sm:p-6 bg-gradient-to-r from-[#11192e] via-[#16233f] to-[#121c33] border-b border-[#203050] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Coins className="w-7 h-7 text-slate-950 fill-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Loja Koki Coins
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/30 text-amber-300 border border-amber-500/40">
                  Duração 72h
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Desbloqueie avatares animados, banners MP4, títulos e cargo VIP exclusivo.
              </p>
            </div>
          </div>

          {/* Balance & Daily Rewards Controls */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {/* Coin Balance Pill */}
            <div className="flex items-center gap-2 bg-[#090e1a] border border-amber-500/50 px-3.5 py-2 rounded-2xl shadow-inner">
              <Coins className="w-5 h-5 text-amber-400 fill-amber-400/30 shrink-0 animate-pulse" />
              <div>
                <div className="text-[9px] font-bold text-amber-300/80 uppercase tracking-wider leading-none">
                  Seu Saldo
                </div>
                <div className="text-sm sm:text-base font-black text-amber-400 font-mono tracking-tight leading-tight">
                  {isMasterUser ? "∞" : coins.toLocaleString()} <span className="text-xs text-amber-200">Coins</span>
                </div>
              </div>
            </div>

            {/* Daily Reward (+50 Coins) / 24h Cooldown Button */}
            {isMasterUser ? (
              <button
                onClick={handleClaimDaily}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs px-3 py-2 rounded-xl transition-all shadow-md shadow-amber-950/50 cursor-pointer shrink-0"
                title="Master: Saldo ilimitado e sem recarga"
              >
                <Crown className="w-3.5 h-3.5 fill-current" />
                <span>+50 Coins (∞)</span>
              </button>
            ) : cooldownInfo.canClaim ? (
              <button
                onClick={handleClaimDaily}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-md shadow-emerald-950/50 cursor-pointer shrink-0 animate-pulse"
                title="Resgatar bônus diário de +50 Koki Coins"
              >
                <Gift className="w-3.5 h-3.5 text-emerald-200 animate-bounce" />
                <span>+50 Coins (Diário)</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-1.5 bg-[#121a2d] border border-[#202e48] text-slate-400 text-xs font-medium px-3 py-2 rounded-xl cursor-not-allowed shrink-0"
                title={`Bônus diário em recarga. Disponível em ${cooldownInfo.formatted}`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-400/80 animate-spin" />
                <span className="font-mono text-[11px] text-amber-300 font-bold">{cooldownInfo.formatted}</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-[#141e33] hover:bg-[#1f2e4d] rounded-xl transition-colors cursor-pointer shrink-0 ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Master Account Info Alert */}
        {isMasterUser && (
          <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/50 to-amber-950/80 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
              <Crown className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
              <span>Dono Master Autenticado: Você possui todas as vantagens ativas permanentemente e moedas ilimitadas!</span>
            </div>
            <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
              Acesso Total
            </span>
          </div>
        )}

        {/* Toast / Alert Feedback */}
        {purchaseSuccessMessage && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/50 px-4 py-2.5 flex items-center gap-2.5 text-xs text-emerald-200 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{purchaseSuccessMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-950/90 border-b border-rose-500/50 px-4 py-2.5 flex items-center gap-2.5 text-xs text-rose-200 animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {dailyClaimMsg && (
          <div className="bg-teal-950/90 border-b border-teal-500/50 px-4 py-2.5 flex items-center gap-2.5 text-xs text-teal-200 animate-in slide-in-from-top-2">
            <Gift className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="font-semibold">{dailyClaimMsg}</span>
          </div>
        )}

        {/* Navigation Tabs & Filter */}
        <div className="px-4 sm:px-6 pt-3 pb-1 flex items-center justify-between border-b border-[#1b2742]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200 bg-[#121a2d]"
              }`}
            >
              Todos os Itens ({STORE_PERKS.length})
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "active"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200 bg-[#121a2d]"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Itens Ativos ({activePerksCount})</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Cada item permanece ativo por <span className="text-amber-300 font-bold">72 horas</span> após a compra
          </span>
        </div>

        {/* Main Content Area: Perks Cards Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedPerks.map((perk) => {
              const active = isMasterUser || isPerkActive(perk.id, purchasedPerks);
              const activeUntil = isMasterUser ? Date.now() + 1000 * 3600 * 24 * 365 : (purchasedPerks[perk.id] || 0);
              const remainingInfo = getPerkRemainingTime(activeUntil);
              const canAfford = coins >= perk.price;

              return (
                <div
                  key={perk.id}
                  className={`relative bg-[#101728] border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
                    active
                      ? "border-emerald-500/50 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/30"
                      : "border-[#202f4d] hover:border-slate-600 shadow-md"
                  }`}
                >
                  {/* Top Badge Tag */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#162138] border border-[#25375c] flex items-center justify-center shadow-inner">
                        {getPerkIcon(perk.id)}
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                          {perk.name}
                        </h2>
                        <p className="text-xs text-slate-400 leading-tight">{perk.tagline}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                        active
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/60"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {perk.badgeLabel}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    {perk.description}
                  </p>

                  {/* Key Benefits List */}
                  <div className="bg-[#0b101c] rounded-xl p-2.5 mb-4 border border-[#1a263d] space-y-1.5">
                    {perk.benefits.map((b, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-300">
                        <Check className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>

                  {/* Active 72h Status or Countdown Bar */}
                  {active ? (
                    <div className="mb-4 bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-300 mb-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                          <span>Status: ATIVO</span>
                        </div>
                        <span className="font-mono text-emerald-200">
                          {isMasterUser ? "👑 Permanente (Dono)" : remainingInfo.formatted}
                        </span>
                      </div>
                      {!isMasterUser && (
                        <div className="w-full bg-[#0a1120] h-1.5 rounded-full overflow-hidden border border-emerald-900">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${remainingInfo.percentage}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4 bg-[#0a0f1d] border border-[#1b2742] rounded-xl p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Duração:</span>
                      </div>
                      <span className="font-bold text-amber-300">72 horas de acesso</span>
                    </div>
                  )}

                  {/* Custom Title Quick Configurator (if custom_title is active) */}
                  {perk.id === "custom_title" && active && (
                    <form onSubmit={handleSaveCustomTitle} className="mb-4 bg-[#121c30] border border-cyan-500/40 rounded-xl p-3">
                      <label className="text-[11px] font-bold text-cyan-300 flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-cyan-400" />
                          Definir seu Título de Perfil:
                        </span>
                        {savedTitleFeedback && (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Salvo!
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={30}
                          value={customTitleInput}
                          onChange={(e) => setCustomTitleInput(e.target.value)}
                          placeholder="Ex: PRO GAMER • STREAMER VIP"
                          className="w-full bg-[#080d19] border border-[#203050] text-slate-100 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          type="submit"
                          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0"
                        >
                          Salvar
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Purchase & Action Footer */}
                  <div className="pt-2 border-t border-[#1b2742] flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-amber-400 font-mono">
                        {perk.price}
                      </span>
                      <span className="text-xs text-amber-200/80 font-bold">Coins</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {active && onOpenProfileEditor && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenProfileEditor();
                          }}
                          className="flex items-center gap-1 bg-[#16233d] hover:bg-[#1e3052] text-cyan-300 border border-cyan-500/40 text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer"
                          title="Abrir editor para aplicar a vantagem"
                        >
                          <Palette className="w-3.5 h-3.5" />
                          <span>Configurar</span>
                        </button>
                      )}

                      <button
                        onClick={() => handlePurchase(perk)}
                        disabled={isProcessing === perk.id || (!canAfford && !active)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-md ${
                          active
                            ? "bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-400/50"
                            : canAfford
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-amber-950/60"
                            : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                        }`}
                      >
                        {active ? (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Estender +72h ({perk.price})</span>
                          </>
                        ) : canAfford ? (
                          <>
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>Comprar (72h)</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Faltam {perk.price - coins}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tips and Information Section */}
          <div className="mt-6 bg-[#0a101f] border border-[#1b2947] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Como obter mais Koki Coins?</h4>
                <p className="text-[11px] text-slate-400">
                  Resgate a sua recompensa diária de +300 moedas todos os dias e participe de chamadas ativas!
                </p>
              </div>
            </div>

            <button
              onClick={handleClaimDaily}
              className="bg-[#142038] hover:bg-[#1d2f54] text-amber-300 border border-amber-500/40 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer shrink-0"
            >
              Coletar Bônus Diário
            </button>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-3 sm:p-4 bg-[#080d19] border-t border-[#18233b] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Transações seguras e armazenamento local automático.</span>
          </div>

          <button
            onClick={onClose}
            className="bg-[#141e33] hover:bg-[#1f2e4d] text-slate-200 px-4 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
