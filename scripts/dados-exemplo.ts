/**
 * Cria um exemplo pequeno de Mercado Livre para dar o que ver nas telas.
 *
 *   npm run dados-exemplo -- --loja "JtechBM"
 *   npm run dados-exemplo -- --loja "JtechBM" --limpar
 *
 * Propositalmente enxuto: 5 produtos e 6 pedidos. O suficiente para exercitar
 * lucro positivo, prejuízo, custo em branco e venda sem produto vinculado —
 * que são os quatro estados que a tela de Vendas precisa saber mostrar.
 *
 * A conta nasce com externalId prefixado por `exemplo-`, e é assim que o
 * `--limpar` sabe o que apagar sem tocar em loja de verdade.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PREFIXO = "exemplo-";

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Catálogo. `cost: 0` no último de propósito: é o estado "custo desconhecido". */
const PRODUTOS = [
  { sku: "FUT-RED-40", title: "Kit 2 Futon Redondo 9 Furos Assento De Cadeira 40x40 cm", price: 29.9, cost: 11.98, extraCost: 0, stock: 42 },
  { sku: "ALM-FUT-40", title: "Kit 2 Almofada Futon Assento Para Cadeira 40x40", price: 34.0, cost: 13.04, extraCost: 0, stock: 18 },
  { sku: "ALM-VEL-45", title: "Almofada Decorativa Veludo 45x45 cm", price: 39.9, cost: 14.5, extraCost: 1.2, stock: 7 },
  { sku: "MAN-TRI-120", title: "Manta Para Sofá Tricot 1,20x1,50m", price: 129.0, cost: 52.0, extraCost: 2.5, stock: 3 },
  { sku: "CAP-LIN-50", title: "Capa de Almofada Linho 50x50 cm", price: 24.9, cost: 0, extraCost: 0, stock: 25 },
];

/**
 * Pedidos. `commission` e `shipping` são o que o Mercado Livre retém — no ML o
 * frete grátis sai do bolso do vendedor, e é ele que vira prejuízo no pedido 3.
 */
const PEDIDOS: Array<{
  diasAtras: number;
  hora: number;
  modo: string;
  itens: Array<{ sku: string | null; titulo?: string; qtd: number; preco: number; comissao: number; frete: number }>;
}> = [
  { diasAtras: 1, hora: 17, modo: "Mercado Envios", itens: [{ sku: "FUT-RED-40", qtd: 1, preco: 29.9, comissao: 4.79, frete: 5.19 }] },
  { diasAtras: 2, hora: 14, modo: "Full", itens: [
    { sku: "ALM-VEL-45", qtd: 2, preco: 39.9, comissao: 12.77, frete: 0 },
    { sku: "CAP-LIN-50", qtd: 1, preco: 24.9, comissao: 3.98, frete: 0 },
  ] },
  // Frete grátis num item barato: o clássico pedido que fecha no vermelho.
  { diasAtras: 4, hora: 10, modo: "Mercado Envios", itens: [{ sku: "ALM-FUT-40", qtd: 3, preco: 34.0, comissao: 16.32, frete: 39.9 }] },
  { diasAtras: 8, hora: 20, modo: "Full", itens: [{ sku: "MAN-TRI-120", qtd: 1, preco: 129.0, comissao: 20.64, frete: 0 }] },
  // Anúncio antigo, sem SKU: cai como venda sem produto vinculado.
  { diasAtras: 12, hora: 9, modo: "Mercado Envios", itens: [{ sku: null, titulo: "Almofada Cheia Fibra Siliconada 50x50 (anúncio antigo)", qtd: 2, preco: 27.5, comissao: 8.8, frete: 11.4 }] },
  { diasAtras: 19, hora: 16, modo: "Full", itens: [
    { sku: "FUT-RED-40", qtd: 4, preco: 29.9, comissao: 19.14, frete: 0 },
    { sku: "MAN-TRI-120", qtd: 1, preco: 129.0, comissao: 20.64, frete: 0 },
  ] },
];

