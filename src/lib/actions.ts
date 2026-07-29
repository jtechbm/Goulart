"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser, destroySession } from "./auth";
import { prisma } from "./db";

export async function logout() {
  await destroySession();
  redirect("/login");
}

/**
 * Envia mensagem na conversa. O autor sai da sessão — o formulário não decide
 * quem está falando — e um cliente só consegue escrever na própria thread.
 */
export async function sendMessage(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  // do lado da agência, só quem tem a função de suporte responde
  if (user.role === "ADMIN" && !user.permissions.includes("suporte")) return;

  const body = String(formData.get("body") ?? "").trim();
  const threadId = String(formData.get("threadId") ?? "");
  if (!body) return;

  let thread = threadId ? await prisma.thread.findUnique({ where: { id: threadId } }) : null;

  if (user.role === "CLIENT") {
    // ignora o threadId recebido e usa (ou cria) a thread do próprio cliente
    thread =
      (await prisma.thread.findFirst({ where: { clientId: user.clientId! }, orderBy: { updatedAt: "desc" } })) ??
      (await prisma.thread.create({ data: { clientId: user.clientId!, subject: body.slice(0, 60) } }));
  }

  if (!thread) return;

  await prisma.message.create({
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

  revalidatePath(user.role === "CLIENT" ? "/portal/suporte" : "/suporte");
}
