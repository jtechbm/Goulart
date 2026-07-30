import { cache } from "react";
import { prisma } from "./db";
import { variation } from "./format";

export const WINDOW_DAYS = 30;

/** Alíquota efetiva usada nos consolidados. Ajuste conforme o regime tributário. */
export const TAX_RATE = 0.113;

/** Receita, custos e margem a partir dos rollups — mesma conta nas duas áreas. */
export function financials(rollups: AccountRollup[]) {
  const revenue = rollups.reduce((s, r) => s + r.revenue, 0);
  const prevRevenue = rollups.reduce((s, r) => s + r.prevRevenue, 0);
  const ads = rollups.reduce((s, r) => s + r.adsSpend, 0);
  const fees = rollups.reduce((s, r) => s + r.fees, 0);
  const orders = rollups.reduce((s, r) => s + r.orders, 0);
  const tax = revenue * TAX_RATE;
  const profit = revenue - tax - ads - fees;

  return {
    revenue,
    prevRevenue,
    revenueVariation: variation(revenue, prevRevenue),
    ads,
    fees,
    tax,
    orders,
    profit,
    margin: revenue ? (profit / revenue) * 100 : 0,
    ticket: orders ? revenue / orders : 0,
  };
}

function windows(days = WINDOW_DAYS) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const prevFrom = new Date(from.getTime() - days * 86400000);
  return { to, from, prevFrom };
}

export type AccountRollup = {
  id: string;
  shopName: string;
  platform: string;
  clientId: string;
  clientName: string;
  revenue: number;
  prevRevenue: number;
  variation: number;
  orders: number;
  adsSpend: number;
  fees: number;
  status: string;
  statusNote: string | null;
  reputation: string | null;
  hasPenalty: boolean;
  penaltyNote: string | null;
  lastSyncAt: Date | null;
};

/**
 * Faturamento por conta na janela atual e na anterior (para a variação).
 * `clientId` restringe ao portal do lojista — sem ele, é a carteira toda.
 *
 * Em `cache()` porque o Painel chama isto duas vezes na mesma renderização
 * (via portfolioSummary e via criticalAlerts) com os mesmos argumentos — sem
 * o cache o agregado pesado roda duplicado. O cache vive só na requisição.
 */
export const accountRollups = cache(async function accountRollups(
  days = WINDOW_DAYS,
  clientId?: string,
): Promise<AccountRollup[]> {
  const { to, from, prevFrom } = windows(days);
  const scope = clientId ? { clientId } : {};

  const [accounts, current, previous] = await Promise.all([
    prisma.account.findMany({
      relationLoadStrategy: "join",
      where: scope,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { shopName: "asc" },
    }),
    prisma.dailyMetric.groupBy({
      by: ["accountId"],
      where: { day: { gte: from, lte: to }, account: scope },
      _sum: { revenue: true, orders: true, adsSpend: true, fees: true },
    }),
    prisma.dailyMetric.groupBy({
      by: ["accountId"],
      where: { day: { gte: prevFrom, lt: from }, account: scope },
      _sum: { revenue: true },
    }),
  ]);

  const cur = new Map(current.map((r) => [r.accountId, r._sum]));
  const prev = new Map(previous.map((r) => [r.accountId, r._sum.revenue ?? 0]));

  return accounts.map((a) => {
    const c = cur.get(a.id);
    const revenue = c?.revenue ?? 0;
    const prevRevenue = prev.get(a.id) ?? 0;
    return {
      id: a.id,
      shopName: a.shopName,
      platform: a.platform,
      clientId: a.clientId,
      clientName: a.client.name,
      revenue,
      prevRevenue,
      variation: variation(revenue, prevRevenue),
      orders: c?.orders ?? 0,
      adsSpend: c?.adsSpend ?? 0,
      fees: c?.fees ?? 0,
      status: a.status,
      statusNote: a.statusNote,
      reputation: a.reputation,
      hasPenalty: a.hasPenalty,
      penaltyNote: a.penaltyNote,
      lastSyncAt: a.lastSyncAt,
    };
  });
});

/** Saúde de uma conta, derivada dos números — não é campo manual. */
export function healthOf(a: Pick<AccountRollup, "variation" | "hasPenalty" | "status">) {
  if (a.hasPenalty || a.status === "ERROR") return "CRITICO" as const;
  if (a.variation <= -15 || a.status === "EXPIRED") return "ATENCAO" as const;
  return "SAUDAVEL" as const;
}

