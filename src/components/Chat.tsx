"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useOptimistic, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendMessage } from "@/lib/actions";
import type { ChatMessage } from "@/lib/chat";

/**
 * Painel de mensagens do chat interno.
 *
 * Atualiza por polling: sem WebSocket porque a aplicação roda em funções
 * serverless, que não mantêm conexão aberta. Para o volume aqui (uma agência
 * e seus lojistas) isso é suficiente, passa pelos mesmos guards de permissão
 * do resto do sistema e não exige infraestrutura nova.
 *
 * Três cuidados para não desperdiçar chamada:
 * - só busca o que chegou depois da última mensagem conhecida;
 * - pausa enquanto a aba está em segundo plano;
 * - volta a buscar na hora em que a aba reaparece.
 */

const POLL_MS = 5000;

/** Separado porque `useFormStatus` só enxerga o form quando está dentro dele. */
function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-60"
    >
      <Send size={15} /> Enviar
    </button>
  );
}

type Props = {
  threadId: string | null;
  initialMessages: ChatMessage[];
  /** Lado que aparece à direita (as mensagens de quem está olhando). */
  meAuthorType: "CLIENT" | "AGENCY";
  emptyHint: string;
  showAuthorOnMine?: boolean;
};

export function Chat({ threadId, initialMessages, meAuthorType, emptyHint, showAuthorOnMine }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * A mensagem aparece na hora; se o envio falhar, ela some e o erro aparece.
   *
   * O redutor descarta a otimista quando a real já está na lista: como a ação
   * grava a mensagem confirmada no estado antes de encerrar, havia um instante
   * em que as duas coexistiam e o usuário via a própria mensagem duplicada,
   * uma delas presa em "enviando…".
   */
  const [optimistic, addOptimistic] = useOptimistic(messages, (state, m: ChatMessage) => {
    const jaChegou = state.some(
      (x) => !x.id.startsWith("tmp-") && x.authorType === m.authorType && x.body === m.body,
    );
    return jaChegou ? state : [...state, m];
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  // Trocar de conversa zera a lista. O `key={thread.id}` na página já remonta
  // o componente, mas isto garante o comportamento se ele for reaproveitado.
  const threadRef = useRef(threadId);
  useEffect(() => {
    if (threadRef.current === threadId) return;
    threadRef.current = threadId;
    setMessages(initialMessages);
  }, [threadId, initialMessages]);

  /**
   * O envio dispara `revalidatePath` (para a lista lateral e o sino), e o
   * servidor manda `initialMessages` de novo. Mesclamos em vez de substituir:
   * trocar direto faria a mensagem recém-enviada sumir por um instante caso a
   * resposta do servidor chegasse antes de ela estar gravada na leitura.
   */
  useEffect(() => {
    if (threadRef.current !== threadId) return;
    setMessages((atuais) => {
      const vistos = new Set(atuais.map((m) => m.id));
      const novas = initialMessages.filter((m) => !vistos.has(m.id));
      return novas.length ? [...atuais, ...novas].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : atuais;
    });
  }, [initialMessages, threadId]);

  const buscarNovas = useCallback(async () => {
    if (!threadId) return;
    const ultima = messages[messages.length - 1]?.id;
    try {
      const url = `/api/chat?thread=${encodeURIComponent(threadId)}${ultima ? `&after=${encodeURIComponent(ultima)}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: ChatMessage[] };
      if (data.messages?.length) {
        setMessages((atuais) => {
          const vistos = new Set(atuais.map((m) => m.id));
          const novas = data.messages!.filter((m) => !vistos.has(m.id));
          return novas.length ? [...atuais, ...novas] : atuais;
        });
      }
    } catch {
      // rede oscilou; o próximo ciclo tenta de novo
    }
  }, [threadId, messages]);

  useEffect(() => {
    if (!threadId) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const iniciar = () => {
      if (timer) return;
      timer = setInterval(buscarNovas, POLL_MS);
    };
    const parar = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const aoTrocarVisibilidade = () => {
      if (document.visibilityState === "visible") {
        void buscarNovas(); // não espera o próximo ciclo
        iniciar();
      } else {
        parar();
      }
    };

    if (document.visibilityState === "visible") iniciar();
    document.addEventListener("visibilitychange", aoTrocarVisibilidade);

    return () => {
      parar();
      document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
    };
  }, [threadId, buscarNovas]);

  // desce para a última mensagem; sem isso a conversa abre no topo
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    // salta na primeira pintura, desliza nas seguintes
    fimRef.current?.scrollIntoView({ block: "end", behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [optimistic.length, messages.length]);

  /**
   * Precisa ser a própria função async passada em `action`: o React mantém o
   * escopo da ação aberto até ela resolver, e é isso que faz o `useOptimistic`
   * valer. Embrulhar num `startTransition` sem await descarta o otimista e o
   * formulário cai no envio nativo, recarregando a página.
   */
  async function enviar(formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    setErro(null);
    inputRef.current?.form?.reset(); // limpa o campo antes da ida ao servidor
    inputRef.current?.focus();

    addOptimistic({
      id: `tmp-${Date.now()}`,
      authorType: meAuthorType,
      authorName: "",
      body,
      createdAt: new Date().toISOString(),
    });

    const res = await sendMessage({ threadId, body });
    if (res.ok) {
      setMessages((atuais) => (atuais.some((m) => m.id === res.message.id) ? atuais : [...atuais, res.message]));
    } else {
      setErro(res.error);
      if (inputRef.current) inputRef.current.value = body; // devolve o texto
    }
  }

  return (
    <>
      <ul ref={listaRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {optimistic.length === 0 && (
          <li className="py-10 text-center text-[13px] text-ink-muted">{emptyHint}</li>
        )}

        {optimistic.map((m) => {
          if (m.authorType === "SYSTEM") {
            return (
              <li key={m.id} className="text-center text-[12px] italic text-ink-muted">
                {m.body}
              </li>
            );
          }
          const mine = m.authorType === meAuthorType;
          const enviando = m.id.startsWith("tmp-");
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 transition-opacity ${
                  mine ? "bg-brand text-brand-ink" : "border border-line bg-surface-2 text-ink"
                } ${enviando ? "opacity-60" : ""}`}
              >
                {m.authorName && (mine ? showAuthorOnMine : true) && (
                  <p
                    className={`mb-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      mine ? "opacity-80" : "text-ink-muted"
                    }`}
                  >
                    {m.authorName}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? "opacity-70" : "text-ink-muted"}`}>
                  {enviando
                    ? "enviando…"
                    : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
                        new Date(m.createdAt),
                      )}
                </p>
              </div>
            </li>
          );
        })}
        <div ref={fimRef} />
      </ul>

      {erro && (
        <p role="alert" className="px-5 pb-2 text-[13px]" style={{ color: "var(--critical)" }}>
          {erro}
        </p>
      )}

      <form action={enviar} className="flex items-center gap-3 border-t border-line px-5 py-4">
        <input
          ref={inputRef}
          name="body"
          required
          maxLength={4000}
          autoComplete="off"
          placeholder="Escrever mensagem..."
          aria-label="Escrever mensagem"
          className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
        />
        <BotaoEnviar />
      </form>
    </>
  );
}
