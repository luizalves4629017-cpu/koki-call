import React, { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { Save, Store } from "lucide-react";
import { getStoreItems } from "../utils/storage";
import type { StorePerk } from "../types";
import { notify } from "./Toast";
import { EcoCoinIcon } from "./EcoCoinIcon";

const C = { fundo: "#16171B", painel: "#1E2026", borda: "#2A2D35", agua: "#5EEAD4", lilas: "#C4B5FD", perigo: "#F43F5E" };

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <button
    onClick={() => onChange(!on)}
    className={`w-10 h-5 rounded-full relative transition cursor-pointer ${on ? "" : "bg-slate-700"}`}
    style={on ? { background: C.agua } : undefined}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
  </button>
);

const campo = "w-full px-3 py-2 rounded-lg border bg-transparent text-white text-sm outline-none placeholder:text-slate-600";

/* =================== Loja: preços =================== */
export const EditorLoja: React.FC<{ socket: Socket; masterToken?: string | null }> = ({ socket, masterToken }) => {
  const [itens, setItens] = useState<StorePerk[]>(() => getStoreItems());
  const [rascunho, setRascunho] = useState<Record<string, { price: string; durationHours: string; discountPercent: string }>>({});

  useEffect(() => {
    const f = () => setItens(getStoreItems());
    window.addEventListener("eco_store_items_updated", f);
    socket.emit("loja:config", {}, () => f());
    return () => window.removeEventListener("eco_store_items_updated", f);
  }, [socket]);

  const valor = (it: StorePerk, k: "price" | "durationHours" | "discountPercent") =>
    rascunho[it.id]?.[k] ?? String((it as any)[k] ?? (k === "discountPercent" ? 0 : ""));

  const mudar = (id: string, k: "price" | "durationHours" | "discountPercent", v: string) =>
    setRascunho((r) => ({ ...r, [id]: { ...{ price: "", durationHours: "", discountPercent: "" }, ...(r[id] || {}), [k]: v } as any }));

  const salvar = (it: StorePerk, extra: any = {}) => {
    const r = rascunho[it.id] || ({} as any);
    const ajuste: any = { ...extra };
    if (r.price !== undefined && r.price !== "") ajuste.price = Number(r.price);
    if (r.durationHours !== undefined && r.durationHours !== "") ajuste.durationHours = Number(r.durationHours);
    if (r.discountPercent !== undefined && r.discountPercent !== "") {
      const desc = Math.max(0, Math.min(100, Number(r.discountPercent)));
      ajuste.discountPercent = desc;
      const base = it.originalPrice || Number(r.price || it.price);
      if (desc > 0) {
        ajuste.originalPrice = base;
        ajuste.price = Math.round(base * (1 - desc / 100));
      } else {
        ajuste.originalPrice = 0;
      }
    }
    socket.emit("loja:ajustar", { itemId: it.id, ajuste, masterToken: masterToken || undefined }, (res: any) => {
      if (res?.ok) {
        notify(`${it.name} atualizado para todo mundo.`, "success");
        setRascunho((x) => {
          const n = { ...x };
          delete n[it.id];
          return n;
        });
      } else notify(res?.mensagem || "Não salvou.", "error");
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <Store className="w-3.5 h-3.5" style={{ color: C.lilas }} /> Muda na hora para todos que estão no eco.
      </p>
      {itens.map((it) => (
        <div key={it.id} className="rounded-xl border p-3" style={{ background: C.fundo, borderColor: C.borda, opacity: it.isActive === false ? 0.55 : 1 }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-medium truncate">{it.name}</div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                Atual: <EcoCoinIcon className="w-3 h-3" /> {it.price}
                {it.discountPercent ? ` (−${it.discountPercent}%)` : ""} · {it.durationHours}h
              </div>
            </div>
            <span className="text-[11px] text-slate-500 mr-1">{it.isActive === false ? "Oculto" : "Na loja"}</span>
            <Toggle on={it.isActive !== false} onChange={(v) => salvar(it, { isActive: v })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] text-slate-500">
              Preço
              <input type="number" min={0} value={valor(it, "price")} onChange={(e) => mudar(it.id, "price", e.target.value)} className={campo} style={{ borderColor: C.borda }} />
            </label>
            <label className="text-[10px] text-slate-500">
              Duração (h)
              <input type="number" min={1} value={valor(it, "durationHours")} onChange={(e) => mudar(it.id, "durationHours", e.target.value)} className={campo} style={{ borderColor: C.borda }} />
            </label>
            <label className="text-[10px] text-slate-500">
              Desconto %
              <input type="number" min={0} max={100} value={valor(it, "discountPercent")} onChange={(e) => mudar(it.id, "discountPercent", e.target.value)} className={campo} style={{ borderColor: C.borda }} />
            </label>
          </div>
          {rascunho[it.id] && (
            <button
              onClick={() => salvar(it)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#0b1413] cursor-pointer"
              style={{ background: C.agua }}
            >
              <Save className="w-3.5 h-3.5" /> Salvar preço
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

