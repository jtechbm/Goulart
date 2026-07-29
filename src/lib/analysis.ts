import { prisma } from "./db";
import { variation } from "./format";

/**
 * Motor de análise "5 focos".
 *
 * Hoje é determinístico: roda regras sobre as métricas já sincronizadas, então
 * funciona sem nenhuma credencial extra e sempre dá o mesmo resultado para o
 * mesmo dado. Se quiser trocar por um LLM depois, o ponto de extensão é
 * `runAnalysis` — basta manter o formato de `Focus[]` que a tela não muda.
 */

export type Focus = {
  title: string;
  verdict: "SAUDAVEL" | "ATENCAO" | "CRITICO";
  finding: string;
  action: string;
};

const worst = (a: Focus["verdict"], b: Focus["verdict"]) => {
  const rank = { CRITICO: 0, ATENCAO: 1, SAUDAVEL: 2 } as const;
  return rank[a] < rank[b] ? a : b;
};

export async function runAnalysis(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { client: true },
  });
  if (!account) throw new Error("Conta não encontrada");

  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  const prevFrom = new Date(from.getTime() - 30 * 86400000);

  const [cur, prev] = await Promise.all([
    prisma.dailyMetric.aggregate({
      where: { accountId, day: { gte: from, lte: to } },
      _sum: { revenue: true, orders: true, units: true, adsSpend: true, fees: true },
    }),
    prisma.dailyMetric.aggregate({
      where: { accountId, day: { gte: prevFrom, lt: from } },
      _sum: { revenue: true, orders: true },
    }),
  ]);

  const revenue = cur._sum.revenue ?? 0;
  const prevRevenue = prev._sum.revenue ?? 0;
  const orders = cur._sum.orders ?? 0;
  const prevOrders = prev._sum.orders ?? 0;
  const ads = cur._sum.adsSpend ?? 0;
  const fees = cur._sum.fees ?? 0;

  const revVar = variation(revenue, prevRevenue);
  const ticket = orders ? revenue / orders : 0;
  const prevTicket = prevOrders ? prevRevenue / prevOrders : 0;
  const acos = revenue ? (ads / revenue) * 100 : 0;
  const feeRate = revenue ? (fees / revenue) * 100 : 0;

  const focuses: Focus[] = [];

  // 1 — Faturamento
  focuses.push({
    title: "Faturamento",
    verdict: revVar <= -15 ? "CRITICO" : revVar < 0 ? "ATENCAO" : "SAUDAVEL",
    finding:
      prevRevenue === 0
        ? `R$ ${revenue.toFixed(0)} nos últimos 30 dias. Sem período anterior para comparar.`
        : `R$ ${revenue.toFixed(0)} nos últimos 30 dias, ${revVar >= 0 ? "alta" : "queda"} de ${Math.abs(revVar).toFixed(1)}% contra os 30 dias anteriores.`,
    action:
      revVar <= -15
        ? "Revisar posicionamento dos anúncios campeões e checar rupturas de estoque nos SKUs de maior giro."
        : revVar < 0
          ? "Monitorar semanalmente e reforçar os SKUs que puxaram a queda."
          : "Manter a cadência e replicar o que funcionou nos SKUs de menor giro.",
  });

  // 2 — Volume e ticket médio
  const ticketVar = variation(ticket, prevTicket);
  focuses.push({
    title: "Volume e ticket médio",
    verdict: orders === 0 ? "CRITICO" : ticketVar <= -10 ? "ATENCAO" : "SAUDAVEL",
    finding:
      orders === 0
        ? "Nenhum pedido registrado no período."
        : `${orders} pedidos, ticket médio de R$ ${ticket.toFixed(2)}${prevTicket ? ` (${ticketVar >= 0 ? "+" : ""}${ticketVar.toFixed(1)}%)` : ""}.`,
    action:
      orders === 0
        ? "Confirmar se a loja está ativa e se o sync está trazendo pedidos."
        : ticketVar <= -10
          ? "Trabalhar kits e frete grátis progressivo para recuperar o ticket."
          : "Testar upsell nos SKUs de maior conversão.",
  });

  // 3 — Investimento em ADS
  focuses.push({
    title: "Investimento em ADS",
    verdict: ads === 0 ? "ATENCAO" : acos > 20 ? "CRITICO" : acos > 12 ? "ATENCAO" : "SAUDAVEL",
    finding:
      ads === 0
        ? "Nenhum investimento em ADS importado para o período."
        : `R$ ${ads.toFixed(0)} investidos, ACOS de ${acos.toFixed(1)}% sobre o faturamento.`,
    action:
      ads === 0
        ? "Conectar a API de Ads da plataforma ou lançar o investimento manualmente."
        : acos > 20
          ? "Pausar campanhas com ACOS acima da margem e realocar verba nos SKUs lucrativos."
          : "Escalar gradualmente as campanhas com melhor retorno.",
  });

  // 4 — Comissões e margem
  focuses.push({
    title: "Comissões e margem",
    verdict: feeRate > 20 ? "ATENCAO" : "SAUDAVEL",
    finding: fees
      ? `Comissões somam R$ ${fees.toFixed(0)} (${feeRate.toFixed(1)}% do faturamento).`
      : "Comissões ainda não importadas — a plataforma expõe isso em endpoint separado de repasse.",
    action:
      feeRate > 20
        ? "Revisar precificação nos SKUs de maior comissão e avaliar mudança de categoria."
        : "Manter o acompanhamento mensal do repasse.",
  });

  // 5 — Saúde da conta e da integração
  const integrationBroken = account.status === "ERROR" || account.status === "EXPIRED";
  const stale = account.lastSyncAt ? Date.now() - account.lastSyncAt.getTime() > 48 * 3600000 : true;
  focuses.push({
    title: "Saúde da conta",
    verdict: account.hasPenalty || integrationBroken ? "CRITICO" : stale ? "ATENCAO" : "SAUDAVEL",
    finding: account.hasPenalty
      ? `Penalidade ativa: ${account.penaltyNote ?? "verificar no painel do marketplace"}.`
      : integrationBroken
        ? `Integração com problema: ${account.statusNote ?? account.status}.`
        : stale
          ? "Nenhuma sincronização nas últimas 48h — os números podem estar defasados."
          : `Reputação ${account.reputation ?? "sem penalidade"}, integração conectada.`,
    action: account.hasPenalty
      ? "Abrir contestação no marketplace e corrigir a causa raiz (prazo de envio, cancelamentos)."
      : integrationBroken
        ? "Reconectar a loja em Configurações → Integrações."
        : stale
          ? "Rodar o sync e confirmar que o cron está ativo."
          : "Nenhuma ação necessária.",
  });

  const verdict = focuses.map((f) => f.verdict).reduce(worst, "SAUDAVEL" as Focus["verdict"]);

  const analysis = await prisma.analysis.create({
    data: {
      accountId,
      title: "Análise GoulartERP — 5 focos",
      verdict,
      summary: `${account.shopName} · ${account.client.name} — R$ ${revenue.toFixed(0)} em 30 dias, ${orders} pedidos, ACOS ${acos.toFixed(1)}%.`,
      focuses: JSON.stringify(focuses),
    },
  });

  return analysis;
}

export function parseFocuses(json: string): Focus[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Focus[]) : [];
  } catch {
    return [];
  }
}