async function main() {
  const nomeLoja = arg("loja")?.trim();
  if (!nomeLoja) throw new Error('Uso: npm run dados-exemplo -- --loja "Nome da empresa"');

  const client = await prisma.client.findFirst({ where: { name: nomeLoja } });
  if (!client) throw new Error(`Empresa "${nomeLoja}" não existe.`);

  // Idempotente: derrubar a conta leva junto pedidos, itens, produtos e métricas
  // (todos em cascata). Assim rodar duas vezes não duplica nada.
  const apagados = await prisma.account.deleteMany({
    where: { clientId: client.id, externalId: { startsWith: PREFIXO } },
  });
  if (arg("limpar") !== undefined || process.argv.includes("--limpar")) {
    console.log(`removidas ${apagados.count} loja(s) de exemplo de "${client.name}".`);
    return;
  }

  const account = await prisma.account.create({
    data: {
      clientId: client.id,
      platform: "MERCADO_LIVRE",
      externalId: `${PREFIXO}${Date.now()}`,
      shopName: "Loja Exemplo (Mercado Livre)",
      status: "CONNECTED",
      reputation: "verde",
      lastSyncAt: new Date(),
      lastSyncNote: "dados de exemplo",
    },
  });

  const porSku = new Map<string, string>();
  for (const p of PRODUTOS) {
    const criado = await prisma.product.create({
      data: {
        accountId: account.id,
        externalId: `${PREFIXO}${p.sku}`,
        sku: p.sku,
        title: p.title,
        price: p.price,
        cost: p.cost,
        extraCost: p.extraCost,
        stock: p.stock,
        status: "active",
        origin: "SYNCED",
      },
    });
    porSku.set(p.sku, criado.id);
  }

  const porDia = new Map<string, { revenue: number; orders: number; units: number; fees: number }>();

  for (const [i, ped] of PEDIDOS.entries()) {
    const quando = new Date();
    quando.setDate(quando.getDate() - ped.diasAtras);
    quando.setHours(ped.hora, (i * 17) % 60, 0, 0);

    const gross = ped.itens.reduce((s, it) => s + it.qtd * it.preco, 0);
    const commission = ped.itens.reduce((s, it) => s + it.comissao, 0);
    const shipping = ped.itens.reduce((s, it) => s + it.frete, 0);
    const fees = commission + shipping;

    await prisma.order.create({
      data: {
        accountId: account.id,
        externalId: `${PREFIXO}${2000000000 + i}`,
        status: "paid",
        gross,
        fees,
        commission,
        shipping,
        shippingMode: ped.modo,
        itemsCount: ped.itens.reduce((s, it) => s + it.qtd, 0),
        placedAt: quando,
        items: {
          create: ped.itens.map((it, j) => ({
            productId: it.sku ? porSku.get(it.sku)! : null,
            externalItemId: `${PREFIXO}${i}-${j}`,
            sku: it.sku,
            title: it.titulo ?? PRODUTOS.find((p) => p.sku === it.sku)!.title,
            quantity: it.qtd,
            unitPrice: it.preco,
            total: it.qtd * it.preco,
            fees: it.comissao + it.frete,
          })),
        },
      },
    });

    // O agregado diário sai dos próprios pedidos. Inventar números soltos aqui
    // faria o Faturamento discordar da tela de Vendas.
    const chave = quando.toISOString().slice(0, 10);
    const atual = porDia.get(chave) ?? { revenue: 0, orders: 0, units: 0, fees: 0 };
    porDia.set(chave, {
      revenue: atual.revenue + gross,
      orders: atual.orders + 1,
      units: atual.units + ped.itens.reduce((s, it) => s + it.qtd, 0),
      fees: atual.fees + fees,
    });
  }

  for (const [chave, m] of porDia) {
    await prisma.dailyMetric.create({
      data: { accountId: account.id, day: new Date(`${chave}T00:00:00.000Z`), ...m },
    });
  }

  const itens = await prisma.orderItem.count({ where: { order: { accountId: account.id } } });
  console.log(`Exemplo criado em "${client.name}":`);
  console.log(`  loja     : ${account.shopName}`);
  console.log(`  produtos : ${PRODUTOS.length} (1 sem custo informado, de propósito)`);
  console.log(`  pedidos  : ${PEDIDOS.length} · ${itens} item(ns), 1 sem produto vinculado`);
  console.log(`  métricas : ${porDia.size} dia(s)`);
  console.log(`\nPara remover: npm run dados-exemplo -- --loja "${client.name}" --limpar`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
