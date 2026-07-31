"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser, destroySession } from "./auth";
import { MAX_BODY, resolveThread, type ChatMessage } from "./chat";
import { prisma } from "./db";

export async function logout() {
  await destroySession();
  redirect("/login");
}

export type SendResult =
  | { ok: true; message: ChatMessage; threadId: string }
  | { ok: false; error: string };

/**
 * Envia mensagem na conversa. O autor sai da sessão — o formulário não decide
 * quem está falando — e um cliente só consegue escrever na própria thread.
 *
 * Devolve a mensagem gravada em vez de revalidar a página: o chat troca só a
 * lista de mensagens, sem re-renderizar a tela inteira a cada envio.
 */
export async function sendMessage(input: { threadId?: string | null; body: string }): Promise<SendResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };
  // do lado da agência, só quem tem a função de suporte responde
  if (user.role === "ADMIN" && !user.permissions.includes("suporte")) {
    return { ok: false, error: "Sua função não permite responder no suporte." };
  }

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Mensagem vazia." };
  if (body.length > MAX_BODY) return { ok: false, error: "Mensagem longa demais." };

  let thread = await resolveThread(user, input.threadId);

  // o lojista pode não ter conversa ainda — a primeira mensagem cria
  if (!thread && user.role === "CLIENT" && user.clientId) {
    thread = await prisma.thread.create({
      data: { clientId: user.clientId, subject: body.slice(0, 60) },
    });
  }

  if (!thread) return { ok: false, error: "Conversa não encontrada." };

  const created = await prisma.message.create({
    data: {
      threadId: thread.id,
      authorType: user.role === "CLIENT" ? "CLIENT" : "AGENCY",
      authorName: user.name,
      body,
    },
  });

  // mensagem do cliente vira pendência para a agência, e vice-versa
  await prisma.thread.update({
    where: { id: thread.id },
    data: { unread: user.role === "CLIENT" ? { increment: 1 } : 0, updatedAt: new Date() },
  });

  // a lista lateral e o sino mostram a última mensagem: precisam saber.
  // O painel de mensagens em si atualiza sozinho, sem depender disto.
  revalidatePath(user.role === "CLIENT" ? "/portal/suporte" : "/suporte");

  return {
    ok: true,
    threadId: thread.id,
    message: {
      id: created.id,
      authorType: created.authorType as ChatMessage["authorType"],
      authorName: created.authorName,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
    },
  };
}
