import { prisma } from "./db";
import type { SessionUser } from "./auth";
import { LOW_STOCK } from "./inventory";
import { brl, date } from "./format";

export type Notification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "CRITICO" | "ATENCAO" | "INFO";
};

const RANK = { CRITICO: 0, ATENCAO: 1, INFO: 2 } as const;

/**
 * Alimenta o sino. Cada item segue a permissão de quem está olhando — quem não
 * tem acesso a contas não é notificado sobre elas, senão o aviso levaria a uma
 * tela que a pessoa não pode abrir.
 */
export async function notificationsFor(user: SessionUser): Promise<Notification[]> {
  const items: Notification[] = [];

  if (user.role === "CLIENT") {
    if (!user.clientId) return [];

    const [faturas, semEstoque, baixo] = await Promise.all([
      prisma.invoice.findMany({
        where: { clientId: user.clientId, status: { in: ["PENDENTE", "ATRASADO"] } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.product.count({ where: { account: { clientId: user.clientId }, stock: 0 } }),
      prisma.product.count({
        where: { account: { clientId: user.clientId }, stock: { gt: 0, lte: LOW_STOCK } },
      }),
    ]);

    for (const f of faturas) {
      const atrasada = f.status === "ATRASADO";
      items.push({
        id: `inv-${f.id}`,
        title: atrasada ? "Fatura em atraso" : "Fatura em aberto",
        detail: `${brl(f.amount)} · vencimento ${date(f.dueDate)}`,
        href: "/portal/faturas",
        severity: atrasada ? "CRITICO" : "ATENCAO",
      });
    }

    if (semEstoque > 0) {
      items.push({
        id: "estoque-zerado",
        title: `${semEstoque} produto(s) esgotado(s)`,
        detail: "Sem estoque para vender.",
        href: "/portal/estoque?filtro=zerado",
        severity: "CRITICO",
      });
    }
    if (baixo > 0) {
      items.push({
        id: "estoque-baixo",
        title: `${baixo} produto(s) com estoque baixo`,
        detail: `Restam ${LOW_STOCK} unidades ou menos.`,
        href: "/portal/estoque?filtro=baixo",
        severity: "ATENCAO",
      });
    }

    return items.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  }

  // As três listas são independentes: buscar em paralelo troca três idas ao
  // banco em fila por uma só. Quem não tem a permissão nem consulta.
  const [contas, atrasadas, threads] = await Promise.all([
    user.permissions.includes("contas")
      ? prisma.account.findMany({
          where: { OR: [{ hasPenalty: true }, { status: { in: ["EXPIRED", "ERROR"] } }] },
          include: { client: { select: { name: true } } },
          take: 20,
        })
      : Promise.resolve([]),
    user.permissions.includes("mensalidades")
      ? prisma.invoice.findMany({
          where: { status: "ATRASADO" },
          include: { client: { select: { id: true, name: true } } },
          orderBy: { dueDate: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    user.permissions.includes("suporte")
      ? prisma.thread.findMany({
          where: { unread: { gt: 0 } },
          include: { client: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  for (const a of contas) {
    const quebrada = a.status === "EXPIRED" || a.status === "ERROR";
    items.push({
      id: `conta-${a.id}`,
      title: a.hasPenalty ? `${a.shopName} com penalidade` : `${a.shopName} precisa reconectar`,
      detail: a.hasPenalty ? (a.penaltyNote ?? a.client.name) : (a.statusNote ?? a.client.name),
      href: quebrada ? "/configuracoes" : `/contas?conta=${a.id}`,
      severity: "CRITICO",
    });
  }

  for (const f of atrasadas) {
    items.push({
      id: `fat-${f.id}`,
      title: `${f.client.name} — mensalidade atrasada`,
      detail: `${brl(f.amount)} · venceu ${date(f.dueDate)}`,
      href: `/mensalidades/${f.client.id}`,
      severity: "CRITICO",
    });
  }

  for (const t of threads) {
    items.push({
      id: `thread-${t.id}`,
      title: `${t.client.name} aguardando resposta`,
      detail: `${t.unread} mensagem(ns) não lida(s)`,
      href: `/suporte?conversa=${t.id}`,
      severity: "ATENCAO",
    });
  }

  return items.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