/** Pior saúde entre as contas do cliente. */
export function healthOfClient(accounts: AccountRollup[]) {
  const order = { CRITICO: 0, ATENCAO: 1, SAUDAVEL: 2 } as const;
  return accounts
    .map(healthOf)
    .sort((a, b) => order[a] - order[b])[0] ?? ("SAUDAVEL" as const);
}

export async function portfolioSummary(days = WINDOW_DAYS) {
  // As três são independentes — em série viravam duas idas ao banco em fila.
  const [rollups, clients, byPlatform] = await Promise.all([
    accountRollups(days),
    prisma.client.count(),
    prisma.account.groupBy({ by: ["platform"], _count: { _all: true } }),
  ]);

  const revenue = rollups.reduce((s, r) => s + r.revenue, 0);
  const prevRevenue = rollups.reduce((s, r) => s + r.prevRevenue, 0);
  const adsSpend = rollups.reduce((s, r) => s + r.adsSpend, 0);
  const fees = rollups.reduce((s, r) => s + r.fees, 0);
  const orders = rollups.reduce((s, r) => s + r.orders, 0);

  const withHistory = rollups.filter((r) => r.prevRevenue > 0);
  const avgGrowth = withHistory.length
    ? withHistory.reduce((s, r) => s + r.variation, 0) / withHistory.length
    : 0;

  return {
    rollups,
    clients,
    accounts: rollups.length,
    byPlatform: Object.fromEntries(byPlatform.map((p) => [p.platform, p._count._all])),
    revenue,
    prevRevenue,
    revenueVariation: variation(revenue, prevRevenue),
    adsSpend,
    fees,
    orders,
    avgGrowth,
  };
}

/** Série diária de faturamento por plataforma — alimenta o gráfico de linha. */
export async function revenueSeries(days = WINDOW_DAYS, clientId?: string) {
  const { to, from } = windows(days);
  const rows = await prisma.dailyMetric.findMany({
    where: { day: { gte: from, lte: to }, ...(clientId ? { account: { clientId } } : {}) },
    select: { day: true, revenue: true, account: { select: { platform: true } } },
    orderBy: { day: "asc" },
  });

  const byDay = new Map<number, { day: number; MERCADO_LIVRE: number; SHOPEE: number; TIKTOK_SHOP: number }>();
  for (let i = 0; i <= days; i++) {
    const d = new Date(from.getTime() + i * 86400000);
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    byDay.set(key, { day: key, MERCADO_LIVRE: 0, SHOPEE: 0, TIKTOK_SHOP: 0 });
  }

  for (const r of rows) {
    const key = Date.UTC(r.day.getUTCFullYear(), r.day.getUTCMonth(), r.day.getUTCDate());
    const bucket = byDay.get(key);
    if (!bucket) continue;
    const p = r.account.platform as "MERCADO_LIVRE" | "SHOPEE" | "TIKTOK_SHOP";
    if (p in bucket) bucket[p] += r.revenue;
  }

  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

/** Alertas do painel: penalidades, quedas fortes e integrações quebradas. */
export async function criticalAlerts(days = WINDOW_DAYS) {
  const rollups = await accountRollups(days);
  const alerts: Array<{
    accountId: string;
    platform: string;
    title: string;
    severity: "CRITICO" | "ATENCAO";
  }> = [];

  for (const r of rollups) {
    if (r.hasPenalty) {
      alerts.push({
        accountId: r.id,
        platform: r.platform,
        title: `${r.shopName} — ${r.penaltyNote ?? "conta com penalidade ativa"}`,
        severity: "CRITICO",
      });
    }
    if (r.status === "ERROR" || r.status === "EXPIRED") {
      alerts.push({
        accountId: r.id,
        platform: r.platform,
        title: `${r.shopName} — integração precisa de atenção: ${r.statusNote ?? r.status}`,
        severity: "CRITICO",
      });
    }
    if (r.variation <= -15 && r.prevRevenue > 0) {
      alerts.push({
        accountId: r.id,
        platform: r.platform,
        title: `${r.shopName} — queda de ${Math.abs(r.variation).toFixed(0)}% no faturamento em ${days} dias`,
        severity: "ATENCAO",
      });
    }
  }

  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "CRITICO" ? -1 : 1));
}
