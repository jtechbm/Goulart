import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { messagesOf, resolveThread } from "@/lib/chat";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat?thread=<id>&after=<idDaUltimaMensagem>
 *
 * Endpoint do polling. Passa pelos mesmos guards do resto do sistema:
 * `resolveThread` ignora o id recebido quando quem pergunta é um lojista e
 * devolve sempre a thread dele — trocar o id na URL não alcança outro cliente.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const thread = await resolveThread(user, url.searchParams.get("thread"));
  if (!thread) return NextResponse.json({ messages: [] });

  const messages = await messagesOf(thread.id, url.searchParams.get("after"));

  return NextResponse.json(
    { threadId: thread.id, messages },
    { headers: { "Cache-Control": "no-store" } },
  );
}
