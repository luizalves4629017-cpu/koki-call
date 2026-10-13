import React, { useState } from "react";
import { X, UserX, Ban, Gavel, Infinity as InfinityIcon } from "lucide-react";
import { Participant } from "../types";
import { tagVisivel } from "../utils/tagExibida";

export type AcaoPunir = "expulsar" | "sala" | "app";

interface PunirModalProps {
  alvo: Participant;
  /** A pessoa está online agora (dá pra expulsar da call) */
  alvoOnline: boolean;
  /** Pode tirar da call agora (poder "expulsar" do cargo, Dono ou Co-fundador) */
  podeExpulsarDaCall: boolean;
  /** Pode banir da sala / do app (Dono Master ou Co-fundador) */
  podeBanir: boolean;
  /** Nome da sala atual (pra "Banir do servidor/sala") */
  salaNome?: string;
  /** acao "expulsar" ignora minutos/motivo; minutos null = permanente */
  onPunir: (alvo: Participant, acao: AcaoPunir, minutos: number | null, motivo: string) => Promise<{ ok: boolean; mensagem?: string }>;
  onClose: () => void;
}

const PRESETS: { rotulo: string; minutos: number }[] = [
  { rotulo: "10 min", minutos: 10 },
  { rotulo: "1 h", minutos: 60 },
  { rotulo: "1 dia", minutos: 24 * 60 },
  { rotulo: "7 dias", minutos: 7 * 24 * 60 },
  { rotulo: "30 dias", minutos: 30 * 24 * 60 },
];

