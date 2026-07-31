import { Chat } from "@/components/Chat";
import { Topbar } from "@/components/Topbar";
import { Card, PageHeader } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { messagesOf } from "@/lib/chat";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PortalSuportePage() {
  const user = await requireClient();

  const thread = await prisma.thread.findFirst({
    where: { clientId: user.clientId },
    orderBy: { updatedAt: "desc" },
  });

  const messages = thread ? await messagesOf(thread.id) : [];

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

          <Chat
            threadId={thread?.id ?? null}
            initialMessages={messages}
            meAuthorType="CLIENT"
            emptyHint="Nenhuma mensagem ainda. Escreva abaixo para iniciar a conversa."
          />
        </Card>
      </main>
    </>
  );
}
