import { prisma } from "./db";

/** Respostas fictícias — dão a sensação de conversa real na demonstração. */
const RESPOSTAS_AUTOMATICAS = [
  "Oi! Recebi sua mensagem, já te retorno por aqui.",
  "Show, vou verificar e já te aviso.",
  "Perfeito, obrigado pelo contato! Só um instante.",
  "Entendido, vou conferir o pedido e volto já.",
  "Valeu! Assim que tiver novidade eu te chamo.",
  "Certo, deixa eu confirmar isso pra você.",
];

export async function conversas(clientId: string) {
  const rows = await prisma.conversation.findMany({
    where: { clientId },
    include: {
      _count: { select: { messages: { where: { direction: "IN", readAt: null } } } },
      messages: { orderBy: { sentAt: "desc" }, take: 1, select: { body: true, direction: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  return rows.map((c) => ({
    id: c.id,
    platform: c.platform,
    customerName: c.customerName,
    customerHandle: c.customerHandle,
    status: c.status,
    lastMessageAt: c.lastMessageAt,
    naoLidas: c._count.messages,
    ultimaMensagem: c.messages[0]?.body ?? null,
  }));
}

export async function totalNaoLidas(clientId: string) {
  return prisma.message.count({ where: { conversation: { clientId }, direction: "IN", readAt: null } });
}

export async function conversaComMensagens(clientId: string, conversationId: string) {
  const conversa = await prisma.conversation.findFirst({ where: { id: conversationId, clientId } });
  if (!conversa) return null;
  const mensagens = await prisma.message.findMany({ where: { conversationId }, orderBy: { sentAt: "asc" } });
  return { conversa, mensagens };
}

export async function marcarComoLida(clientId: string, conversationId: string) {
  const conversa = await prisma.conversation.findFirst({ where: { id: conversationId, clientId } });
  if (!conversa) return;
  await prisma.message.updateMany({
    where: { conversationId, direction: "IN", readAt: null },
    data: { readAt: new Date() },
  });
}

export async function enviarMensagem(clientId: string, conversationId: string, body: string) {
  const conversa = await prisma.conversation.findFirst({ where: { id: conversationId, clientId } });
  if (!conversa) throw new Error("Conversa não encontrada.");
  const texto = body.trim();
  if (!texto) throw new Error("Mensagem vazia.");

  const agora = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId, direction: "OUT", body: texto, sentAt: agora, readAt: agora } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: agora } }),
  ]);
}

/** Chamada ~1.8s depois do envio, pelo cliente — simula o "cliente" respondendo. */
export async function responderAutomaticamente(clientId: string, conversationId: string) {
  const conversa = await prisma.conversation.findFirst({ where: { id: conversationId, clientId } });
  if (!conversa) return;

  const resposta = RESPOSTAS_AUTOMATICAS[Math.floor(Math.random() * RESPOSTAS_AUTOMATICAS.length)];
  const agora = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId, direction: "IN", body: resposta, sentAt: agora } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: agora } }),
  ]);
}
