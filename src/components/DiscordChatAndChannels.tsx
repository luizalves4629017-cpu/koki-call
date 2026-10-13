import { apiUrl, midiaUrl } from "../utils/backend";
import { useFecharComNevoa, NevoaSaida } from "./NevoaSaida";
import { useContagem, textoCalma } from "../utils/useContagem";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X,
  SendHorizontal,
  Paperclip,
  Image as ImageIcon,
  Play,
  ShieldAlert,
  Crown,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Upload,
  Film,
} from "lucide-react";
import { ChatAttachment, ChatMessage, Participant, TextChannel } from "../types";

interface ArquivoParaEnviar {
  uploadId: string;
  name: string;
  width?: number;
  height?: number;
  spoiler?: boolean;
}

interface ArquivoPronto {
  name: string;
  data: Blob;
  width?: number;
  height?: number;
}

/** Sobe o arquivo direto pro servidor mostrando o progresso (0 a 1) */
function subirArquivo(
  blob: Blob,
  socketId: string,
  roomId: string,
  onProgresso: (p: number) => void
): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/api/media/upload"));
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("x-eco-socket", socketId);
    xhr.setRequestHeader("x-eco-room", roomId);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgresso(e.loaded / e.total);
    xhr.onload = () => {
      let r: any = {};
      try {
        r = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 200 && r.ok) resolve({ id: r.id });
      else reject(new Error(r.message || "Falha no envio."));
    };
    xhr.onerror = () => reject(new Error("Conexão caiu durante o envio."));
    xhr.send(blob);
  });
}

interface DiscordChatAndChannelsProps {
  isOpen: boolean;
  channels: TextChannel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  messages: ChatMessage[];
  self: Participant;
  isDarkTheme?: boolean;
  onClose: () => void;
  onSendMessage: (text: string, channelId: string) => void;
  onSendMedia?: (files: ArquivoParaEnviar[], text: string, channelId: string) => Promise<boolean>;
  socketId?: string;
  roomId?: string;
  /** Anti-spam: até quando o chat está bloqueado (ms, relógio do aparelho) */
  bloqueadoAte?: number;
}

const C = {
  fundo: "#16171B",
  painel: "#1E2026",
  borda: "#2A2D35",
  agua: "#5EEAD4",
  lilas: "#C4B5FD",
  perigo: "#F43F5E",
  texto: "#ECECEC",
  suave: "#8B8F9A",
};

const LIMITE_IMAGEM = 25 * 1024 * 1024;
const LIMITE_VIDEO = 512 * 1024 * 1024;
const MAX_ANEXOS = 4;
const AGRUPAR_MS = 5 * 60 * 1000;

interface Pendente {
  id: string;
  file: File;
  kind: "image" | "video";
  previewUrl: string;
  spoiler: boolean;
}

