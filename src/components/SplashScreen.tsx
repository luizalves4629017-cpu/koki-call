import React, { useEffect, useState } from "react";
import { ShieldCheck, Sparkles, Radio } from "lucide-react";

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [stage, setStage] = useState<"initial" | "reveal" | "glow" | "exit">("initial");

  useEffect(() => {
    // Sequence stages
    const timer1 = setTimeout(() => setStage("reveal"), 150);
    const timer2 = setTimeout(() => setStage("glow"), 800);
    const timer3 = setTimeout(() => setStage("exit"), 2000);
    const timer4 = setTimeout(() => onFinish(), 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onFinish]);

  return (
    <div
      onClick={onFinish}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none transition-opacity duration-500 overflow-hidden ${
        stage === "exit" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background: "radial-gradient(ellipse at center, #0f2759 0%, #081330 50%, #030816 100%)",
      }}
    >
      {/* Background Animated Ambient Glow Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-3xl transition-all duration-1000 ${
            stage !== "initial" ? "scale-125 opacity-70" : "scale-50 opacity-0"
          }`}
        />
        <div
          className={`w-[350px] h-[350px] rounded-full bg-blue-600/20 blur-2xl transition-all duration-1000 delay-200 ${
            stage === "glow" || stage === "exit" ? "scale-110 opacity-80" : "scale-75 opacity-20"
          }`}
        />
      </div>

      {/* Grid Pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Main Logo & Name Container */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
        {/* Glowing Emblem Icon */}
        <div
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 p-0.5 shadow-2xl transition-all duration-700 ${
            stage === "initial"
              ? "scale-50 opacity-0 -translate-y-6"
              : "scale-100 opacity-100 translate-y-0 shadow-cyan-500/40 ring-2 ring-cyan-400/50"
          }`}
        >
          <div className="w-full h-full rounded-[22px] bg-[#071129] flex items-center justify-center relative overflow-hidden">
            {/* Shimmer flare */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/20 to-transparent animate-pulse" />
            <span className="font-black text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-200 to-cyan-400 tracking-tighter">
              K
            </span>
          </div>
        </div>

        {/* Cinematic "Koki" Name Reveal */}
        <div className="mt-6 overflow-hidden">
          <h1
            className={`text-5xl sm:text-6xl font-black tracking-tight text-white transition-all duration-700 ${
              stage === "initial"
                ? "translate-y-12 opacity-0 tracking-widest"
                : "translate-y-0 opacity-100 tracking-tight"
            }`}
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400">
              Koki
            </span>
          </h1>
        </div>

        {/* Security & Audio Tagline */}
        <div
          className={`flex items-center gap-2 mt-3 transition-all duration-700 delay-300 ${
            stage === "glow" || stage === "exit"
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-semibold shadow-lg shadow-cyan-950/50">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Koki Shield • Proteção & Baixa Latência</span>
          </div>
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-8 text-slate-500 text-[11px] font-medium flex items-center gap-1.5">
        <Radio className="w-3 h-3 text-cyan-500 animate-ping" />
        <span>Iniciando ambiente seguro...</span>
      </div>
    </div>
  );
};
