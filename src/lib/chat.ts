import { prisma } from "./db";
import type { SessionUser } from "./auth";

/**
 * Regras do chat interno, num lugar só.
 *
 * O ponto sensível é o escopo: um lojista só pode ler e escrever na thread do
 * próprio cliente. Toda entrada aqui recebe o usuário da sessão e resolve a
 * thread a partir dele — o id que vem do formulário nunca é usado sozinho.
 */

export type ChatMessage = {
  id: string;
  authorType: "CLIENT" | "AGENCY" | "SYSTEM";
  authorName: string;
  body: string;
  createdAt: string;
};

/** Máximo de caracteres por mensagem — evita payload abusivo. */
export const MAX_BODY = 4000;

/**
 * Devolve a thread que este usuário pode acessar, ou null.
 *
 * Cliente: sempre a própria, ignorando o `threadId` recebido.
 * Agência: a pedida, desde que exista e a pessoa tenha permissão de suporte.
 */
export async function resolveThread(user: SessionUser, threadId?: string | null) {
  if (user.role === "CLIENT") {
    if (!user.clientId) return null;
    return prisma.thread.findFirst({
      where: { clientId: user.clientId },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!user.permissions.includes("suporte")) return null;
  if (!threadId) return null;
  return prisma.thread.findUnique({ where: { id: threadId } });
}

/** Mensagens da thread, opcionalmente só as criadas depois de `afterId`. */
export async function messagesOf(threadId: string, afterId?: string | null): Promise<ChatMessage[]> {
  // Com `afterId` buscamos só o que chegou depois — o polling trafega quase
  // nada quando não há novidade.
  let after: Date | null = null;
  if (afterId) {
    const ref = await prisma.message.findUnique({
      where: { id: afterId },
      select: { createdAt: true },
    });
    after = ref?.createdAt ?? null;
  }

  const rows = await prisma.message.findMany({
    where: { threadId, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return rows.map((m) => ({
    id: m.id,
    authorType: m.authorType as ChatMessage["authorType"],
    authorName: m.authorName,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));
}

/**
 * Zera o contador de não lidas ao abrir a conversa.
 *
 * Só a agência: `unread` conta mensagens do cliente esperando resposta, então
 * quem "lê" nesse sentido é quem atende.
 */
export async function markThreadRead(user: SessionUser, threadId: string) {
  if (user.role === "CLIENT") return;
  if (!user.permissions.includes("suporte")) return;
  await prisma.thread.updateMany({ where: { id: threadId, unread: { gt: 0 } }, data: { unread: 0 } });
}
