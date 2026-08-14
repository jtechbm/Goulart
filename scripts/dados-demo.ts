/**
 * Popula uma loja já cadastrada com ~90 dias de histórico fictício, mas
 * completo: 4 marketplaces + Atacado vendendo, financeiro com título vencido
 * e pago, e chat com conversa não lida — o suficiente pra abrir o sistema e
 * ele já parecer operado de verdade.
 *
 *   npm run dados-demo -- --loja "Nome da Empresa"
 *   npm run dados-demo -- --loja "Nome da Empresa" --limpar
 *
 * A empresa precisa já existir (`npm run criar-acesso` primeiro). Contas de
 * marketplace nascem com externalId prefixado por `demo-`, e é por aí que o
 * `--limpar` sabe o que apagar (cascata: pedidos, itens, produtos, métricas).
 * Clientes/fornecedores, financeiro, chat e configurações são de todo o
 * cliente — rodar de novo limpa e recria tudo, não acumula duplicata.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PREFIXO = "demo-";
const DIAS_HISTORICO = 90;

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T,>(arr: readonly T[]): T => arr[randInt(0, arr.length - 1)];
const diaUTC = (offsetDias: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDias);
  return d;
};

/* -------------------------------------------------------------------------- */
/* Catálogo — 28 produtos de decoração espalhados pelos 4 marketplaces,       */
/* 10 deles também no atacado (wholesale: true).                              */
/* -------------------------------------------------------------------------- */

type ProdutoSeed = {
  sku: string;
  title: string;
  price: number;
  cost: number;
  extraCost: number;
  stock: number;
  platform: "MERCADO_LIVRE" | "SHOPEE" | "TIKTOK_SHOP" | "SHEIN";
  wholesale?: boolean;
};

