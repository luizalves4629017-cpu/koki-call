import React, { useState } from "react";
import { Crown, Key, Eye, EyeOff, Loader2 } from "lucide-react";
import { authenticateMasterOnServer, saveMasterAuthLocally, clearMasterAuthLocally } from "../utils/masterAuth";
import { EcoLogo } from "./EcoLogo";

interface MasterLoginModalProps {
  isOpen: boolean;
  isMaster: boolean;
  onClose: () => void;
  onLoginSuccess: (masterToken: string) => void;
  onLogout: () => void;
  onOpenAdminPanel?: () => void;
}

export const MasterLoginModal: React.FC<MasterLoginModalProps> = ({
  isOpen,
  isMaster,
  onClose,
  onLoginSuccess,
  onLogout,
  onOpenAdminPanel,
}) => {
  const [masterKey, setMasterKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = masterKey.trim();
    if (!cleanKey) {
      setErrorMsg("Informe a chave de dono para continuar.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await authenticateMasterOnServer(cleanKey);

    if (result.success && result.masterToken) {
      saveMasterAuthLocally(result.masterToken, rememberMe);
      onLoginSuccess(result.masterToken);
      setLoading(false);
      onClose();
      if (onOpenAdminPanel) {
        onOpenAdminPanel();
      }
    } else {
      setErrorMsg(result.error || "Chave de dono incorreta.");
      setLoading(false);
    }
  };

  const handleLogoutMaster = () => {
    clearMasterAuthLocally();
    onLogout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16171B]/85 backdrop-blur-md animate-in fade-in select-none">
      {/* Top Left decorative logo & crown from design */}
      <div className="absolute top-6 left-6 hidden sm:flex items-center gap-3">
        <EcoLogo size="sm" showWordmark={true} />
        <div className="w-8 h-8 rounded-xl bg-[#1E2026] border border-[#2A2D35] flex items-center justify-center text-[#C4B5FD] shadow-sm">
          <Crown className="w-4 h-4 fill-current" />
        </div>
      </div>

      {/* Center Card matching user's Image 2 */}
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#1E2026] border border-[#2A2D35] rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center transition-all">
        {/* Subtle glow border effect */}
        <div className="absolute -inset-px rounded-2xl border border-transparent hover:border-[#C4B5FD]/20 pointer-events-none transition-colors" />

        <div className="w-10 h-10 rounded-xl bg-[#C4B5FD]/10 border border-[#C4B5FD]/30 flex items-center justify-center text-[#C4B5FD] mb-3">
          <Crown className="w-5 h-5 fill-current" />
        </div>

        <h2 className="text-xl font-bold text-[#ECECEC] tracking-tight">
          Acesso do Dono
        </h2>
        <p className="text-xs text-[#8B8F98] mt-1 mb-6">
          Painel administrativo do eco
        </p>

        {isMaster ? (
          <div className="w-full space-y-4">
            <div className="p-3.5 rounded-xl bg-[#C4B5FD]/10 border border-[#C4B5FD]/30 text-xs text-[#ECECEC]">
              <div className="flex items-center justify-center gap-1.5 font-semibold text-[#C4B5FD] mb-1">
                <Crown className="w-4 h-4 fill-current" />
                <span>Dono Master Autenticado</span>
              </div>
              <p className="text-[11px] text-[#8B8F98]">
                Você possui acesso irrestrito às salas, moderação e ao Painel do Dono.
              </p>
            </div>

            {onOpenAdminPanel && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminPanel();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#C4B5FD] hover:bg-[#d8b4fe] text-[#16171B] font-semibold text-sm transition-all duration-150 cursor-pointer shadow-md"
              >
                Abrir Painel do Dono
              </button>
            )}

            <button
              type="button"
              onClick={handleLogoutMaster}
              className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-[#F43F5E]/10 border border-[#2A2D35] hover:border-[#F43F5E]/40 text-[#F43F5E] text-xs font-medium transition-all cursor-pointer"
            >
              Sair da conta de Dono
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[#8B8F98] hover:text-[#ECECEC] transition-colors cursor-pointer pt-1"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-4 text-left">
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E] text-xs text-center">
                {errorMsg}
              </div>
            )}

            {/* Input Chave de Dono */}
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8B8F98]">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  placeholder="Chave de dono"
                  autoFocus
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-[#16171B] border border-[#2A2D35] focus:border-[#C4B5FD] focus:ring-1 focus:ring-[#C4B5FD] rounded-xl text-sm text-[#ECECEC] placeholder-[#8B8F98] outline-none transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8B8F98] hover:text-[#ECECEC] cursor-pointer transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Checkbox Lembrar */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#2A2D35] bg-[#16171B] text-[#C4B5FD] focus:ring-[#C4B5FD] accent-[#C4B5FD] cursor-pointer"
              />
              <span className="text-xs text-[#8B8F98] hover:text-[#ECECEC] transition-colors">
                Lembrar neste dispositivo
              </span>
            </label>

            {/* Primary Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#C4B5FD] hover:bg-[#d8b4fe] text-[#16171B] font-semibold text-sm transition-all duration-150 cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#16171B]" />
                  <span>Verificando...</span>
                </>
              ) : (
                <span>Entrar no painel</span>
              )}
            </button>

            {/* Cancel link */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-[#8B8F98] hover:text-[#ECECEC] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
