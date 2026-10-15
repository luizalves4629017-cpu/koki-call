import React, { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { notify } from "./Toast";
import { TEMAS_INFO } from "./SalaDiversao";

/** Dono Master define o prêmio dos mini-jogos e o preço de cada Tema da Sala (Eco Coins). */
const CAMPOS: Array<{ chave: string; rotulo: string; padrao: number }> = [
  { chave: "jogo_velha", rotulo: "Prêmio do Jogo da Velha", padrao: 20 },
  { chave: "jogo_damas", rotulo: "Prêmio das Damas", padrao: 30 },
  { chave: "jogo_uno", rotulo: "Prêmio do Uno", padrao: 40 },
  ...TEMAS_INFO.filter((t) => t.id !== "padrao").map((t) => ({
    chave: `tema_${t.id}`,
    rotulo: `Tema ${t.nome}`,
    padrao: ({ buraco_negro: 200, aurora: 150, chuva: 100, cerejeira: 150 } as Record<string, number>)[t.id] ?? 0,
  })),
];

export const EditorJogos: React.FC<{ socket: Socket; masterToken?: string | null }> = ({ socket, masterToken }) => {
  const [valores, setValores] = useState<Record<string, string>>({});
  useEffect(() => {
    socket.emit("loja:config", {}, (r: any) => {
      const a = r?.ajustes || {};
      setValores(Object.fromEntries(CAMPOS.map((c) => [c.chave, String(a[c.chave]?.price ?? c.padrao)])));
    });
  }, [socket]);
  const salvar = (chave: string) => {
    const n = Math.max(0, Math.floor(Number(valores[chave])));
    if (!Number.isFinite(n)) return notify("Valor inválido.");
    socket.emit("loja:ajustar", { itemId: chave, ajuste: { price: n }, masterToken: masterToken || undefined }, (r: any) =>
      r?.ok === false ? notify(r?.mensagem || "Não salvou.", "error") : notify("Valor salvo para todo mundo.", "success"));
  };
  return (
    <div className="bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-4 space-y-3">
      <p className="font-bold text-sm text-[#5EEAD4]">Mini-jogos e Temas da Sala</p>
      <p className="text-[#8B8E98]">Valores em Eco Coins. Coloque 0 para deixar um tema grátis.</p>
      {CAMPOS.map((c) => (
        <div key={c.chave} className="flex items-center gap-2">
          <span className="flex-1 text-[#ECECEC]">{c.rotulo}</span>
          <input type="number" min={0} value={valores[c.chave] ?? ""} onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
            className="w-24 bg-[#16171B] border border-[#2A2D35] rounded-lg px-2 py-1.5 text-[#ECECEC] text-right" />
          <button onClick={() => salvar(c.chave)} className="px-3 py-1.5 rounded-lg bg-[#5EEAD4]/15 text-[#5EEAD4] font-bold cursor-pointer">Salvar</button>
        </div>
      ))}
    </div>
  );
};
