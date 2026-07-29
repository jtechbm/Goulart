import { Send } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Card, PageHeader } from "@/components/ui";
import { sendMessage } from "@/lib/actions";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PortalSuportePage() {
  const user = await requireClient();

  const thread = await prisma.thread.findFirst({
    where: { clientId: user.clientId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  const messages = thread?.messages ?? [];

  return (
    <>
      <Topbar crumb="Suporte" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Suporte" subtitle="Fale direto com seu gestor." />

        <Card className="flex min-h-[560px] max-w-3xl flex-col">
          <div className="border-b border-line px-5 py-4">
            <p className="text-[15px] font-semibold text-ink">Atendimento GoulartERP</p>
            <p className="text-[13px] text-ink-muted">Respondemos em horário comercial.</p>
          </div>

          <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
            {messages.length === 0 && (
              <li className="py-10 text-center text-[13px] text-ink-muted">
                Nenhuma mensagem ainda. Escreva abaixo para iniciar a conversa.
              </li>
            )}

            {messages.map((m) => {
              if (m.authorType === "SYSTEM") {
                return (
                  <li key={m.id} className="text-center text-[12px] italic text-ink-muted">
                    {m.body}
                  </li>
                );
              }
              // no portal, quem fala à direita é o próprio cliente
              const mine = m.authorType === "CLIENT";
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      mine ? "bg-brand text-brand-ink" : "border border-line bg-surface-2 text-ink"
                    }`}
                  >
                    {!mine && (
                      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                        {m.authorName}
                      </p>
                    )}
                    <p className="text-sm">{m.body}</p>
                    <p className={`mt-1 text-[11px] ${mine ? "opacity-70" : "text-ink-muted"}`}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(m.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <form action={sendMessage} className="flex items-center gap-3 border-t border-line px-5 py-4">
            <input type="hidden" name="threadId" value={thread?.id ?? ""} />
            <input
              name="body"
              required
              placeholder="Escrever mensagem..."
              aria-label="Escrever mensagem"
              className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
            >
              <Send size={15} /> Enviar
            </button>
          </form>
        </Card>
      </main>
    </>
  );
}
