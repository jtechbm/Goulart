import { garantirCustomerDoCliente } from "./customers";
import { prisma } from "./db";

export const CATEGORIAS_RECEBER = ["VENDA_ATACADO", "REPASSE_MARKETPLACE", "OUTROS_RECEBIVEIS"] as const;
export const CATEGORIAS_PAGAR = [
  "ALUGUEL",
  "EMBALAGEM",
  "ADS",
  "SALARIO",
  "FORNECEDOR",
  "IMPOSTO",
  "OUTRAS_DESPESAS",
] as const;
export type CategoriaReceber = (typeof CATEGORIAS_RECEBER)[number];
export type CategoriaPagar = (typeof CATEGORIAS_PAGAR)[number];

export const CATEGORIA_LABEL: Record<string, string> = {
  VENDA_ATACADO: "Venda de atacado",
  REPASSE_MARKETPLACE: "Repasse de marketplace",
  OUTROS_RECEBIVEIS: "Outros recebíveis",
  ALUGUEL: "Aluguel",
  EMBALAGEM: "Embalagem",
  ADS: "Investimento em ADS",
  SALARIO: "Salário",
  FORNECEDOR: "Fornecedor",
  IMPOSTO: "Imposto",
  OUTRAS_DESPESAS: "Outras despesas",
};

export type StatusLancamento = "PAGO" | "ATRASADO" | "PENDENTE";

/**
 * Status é sempre derivado, nunca gravado — um status salvo no banco
 * envelhece sozinho e passaria a mentir assim que a data vencesse.
 */
export function statusDe(entry: { paidAt: Date | null; dueDate: Date }): StatusLancamento {
  if (entry.paidAt) return "PAGO";
  if (entry.dueDate.getTime() < Date.now()) return "ATRASADO";
  return "PENDENTE";
}

export const STATUS_COR: Record<StatusLancamento, string> = {
  PAGO: "var(--good)",
  PENDENTE: "var(--warning)",
  ATRASADO: "var(--critical)",
};

export const STATUS_LABEL: Record<StatusLancamento, string> = {
  PAGO: "Pago",
  PENDENTE: "Pendente",
  ATRASADO: "Atrasado",
};