const PRODUTOS: ProdutoSeed[] = [
  // Mercado Livre (8)
  { sku: "FUT-RED-40", title: "Kit 2 Futon Redondo 9 Furos Assento De Cadeira 40x40 cm", price: 29.9, cost: 11.98, extraCost: 0, stock: 42, platform: "MERCADO_LIVRE", wholesale: true },
  { sku: "ALM-FUT-40", title: "Kit 2 Almofada Futon Assento Para Cadeira 40x40", price: 34.0, cost: 13.04, extraCost: 0, stock: 18, platform: "MERCADO_LIVRE", wholesale: true },
  { sku: "ALM-VEL-45", title: "Almofada Decorativa Veludo 45x45 cm", price: 39.9, cost: 14.5, extraCost: 1.2, stock: 7, platform: "MERCADO_LIVRE", wholesale: true },
  { sku: "MAN-TRI-120", title: "Manta Para Sofá Tricot 1,20x1,50m", price: 129.0, cost: 52.0, extraCost: 2.5, stock: 3, platform: "MERCADO_LIVRE" },
  { sku: "CAP-LIN-50", title: "Capa de Almofada Linho 50x50 cm", price: 24.9, cost: 0, extraCost: 0, stock: 25, platform: "MERCADO_LIVRE" },
  { sku: "TAP-JUT-2M", title: "Tapete de Juta Natural Redondo 2 Metros", price: 189.9, cost: 79.0, extraCost: 6.0, stock: 11, platform: "MERCADO_LIVRE" },
  { sku: "QUA-TRIO-A4", title: "Kit 3 Quadros Decorativos Botânicos A4 com Moldura", price: 79.9, cost: 28.0, extraCost: 3.0, stock: 33, platform: "MERCADO_LIVRE", wholesale: true },
  { sku: "LUM-PEN-RAT", title: "Luminária Pendente Cesto de Rattan Boho", price: 149.0, cost: 61.0, extraCost: 4.5, stock: 9, platform: "MERCADO_LIVRE" },
  // Shopee (7)
  { sku: "JOG-CAM-CAS", title: "Jogo de Cama Casal 4 Peças 200 Fios Percal", price: 99.9, cost: 41.0, extraCost: 2.0, stock: 21, platform: "SHOPEE", wholesale: true },
  { sku: "CORT-BLA-2M", title: "Cortina Blackout Corta Luz 2,00x1,80m", price: 69.9, cost: 27.0, extraCost: 1.5, stock: 16, platform: "SHOPEE" },
  { sku: "ORG-POT-6PC", title: "Kit 6 Potes Organizadores Herméticos Empilháveis", price: 54.9, cost: 19.5, extraCost: 2.2, stock: 38, platform: "SHOPEE", wholesale: true },
  { sku: "ESP-DEC-RED", title: "Espelho Decorativo Redondo Sol 60cm com Moldura Dourada", price: 119.9, cost: 48.0, extraCost: 3.0, stock: 6, platform: "SHOPEE" },
  { sku: "VAS-CER-TRI", title: "Trio de Vasos de Cerâmica Decorativos Nórdicos", price: 64.9, cost: 22.0, extraCost: 1.8, stock: 27, platform: "SHOPEE", wholesale: true },
  { sku: "TOA-BAN-KIT", title: "Kit 4 Toalhas de Banho Felpudas 500g/m²", price: 89.9, cost: 36.0, extraCost: 2.0, stock: 14, platform: "SHOPEE" },
  { sku: "PUF-VEL-RED", title: "Puff Redondo Veludo Reforçado", price: 159.9, cost: 68.0, extraCost: 5.0, stock: 8, platform: "SHOPEE" },
  // TikTok Shop (7)
  { sku: "ENF-LED-3M", title: "Enfeite de Led Cordão de Luz Fada 3 Metros", price: 32.9, cost: 11.0, extraCost: 0.8, stock: 52, platform: "TIKTOK_SHOP", wholesale: true },
  { sku: "PORT-RET-3", title: "Kit 3 Porta-Retratos Rústicos Madeira", price: 44.9, cost: 16.0, extraCost: 1.2, stock: 29, platform: "TIKTOK_SHOP" },
  { sku: "CEST-PALHA-M", title: "Cesto Organizador de Palha Média com Alça", price: 39.9, cost: 14.0, extraCost: 1.0, stock: 19, platform: "TIKTOK_SHOP", wholesale: true },
  { sku: "TAPETE-PEL-1M", title: "Tapete de Pelúcia Antiderrapante 1,20x0,60m", price: 47.9, cost: 17.5, extraCost: 1.5, stock: 24, platform: "TIKTOK_SHOP" },
  { sku: "RELOG-PAR-NOR", title: "Relógio de Parede Nórdico Silencioso 30cm", price: 59.9, cost: 21.0, extraCost: 1.0, stock: 17, platform: "TIKTOK_SHOP" },
  { sku: "COBERTOR-CAS", title: "Cobertor Casal Microfibra Toque de Pele", price: 74.9, cost: 29.0, extraCost: 2.0, stock: 0, platform: "TIKTOK_SHOP" },
  { sku: "PLANTA-ART-M", title: "Planta Artificial Decorativa em Vaso Médio", price: 42.9, cost: 15.5, extraCost: 1.2, stock: 31, platform: "TIKTOK_SHOP" },
  // SHEIN (6)
  { sku: "CAPA-SOFA-3L", title: "Capa de Sofá Elástica 3 Lugares Impermeável", price: 84.9, cost: 32.0, extraCost: 2.5, stock: 13, platform: "SHEIN" },
  { sku: "ADESIVO-PAR-KIT", title: "Kit Adesivos de Parede Frases Motivacionais", price: 19.9, cost: 6.0, extraCost: 0.5, stock: 46, platform: "SHEIN", wholesale: true },
  { sku: "PORTA-CHAVE-DEC", title: "Porta-Chaves de Parede Decorativo com Prateleira", price: 36.9, cost: 13.0, extraCost: 1.0, stock: 22, platform: "SHEIN" },
  { sku: "BANDEJA-DEC-2PC", title: "Kit 2 Bandejas Decorativas Espelhadas", price: 49.9, cost: 18.0, extraCost: 1.5, stock: 15, platform: "SHEIN" },
  { sku: "CORTINA-VOIL-2M", title: "Cortina de Voil Transparente 2,00x2,60m", price: 39.9, cost: 14.5, extraCost: 1.0, stock: 28, platform: "SHEIN" },
  { sku: "TAPETE-BANH-3PC", title: "Kit 3 Tapetes de Banheiro Antiderrapante", price: 57.9, cost: 21.0, extraCost: 1.8, stock: 20, platform: "SHEIN" },
];

