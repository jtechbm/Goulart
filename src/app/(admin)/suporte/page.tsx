import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { Chat } from "@/components/Chat";
import { Topbar } from "@/components/Topbar";
import { Card, Empty, PageHeader } from "@/components/ui";
import { markThreadRead, messagesOf } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { relative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SuportePage({
  searchParams,
}: {
  searchParams: Promise<{ conversa?: string }>;
}) {
  const user = await requirePermission("suporte");
  const { conversa } = await searchParams;

  const threads = await prisma.thread.findMany({
    include: {
      client: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activeId = conversa ?? threads[0]?.id;
  const active = activeId
    ? await prisma.thread.findUnique({ where: { id: activeId }, include: { client: true } })
    : null;

  // abrir a conversa já conta como lida — antes o contador só zerava ao responder
  const mensagens = active ? await messagesOf(active.id) : [];
  if (active) await markThreadRead(user, active.id);

  return (
    <>
      <Topbar crumb="Suporte" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Suporte" subtitle="Chat interno com clientes — sem WhatsApp pessoal." />

        {threads.length === 0 ? (
          <Card>
            <Empty title="Nenhuma conversa" hint="As conversas abertas pelos clientes aparecem aqui." />
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <Card className="overflow-hidden">
              <ul className="divide-y divide-[var(--border)]">
                {threads.map((t) => {
                  const isActive = t.id === activeId;
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/suporte?conversa=${t.id}`}
                        aria-current={isActive ? "true" : undefined}
                        className={`block px-4 py-3.5 transition-colors ${
                          isActive ? "bg-brand-soft" : "hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-sm font-semibold ${isActive ? "text-brand" : "text-ink"}`}>
                            {t.client.name}
                          </p>
                          <span className="shrink-0 text-[11px] text-ink-muted">{relative(t.updatedAt)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="line-clamp-1 flex-1 text-[13px] text-ink-muted">
                            {t.messages[0]?.body ?? t.subject ?? "—"}
                          </p>
                          {t.unread > 0 && (
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[10px] font-bold text-brand-ink tabular">
                              {t.unread}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card className="flex min-h-[560px] flex-col">
              {active ? (
                <>
                  <div className="border-b border-line px-5 py-4">
                    <p className="text-[15px] font-semibold text-ink">{active.client.name}</p>
                    <p className="text-[13px] text-ink-muted">{active.client.email}</p>
                  </div>

                  <Chat
                    key={active.id}
                    threadId={active.id}
                    initialMessages={mensagens}
                    meAuthorType="AGENCY"
                    emptyHint="Nenhuma mensagem nesta conversa ainda."
                    showAuthorOnMine
                  />
                </>
              ) : (
                <Empty title="Selecione uma conversa" />
              )}
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