export async function lancamentos(clientId: string, filtro?: { kind?: "RECEBER" | "PAGAR" }) {
  const rows = await prisma.financeEntry.findMany({
    where: { clientId, ...(filtro?.kind ? { kind: filtro.kind } : {}) },
    include: { customer: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((r) => ({ ...r, status: statusDe(r) }));
}

/** Resumo pro topo de /financeiro: saldo do mês, a receber, a pagar, vencido. */
export async function resumoFinanceiro(clientId: string) {
  const rows = await prisma.financeEntry.findMany({ where: { clientId } });

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  let aReceber = 0,
    aPagar = 0,
    vencidoReceber = 0,
    vencidoPagar = 0,
    entradasMes = 0,
    saidasMes = 0;

  for (const r of rows) {
    const status = statusDe(r);
    if (r.kind === "RECEBER" && status !== "PAGO") aReceber += r.amount;
    if (r.kind === "PAGAR" && status !== "PAGO") aPagar += r.amount;
    /**
     * Vencido sai separado por sentido. Somado num número só, "Vencido: R$ 5.000"
     * em vermelho ao lado de "A pagar" lê como dívida — mas parte pode ser
     * dinheiro que devem ao lojista, que é o oposto. O total continua existindo
     * para quem só quer a soma.
     */
    if (status === "ATRASADO") {
      if (r.kind === "RECEBER") vencidoReceber += r.amount;
      else vencidoPagar += r.amount;
    }
    if (status === "PAGO" && r.paidAt && r.paidAt >= inicioMes) {
      if (r.kind === "RECEBER") entradasMes += r.amount;
      else saidasMes += r.amount;
    }
  }

  return {
    aReceber,
    aPagar,
    vencido: vencidoReceber + vencidoPagar,
    vencidoReceber,
    vencidoPagar,
    saldoMes: entradasMes - saidasMes,
    entradasMes,
    saidasMes,
  };
}

/** Entradas × saídas × saldo acumulado, por dia, alimenta o gráfico de caixa. */
export async function fluxoDeCaixa(clientId: string, dias: number) {
  const de = new Date(Date.now() - dias * 86400000);
  de.setHours(0, 0, 0, 0);

  const rows = await prisma.financeEntry.findMany({
    where: { clientId, paidAt: { gte: de } },
    select: { kind: true, amount: true, paidAt: true },
  });

  /**
   * A chave do dia é o dia LOCAL, não o UTC.
   *
   * `de` nasce da meia-noite local, mas `toISOString()` converte para UTC: no
   * Brasil (UTC−3) um pagamento das 22h caía no balde do dia seguinte, e o
   * gráfico empurrava toda venda de fim de tarde para a data errada.
   */
  const diaLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const byDay = new Map<string, { entrada: number; saida: number }>();
  for (let i = 0; i <= dias; i++) {
    byDay.set(diaLocal(new Date(de.getTime() + i * 86400000)), { entrada: 0, saida: 0 });
  }
  for (const r of rows) {
    if (!r.paidAt) continue;
    const chave = diaLocal(r.paidAt);
    const bucket = byDay.get(chave);
    if (!bucket) continue;
    if (r.kind === "RECEBER") bucket.entrada += r.amount;
    else bucket.saida += r.amount;
  }

  let saldo = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([dia, v]) => {
      saldo += v.entrada - v.saida;
      return { dia, entrada: v.entrada, saida: v.saida, saldo };
    });
}

export async function despesasPorCategoria(clientId: string, de: Date, ate: Date) {
  const rows = await prisma.financeEntry.groupBy({
    by: ["category"],
    where: { clientId, kind: "PAGAR", dueDate: { gte: de, lte: ate } },
    _sum: { amount: true },
  });
  return rows
    .map((r) => ({ categoria: r.category, label: CATEGORIA_LABEL[r.category] ?? r.category, valor: r._sum.amount ?? 0 }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

/** Repasses = lançamentos a receber com `platform` preenchido. */
export async function repasses(clientId: string) {
  const rows = await prisma.financeEntry.findMany({
    where: { clientId, kind: "RECEBER", category: "REPASSE_MARKETPLACE" },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((r) => ({ ...r, status: statusDe(r) }));
}

export async function criarLancamento(input: {
  clientId: string;
  kind: "RECEBER" | "PAGAR";
  category: string;
  description: string;
  amount: number;
  dueDate: Date;
  customerId?: string | null;
  platform?: string | null;
  recurring?: boolean;
  notes?: string | null;
}) {
  const description = input.description.trim();
  if (!description) throw new Error("Descrição é obrigatória.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Valor inválido.");
  // Data invalida chegava crua ao Prisma e virava erro tecnico na cara do lojista.
  if (!(input.dueDate instanceof Date) || Number.isNaN(input.dueDate.getTime())) {
    throw new Error("Data de vencimento inválida.");
  }

  const customerId = await garantirCustomerDoCliente(input.customerId, input.clientId);

  return prisma.financeEntry.create({
    data: {
      clientId: input.clientId,
      kind: input.kind,
      category: input.category,
      description,
      amount: input.amount,
      dueDate: input.dueDate,
      customerId,
      platform: input.platform ?? null,
      recurring: input.recurring ?? false,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function baixarLancamento(id: string, clientId: string): Promise<boolean> {
  const { count } = await prisma.financeEntry.updateMany({
    where: { id, clientId, paidAt: null },
    data: { paidAt: new Date() },
  });
  return count === 1;
}

export async function estornarLancamento(id: string, clientId: string): Promise<boolean> {
  const { count } = await prisma.financeEntry.updateMany({
    where: { id, clientId },
    data: { paidAt: null },
  });
  return count === 1;
}
