import type { Account } from "@prisma/client";
import { prisma } from "./db";
import { adapterFor, type Platform } from "./integrations";
import { log, mensagemDoErro } from "./log";
import { comRetentativa, ehFalhaDeAutorizacao } from "./retry";
import { validAccessToken } from "./tokens";

export type SyncResult = {
  accountId: string;
  shopName: string;
  platform: string;
  ok: boolean;
  orders: number;
  message?: string;
};

/** Trunca um Date para 00:00 UTC — chave do agregado diário. */
function dayKey(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Puxa os pedidos da janela, grava (upsert por externalId) e reconstrói o
 * agregado diário dos dias tocados. É idempotente: rodar duas vezes não duplica.
 */
export async function syncAccount(account: Account, days = 30): Promise<SyncResult> {
  const base = {
    accountId: account.id,
    shopName: account.shopName,
    platform: account.platform,
  };

  const registro = await prisma.syncLog.create({
    data: { accountId: account.id, kind: "orders", ok: false },
  });

  try {
    /**
     * A renovação do token fica FORA da retentativa de propósito. No Mercado
     * Livre o refresh token rotaciona a cada uso: se a renovação apenas
     * demorasse e nós tentássemos de novo, a segunda chamada apresentaria um
     * refresh token que a primeira já consumiu — e derrubaríamos a conexão da
     * loja tentando consertá-la.
     */
    const accessToken = await validAccessToken(account);
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    const orders = await comRetentativa(
      () =>
        adapterFor(account.platform as Platform).fetchOrders({
          accessToken,
          externalId: account.externalId,
          shopCipher: account.shopCipher,
          from,
          to,
        }),
      {
        aoRepetir: ({ tentativa, esperaMs, erro }) =>
          log.aviso("sync.repetindo", {
            accountId: account.id,
            platform: account.platform,
            tentativa,
            esperaMs,
            motivo: mensagemDoErro(erro),
          }),
      },
    );

    for (const o of orders) {
      const data = {
        status: o.status,
        currency: o.currency,
        gross: o.gross,
        fees: o.fees,
        shipping: o.shipping,
        itemsCount: o.itemsCount,
        buyerRef: o.buyerRef,
        placedAt: o.placedAt,
        raw: JSON.stringify(o.raw),
      };
      await prisma.order.upsert({
        where: { accountId_externalId: { accountId: account.id, externalId: o.externalId } },
        create: { accountId: account.id, externalId: o.externalId, ...data },
        update: data,
      });
    }

    await rebuildDailyMetrics(account.id, from, to);
    await syncProducts(account, accessToken);

    await prisma.account.update({
      where: { id: account.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncNote: `${orders.length} pedidos`,
        status: "CONNECTED",
        statusNote: null,
      },
    });
    await prisma.syncLog.update({
      where: { id: registro.id },
      data: { ok: true, itemCount: orders.length, endedAt: new Date() },
    });

    return { ...base, ok: true, orders: orders.length };
  } catch (err) {
    const message = mensagemDoErro(err);

    /**
     * Marcar o `status` da conta é o que faz o alerta chegar ao lojista: o sino
     * lista contas em EXPIRED/ERROR. Antes daqui só o `lastSyncNote` mudava, e
     * uma loja podia passar semanas sem sincronizar sem ninguém ser avisado —
     * o lojista só descobriria pelo faturamento que parou de crescer.
     */
    const precisaReconectar = ehFalhaDeAutorizacao(err);
    await prisma.syncLog.update({
      where: { id: registro.id },
      data: { ok: false, message: message.slice(0, 500), endedAt: new Date() },
    });
    await prisma.account.update({
      where: { id: account.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncNote: `Erro: ${message.slice(0, 200)}`,
        status: precisaReconectar ? "EXPIRED" : "ERROR",
        statusNote: precisaReconectar
          ? "A autorização com o marketplace caiu. Reconecte a loja."
          : message.slice(0, 200),
      },
    });

    log.erro("sync.falhou", {
      accountId: account.id,
      platform: account.platform,
      precisaReconectar,
      mensagem: message,
    });
    return { ...base, ok: false, orders: 0, message };
  }
}

/**
 * Atualiza o catálogo/estoque. Falha aqui não derruba o sync de pedidos — o
 * estoque desatualiza, mas o financeiro continua correto.
 */
export async function syncProducts(account: Account, accessToken: string) {
  const registro = await prisma.syncLog.create({
    data: { accountId: account.id, kind: "products", ok: false },
  });

  try {
    const products = await comRetentativa(() =>
      adapterFor(account.platform as Platform).fetchProducts({
        accessToken,
        externalId: account.externalId,
        shopCipher: account.shopCipher,
      }),
    );

    const seen: string[] = [];
    for (const p of products) {
      const data = {
        sku: p.sku,
        title: p.title,
        price: p.price,
        currency: p.currency,
        stock: p.stock,
        status: p.status,
        imageUrl: p.imageUrl,
        permalink: p.permalink,
        soldCount: p.soldCount,
        meta: p.meta ? JSON.stringify(p.meta) : null,
        syncedAt: new Date(),
      };
      await prisma.product.upsert({
        where: { accountId_externalId: { accountId: account.id, externalId: p.externalId } },
        create: { accountId: account.id, externalId: p.externalId, origin: "SYNCED", ...data },
        update: data,
      });
      seen.push(p.externalId);
    }

    // Anúncios que sumiram da plataforma saem do estoque. Produtos MANUAL não
    // existem lá, então ficam de fora da limpeza — senão sumiriam a cada sync.
    if (seen.length > 0) {
      await prisma.product.deleteMany({
        where: { accountId: account.id, origin: "SYNCED", externalId: { notIn: seen } },
      });
    }

    await prisma.syncLog.update({
      where: { id: registro.id },
      data: { ok: true, itemCount: products.length, endedAt: new Date() },
    });
    return products.length;
  } catch (err) {
    const message = mensagemDoErro(err);
    await prisma.syncLog.update({
      where: { id: registro.id },
      data: { ok: false, message: message.slice(0, 500), endedAt: new Date() },
    });
    // Só o catálogo falhou; o financeiro do pedido já entrou. Registra e segue.
    log.aviso("sync.produtos.falhou", {
      accountId: account.id,
      platform: account.platform,
      mensagem: message,
    });
    return 0;
  }
}

/** Recalcula DailyMetric a partir dos pedidos já gravados no intervalo. */
export async function rebuildDailyMetrics(accountId: string, from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: { accountId, placedAt: { gte: from, lte: to } },
    select: { placedAt: true, gross: true, fees: true, itemsCount: true },
  });

  const byDay = new Map<number, { revenue: number; orders: number; units: number; fees: number }>();
  for (const o of orders) {
    const key = dayKey(o.placedAt).getTime();
    const acc = byDay.get(key) ?? { revenue: 0, orders: 0, units: 0, fees: 0 };
    acc.revenue += o.gross;
    acc.fees += o.fees;
    acc.units += o.itemsCount;
    acc.orders += 1;
    byDay.set(key, acc);
  }

  for (const [key, agg] of byDay) {
    const day = new Date(key);
    await prisma.dailyMetric.upsert({
      where: { accountId_day: { accountId, day } },
      create: { accountId, day, ...agg },
      // adsSpend e visits vêm de outras APIs; preservados no update
      update: { revenue: agg.revenue, orders: agg.orders, units: agg.units, fees: agg.fees },
    });
  }
}

/**
 * Sincroniza as contas conectadas. `clientId` restringe às lojas de um cliente
 * — é o que a sessão do lojista usa. Sem ele (só o cron, com CRON_SECRET) roda
 * sobre todas as lojas da base.
 */
export async function syncAll(days = 30, clientId?: string | null): Promise<SyncResult[]> {
  const accounts = await prisma.account.findMany({
    where: {
      status: { in: ["CONNECTED", "EXPIRED", "ERROR"] },
      ...(clientId ? { clientId } : {}),
    },
  });
  const results: SyncResult[] = [];
  for (const account of accounts) {
    results.push(await syncAccount(account, days));
  }
  return results;
}
