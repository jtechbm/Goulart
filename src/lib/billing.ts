import type { Invoice, Subscription } from "@prisma/client";
import { prisma } from "./db";

/**
 * Mensalidades no modelo manual: a assinatura define valor e dia, o sistema
 * materializa uma fatura por competência (AAAA-MM) e o Kadu dá a baixa.
 *
 * A unique (clientId, reference) no schema é o que torna a geração idempotente
 * — rodar duas vezes no mesmo mês não duplica.
 */

export const reference = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Vencimento no mês/ano dados, respeitando meses curtos (dia 31 → 30/28). */
export function dueDateFor(year: number, monthIndex: number, dueDay: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dueDay, lastDay));
}

/** Próximos N vencimentos ainda não faturados — a projeção que o Kadu vê. */
export function upcomingDueDates(sub: Subscription, count = 3, after = new Date()): Date[] {
  const out: Date[] = [];
  const cursor = new Date(after.getFullYear(), after.getMonth(), 1);

  while (out.length < count) {
    const due = dueDateFor(cursor.getFullYear(), cursor.getMonth(), sub.dueDay);
    if (due > after) out.push(due);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/**
 * Gera as faturas em aberto das assinaturas ativas até o mês corrente e marca
 * como ATRASADO o que passou do vencimento. Idempotente.
 */
export async function runBilling(): Promise<{ created: number; overdue: number }> {
  const subs = await prisma.subscription.findMany({ where: { status: "ATIVA" } });
  const now = new Date();
  let created = 0;

  for (const sub of subs) {
    const ref = reference(now);
    const existing = await prisma.invoice.findUnique({
      where: { clientId_reference: { clientId: sub.clientId, reference: ref } },
    });
    if (existing) continue;

    const dueDate = dueDateFor(now.getFullYear(), now.getMonth(), sub.dueDay);
    await prisma.invoice.create({
      data: {
        clientId: sub.clientId,
        subscriptionId: sub.id,
        amount: sub.amount,
        dueDay: sub.dueDay,
        dueDate,
        method: sub.method,
        status: "PENDENTE",
        reference: ref,
      },
    });
    created++;
  }

  const { count: overdue } = await prisma.invoice.updateMany({
    where: { status: "PENDENTE", dueDate: { lt: startOfToday() } },
    data: { status: "ATRASADO" },
  });

  return { created, overdue };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type BillingRow = {
  clientId: string;
  clientName: string;
  subscription: Subscription | null;
  current: Invoice | null;
  history: Invoice[];
  upcoming: Date[];
  paidTotal: number;
  openTotal: number;
  monthsAsClient: number;
};

/** Uma linha por cliente com contrato, fatura do mês, histórico e projeção. */
export async function billingRows(): Promise<BillingRow[]> {
  const clients = await prisma.client.findMany({
    include: {
      subscription: true,
      invoices: { orderBy: { dueDate: "desc" } },
    },
    orderBy: { name: "asc" },
  });

  const ref = reference(new Date());

  return clients.map((c) => {
    const invoices = c.invoices;
    const current = invoices.find((i) => i.reference === ref) ?? null;
    const paidTotal = invoices.filter((i) => i.status === "PAGO").reduce((s, i) => s + i.amount, 0);
    const openTotal = invoices
      .filter((i) => i.status === "PENDENTE" || i.status === "ATRASADO")
      .reduce((s, i) => s + i.amount, 0);

    const start = c.subscription?.startedAt ?? c.createdAt;
    const monthsAsClient = Math.max(
      1,
      (new Date().getFullYear() - start.getFullYear()) * 12 + (new Date().getMonth() - start.getMonth()) + 1,
    );

    return {
      clientId: c.id,
      clientName: c.name,
      subscription: c.subscription,
      current,
      history: invoices.filter((i) => i.reference !== ref),
      upcoming: c.subscription && c.subscription.status === "ATIVA" ? upcomingDueDates(c.subscription, 3) : [],
      paidTotal,
      openTotal,
      monthsAsClient,
    };
  });
}

/** Visão do próprio cliente no portal. */
export async function clientBilling(clientId: string) {
  const [client, invoices] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, include: { subscription: true } }),
    prisma.invoice.findMany({ where: { clientId }, orderBy: { dueDate: "desc" } }),
  ]);

  const ref = reference(new Date());
  const current = invoices.find((i) => i.reference === ref) ?? null;
  const open = invoices.filter((i) => i.status === "PENDENTE" || i.status === "ATRASADO");

  return {
    subscription: client?.subscription ?? null,
    current,
    open,
    history: invoices.filter((i) => i.status === "PAGO"),
    all: invoices,
    upcoming:
      client?.subscription && client.subscription.status === "ATIVA"
        ? upcomingDueDates(client.subscription, 3)
        : [],
    paidTotal: invoices.filter((i) => i.status === "PAGO").reduce((s, i) => s + i.amount, 0),
    openTotal: open.reduce((s, i) => s + i.amount, 0),
  };
}
