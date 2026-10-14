import React from "react";
import { X, Sparkles, Trash2 } from "lucide-react";
import { AuraConfig, AURA_PRESETS, corAura, duracaoAura, gradienteAura, TOM_MIN_MEMBRO, TOM_MAX_MEMBRO } from "../utils/auraCard";
import { CORES_AURA_LOJA, corAuraLoja } from "../utils/auraLoja";

const PARTICULAS = [
  { l: "4%", t: "12%", d: "0s" },
  { l: "96%", t: "22%", d: "1.2s" },
  { l: "-2%", t: "58%", d: "2.1s" },
  { l: "101%", t: "70%", d: "0.6s" },
  { l: "30%", t: "-1.5%", d: "1.7s" },
  { l: "72%", t: "101%", d: "2.6s" },
  { l: "12%", t: "99%", d: "3.1s" },
  { l: "88%", t: "-1%", d: "0.9s" },
];

/**
 * Aura configurável em volta do card inteiro — mesmo desenho da aura do criador
 * (fio nítido na borda + brilho desfocado + névoa larga + partículas), com as cores/valores escolhidos.
 * Só pra quem o Dono Master ou o Co-fundador liberou.
 */
export const AuraCard: React.FC<{ config: AuraConfig }> = ({ config: bruto }) => {
  // Mesmo limite do servidor (sem branco/prata/preto, exclusivos do Dono e do Co-fundador)
  const config = { ...bruto, tom: Math.min(TOM_MAX_MEMBRO, Math.max(TOM_MIN_MEMBRO, bruto.tom)) };
  const luz = gradienteAura(config);
  const i = config.intensidade / 100;
  const dur = duracaoAura(config.velocidade);
  const corParticula = corAura(config.cor1, config.tom, 1);
  const corParticula2 = corAura(config.duasCores ? config.cor2 : config.cor1, config.tom, 1);
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {/* névoa larga, gira ao contrário */}
      <div className="absolute -inset-5 rounded-[40px] overflow-hidden" style={{ filter: `blur(${12 + 20 * i}px)`, opacity: 0.12 + 0.38 * i }}>
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar-rev" style={{ background: luz, animationDuration: `${dur * 2}s` }} />
      </div>
      {/* brilho colado na borda */}
      <div className="absolute -inset-2 rounded-[32px] overflow-hidden" style={{ filter: `blur(${4 + 8 * i}px)`, opacity: 0.3 + 0.6 * i }}>
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar" style={{ background: luz, animationDuration: `${dur}s` }} />
      </div>
      {/* fio de luz nítido contornando o card */}
      <div className="absolute -inset-[1.5px] rounded-[25.5px] overflow-hidden" style={{ opacity: 0.55 + 0.45 * i }}>
        <div className="absolute left-1/2 top-1/2 w-[220%] aspect-square -translate-x-1/2 -translate-y-1/2 eco-aura-girar" style={{ background: luz, animationDuration: `${dur}s` }} />
      </div>
      {config.particulas &&
        PARTICULAS.map((p, k) => {
          const c = k % 2 ? corParticula2 : corParticula;
          return (
            <span
              key={k}
              className="absolute w-1 h-1 rounded-full eco-aura-particula"
              style={{ left: p.l, top: p.t, animationDelay: p.d, background: c, boxShadow: `0 0 6px 1px ${c}` }}
            />
          );
        })}
    </div>
  );
};

/** Aura simples da loja: só um brilho suave que pulsa devagar na borda (sem giro e sem partículas). */
export const AuraLojaBrilho: React.FC<{ cor: string }> = ({ cor }) => {
  const c = corAuraLoja(cor)?.cor || "#60A5FA";
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <div className="absolute -inset-1 rounded-[28px] eco-aura-loja" style={{ boxShadow: `0 0 18px 4px ${c}88, 0 0 42px 10px ${c}33` }} />
      <div className="absolute -inset-[1.5px] rounded-[25.5px]" style={{ background: c, opacity: 0.55 }} />
    </div>
  );
};

/* ---------- Editor completo (liberado pelo Dono Master / Co-fundador) ---------- */

