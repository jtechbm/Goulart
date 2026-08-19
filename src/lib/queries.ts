import { cache } from "react";
import { CANAIS, type Canal } from "./canais";
import { prisma } from "./db";
import { variation } from "./format";

export const WINDOW_DAYS = 30;

/** Alíquota efetiva usada nos consolidados. Ajuste conforme o regime tributário. */
export const TAX_RATE = 0.113;

/** Receita, custos e margem a partir dos rollups. */
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
 * Faturamento por loja na janela atual e na anterior (para a variação).
 *
 * `clientId` é o primeiro parâmetro e obrigatório de propósito: é o escopo de
 * segurança da consulta. Quando era opcional, esquecê-lo devolvia silenciosamente
 * a base inteira.
 *
 * Em `cache()` porque a mesma renderização pode pedir os rollups mais de uma vez
 * com os mesmos argumentos — sem o cache o agregado pesado roda duplicado. O
 * cache vive só na requisição.
 */
export const accountRollups = cache(async function accountRollups(
  clientId: string,
  days = WINDOW_DAYS,
): Promise<AccountRollup[]> {
  const { to, from, prevFrom } = windows(days);

  const [accounts, current, previous] = await Promise.all([
    prisma.account.findMany({
      where: { clientId },
      orderBy: { shopName: "asc" },
    }),
    prisma.dailyMetric.groupBy({
      by: ["accountId"],
      where: { day: { gte: from, lte: to }, account: { clientId } },
      _sum: { revenue: true, orders: true, adsSpend: true, fees: true },
    }),
    prisma.dailyMetric.groupBy({
      by: ["accountId"],
      where: { day: { gte: prevFrom, lt: from }, account: { clientId } },
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

/** Série diária de faturamento por plataforma — alimenta o gráfico de linha. */
export async function revenueSeries(clientId: string, days = WINDOW_DAYS) {
  const { to, from } = windows(days);
  const rows = await prisma.dailyMetric.findMany({
    where: { day: { gte: from, lte: to }, account: { clientId } },
    select: { day: true, revenue: true, account: { select: { platform: true } } },
    orderBy: { day: "asc" },
  });

  type Bucket = { day: number } & Record<Canal, number>;
  const zeroCanais = () => Object.fromEntries(CANAIS.map((c) => [c, 0])) as Record<Canal, number>;

  const byDay = new Map<number, Bucket>();
  for (let i = 0; i <= days; i++) {
    const d = new Date(from.getTime() + i * 86400000);
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    byDay.set(key, { day: key, ...zeroCanais() });
  }

  for (const r of rows) {
    const key = Date.UTC(r.day.getUTCFullYear(), r.day.getUTCMonth(), r.day.getUTCDate());
    const bucket = byDay.get(key);
    if (!bucket) continue;
    const p = r.account.platform as Canal;
    if (p in bucket) bucket[p] += r.revenue;
  }

  return [...byDay.values()].sort((a, b) => a.day - b.day);
}
