/**
 * Semeia o mínimo para o sistema não abrir vazio: uma loja no Mercado Livre e
 * uma na Shopee, cada uma com um produto e uma venda.
 *
 *   npm run dados-minimos -- --loja "Nome da Empresa"
 *   npm run dados-minimos -- --loja "Nome da Empresa" --limpar
 *
 * É deliberadamente pequeno. Um catálogo fictício grande dá a impressão de
 * sistema em operação e esconde o que ainda não foi provado — aqui a conta
 * inteira cabe na tela e dá para conferir a olho se a margem fecha.
 *
 * As contas nascem com `externalId` prefixado por `demo-`, e é por aí que o
 * `--limpar` sabe o que apagar. Rodar de novo não duplica: limpa antes.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PREFIXO = "demo-";

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Meia-noite UTC de N dias atrás — mesma chave que o agregado diário usa. */
function diasAtras(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/**
 * Os números saem de uma venda plausível, não de sorteio: preço, comissão do
 * marketplace e custo do produto na proporção que o lojista realmente vê.
 * Assim a margem que aparece na tela é conferível na mão.
 */
const LOJAS = [
  {
    platform: "MERCADO_LIVRE",
    shopName: "Loja demonstração (Mercado Livre)",
    produto: { titulo: "Luminária de mesa articulada", sku: "LUM-001", preco: 129.9, custo: 62.0, estoque: 12 },
    // O ML retém comissão e frete; não usa taxa de serviço nem de cartão.
    venda: {
      quantidade: 1,
      diasAtras: 2,
      envio: "Mercado Envios Full",
      taxas: { commission: 16.24, shipping: 0, serviceFee: 0, cardFee: 0, coins: 0 },
    },
  },
  {
    platform: "SHOPEE",
    shopName: "Loja demonstração (Shopee)",
    produto: { titulo: "Kit 4 potes herméticos de vidro", sku: "POT-004", preco: 89.9, custo: 41.5, estoque: 30 },
    // A Shopee soma taxa de serviço e de cartão à comissão.
    venda: {
      quantidade: 2,
      diasAtras: 5,
      envio: "Shopee Xpress",
      taxas: { commission: 17.98, shipping: 0, serviceFee: 3.6, cardFee: 3.59, coins: 0 },
    },
  },
] as const;

/**
 * Retenção total do pedido, somada a partir da quebra.
 *
 * O `fees` é redundante com as colunas da quebra de propósito (alimenta o
 * agregado diário sem somar tudo), e por isso é derivado aqui em vez de
 * digitado: um número solto que não fecha com a quebra faz o relatório
 * apontar "divergência de taxas" — e o aviso estaria certo.
 */
function retencao(t: { commission: number; shipping: number; serviceFee: number; cardFee: number; coins: number }) {
  return t.commission + t.shipping + t.serviceFee + t.cardFee - t.coins;
}

async function main() {
  const loja = arg("loja")?.trim();
  if (!loja) throw new Error('Uso: npm run dados-minimos -- --loja "Nome da Empresa"');

  const client = await prisma.client.findFirst({ where: { name: loja } });
  if (!client) throw new Error(`Empresa "${loja}" não encontrada. Rode antes: npm run criar-acesso`);

  // Apagar a conta leva pedidos, itens, produtos e métricas em cascata.
  const removidas = await prisma.account.deleteMany({
    where: { clientId: client.id, externalId: { startsWith: PREFIXO } },
  });
  if (removidas.count > 0) console.log(`  ${removidas.count} loja(s) de demonstração anterior(es) removida(s).`);
  if (process.argv.includes("--limpar")) {
    console.log("  Pronto: só a limpeza foi pedida.");
    return;
  }

  for (const l of LOJAS) {
    const account = await prisma.account.create({
      data: {
        clientId: client.id,
        platform: l.platform,
        shopName: l.shopName,
        externalId: `${PREFIXO}${l.platform.toLowerCase()}`,
        status: "CONNECTED",
        lastSyncAt: new Date(),
        lastSyncNote: "1 pedido",
        // Sem token de propósito: é vitrine, não conexão real. Um token falso
        // faria o sync tentar falar com o marketplace e falhar de verdade.
      },
    });

    const produto = await prisma.product.create({
      data: {
        accountId: account.id,
        externalId: `${PREFIXO}${l.produto.sku}`,
        sku: l.produto.sku,
        title: l.produto.titulo,
        price: l.produto.preco,
        cost: l.produto.custo,
        stock: l.produto.estoque,
        status: "active",
        origin: "SYNCED",
        syncedAt: new Date(),
      },
    });

    const total = l.produto.preco * l.venda.quantidade;
    const placedAt = diasAtras(l.venda.diasAtras);
    const retido = retencao(l.venda.taxas);

    const order = await prisma.order.create({
      data: {
        accountId: account.id,
        externalId: `${PREFIXO}pedido-${l.platform.toLowerCase()}`,
        status: "paid",
        currency: "BRL",
        gross: total,
        fees: retido,
        ...l.venda.taxas,
        shippingMode: l.venda.envio,
        itemsCount: l.venda.quantidade,
        placedAt,
        items: {
          create: [{
            productId: produto.id,
            externalItemId: `${PREFIXO}item-${l.produto.sku}`,
            sku: l.produto.sku,
            title: l.produto.titulo,
            quantity: l.venda.quantidade,
            unitPrice: l.produto.preco,
            total,
            fees: retido,
          }],
        },
      },
    });

    // O agregado diário é o que alimenta o gráfico do painel; sem ele a venda
    // existe na lista mas o gráfico fica reto em zero.
    const dia = new Date(Date.UTC(placedAt.getUTCFullYear(), placedAt.getUTCMonth(), placedAt.getUTCDate()));
    await prisma.dailyMetric.upsert({
      where: { accountId_day: { accountId: account.id, day: dia } },
      create: { accountId: account.id, day: dia, revenue: total, orders: 1, units: l.venda.quantidade, fees: retido },
      update: { revenue: total, orders: 1, units: l.venda.quantidade, fees: retido },
    });

    const liquido = total - retido;
    const imposto = total * 0.113;
    const lucro = liquido - imposto - l.produto.custo * l.venda.quantidade;
    console.log(
      `  ${l.platform.padEnd(14)} ${l.produto.titulo} — venda R$ ${total.toFixed(2)} · lucro R$ ${lucro.toFixed(2)} (${((lucro / total) * 100).toFixed(1)}%)  [${order.externalId}]`,
    );
  }

  console.log("\n  2 lojas, 2 produtos, 2 vendas. Para remover: npm run dados-minimos -- --loja \"" + loja + "\" --limpar");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
