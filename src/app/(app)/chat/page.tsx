import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { ChatThread } from "@/components/ChatThread";
import { Topbar } from "@/components/Topbar";
import { Avatar, Card, Empty, PlatformBadge } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { conversaComMensagens, conversas } from "@/lib/chat";
import { relative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ conversa?: string }>;
}) {
  const user = await requireClient();
  const sp = await searchParams;

  const lista = await conversas(user.clientId);
  const conversaId = sp.conversa && lista.some((c) => c.id === sp.conversa) ? sp.conversa : lista[0]?.id;
  const selecionada = conversaId ? await conversaComMensagens(user.clientId, conversaId) : null;

  return (
    <>
      <Topbar crumb="Chat" />
      <main className="flex min-h-0 flex-1 flex-col px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Chat</h1>
          <p className="mt-1 text-sm text-ink-2">Mensagens de todas as plataformas em um só lugar.</p>
        </div>

        {lista.length === 0 ? (
          <Card>
            <Empty title="Nenhuma conversa ainda" hint="As mensagens dos marketplaces e do atacado aparecem aqui." />
          </Card>
        ) : (
          <Card className="flex min-h-[560px] flex-1 overflow-hidden">
            <div className={`w-full shrink-0 border-line lg:block lg:w-[320px] lg:border-r ${sp.conversa ? "hidden" : "block"}`}>
              <ul className="h-full divide-y divide-[var(--border)] overflow-y-auto">
                {lista.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/chat?conversa=${c.id}`}
                      className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 ${
                        c.id === conversaId ? "bg-surface-2" : ""
                      }`}
                    >
                      <Avatar name={c.customerName} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-ink">{c.customerName}</p>
                          <span className="shrink-0 text-[11px] text-ink-muted">{relative(c.lastMessageAt)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <PlatformBadge platform={c.platform} short />
                          <p className="truncate text-[12px] text-ink-muted">{c.ultimaMensagem}</p>
                        </div>
                      </div>
                      {c.naoLidas > 0 && (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-semibold tabular text-brand-ink">
                          {c.naoLidas}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className={`min-w-0 flex-1 ${sp.conversa ? "block" : "hidden lg:block"}`}>
              {selecionada ? (
                <ChatThread
                  key={selecionada.conversa.id}
                  conversationId={selecionada.conversa.id}
                  customerName={selecionada.conversa.customerName}
                  platform={selecionada.conversa.platform}
                  mensagensIniciais={selecionada.mensagens}
                  temNaoLida={selecionada.mensagens.some((m) => m.direction === "IN" && !m.readAt)}
                />
              ) : (
                <div className="grid h-full place-items-center">
                  <div className="text-center">
                    <MessageCircle size={28} className="mx-auto mb-2 text-ink-muted" />
                    <p className="text-sm text-ink-muted">Escolha uma conversa.</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
