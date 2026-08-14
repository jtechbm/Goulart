"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dispararRespostaAction, enviarMensagemAction, marcarComoLidaAction } from "@/lib/chatActions";
import { Avatar, PlatformBadge } from "./ui";

type Mensagem = { id: string; direction: string; body: string; sentAt: Date };

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ChatThread({
  conversationId,
  customerName,
  platform,
  mensagensIniciais,
  temNaoLida,
}: {
  conversationId: string;
  customerName: string;
  platform: string;
  mensagensIniciais: Mensagem[];
  temNaoLida: boolean;
}) {
  const router = useRouter();
  const [mensagens, setMensagens] = useState(mensagensIniciais);
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState(false);
  const [, startTransition] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);

  // Reseta a conversa exibida sempre que o usuário troca de item na lista.
  useEffect(() => {
    setMensagens(mensagensIniciais);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  useEffect(() => {
    if (!temNaoLida) return;
    startTransition(async () => {
      await marcarComoLidaAction(conversationId);
      router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, temNaoLida]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const corpo = texto.trim();
    if (!corpo) return;

    const otimista: Mensagem = { id: `local-${Date.now()}`, direction: "OUT", body: corpo, sentAt: new Date() };
    setMensagens((atual) => [...atual, otimista]);
    setTexto("");

    await enviarMensagemAction(conversationId, corpo);

    setRespondendo(true);
    setTimeout(() => {
      startTransition(async () => {
        await dispararRespostaAction(conversationId);
        router.refresh();
        setRespondendo(false);
      });
    }, 1800);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Link href="/chat" aria-label="Voltar para as conversas" className="grid size-8 shrink-0 place-items-center rounded-full text-ink-2 hover:text-ink lg:hidden">
          <ArrowLeft size={16} />
        </Link>
        <Avatar name={customerName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{customerName}</p>
          <PlatformBadge platform={platform} short />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {mensagens.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "OUT" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[75%]">
              <div
                className={`rounded-2xl px-4 py-2.5 text-[13px] ${
                  m.direction === "OUT" ? "rounded-br-sm bg-brand text-brand-ink" : "rounded-bl-sm bg-surface-2 text-ink"
                }`}
              >
                {m.body}
              </div>
              <p className={`mt-1 text-[11px] text-ink-muted ${m.direction === "OUT" ? "text-right" : ""}`}>{hora.format(m.sentAt)}</p>
            </div>
          </div>
        ))}
        {respondendo && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-2.5 text-[13px] text-ink-muted">digitando…</div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <form onSubmit={enviar} className="flex items-center gap-2 border-t border-line px-4 py-3">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma mensagem…"
          aria-label="Mensagem"
          className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          aria-label="Enviar mensagem"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
