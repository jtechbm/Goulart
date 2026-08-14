import { prisma } from "./db";
import { moveStock } from "./inventory";
import { calcularLinha, somar } from "./sales";
import { configuracoes } from "./settings";

/**
 * O atacado é um canal, não um módulo isolado: uma `Account` sintética com
 * `platform: "ATACADO"`, uma por cliente. Com isso o relatório por
 * plataforma, os gráficos e `revenueSeries` já enxergam o atacado sem
 * ramificação nova — e nenhum produto é duplicado entre varejo e atacado,
 * porque `OrderItem.productId` aponta pro mesmo cadastro de sempre.
 */
export async function contaAtacado(clientId: string) {
  const existente = await prisma.account.findFirst({ where: { clientId, platform: "ATACADO" } });
  if (existente) return existente;

  return prisma.account.create({
    data: {
      clientId,
      platform: "ATACADO",
      externalId: `atacado-${clientId}`,
      shopName: "Vendas no atacado",
      status: "CONNECTED",
    },
  });
}

/** Produtos com preço de atacado definido — o catálogo de /atacado. */
export async function catalogoAtacado(clientId: string) {
  return prisma.product.findMany({
    where: { account: { clientId }, wholesalePrice: { not: null } },
    include: { account: { select: { shopName: true, platform: true } } },
    orderBy: { title: "asc" },
  });
}

/** Produtos do cliente ainda fora do atacado — para "importar dos marketplaces". */
export async function catalogoParaImportar(clientId: string) {
  return prisma.product.findMany({
    where: { account: { clientId, platform: { not: "ATACADO" } }, wholesalePrice: null },
    include: { account: { select: { shopName: true, platform: true } } },
    orderBy: { title: "asc" },
  });
}

/**
 * Define o preço de atacado de um produto já existente — não duplica nada,
 * só marca o produto do varejo (ou o criado direto no atacado) como
 * vendável nesse canal. O estoque continua sendo um só.
 */
export async function definirPrecoAtacado(input: {
  productId: string;
  clientId: string;
  wholesalePrice: number;
  wholesaleMinQty: number;
}): Promise<{ ok: boolean; message?: string }> {
  if (!Number.isFinite(input.wholesalePrice) || input.wholesalePrice <= 0) {
    return { ok: false, message: "Preço de atacado inválido." };
  }
  const { count } = await prisma.product.updateMany({
    where: { id: input.productId, account: { clientId: input.clientId } },
    data: { wholesalePrice: input.wholesalePrice, wholesaleMinQty: Math.max(1, Math.trunc(input.wholesaleMinQty)) },
  });
  return count === 1 ? { ok: true } : { ok: false, message: "Produto não encontrado." };
}

export async function removerDoAtacado(productId: string, clientId: string) {
  await prisma.product.updateMany({
    where: { id: productId, account: { clientId } },
    data: { wholesalePrice: null },
  });
}

export async function pedidosAtacado(clientId: string, dias: number) {
  const [account, config] = await Promise.all([contaAtacado(clientId), configuracoes(clientId)]);
  const desde = new Date(Date.now() - dias * 86400000);

  const pedidos = await prisma.order.findMany({
    where: { accountId: account.id, placedAt: { gte: desde } },
    include: {
      customer: { select: { name: true } },
      items: { include: { product: { select: { cost: true, extraCost: true } } } },
    },
    orderBy: { placedAt: "desc" },
  });

  return pedidos.map((p) => ({
    pedido: p,
    linhas: p.items.map((item) => ({ item, r: calcularLinha({ ...item, fees: 0 }, config.taxRate) })),
  }));
}

export async function resumoAtacado(clientId: string, dias: number) {
  const pedidos = await pedidosAtacado(clientId, dias);
  const todas = pedidos.flatMap((p) => p.linhas.map((l) => l.r));
  return { ...somar(todas), pedidos: pedidos.length };
}

/**
 * Cria o pedido de atacado, baixa o estoque de cada linha (mesmo ledger do
 * `moveStock` usado em /estoque) e recompõe o agregado diário do próprio
 * pedido — nunca inventa número solto, senão Faturamento discordaria de
 * Vendas.
 */
export async function criarPedidoAtacado(input: {
  clientId: string;
  customerId: string;
  authorId: string;
  authorName: string;
  itens: Array<{ productId: string; quantidade: number; precoUnitario: number }>;
}) {
  if (input.itens.length === 0) throw new Error("Adicione ao menos um item ao pedido.");
  if (input.itens.some((i) => i.quantidade <= 0 || i.precoUnitario <= 0)) {
    throw new Error("Quantidade e preço precisam ser maiores que zero.");
  }

  const account = await contaAtacado(input.clientId);

  const produtos = await prisma.product.findMany({
    where: { id: { in: input.itens.map((i) => i.productId) }, account: { clientId: input.clientId } },
  });
  if (produtos.length !== new Set(input.itens.map((i) => i.productId)).size) {
    throw new Error("Um ou mais produtos não foram encontrados.");
  }

  const gross = input.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  const itemsCount = input.itens.reduce((s, i) => s + i.quantidade, 0);

  const order = await prisma.order.create({
    data: {
      accountId: account.id,
      externalId: `atacado-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      status: "paid",
      gross,
      fees: 0,
      itemsCount,
      placedAt: new Date(),
      customerId: input.customerId,
      items: {
        create: input.itens.map((i) => {
          const produto = produtos.find((p) => p.id === i.productId)!;
          return {
            productId: produto.id,
            externalItemId: `${produto.id}-${Date.now().toString(36)}`,
            sku: produto.sku,
            title: produto.title,
            quantity: i.quantidade,
            unitPrice: i.precoUnitario,
            total: i.quantidade * i.precoUnitario,
            fees: 0,
          };
        }),
      },
    },
  });

  for (const i of input.itens) {
    await moveStock({
      productId: i.productId,
      delta: -i.quantidade,
      reason: "VENDA",
      note: `Pedido de atacado #${order.id.slice(-8)}`,
      authorId: input.authorId,
      authorName: input.authorName,
      clientId: input.clientId,
    });
  }

  const dia = new Date();
  dia.setUTCHours(0, 0, 0, 0);
  const existente = await prisma.dailyMetric.findUnique({
    where: { accountId_day: { accountId: account.id, day: dia } },
  });
  if (existente) {
    await prisma.dailyMetric.update({
      where: { id: existente.id },
      data: { revenue: existente.revenue + gross, orders: existente.orders + 1, units: existente.units + itemsCount },
    });
  } else {
    await prisma.dailyMetric.create({
      data: { accountId: account.id, day: dia, revenue: gross, orders: 1, units: itemsCount },
    });
  }

  return order;
}