const hora = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const duracao = (s: number) => {
  if (!Number.isFinite(s)) return "";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

/** Diminui fotos grandes antes de enviar (carrega mais rápido pra todo mundo). GIF vai como está. */
async function prepararImagem(file: File): Promise<ArquivoPronto> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (file.type === "image/gif" || (Math.max(w, h) <= 1920 && file.size <= 1.5 * 1024 * 1024)) {
      return { name: file.name, data: file, width: w, height: h };
    }
    const escala = Math.min(1, 1920 / Math.max(w, h));
    const cw = Math.round(w * escala);
    const ch = Math.round(h * escala);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext("2d")!.drawImage(img, 0, 0, cw, ch);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.85));
    if (!blob || blob.size >= file.size) return { name: file.name, data: file, width: w, height: h };
    return { name: file.name.replace(/\.\w+$/, "") + ".webp", data: blob, width: cw, height: ch };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepararVideo(file: File): Promise<ArquivoPronto> {
  const url = URL.createObjectURL(file);
  try {
    const dims = await new Promise<{ w: number; h: number }>((res) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => res({ w: v.videoWidth, h: v.videoHeight });
      v.onerror = () => res({ w: 0, h: 0 });
      v.src = url;
    });
    return { name: file.name, data: file, width: dims.w || undefined, height: dims.h || undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- Vídeo no chat: play por cima até clicar ---------- */
const VideoAnexo: React.FC<{ a: ChatAttachment; compacto?: boolean }> = ({ a, compacto }) => {
  const [tocando, setTocando] = useState(false);
  const [dur, setDur] = useState("");
  const ref = useRef<HTMLVideoElement | null>(null);
  return (
    <div
      className="relative rounded-xl overflow-hidden border bg-black"
      style={{ borderColor: C.borda, width: compacto ? "100%" : 240, aspectRatio: a.width && a.height ? `${a.width}/${a.height}` : "16/9", maxHeight: 320 }}
    >
      <video
        ref={ref}
        src={midiaUrl(a.url)}
        preload="metadata"
        playsInline
        controls={tocando}
        onLoadedMetadata={(e) => setDur(duracao((e.target as HTMLVideoElement).duration))}
        className="w-full h-full object-contain"
      />
      {!tocando && (
        <button
          onClick={() => {
            setTocando(true);
            ref.current?.play().catch(() => {});
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors cursor-pointer"
          title="Assistir"
        >
          <span className="w-11 h-11 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
          </span>
          {dur && (
            <span className="absolute bottom-1.5 right-2 text-[10px] font-semibold text-white bg-black/60 rounded px-1.5 py-0.5">{dur}</span>
          )}
        </button>
      )}
    </div>
  );
};

/* ---------- Anexos de uma mensagem ---------- */
const Anexos: React.FC<{ itens: ChatAttachment[]; onAbrir: (a: ChatAttachment) => void }> = ({ itens, onAbrir }) => {
  const [revelados, setRevelados] = useState<Record<string, boolean>>({});
  const varios = itens.length > 1;

  const renderImagem = (a: ChatAttachment) => {
    const escondido = a.spoiler && !revelados[a.id];
    return (
      <button
        key={a.id}
        onClick={() => (escondido ? setRevelados((r) => ({ ...r, [a.id]: true })) : onAbrir(a))}
        className="relative block rounded-xl overflow-hidden border cursor-pointer group/img"
        style={{
          borderColor: C.borda,
          width: varios ? "100%" : undefined,
          aspectRatio: varios ? "1/1" : undefined,
          maxWidth: varios ? undefined : 260,
        }}
        title={escondido ? "Clique para ver" : "Abrir"}
      >
        <img
          src={midiaUrl(a.url)}
          alt={a.name}
          loading="lazy"
          className={`block ${varios ? "w-full h-full object-cover" : "max-h-[300px] w-auto"} ${escondido ? "blur-xl scale-110" : ""} transition-[filter] group-hover/img:brightness-110`}
          style={!varios && a.width && a.height ? { aspectRatio: `${a.width}/${a.height}` } : undefined}
        />
        {escondido && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-black/60 rounded-full px-3 py-1">
              <EyeOff className="w-3.5 h-3.5" /> Spoiler
            </span>
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`mt-1.5 ${varios ? "grid grid-cols-2 gap-1.5 max-w-[240px]" : "flex flex-col gap-1.5"}`}>
      {itens.map((a) => (a.kind === "video" ? <VideoAnexo key={a.id} a={a} compacto={varios} /> : renderImagem(a)))}
    </div>
  );
};

/* ---------- Tela cheia ---------- */
const Visualizador: React.FC<{ lista: ChatAttachment[]; indice: number; onFechar: () => void; onIr: (i: number) => void }> = ({
  lista,
  indice,
  onFechar,
  onIr,
}) => {
  const a = lista[indice];
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowLeft" && indice > 0) onIr(indice - 1);
      if (e.key === "ArrowRight" && indice < lista.length - 1) onIr(indice + 1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, lista.length, onFechar, onIr]);
  if (!a) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center" onClick={onFechar}>
      <div className="absolute top-4 right-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <a
          href={midiaUrl(a.url)}
          download={a.name}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Baixar"
        >
          <Download className="w-5 h-5" />
        </a>
        <button onClick={onFechar} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer" title="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>
      {indice > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIr(indice - 1);
          }}
          className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {indice < lista.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIr(indice + 1);
          }}
          className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
      <div onClick={(e) => e.stopPropagation()} className="max-w-[90vw] max-h-[85vh]">
        {a.kind === "video" ? (
          <video src={midiaUrl(a.url)} controls autoPlay playsInline className="max-w-[90vw] max-h-[85vh] rounded-lg" />
        ) : (
          <img src={midiaUrl(a.url)} alt={a.name} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" />
        )}
      </div>
      <div className="absolute bottom-4 text-xs text-white/60">
        {indice + 1} de {lista.length}
      </div>
    </div>
  );
};

export const DiscordChatAndChannels: React.FC<DiscordChatAndChannelsProps> = ({
  isOpen,
  channels,
  activeChannelId,
  messages,
  self,
  onClose,
  onSendMessage,
  onSendMedia,
  socketId,
  roomId,
  bloqueadoAte,
}) => {
  const segundosBloqueado = useContagem(bloqueadoAte);
  const [progresso, setProgresso] = useState<Record<string, number>>({});
  const { fechando, fechar } = useFecharComNevoa(onClose);
  const [inputText, setInputText] = useState("");
  const [aba, setAba] = useState<"conversas" | "midia">("conversas");
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState("");
  const [visor, setVisor] = useState<{ lista: ChatAttachment[]; indice: number } | null>(null);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const inputArquivo = useRef<HTMLInputElement | null>(null);
  const inputImagem = useRef<HTMLInputElement | null>(null);
  const contadorArraste = useRef(0);

  void activeChannelId;
  const canal = channels.find((c) => c.id === "geral") || channels[0] || { id: "geral", name: "geral", description: "" };

  const todasMidias = useMemo(() => messages.flatMap((m) => m.attachments || []), [messages]);

  useEffect(() => {
    if (isOpen && aba === "conversas") fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isOpen, aba]);

  // Limpa as prévias da memória
  useEffect(() => () => pendentes.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!erro) return;
    const t = setTimeout(() => setErro(""), 4000);
    return () => clearTimeout(t);
  }, [erro]);

  const adicionarArquivos = useCallback(
    (lista: FileList | File[]) => {
      const arquivos = Array.from(lista);
      const novos: Pendente[] = [];
      for (const file of arquivos) {
        const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
        if (!kind) {
          setErro("Só dá pra enviar foto, print ou vídeo.");
          continue;
        }
        if (kind === "image" && file.size > LIMITE_IMAGEM * 2) {
          setErro("Imagem grande demais.");
          continue;
        }
        if (kind === "video" && file.size > LIMITE_VIDEO) {
          setErro("Vídeo passa de 512 MB.");
          continue;
        }
        novos.push({ id: Math.random().toString(36).slice(2), file, kind, previewUrl: URL.createObjectURL(file), spoiler: false });
      }
      setPendentes((prev) => {
        const junto = [...prev, ...novos];
        if (junto.length > MAX_ANEXOS) {
          setErro(`Máximo de ${MAX_ANEXOS} arquivos por mensagem.`);
          junto.slice(MAX_ANEXOS).forEach((p) => URL.revokeObjectURL(p.previewUrl));
        }
        return junto.slice(0, MAX_ANEXOS);
      });
    },
    []
  );

  const removerPendente = (id: string) =>
    setPendentes((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((x) => x.id !== id);
    });

  const enviar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (enviando) return;
    if (segundosBloqueado > 0) {
      setErro(textoCalma(segundosBloqueado));
      return;
    }
    const texto = inputText.trim();
    if (pendentes.length > 0 && onSendMedia) {
      if (!socketId || !roomId) {
        setErro("Conectando... tente de novo em instantes.");
        return;
      }
      setEnviando(true);
      setProgresso({});
      try {
        const files: ArquivoParaEnviar[] = [];
        for (const p of pendentes) {
          const pronto = p.kind === "image" ? await prepararImagem(p.file) : await prepararVideo(p.file);
          if (p.kind === "image" && pronto.data.size > LIMITE_IMAGEM) {
            throw new Error("Imagem passa de 25 MB mesmo comprimida.");
          }
          const { id } = await subirArquivo(pronto.data, socketId, roomId, (v) => setProgresso((pr) => ({ ...pr, [p.id]: v })));
          setProgresso((pr) => ({ ...pr, [p.id]: 1 }));
          files.push({ uploadId: id, name: pronto.name, width: pronto.width, height: pronto.height, spoiler: p.spoiler });
        }
        const ok = await onSendMedia(files, texto, canal.id);
        if (ok) {
          pendentes.forEach((p) => URL.revokeObjectURL(p.previewUrl));
          setPendentes([]);
          setInputText("");
        }
      } catch (err: any) {
        setErro(err?.message || "Não consegui enviar esse arquivo.");
      } finally {
        setEnviando(false);
        setProgresso({});
      }
      return;
    }
    if (!texto) return;
    onSendMessage(texto, canal.id);
    setInputText("");
  };

  const colar = (e: React.ClipboardEvent) => {
    const arquivos = Array.from(e.clipboardData.files || []);
    if (arquivos.length > 0) {
      e.preventDefault();
      adicionarArquivos(arquivos);
    }
  };

  if (!isOpen) return null;

  const abrirVisor = (a: ChatAttachment) => {
    const lista = todasMidias;
    setVisor({ lista, indice: Math.max(0, lista.findIndex((x) => x.id === a.id)) });
  };

  return (
    <aside
      className={`w-[340px] border-l flex flex-col h-full shadow-2xl z-30 relative ${fechando ? "eco-painel-sair" : "eco-painel-entrar"}`}
      style={{ backgroundColor: C.painel, borderColor: C.borda, fontFamily: "Inter, system-ui, sans-serif" }}
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        contadorArraste.current += 1;
        setArrastando(true);
      }}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDragLeave={() => {
        contadorArraste.current = Math.max(0, contadorArraste.current - 1);
        if (contadorArraste.current === 0) setArrastando(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        contadorArraste.current = 0;
        setArrastando(false);
        if (e.dataTransfer.files?.length) adicionarArquivos(e.dataTransfer.files);
      }}
    >
      <NevoaSaida ativo={fechando} />
      {/* Cabeçalho */}
      <div className="px-4 pt-3 border-b" style={{ borderColor: C.borda }}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[15px]" style={{ color: C.texto }}>
            Chat da call
          </span>
          <button onClick={fechar} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" style={{ color: C.suave }} title="Fechar chat">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-5 mt-2">
          {(
            [
              ["conversas", "Conversas"],
              ["midia", `Mídia${todasMidias.length ? ` (${todasMidias.length})` : ""}`],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className="pb-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer"
              style={{ color: aba === id ? C.agua : C.suave, borderColor: aba === id ? C.agua : "transparent" }}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {aba === "midia" ? (
        <div className="flex-1 overflow-y-auto p-3" style={{ backgroundColor: C.painel }}>
          {todasMidias.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2" style={{ color: C.suave }}>
              <ImageIcon className="w-8 h-8 opacity-50" />
              <p className="text-xs">Nenhuma foto ou vídeo enviado ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {todasMidias.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setVisor({ lista: todasMidias, indice: i })}
                  className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:brightness-110"
                  style={{ borderColor: C.borda, backgroundColor: C.fundo }}
                >
                  {a.kind === "video" ? (
                    <>
                      <video src={midiaUrl(a.url)} preload="metadata" muted playsInline className="w-full h-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white drop-shadow" fill="white" />
                      </span>
                    </>
                  ) : (
                    <img src={midiaUrl(a.url)} alt={a.name} loading="lazy" className={`w-full h-full object-cover ${a.spoiler ? "blur-md" : ""}`} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-2 select-text" style={{ backgroundColor: C.painel }}>
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6" style={{ color: C.suave }}>
              <Upload className="w-7 h-7 opacity-50" />
              <p className="text-xs leading-relaxed">
                Nenhuma mensagem ainda. Escreva algo, cole um print com Ctrl+V ou arraste uma foto aqui.
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            // Avisos automáticos (entrou, moveu, insígnias, VIP...) ficam escondidos
            if (typeof msg.id === "string" && msg.id.startsWith("sys-")) return null;
            if (msg.isSystem && !msg.isSecurityWarning) {
              return (
                <div key={msg.id} className="px-4 py-1.5 text-center">
                  <span className="text-[11px] leading-snug" style={{ color: C.suave }}>
                    {msg.text}
                  </span>
                </div>
              );
            }
            if (msg.isSecurityWarning && msg.senderId === "system") {
              return (
                <div
                  key={msg.id}
                  className="mx-3 my-1 rounded-lg px-3 py-2 text-xs flex items-start gap-2 border"
                  style={{ borderColor: `${C.perigo}55`, backgroundColor: `${C.perigo}14`, color: "#FDA4AF" }}
                >
                  <ShieldAlert className="w-4 h-4 shrink-0" style={{ color: C.perigo }} />
                  <span>{msg.text}</span>
                </div>
              );
            }

            const anterior = messages[i - 1];
            const agrupada =
              anterior &&
              !anterior.isSystem &&
              anterior.senderId === msg.senderId &&
              msg.timestamp - anterior.timestamp < AGRUPAR_MS;
            const isMe = msg.senderId === self.id;
            const dono = msg.senderIsHost || (isMe && Boolean((self as any).isMaster));
            const avatarUrl = msg.senderAvatarUrl || (isMe ? self.avatarUrl : undefined);

            return (
              <div
                key={msg.id}
                className={`group flex gap-3 px-4 hover:bg-white/[0.025] transition-colors ${agrupada ? "py-0.5" : "pt-2.5 pb-0.5"}`}
              >
                <div className="w-9 shrink-0">
                  {agrupada ? (
                    <span className="hidden group-hover:block text-[9px] text-right pt-1" style={{ color: C.suave }}>
                      {hora(msg.timestamp)}
                    </span>
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold"
                      style={{ backgroundColor: msg.senderAvatarColor || (isMe ? self.avatarColor : C.lilas), color: C.fundo }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <span>{msg.senderAvatarEmoji || (msg.senderName || "?").charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {!agrupada && (
                    <div className="flex items-center gap-1.5 leading-none mb-1">
                      <span className="text-[13px] font-semibold truncate" style={{ color: dono ? C.lilas : C.texto }}>
                        {isMe ? self.name || "Você" : msg.senderName}
                      </span>
                      {dono && <Crown className="w-3 h-3 shrink-0" style={{ color: C.lilas }} />}
                      <span className="text-[10px]" style={{ color: C.suave }}>
                        {hora(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  {msg.text && (
                    <div
                      className="text-[13px] leading-relaxed break-words whitespace-pre-wrap"
                      style={{ color: msg.isSecurityWarning ? "#FDA4AF" : "#D4D6DC" }}
                    >
                      {msg.text}
                    </div>
                  )}
                  {msg.attachments && msg.attachments.length > 0 && <Anexos itens={msg.attachments} onAbrir={abrirVisor} />}
                </div>
              </div>
            );
          })}
          <div ref={fimRef} />
        </div>
      )}

      {/* Arrastar e soltar */}
      {arrastando && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 pointer-events-none" style={{ backgroundColor: `${C.fundo}E6` }}>
          <div className="w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2" style={{ borderColor: C.agua }}>
            <Upload className="w-8 h-8" style={{ color: C.agua }} />
            <span className="text-sm font-semibold" style={{ color: C.texto }}>
              Solte para enviar
            </span>
            <span className="text-[11px]" style={{ color: C.suave }}>
              Foto, print ou vídeo (até 512 MB)
            </span>
          </div>
        </div>
      )}

      {/* Escrever */}
      <form onSubmit={enviar} className="p-3 border-t" style={{ borderColor: C.borda }}>
        {erro && (
          <div className="mb-2 text-[11px] px-2.5 py-1.5 rounded-lg" style={{ color: "#FDA4AF", backgroundColor: `${C.perigo}14` }}>
            {erro}
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="mb-2 rounded-xl border p-2 flex gap-2 overflow-x-auto" style={{ borderColor: C.borda, backgroundColor: C.fundo }}>
            {pendentes.map((p) => (
              <div key={p.id} className="relative w-[84px] h-[64px] shrink-0 rounded-lg overflow-hidden border" style={{ borderColor: C.borda }}>
                {p.kind === "video" ? (
                  <>
                    <video src={p.previewUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    <Film className="absolute bottom-1 left-1 w-3.5 h-3.5 text-white drop-shadow" />
                  </>
                ) : (
                  <img src={p.previewUrl} alt="" className={`w-full h-full object-cover ${p.spoiler ? "blur-sm" : ""}`} />
                )}
                {enviando ? (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 36 36" className="-rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        stroke={C.agua}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 15}
                        strokeDashoffset={2 * Math.PI * 15 * (1 - (progresso[p.id] || 0))}
                        style={{ transition: "stroke-dashoffset .2s" }}
                      />
                    </svg>
                    <span className="absolute text-[9px] font-semibold text-white">{Math.round((progresso[p.id] || 0) * 100)}%</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => removerPendente(p.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-md bg-black/70 hover:bg-black flex items-center justify-center cursor-pointer"
                      title="Tirar"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                    {p.kind === "image" && (
                      <button
                        type="button"
                        onClick={() => setPendentes((prev) => prev.map((x) => (x.id === p.id ? { ...x, spoiler: !x.spoiler } : x)))}
                        className="absolute bottom-1 right-1 w-5 h-5 rounded-md flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: p.spoiler ? C.lilas : "rgba(0,0,0,.7)" }}
                        title="Marcar como spoiler (fica borrada até clicar)"
                      >
                        <EyeOff className="w-3 h-3" style={{ color: p.spoiler ? C.fundo : "white" }} />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {segundosBloqueado > 0 && (
          <div
            className="mb-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold"
            style={{ backgroundColor: "rgba(244,63,94,0.10)", borderColor: "rgba(244,63,94,0.40)", color: "#FECDD3" }}
            role="status"
          >
            <span>{textoCalma(segundosBloqueado)}</span>
            <span className="font-mono text-[13px]" style={{ color: C.perigo }}>{segundosBloqueado}s</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => inputArquivo.current?.click()}
            disabled={enviando || !onSendMedia}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
            style={{ color: C.suave }}
            title="Anexar foto ou vídeo"
          >
            <Paperclip className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => inputImagem.current?.click()}
            disabled={enviando || !onSendMedia}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
            style={{ color: C.suave }}
            title="Enviar imagem"
          >
            <ImageIcon className="w-[18px] h-[18px]" />
          </button>
          <div
            className="flex-1 flex items-center rounded-xl border pl-3 pr-1 py-1 transition-colors focus-within:border-[#5EEAD4]/60"
            style={{ backgroundColor: C.fundo, borderColor: C.borda }}
          >
            <input
              type="text"
              placeholder={segundosBloqueado > 0 ? textoCalma(segundosBloqueado) : `Mensagem em #${canal.name}`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={colar}
              maxLength={1000}
              disabled={enviando || segundosBloqueado > 0}
              className="flex-1 min-w-0 text-[13px] bg-transparent focus:outline-none py-1.5"
              style={{ color: C.texto }}
            />
            <button
              type="submit"
              disabled={enviando || segundosBloqueado > 0 || (!inputText.trim() && pendentes.length === 0)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity cursor-pointer disabled:opacity-30"
              style={{ backgroundColor: C.agua }}
              title="Enviar"
            >
              <SendHorizontal className="w-4 h-4" style={{ color: C.fundo }} />
            </button>
          </div>
        </div>

        <input
          ref={inputArquivo}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) adicionarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={inputImagem}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) adicionarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
      </form>

      {visor && (
        <Visualizador
          lista={visor.lista}
          indice={visor.indice}
          onFechar={() => setVisor(null)}
          onIr={(i) => setVisor((v) => (v ? { ...v, indice: i } : v))}
        />
      )}
    </aside>
  );
};