/** Produtos exclusivos do atacado — nascem direto na conta ATACADO, origin MANUAL. */
const PRODUTOS_ATACADO_EXCLUSIVOS = [
  { sku: "KIT-ATC-ALMOF-12", title: "Kit Atacado 12un Almofada Lisa 40x40 (sortido)", price: 149.9, wholesalePrice: 89.9, wholesaleMinQty: 4, cost: 42.0, extraCost: 3.0, stock: 60 },
  { sku: "KIT-ATC-MANTA-6", title: "Kit Atacado 6un Manta Fleece 1,00x1,40m (sortido)", price: 219.9, wholesalePrice: 139.9, wholesaleMinQty: 3, cost: 74.0, extraCost: 4.0, stock: 40 },
];

const FEE_MODEL: Record<ProdutoSeed["platform"], (gross: number) => { commission: number; shipping: number; serviceFee: number; cardFee: number; coins: number }> = {
  MERCADO_LIVRE: (gross) => {
    const freeShip = Math.random() < 0.35;
    return { commission: gross * 0.16, shipping: freeShip ? gross * 0.15 : 0, serviceFee: 0, cardFee: 0, coins: 0 };
  },
  SHOPEE: (gross) => ({ commission: 0, shipping: 0, serviceFee: gross * 0.14, cardFee: gross * 0.03, coins: gross * 0.01 }),
  TIKTOK_SHOP: (gross) => ({ commission: gross * 0.12, shipping: 0, serviceFee: 0, cardFee: 0, coins: 0 }),
  SHEIN: (gross) => ({ commission: gross * 0.2, shipping: 0, serviceFee: 0, cardFee: 0, coins: 0 }),
};

const SHIPPING_MODE: Record<ProdutoSeed["platform"], string[]> = {
  MERCADO_LIVRE: ["Mercado Envios", "Full"],
  SHOPEE: ["Shopee Xpress", "Correios"],
  TIKTOK_SHOP: ["TikTok Entrega", "Correios"],
  SHEIN: ["SHEIN Envios"],
};

const NOMES_CLIENTES = [
  "Casa Bela Presentes", "Espaço Decor Ltda", "Lar Doce Lar Comércio", "Ambiente & Cia",
  "Point da Decoração", "Bazar Renove", "Charme de Casa Ltda", "Viva Interiores",
];
const NOMES_FORNECEDORES = [
  "Têxtil Sul Distribuidora", "Cerâmica Vale Verde", "Embalagens Pack Fácil", "Madeireira Bom Corte",
  "Import Home Decor",
];
const CIDADES: Array<[string, string]> = [
  ["Poços de Caldas", "MG"], ["Pouso Alegre", "MG"], ["Varginha", "MG"], ["Campinas", "SP"],
  ["Ribeirão Preto", "SP"], ["Belo Horizonte", "MG"], ["Guaxupé", "MG"], ["São Paulo", "SP"],
];

const PRIMEIRO_NOME = ["Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Otávio"];
const SOBRENOME = ["Silva", "Souza", "Oliveira", "Costa", "Pereira", "Almeida", "Ribeiro", "Carvalho"];

const RESPOSTAS_CLIENTE = [
  "Bom dia! Vocês têm esse produto em outra cor?",
  "Oi, o pedido já foi enviado?",
  "Quanto tempo demora pra chegar em Poços de Caldas?",
  "Consigo trocar o tamanho depois da compra?",
  "Vi que tá com desconto, ainda vale o preço anunciado?",
  "Chegou tudo certinho, muito obrigada!",
  "Vocês fazem nota fiscal?",
  "Qual a garantia desse item?",
];
const RESPOSTAS_LOJA = [
  "Bom dia! Temos sim, me passa seu e-mail que te envio as opções.",
  "Oi! Já foi despachado ontem à tarde, deve chegar em até 5 dias úteis.",
  "Em média 4 a 7 dias úteis pra essa região.",
  "Consigo sim, só me chamar em até 7 dias da compra.",
  "Isso, o valor anunciado é o que vale na finalização.",
  "Que bom! Qualquer coisa é só chamar.",
  "Fazemos sim, emitimos junto com o envio.",
  "90 dias direto com a gente, fora a garantia do fabricante.",
];

async function limparClient(clientId: string) {
  const apagados = await prisma.account.deleteMany({ where: { clientId, externalId: { startsWith: PREFIXO } } });
  await prisma.conversation.deleteMany({ where: { clientId } });
  await prisma.financeEntry.deleteMany({ where: { clientId } });
  await prisma.customer.deleteMany({ where: { clientId } });
  await prisma.settings.deleteMany({ where: { clientId } });
  return apagados.count;
}