const Slider: React.FC<{ rotulo: string; valor: number; min?: number; max: number; fundo: string; onChange: (v: number) => void; dica?: string }> = ({
  rotulo,
  valor,
  min = 0,
  max,
  fundo,
  onChange,
  dica,
}) => (
  <label className="block">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs text-[#ECECEC] font-medium">{rotulo}</span>
      <span className="text-[10px] text-[#8B8F98]">{dica ?? valor}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={valor}
      onChange={(e) => onChange(Number(e.target.value))}
      className="eco-range w-full"
      style={{ background: fundo }}
    />
  </label>
);

const Interruptor: React.FC<{ rotulo: string; ligado: boolean; onChange: (v: boolean) => void }> = ({ rotulo, ligado, onChange }) => (
  <button type="button" onClick={() => onChange(!ligado)} className="w-full flex items-center justify-between py-1 cursor-pointer">
    <span className="text-xs text-[#ECECEC] font-medium">{rotulo}</span>
    <span className={`w-9 h-5 rounded-full relative transition-colors ${ligado ? "bg-[#5EEAD4]" : "bg-[#2A2D35]"}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${ligado ? "left-[18px]" : "left-0.5"}`} />
    </span>
  </button>
);

const ARCO_IRIS = "linear-gradient(90deg, hsl(0,90%,60%), hsl(60,90%,60%), hsl(120,90%,55%), hsl(180,90%,55%), hsl(240,90%,65%), hsl(300,90%,60%), hsl(360,90%,60%))";

const PAINEL =
  "z-[60] bg-[#1E2026] border border-[#2A2D35] shadow-2xl p-4 overflow-y-auto text-[#ECECEC] " +
  "max-lg:fixed max-lg:bottom-0 max-lg:inset-x-0 max-lg:max-h-[52vh] max-lg:rounded-t-3xl " +
  "lg:relative lg:w-80 lg:max-h-[92vh] lg:rounded-3xl lg:shrink-0";

export const AuraEditor: React.FC<{
  config: AuraConfig;
  onChange: (c: AuraConfig) => void;
  onSalvar: () => void;
  onRemover: () => void;
  onFechar: () => void;
  salvando?: boolean;
  mensagem?: string;
  liberadoPor?: "dono" | "cofundador";
}> = ({ config, onChange, onSalvar, onRemover, onFechar, salvando, mensagem, liberadoPor }) => {
  const set = (k: keyof AuraConfig, v: any) => onChange({ ...config, [k]: v });
  const velTxt = config.velocidade < 25 ? "Devagar" : config.velocidade < 60 ? "Médio" : config.velocidade < 85 ? "Rápido" : "Muito rápido";
  return (
    <div className={PAINEL} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#C4B5FD]" /> Aura do card
          </h3>
          <p className="text-[10px] text-[#8B8F98] mt-0.5">
            {liberadoPor === "cofundador" ? "Liberado por Co-fundador" : "Liberado por Dono Master"} · o card mostra a prévia
          </p>
        </div>
        <button onClick={onFechar} className="p-1 rounded-md text-[#8B8F98] hover:text-white hover:bg-[#2A2D35] cursor-pointer" title="Fechar sem salvar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-[#8B8F98] mb-1.5">Prontas</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {AURA_PRESETS.map((p) => (
          <button
            key={p.nome}
            type="button"
            onClick={() => onChange({ ...p.config })}
            className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-[#16171B] border border-[#2A2D35] hover:border-[#5EEAD4]/60 text-[11px] cursor-pointer"
          >
            <span
              className="w-4 h-4 rounded-full"
              style={{
                background: p.config.duasCores
                  ? `linear-gradient(135deg, ${corAura(p.config.cor1, p.config.tom, 1)}, ${corAura(p.config.cor2, p.config.tom, 1)})`
                  : corAura(p.config.cor1, p.config.tom, 1),
              }}
            />
            {p.nome}
          </button>
        ))}
      </div>

      <div className="space-y-3.5">
        <Slider rotulo="Cor" valor={config.cor1} max={360} fundo={ARCO_IRIS} onChange={(v) => set("cor1", v)} dica={`${config.cor1}°`} />
        <Slider
          rotulo="Tom"
          valor={Math.min(TOM_MAX_MEMBRO, Math.max(TOM_MIN_MEMBRO, config.tom))}
          min={TOM_MIN_MEMBRO}
          max={TOM_MAX_MEMBRO}
          fundo={`linear-gradient(90deg, ${corAura(config.cor1, TOM_MIN_MEMBRO, 1)}, ${corAura(config.cor1, 50, 1)}, ${corAura(config.cor1, TOM_MAX_MEMBRO, 1)})`}
          onChange={(v) => set("tom", v)}
          dica={config.tom < 35 ? "Escuro" : config.tom > 75 ? "Claro" : "Médio"}
        />
        <Slider
          rotulo="Intensidade do brilho"
          valor={config.intensidade}
          max={100}
          fundo={`linear-gradient(90deg, #2A2D35, ${corAura(config.cor1, config.tom, 1)})`}
          onChange={(v) => set("intensidade", v)}
          dica={`${config.intensidade}%`}
        />
        <Slider rotulo="Velocidade" valor={config.velocidade} max={100} fundo="linear-gradient(90deg, #2A2D35, #5EEAD4)" onChange={(v) => set("velocidade", v)} dica={velTxt} />
        <div className="h-px bg-[#2A2D35]" />
        <Interruptor rotulo="Duas cores" ligado={config.duasCores} onChange={(v) => set("duasCores", v)} />
        {config.duasCores && <Slider rotulo="Segunda cor" valor={config.cor2} max={360} fundo={ARCO_IRIS} onChange={(v) => set("cor2", v)} dica={`${config.cor2}°`} />}
        <Interruptor rotulo="Partículas" ligado={config.particulas} onChange={(v) => set("particulas", v)} />
      </div>

      {mensagem && <p className="text-[11px] text-[#FB7185] mt-3">{mensagem}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={onRemover}
          disabled={salvando}
          className="px-3 py-2 rounded-xl text-xs font-bold text-[#FB7185] bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remover
        </button>
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="flex-1 py-2 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-xs font-extrabold cursor-pointer disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar aura"}
        </button>
      </div>
    </div>
  );
};

/* ---------- Escolha de cor da aura da loja (simples) ---------- */

export const AuraLojaEditor: React.FC<{
  cor: string | null;
  onChange: (cor: string | null) => void;
  onSalvar: () => void;
  onFechar: () => void;
  salvando?: boolean;
  mensagem?: string;
}> = ({ cor, onChange, onSalvar, onFechar, salvando, mensagem }) => (
  <div className={PAINEL} onClick={(e) => e.stopPropagation()}>
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#5EEAD4]" /> Aura do card
        </h3>
        <p className="text-[10px] text-[#8B8F98] mt-0.5">Item da loja · escolha a cor do brilho</p>
      </div>
      <button onClick={onFechar} className="p-1 rounded-md text-[#8B8F98] hover:text-white hover:bg-[#2A2D35] cursor-pointer" title="Fechar sem salvar">
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {CORES_AURA_LOJA.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-[#16171B] border cursor-pointer transition-colors ${
            cor === c.id ? "border-white/70" : "border-[#2A2D35] hover:border-[#383C47]"
          }`}
        >
          <span className="w-6 h-6 rounded-full" style={{ background: c.cor, boxShadow: `0 0 12px 2px ${c.cor}66` }} />
          <span className="text-[11px]">{c.nome}</span>
        </button>
      ))}
    </div>
    {mensagem && <p className="text-[11px] text-[#FB7185] mt-3">{mensagem}</p>}
    <div className="flex items-center gap-2 mt-4">
      <button
        type="button"
        onClick={() => onChange(null)}
        disabled={salvando}
        className="px-3 py-2 rounded-xl text-xs font-bold text-[#B5B9C2] bg-[#2A2D35] hover:bg-[#383C47] cursor-pointer disabled:opacity-50"
      >
        Sem aura
      </button>
      <button
        type="button"
        onClick={onSalvar}
        disabled={salvando}
        className="flex-1 py-2 rounded-xl bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B] text-xs font-extrabold cursor-pointer disabled:opacity-60"
      >
        {salvando ? "Salvando…" : "Salvar aura"}
      </button>
    </div>
  </div>
);
