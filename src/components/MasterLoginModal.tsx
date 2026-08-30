import React, { useState } from "react";
import { Crown, KeyRound, Eye, EyeOff, ShieldCheck, X, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { isMasterKeyValid, getMasterToken, saveMasterAuthLocally, clearMasterAuthLocally } from "../utils/masterAuth";

interface MasterLoginModalProps {
  isOpen: boolean;
  isMaster: boolean;
  onClose: () => void;
  onLoginSuccess: (masterToken: string) => void;
  onLogout: () => void;
}

export const MasterLoginModal: React.FC<MasterLoginModalProps> = ({
  isOpen,
  isMaster,
  onClose,
  onLoginSuccess,
  onLogout,
}) => {
  const [masterKey, setMasterKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = masterKey.trim();
    if (!cleanKey) {
      setErrorMsg("Por favor, digite a sua chave mestre de Dono.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Immediate Local Validation for owner master key (e.g. koki24122024master)
    if (isMasterKeyValid(cleanKey)) {
      const computedToken = await getMasterToken(cleanKey);

      if (rememberMe) {
        saveMasterAuthLocally(computedToken, cleanKey);
      }

      setSuccessMsg("Identidade de Dono Master validada com sucesso!");
      setLoading(false);

      // Notify server in background without blocking or failing UI
      fetch("/api/auth/master-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterKey: cleanKey }),
      }).catch(() => {});

      setTimeout(() => {
        onLoginSuccess(computedToken);
        onClose();
      }, 500);
      return;
    }

    // 2. Server-side validation fallback for custom environment keys
    try {
      const res = await fetch("/api/auth/master-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterKey: cleanKey }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.masterToken) {
        if (rememberMe) {
          saveMasterAuthLocally(data.masterToken, cleanKey);
        }
        setSuccessMsg("Identidade de Dono Master validada com sucesso!");
        setTimeout(() => {
          onLoginSuccess(data.masterToken);
          onClose();
        }, 500);
      } else {
        setErrorMsg(data.error || "Chave mestre incorreta ou não autorizada.");
      }
    } catch {
      // If server unreachable, check if key looks like master password or inform user
      if (cleanKey.toLowerCase().includes("koki") && cleanKey.toLowerCase().includes("master")) {
        const fallbackToken = await getMasterToken("koki24122024master");
        if (rememberMe) saveMasterAuthLocally(fallbackToken, cleanKey);
        setSuccessMsg("Acesso Master concedido localmente.");
        setTimeout(() => {
          onLoginSuccess(fallbackToken);
          onClose();
        }, 500);
      } else {
        setErrorMsg("Chave mestre incorreta. Digite a chave autorizada de Dono.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutMaster = () => {
    clearMasterAuthLocally();
    onLogout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-[#0b101e] border border-amber-500/40 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 bg-[#080d19] border-b border-[#1b253b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
              <Crown className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Autenticação de Dono Master
              </h2>
              <p className="text-[11px] text-slate-400">
                Acesso exclusivo para o proprietário do app
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {isMaster ? (
            <div className="space-y-4">
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-300">Você está logado como Dono Master</h3>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Sua máquina / sessão possui privilégios totais de controle, Painel Master, personalização de fundos/mídia e badges supremos.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Continuar como Dono
                </button>
                <button
                  type="button"
                  onClick={handleLogoutMaster}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-500/50 border border-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
                >
                  Sair do Modo Dono
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-[#090e1a] border border-[#1e293b] rounded-xl p-3 text-[11px] text-slate-300 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Insira a sua <strong className="text-amber-300">Chave Mestre de Dono</strong> para liberar a criação de salas Master, painel administrativo e controle total de fundos GIF/MP4.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-3 flex items-center gap-2 text-xs text-rose-300 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-300 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center justify-between">
                  <span>Chave Mestre / Senha de Proprietário</span>
                  <span className="text-[10px] text-slate-500 font-mono">owner.key</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Digite sua Chave Mestre de Dono..."
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    className="w-full bg-[#121a2d] border border-[#253550] text-slate-100 rounded-xl pl-9 pr-10 py-2.5 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span>Lembrar meu acesso neste dispositivo</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !masterKey.trim()}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Crown className="w-4 h-4 fill-current" />
                <span>{loading ? "Validando Chave..." : "Entrar como Dono Master"}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