async function main() {
  const nomeLoja = arg("loja")?.trim();
  if (!nomeLoja) throw new Error('Uso: npm run dados-demo -- --loja "Nome da empresa"');

  const client = await prisma.client.findFirst({ where: { name: nomeLoja } });
  if (!client) throw new Error(`Empresa "${nomeLoja}" não existe. Rode primeiro: npm run criar-acesso -- --loja "${nomeLoja}" ...`);

  const apagados = await limparClient(client.id);
  if (arg("limpar") !== undefined || process.argv.includes("--limpar")) {
    console.log(`removidas ${apagados} loja(s) demo e todo o financeiro/chat/clientes de "${client.name}".`);
    return;
  }

  /* ---------------------------------------------------------------------- */
  /* Contas: 4 marketplaces + Atacado                                       */
  /* ---------------------------------------------------------------------- */
  const PLATAFORMAS = ["MERCADO_LIVRE", "SHOPEE", "TIKTOK_SHOP", "SHEIN"] as const;
  const NOME_LOJA: Record<(typeof PLATAFORMAS)[number], string> = {
    MERCADO_LIVRE: "Loja no Mercado Livre",
    SHOPEE: "Loja na Shopee",
    TIKTOK_SHOP: "Loja no TikTok Shop",
    SHEIN: "Loja na SHEIN",
  };

  const contas = new Map<string, Awaited<ReturnType<typeof prisma.account.create>>>();
  for (const p of PLATAFORMAS) {
    const conta = await prisma.account.create({
      data: {
        clientId: client.id,
        platform: p,
        externalId: `${PREFIXO}${p.toLowerCase()}`,
        shopName: NOME_LOJA[p],
        status: "CONNECTED",
        reputation: "verde",
        lastSyncAt: new Date(),
        lastSyncNote: "dados de demonstração",
      },
    });
    contas.set(p, conta);
  }
  const contaAtacado = await prisma.account.create({
    data: {
      clientId: client.id,
      platform: "ATACADO",
      externalId: `${PREFIXO}atacado`,
      shopName: "Vendas no atacado",
      status: "CONNECTED",
    },
  });

  /* ---------------------------------------------------------------------- */
  /* Catálogo                                                                */
  /* ---------------------------------------------------------------------- */
  const porSku = new Map<string, { id: string; stock: number; wholesalePrice: number | null }>();

  for (const p of PRODUTOS) {
    const conta = contas.get(p.platform)!;
    const criado = await prisma.product.create({
      data: {
        accountId: conta.id,
        externalId: `${PREFIXO}${p.sku}`,
        sku: p.sku,
        title: p.title,
        price: p.price,
        cost: p.cost,
        extraCost: p.extraCost,
        stock: p.stock,
        status: "active",
        origin: "SYNCED",
        wholesalePrice: p.wholesale ? +(p.price * 0.62).toFixed(2) : null,
        wholesaleMinQty: p.wholesale ? pick([6, 8, 12]) : 1,
      },
    });
    porSku.set(p.sku, { id: criado.id, stock: p.stock, wholesalePrice: criado.wholesalePrice });
  }

  for (const p of PRODUTOS_ATACADO_EXCLUSIVOS) {
    const criado = await prisma.product.create({
      data: {
        accountId: contaAtacado.id,
        externalId: `${PREFIXO}${p.sku}`,
        sku: p.sku,
        title: p.title,
        price: p.price,
        cost: p.cost,
        extraCost: p.extraCost,
        stock: p.stock,
        status: "active",
        origin: "MANUAL",
        wholesalePrice: p.wholesalePrice,
        wholesaleMinQty: p.wholesaleMinQty,
      },
    });
    if (p.stock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: criado.id, delta: p.stock, stockBefore: 0, stockAfter: p.stock,
          reason: "AJUSTE", note: "Estoque inicial", authorId: null, authorName: "Seed de demonstração", pushed: false,
        },
      });
    }
    porSku.set(p.sku, { id: criado.id, stock: p.stock, wholesalePrice: p.wholesalePrice });
  }

  /* ---------------------------------------------------------------------- */
  /* Pedidos de marketplace — ~120 espalhados nos últimos 90 dias            */
  /* ---------------------------------------------------------------------- */
  const PESO: Record<(typeof PLATAFORMAS)[number], number> = { MERCADO_LIVRE: 0.4, SHOPEE: 0.28, TIKTOK_SHOP: 0.2, SHEIN: 0.12 };
  const TOTAL_PEDIDOS = 120;

  type DiaMetrica = { revenue: number; orders: number; units: number; adsSpend: number; fees: number };
  const metricasPorConta = new Map<string, Map<string, DiaMetrica>>();
  const registrarMetrica = (accountId: string, dia: Date, m: Partial<DiaMetrica>) => {
    const chave = dia.toISOString().slice(0, 10);
    const doDia = metricasPorConta.get(accountId) ?? new Map<string, DiaMetrica>();
    const atual = doDia.get(chave) ?? { revenue: 0, orders: 0, units: 0, adsSpend: 0, fees: 0 };
    doDia.set(chave, {
      revenue: atual.revenue + (m.revenue ?? 0),
      orders: atual.orders + (m.orders ?? 0),
      units: atual.units + (m.units ?? 0),
      adsSpend: atual.adsSpend + (m.adsSpend ?? 0),
      fees: atual.fees + (m.fees ?? 0),
    });
    metricasPorConta.set(accountId, doDia);
  };

  let pedidosCriados = 0;
  let itensSemVinculo = 0;

  for (const p of PLATAFORMAS) {
    const conta = contas.get(p)!;
    const produtosDaConta = PRODUTOS.filter((pr) => pr.platform === p);
    const numPedidos = Math.round(TOTAL_PEDIDOS * PESO[p]);

    for (let i = 0; i < numPedidos; i++) {
      // Fim de semana vende mais — resample até cair num dia aceito.
      let offset = randInt(0, DIAS_HISTORICO - 1);
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const dow = diaUTC(offset).getUTCDay();
        const fimDeSemana = dow === 0 || dow === 6;
        if (fimDeSemana || Math.random() < 0.65) break;
        offset = randInt(0, DIAS_HISTORICO - 1);
      }
      const quando = diaUTC(offset);
      quando.setUTCHours(randInt(9, 22), randInt(0, 59), 0, 0);

      const numItens = Math.random() < 0.72 ? 1 : randInt(2, 3);
      const semVinculo = Math.random() < 0.06; // ~6% dos pedidos: anúncio antigo sem SKU
      const itensPedido: Array<{ produto: ProdutoSeed | null; titulo: string; qtd: number; preco: number }> = [];

      if (semVinculo) {
        const ref = pick(produtosDaConta);
        itensPedido.push({ produto: null, titulo: `${ref.title} (anúncio antigo)`, qtd: randInt(1, 2), preco: ref.price });
        itensSemVinculo += 1;
      } else {
        for (let j = 0; j < numItens; j++) {
          const produto = pick(produtosDaConta);
          itensPedido.push({ produto, titulo: produto.title, qtd: randInt(1, 3), preco: produto.price });
        }
      }

      const gross = itensPedido.reduce((s, it) => s + it.qtd * it.preco, 0);
      const { commission, shipping, serviceFee, cardFee, coins } = FEE_MODEL[p](gross);
      const fees = commission + shipping + serviceFee + cardFee - coins;
      const itemsCount = itensPedido.reduce((s, it) => s + it.qtd, 0);

      await prisma.order.create({
        data: {
          accountId: conta.id,
          externalId: `${PREFIXO}${p.toLowerCase()}-${Date.now().toString(36)}-${i}`,
          status: "paid",
          gross, fees, commission, shipping, serviceFee, cardFee, coins,
          shippingMode: pick(SHIPPING_MODE[p]),
          itemsCount,
          placedAt: quando,
          items: {
            create: itensPedido.map((it, j) => ({
              productId: it.produto ? porSku.get(it.produto.sku)!.id : null,
              externalItemId: `${PREFIXO}${p.toLowerCase()}-${i}-${j}`,
              sku: it.produto?.sku ?? null,
              title: it.titulo,
              quantity: it.qtd,
              unitPrice: it.preco,
              total: it.qtd * it.preco,
              fees: it.produto ? (fees * (it.qtd * it.preco)) / gross : 0,
            })),
          },
        },
      });
      pedidosCriados += 1;

      const adsHoje = Math.random() < 0.4 ? +rand(3, 25).toFixed(2) : 0;
      registrarMetrica(conta.id, quando, { revenue: gross, orders: 1, units: itemsCount, fees, adsSpend: adsHoje });
    }
  }

  for (const [accountId, porDia] of metricasPorConta) {
    for (const [chave, m] of porDia) {
      await prisma.dailyMetric.create({
        data: { accountId, day: new Date(`${chave}T00:00:00.000Z`), ...m, visits: Math.round(m.orders * rand(8, 22)) },
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Clientes e fornecedores                                                */
  /* ---------------------------------------------------------------------- */
  const clientesAtacado: Array<{ id: string; name: string }> = [];
  for (const [i, nome] of NOMES_CLIENTES.entries()) {
    const [cidade, uf] = CIDADES[i % CIDADES.length];
    const c = await prisma.customer.create({
      data: {
        clientId: client.id, kind: "CLIENTE", name: nome,
        document: `${randInt(10, 99)}.${randInt(100, 999)}.${randInt(100, 999)}/0001-${randInt(10, 99)}`,
        email: `contato@${nome.toLowerCase().replace(/[^a-z]+/g, "")}.com.br`,
        phone: `(35) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
        city: cidade, uf,
      },
    });
    clientesAtacado.push({ id: c.id, name: c.name });
  }
  const fornecedores: Array<{ id: string; name: string }> = [];
  for (const [i, nome] of NOMES_FORNECEDORES.entries()) {
    const [cidade, uf] = CIDADES[(i + 3) % CIDADES.length];
    const f = await prisma.customer.create({
      data: {
        clientId: client.id, kind: "FORNECEDOR", name: nome,
        document: `${randInt(10, 99)}.${randInt(100, 999)}.${randInt(100, 999)}/0001-${randInt(10, 99)}`,
        phone: `(35) 3${randInt(100, 999)}-${randInt(1000, 9999)}`,
        city: cidade, uf,
      },
    });
    fornecedores.push({ id: f.id, name: f.name });
  }

  /* ---------------------------------------------------------------------- */
  /* Pedidos de atacado — ~18, baixando estoque de verdade                  */
  /* ---------------------------------------------------------------------- */
  const produtosAtacado = [...PRODUTOS.filter((p) => p.wholesale), ...PRODUTOS_ATACADO_EXCLUSIVOS];
  let pedidosAtacadoCriados = 0;

  for (let i = 0; i < 18; i++) {
    const offset = randInt(0, DIAS_HISTORICO - 1);
    const quando = diaUTC(offset);
    quando.setUTCHours(randInt(9, 18), randInt(0, 59), 0, 0);

    const cliente = pick(clientesAtacado);
    const numItens = randInt(1, 3);
    const itensPedido: Array<{ sku: string; qtd: number; preco: number }> = [];
    for (let j = 0; j < numItens; j++) {
      const produto = pick(produtosAtacado);
      const entrada = porSku.get(produto.sku)!;
      if (entrada.wholesalePrice == null || entrada.stock <= 0) continue;
      const minQty = "wholesaleMinQty" in produto ? produto.wholesaleMinQty : 6;
      const qtd = Math.min(entrada.stock, randInt(minQty, minQty * 3));
      if (qtd <= 0) continue;
      itensPedido.push({ sku: produto.sku, qtd, preco: entrada.wholesalePrice });
      entrada.stock -= qtd;
    }
    if (itensPedido.length === 0) continue;

    const gross = itensPedido.reduce((s, it) => s + it.qtd * it.preco, 0);
    const itemsCount = itensPedido.reduce((s, it) => s + it.qtd, 0);

    await prisma.order.create({
      data: {
        accountId: contaAtacado.id,
        externalId: `${PREFIXO}atacado-${Date.now().toString(36)}-${i}`,
        status: "paid",
        gross, fees: 0, itemsCount, placedAt: quando, customerId: cliente.id,
        items: {
          create: itensPedido.map((it, j) => {
            const p = porSku.get(it.sku)!;
            const prodDef = [...PRODUTOS, ...PRODUTOS_ATACADO_EXCLUSIVOS].find((pr) => pr.sku === it.sku)!;
            return {
              productId: p.id, externalItemId: `${PREFIXO}atacado-${i}-${j}`, sku: it.sku,
              title: prodDef.title, quantity: it.qtd, unitPrice: it.preco, total: it.qtd * it.preco, fees: 0,
            };
          }),
        },
      },
    });
    pedidosAtacadoCriados += 1;

    for (const it of itensPedido) {
      const p = porSku.get(it.sku)!;
      const stockAfter = p.stock; // já decrementado acima
      const stockBefore = stockAfter + it.qtd;
      await prisma.stockMovement.create({
        data: {
          productId: p.id, delta: -it.qtd, stockBefore, stockAfter,
          reason: "VENDA", note: `Pedido de atacado — ${cliente.name}`, authorId: null,
          authorName: "Seed de demonstração", pushed: false,
        },
      });
      await prisma.product.update({ where: { id: p.id }, data: { stock: stockAfter } });
    }

    registrarMetrica(contaAtacado.id, quando, { revenue: gross, orders: 1, units: itemsCount });
  }
  for (const [accountId, porDia] of [...metricasPorConta].filter(([id]) => id === contaAtacado.id)) {
    for (const [chave, m] of porDia) {
      const dia = new Date(`${chave}T00:00:00.000Z`);
      const existente = await prisma.dailyMetric.findUnique({ where: { accountId_day: { accountId, day: dia } } });
      if (existente) await prisma.dailyMetric.update({ where: { id: existente.id }, data: m });
      else await prisma.dailyMetric.create({ data: { accountId, day: dia, ...m } });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Financeiro — repasses, despesas recorrentes, recebíveis de atacado      */
  /* ---------------------------------------------------------------------- */
  let lancamentosCriados = 0;
  const criarLancamento = async (data: Parameters<typeof prisma.financeEntry.create>[0]["data"]) => {
    await prisma.financeEntry.create({ data });
    lancamentosCriados += 1;
  };

  // Repasses quinzenais dos marketplaces, últimos 90 dias — a maioria já paga.
  for (const p of PLATAFORMAS) {
    for (let offset = 4; offset < DIAS_HISTORICO; offset += 14) {
      const venceu = diaUTC(offset);
      const pago = offset > 10; // os mais recentes ainda não caíram
      await criarLancamento({
        clientId: client.id, kind: "RECEBER", category: "REPASSE_MARKETPLACE",
        description: `Repasse ${NOME_LOJA[p]}`, amount: +rand(400, 3200).toFixed(2),
        dueDate: venceu, paidAt: pago ? venceu : null, platform: p,
      });
    }
  }

  // Despesas recorrentes: aluguel, embalagem, ads, salário — 3 meses.
  const DESPESAS_FIXAS: Array<{ category: string; description: string; valor: [number, number] }> = [
    { category: "ALUGUEL", description: "Aluguel do galpão", valor: [1800, 1800] },
    { category: "SALARIO", description: "Salário — auxiliar de expedição", valor: [2100, 2100] },
    { category: "EMBALAGEM", description: "Compra de embalagens e etiquetas", valor: [280, 650] },
    { category: "ADS", description: "Impulsionamento de anúncios", valor: [150, 900] },
  ];
  for (let mes = 0; mes < 3; mes++) {
    for (const d of DESPESAS_FIXAS) {
      const offset = mes * 30 + randInt(1, 8);
      const venceu = diaUTC(offset);
      const pago = offset > 12;
      await criarLancamento({
        clientId: client.id, kind: "PAGAR", category: d.category, description: d.description,
        amount: +rand(...d.valor).toFixed(2), dueDate: venceu, paidAt: pago ? venceu : null, recurring: true,
      });
    }
  }

  // Pagamentos a fornecedores — alguns em atraso, de propósito.
  for (let i = 0; i < 8; i++) {
    const fornecedor = pick(fornecedores);
    const offset = randInt(-25, 60); // negativo = vencido
    const venceu = diaUTC(-offset);
    const pago = offset > 5 && Math.random() < 0.6;
    await criarLancamento({
      clientId: client.id, kind: "PAGAR", category: "FORNECEDOR",
      description: `Compra de mercadoria — ${fornecedor.name}`, amount: +rand(300, 2400).toFixed(2),
      dueDate: venceu, paidAt: pago ? venceu : null, customerId: fornecedor.id,
    });
  }

  // Recebíveis de atacado avulsos (além dos pedidos já registrados) — mistura os três status.
  for (let i = 0; i < 10; i++) {
    const cliente = pick(clientesAtacado);
    const offset = randInt(-20, 45);
    const venceu = diaUTC(-offset);
    const pago = offset > 3 && Math.random() < 0.55;
    await criarLancamento({
      clientId: client.id, kind: "RECEBER", category: "VENDA_ATACADO",
      description: `Recebível de pedido — ${cliente.name}`, amount: +rand(200, 1800).toFixed(2),
      dueDate: venceu, paidAt: pago ? venceu : null, customerId: cliente.id,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Configurações                                                          */
  /* ---------------------------------------------------------------------- */
  await prisma.settings.create({
    data: {
      clientId: client.id,
      companyName: client.name,
      document: "12.345.678/0001-90",
      phone: "(35) 99999-0000",
      address: "Rua das Decorações, 123 — Centro, Poços de Caldas/MG",
      taxRate: 0.113,
      defaultExtraCost: 0,
      lowStockThreshold: 5,
    },
  });

  /* ---------------------------------------------------------------------- */
  /* Chat — 14 conversas, 3 com mensagem não lida                           */
  /* ---------------------------------------------------------------------- */
  const CANAIS_CHAT = [...PLATAFORMAS] as const;
  let conversasCriadas = 0;
  for (let i = 0; i < 14; i++) {
    const platform = pick(CANAIS_CHAT);
    const nomeCliente = `${pick(PRIMEIRO_NOME)} ${pick(SOBRENOME)}`;
    const numMsgs = randInt(6, 12);
    const inicioOffsetHoras = randInt(2, 96);

    const msgs: Array<{ direction: "IN" | "OUT"; body: string; sentAt: Date }> = [];
    let cursor = new Date(Date.now() - inicioOffsetHoras * 3600_000);
    for (let m = 0; m < numMsgs; m++) {
      const direction: "IN" | "OUT" = m % 2 === 0 ? "IN" : "OUT";
      const body = direction === "IN" ? pick(RESPOSTAS_CLIENTE) : pick(RESPOSTAS_LOJA);
      cursor = new Date(cursor.getTime() + randInt(3, 40) * 60_000);
      msgs.push({ direction, body, sentAt: cursor });
    }

    const naoLida = i < 3; // as 3 primeiras ficam com a última mensagem do cliente sem ler
    if (naoLida && msgs[msgs.length - 1].direction !== "IN") {
      msgs.push({ direction: "IN", body: pick(RESPOSTAS_CLIENTE), sentAt: new Date(cursor.getTime() + 5 * 60_000) });
    }

    const conversa = await prisma.conversation.create({
      data: {
        clientId: client.id, platform, customerName: nomeCliente,
        customerHandle: `@${nomeCliente.toLowerCase().replace(/\s+/g, "")}`,
        status: "ABERTA", lastMessageAt: msgs[msgs.length - 1].sentAt,
      },
    });
    await prisma.message.createMany({
      data: msgs.map((m, idx) => ({
        conversationId: conversa.id, direction: m.direction, body: m.body, sentAt: m.sentAt,
        readAt: naoLida && idx === msgs.length - 1 ? null : m.direction === "IN" ? m.sentAt : m.sentAt,
      })),
    });
    conversasCriadas += 1;
  }

  console.log(`Dados de demonstração criados em "${client.name}":`);
  console.log(`  contas       : 4 marketplaces + Atacado`);
  console.log(`  produtos     : ${PRODUTOS.length + PRODUTOS_ATACADO_EXCLUSIVOS.length} (${PRODUTOS.filter((p) => p.wholesale).length + PRODUTOS_ATACADO_EXCLUSIVOS.length} no atacado, 1 sem custo, 1 zerado, 1 baixo)`);
  console.log(`  pedidos      : ${pedidosCriados} de marketplace (${itensSemVinculo} sem produto vinculado) + ${pedidosAtacadoCriados} de atacado`);
  console.log(`  clientes     : ${clientesAtacado.length} · fornecedores: ${fornecedores.length}`);
  console.log(`  financeiro   : ${lancamentosCriados} lançamento(s)`);
  console.log(`  chat         : ${conversasCriadas} conversa(s), 3 com mensagem não lida`);
  console.log(`\nPara remover: npm run dados-demo -- --loja "${client.name}" --limpar`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