export const PunirModal: React.FC<PunirModalProps> = ({ alvo, alvoOnline, podeExpulsarDaCall, podeBanir, salaNome, onPunir, onClose }) => {
  const podeCall = podeExpulsarDaCall && alvoOnline;
  const [acao, setAcao] = useState<AcaoPunir>(podeBanir ? (podeCall ? "expulsar" : "sala") : "expulsar");
  const [permanente, setPermanente] = useState(false);
  const [dias, setDias] = useState("0");
  const [horas, setHoras] = useState("1");
  const [minutos, setMinutos] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  const numero = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const totalMin = numero(dias) * 1440 + numero(horas) * 60 + numero(minutos);
  const aplicarPreset = (m: number) => {
    setPermanente(false);
    setDias(String(Math.floor(m / 1440)));
    setHoras(String(Math.floor((m % 1440) / 60)));
    setMinutos(String(m % 60));
    setConfirmar(false);
  };

  const textoDuracao = (() => {
    if (permanente) return "para sempre (até alguém desbanir)";
    if (totalMin <= 0) return "escolha um tempo";
    const partes: string[] = [];
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d) partes.push(`${d} ${d === 1 ? "dia" : "dias"}`);
    if (h) partes.push(`${h} h`);
    if (m) partes.push(`${m} min`);
    return partes.join(" e ");
  })();

  const ehBan = acao === "sala" || acao === "app";
  const onde = acao === "sala" ? `da sala ${salaNome || "atual"}` : "do Eco inteiro";

  const enviar = async () => {
    setErro("");
    if (acao === "expulsar" && !podeCall) {
      setErro(`${alvo.name} está offline. Para quem está offline use Banir.`);
      return;
    }
    if (ehBan && !permanente) {
      if (totalMin < 1) return setErro("Escolha por quanto tempo (dias, horas, minutos) ou marque Permanente.");
      if (totalMin > 365 * 1440) return setErro("O banimento com prazo pode durar no máximo 365 dias. Para mais, use Permanente.");
    }
    if (ehBan && !confirmar) {
      setConfirmar(true);
      return;
    }
    setEnviando(true);
    const r = await onPunir(alvo, acao, ehBan ? (permanente ? null : totalMin) : null, motivo.trim());
    setEnviando(false);
    if (r.ok) onClose();
    else setErro(r.mensagem || "Não deu pra aplicar a punição.");
  };

  // Chamado como função (não como componente): a call atualiza toda hora e o React recriaria o botão, perdendo o clique
  const cartao = (id: AcaoPunir, titulo: string, desc: string, icone: React.ReactNode, cor: string, desativado = false) => (
    <button
      key={id}
      type="button"
      disabled={desativado}
      onClick={() => {
        setAcao(id);
        setConfirmar(false);
        setErro("");
      }}
      className={`w-full flex items-start gap-3 p-3 rounded-2xl border text-left transition-colors ${
        desativado ? "opacity-40 cursor-not-allowed bg-[#1E2026] border-[#2A2D35]" : acao === id ? "bg-[#16171B] cursor-pointer" : "bg-[#1E2026] border-[#2A2D35] hover:border-[#3A3E48] cursor-pointer"
      }`}
      style={acao === id && !desativado ? { borderColor: cor } : undefined}
    >
      <span className="mt-0.5 shrink-0" style={{ color: cor }}>
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-[#ECECEC]">{titulo}</span>
        <span className="block text-[11px] text-[#8B8F98]">{desc}</span>
      </span>
    </button>
  );

  const corBotao = acao === "app" ? "bg-[#F43F5E] hover:bg-[#E11D48] text-white" : acao === "sala" ? "bg-[#C4B5FD] hover:bg-[#B4A3FB] text-[#16171B]" : "bg-[#5EEAD4] hover:bg-[#2DD4BF] text-[#16171B]";
  const rotuloBotao = enviando
    ? "..."
    : acao === "expulsar"
    ? "Expulsar da call"
    : confirmar
    ? "Sim, banir"
    : acao === "sala"
    ? "Banir da sala"
    : "Banir do app";

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-[#16171B] border border-[#2A2D35] shadow-2xl p-5 text-[#ECECEC] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <Gavel className="w-5 h-5 text-[#FB7185]" />
              <span className="truncate">Punir {alvo.name}</span>
            </h3>
            <p className="text-[11px] text-[#8B8F98]">
              @{alvo.name.toLowerCase().replace(/\s+/g, "")}#{tagVisivel(alvo)} · {alvoOnline ? <span className="text-emerald-400">online</span> : "offline"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#8B8F98] hover:text-[#ECECEC] hover:bg-[#1E2026] cursor-pointer" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {podeExpulsarDaCall &&
            cartao(
              "expulsar",
              "Expulsar da call",
              alvoOnline ? "Tira a pessoa da sala agora. Ela pode voltar depois." : "Só para quem está online agora.",
              <UserX className="w-4 h-4" />,
              "#5EEAD4",
              !alvoOnline
            )}
          {podeBanir &&
            cartao(
              "sala",
              "Banir do servidor/sala",
              `Não entra mais em ${salaNome ? `"${salaNome}"` : "esta sala"} até o tempo acabar. As outras salas continuam liberadas.`,
              <Gavel className="w-4 h-4" />,
              "#C4B5FD"
            )}
          {podeBanir && cartao("app", "Banir do app", "Bloqueia o Eco inteiro: nenhuma sala, nenhuma conta, mesmo IP.", <Ban className="w-4 h-4" />, "#F43F5E")}
        </div>

        {ehBan && (
          <div className="space-y-2.5 bg-[#1E2026] border border-[#2A2D35] rounded-2xl p-3">
            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p.rotulo}
                  type="button"
                  onClick={() => aplicarPreset(p.minutos)}
                  className={`text-[11px] px-3 py-1 rounded-full border font-semibold cursor-pointer transition-colors ${
                    !permanente && totalMin === p.minutos ? "bg-[#5EEAD4]/15 border-[#5EEAD4]/60 text-[#5EEAD4]" : "border-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC]"
                  }`}
                >
                  {p.rotulo}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPermanente((v) => !v);
                  setConfirmar(false);
                }}
                className={`text-[11px] px-3 py-1 rounded-full border font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                  permanente ? "bg-[#F43F5E]/15 border-[#F43F5E]/60 text-[#FB7185]" : "border-[#2A2D35] text-[#8B8F98] hover:text-[#ECECEC]"
                }`}
              >
                <InfinityIcon className="w-3 h-3" />
                Permanente
              </button>
            </div>
            <div className={`grid grid-cols-3 gap-2 ${permanente ? "opacity-40 pointer-events-none" : ""}`}>
              {[
                { rotulo: "Dias", valor: dias, set: setDias, max: 365 },
                { rotulo: "Horas", valor: horas, set: setHoras, max: 23 },
                { rotulo: "Minutos", valor: minutos, set: setMinutos, max: 59 },
              ].map((c) => (
                <label key={c.rotulo} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B8F98]">{c.rotulo}</span>
                  <input
                    type="number"
                    min={0}
                    max={c.max}
                    value={c.valor}
                    onChange={(e) => {
                      c.set(e.target.value);
                      setConfirmar(false);
                    }}
                    className="bg-[#16171B] border border-[#2A2D35] rounded-xl px-3 py-2 text-sm font-semibold text-[#ECECEC] focus:outline-none focus:border-[#5EEAD4]"
                  />
                </label>
              ))}
            </div>
            <p className="text-[11px] text-[#8B8F98]">
              Banido {onde} <span className="text-[#ECECEC] font-semibold">{textoDuracao}</span>.
            </p>
          </div>
        )}

        {ehBan && (
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-[#8B8F98]">Motivo (opcional)</span>
            <input
              type="text"
              maxLength={200}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: spam no chat"
              className="w-full bg-[#1E2026] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-xs text-[#ECECEC] focus:outline-none focus:border-[#C4B5FD]"
            />
          </label>
        )}

        {erro && <div className="text-[11px] text-[#FB7185] bg-[#F43F5E]/10 rounded-xl px-3 py-2">{erro}</div>}
        {confirmar && ehBan && (
          <div className="text-[11px] text-[#FECDD3] bg-[#F43F5E]/10 border border-[#F43F5E]/40 rounded-xl px-3 py-2">
            Tem certeza? {alvo.name} fica banido {onde} {textoDuracao}. Clique de novo para confirmar.
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-[#1E2026] border border-[#2A2D35] hover:bg-[#252830] text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={enviar}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black cursor-pointer disabled:opacity-50 ${corBotao}`}
          >
            {rotuloBotao}
          </button>
        </div>
      </div>
    </div>
  );
};
