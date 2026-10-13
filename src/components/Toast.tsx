import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  removeToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// Global helper for non-React contexts or fast imports
let globalShowToast: ((message: string, type?: ToastType, duration?: number) => void) | null = null;

export const notify = (message: string, type: ToastType = "info", duration = 4000) => {
  if (globalShowToast) {
    globalShowToast(message, type, duration);
  } else {
    console.log(`[Toast ${type.toUpperCase()}]: ${message}`);
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastItem = { id, type, message, duration };
    setToasts((prev) => [...prev.slice(-4), newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  globalShowToast = showToast;

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast floating container */}
      <aside aria-label="Notificações do sistema" className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3">
        {toasts.map((toast) => {
          let icon = <Info className="w-5 h-5 text-sky-500 shrink-0" />;
          let borderClass = "border-sky-300/80 bg-white/95 text-slate-800 shadow-sky-900/10";

          if (toast.type === "success") {
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
            borderClass = "border-emerald-300/80 bg-white/95 text-slate-800 shadow-emerald-900/10";
          } else if (toast.type === "error") {
            icon = <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
            borderClass = "border-rose-300/80 bg-white/95 text-slate-800 shadow-rose-900/10";
          } else if (toast.type === "warning") {
            icon = <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
            borderClass = "border-amber-300/80 bg-white/95 text-slate-800 shadow-amber-900/10";
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${borderClass}`}
            >
              <div className="pt-0.5">{icon}</div>
              <div className="flex-1 text-xs font-medium leading-relaxed select-text">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
};
