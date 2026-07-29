import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

/** Credenciais de demonstração — troque antes de qualquer uso real. */
const ADMIN_LOGIN = { email: "kadu@jtech.com.br", password: "kadu@2026" };
const STAFF_LOGIN_PASSWORD = "equipe@2026";
const CLIENT_LOGIN_PASSWORD = "cliente@2026";

/**
 * Popula o banco com uma carteira de demonstração para a UI ter o que mostrar
 * antes da primeira conexão real. As contas nascem com status PENDING e sem
 * token — ao conectar de verdade via OAuth, o upsert por (platform, externalId)
 * assume a conta e o sync passa a sobrescrever as métricas.
 */

/** Uma pessoa por função, para dar pra testar as permissões logo de cara. */
const TEAM = [
  { name: "Kadu Goulart", email: "kadu@jtech.com.br", role: "diretor" },
  { name: "Mariana Souza", email: "mariana@jtech.com.br", role: "analista" },
  { name: "Pedro Alves", email: "pedro@jtech.com.br", role: "financeiro" },
  { name: "Camila Ribeiro", email: "camila@jtech.com.br", role: "suporte" },
];

const CLIENTS = [
  { name: "Casa Bella Decor", email: "contato@casabella.com.br", phone: "(11) 98765-4321", fee: 2500 },
  { name: "TechFast Acessórios", email: "ana@techfast.com.br", phone: "(11) 97654-3210", fee: 3200 },
  { name: "Pet Mania Shop", email: "rafael@petmania.com.br", phone: "(21) 99876-1234", fee: 1800 },
  { name: "Bella Moda Feminina", email: "juliana@bellamoda.com.br", phone: "(11) 98123-4567", fee: 4500 },
  { name: "Kids Brincar", email: "marcia@kidsbrincar.com.br", phone: "(31) 99234-5678", fee: 2200 },
  { name: "Esporte Total", email: "carlos@esportetotal.com.br", phone: "(41) 98765-9999", fee: 2800 },
  { name: "Glow Cosméticos", email: "patricia@glowcosmeticos.com.br", phone: "(11) 97777-1212", fee: 3500 },
];

type SeedAccount = {
  client: string;
  shopName: string;
  platform: "MERCADO_LIVRE" | "SHOPEE" | "TIKTOK_SHOP";
  /** faturamento-alvo em 30 dias */
  revenue30: number;
  /** tendência: >1 crescendo, <1 caindo */
  trend: number;
  reputation?: string;
  penalty?: string;
  owner?: string;
};

const ACCOUNTS: SeedAccount[] = [
  { client: "Casa Bella Decor", shopName: "Casa Bella Decor Oficial", platform: "MERCADO_LIVRE", revenue30: 128900, trend: 1.12, reputation: "Mercado Líder Platinum", owner: "Mariana Souza" },
  { client: "Casa Bella Decor", shopName: "Casa Bella Shopee", platform: "SHOPEE", revenue30: 81200, trend: 1.08, reputation: "4.9 / 5.0", owner: "Mariana Souza" },
  { client: "TechFast Acessórios", shopName: "TechFast Shopee", platform: "SHOPEE", revenue30: 102400, trend: 0.96, reputation: "4.7 / 5.0", owner: "Pedro Alves" },
  { client: "TechFast Acessórios", shopName: "TechFast TikTok", platform: "TIKTOK_SHOP", revenue30: 58400, trend: 0.81, reputation: "4.2 / 5.0", owner: "Pedro Alves" },
  { client: "Pet Mania Shop", shopName: "Pet Mania Shop", platform: "MERCADO_LIVRE", revenue30: 64800, trend: 0.78, reputation: "Reputação Amarela", penalty: "Baixa taxa de envio no prazo", owner: "Pedro Alves" },
  { client: "Bella Moda Feminina", shopName: "Bella Moda ML", platform: "MERCADO_LIVRE", revenue30: 184500, trend: 1.18, reputation: "Mercado Líder Platinum", owner: "Mariana Souza" },
  { client: "Bella Moda Feminina", shopName: "Bella Moda Shopee", platform: "SHOPEE", revenue30: 148200, trend: 1.15, reputation: "4.9 / 5.0", owner: "Mariana Souza" },
  { client: "Bella Moda Feminina", shopName: "Bella Moda TikTok", platform: "TIKTOK_SHOP", revenue30: 112400, trend: 1.33, reputation: "4.8 / 5.0" },
  { client: "Kids Brincar", shopName: "Kids Brincar Shopee", platform: "SHOPEE", revenue30: 51200, trend: 0.82, reputation: "4.6 / 5.0" },
  { client: "Esporte Total", shopName: "Esporte Total ML", platform: "MERCADO_LIVRE", revenue30: 142800, trend: 1.1, reputation: "Mercado Líder" },
  { client: "Glow Cosméticos", shopName: "Glow TikTok", platform: "TIKTOK_SHOP", revenue30: 88600, trend: 1.04, reputation: "4.7 / 5.0" },
];

const PRODUCTS: Record<string, string[]> = {
  "Casa Bella Decor": ["Luminária de mesa articulada", "Jogo de cama casal 200 fios", "Espelho decorativo redondo 60cm", "Kit 3 vasos cerâmica"],
  "TechFast Acessórios": ["Fone bluetooth TWS", "Carregador turbo 30W USB-C", "Suporte veicular magnético", "Cabo USB-C trançado 2m"],
  "Pet Mania Shop": ["Ração premium cães adultos 15kg", "Arranhador para gatos 3 níveis", "Coleira antipulgas", "Comedouro automático"],
  "Bella Moda Feminina": ["Vestido midi floral", "Blazer alfaiataria feminino", "Calça wide leg jeans", "Conjunto tricot 2 peças"],
  "Kids Brincar": ["Quebra-cabeça 100 peças", "Kit massinha 12 cores", "Carrinho controle remoto", "Boneca articulada"],
  "Esporte Total": ["Kit halteres 20kg", "Tapete yoga antiderrapante", "Corda de pular profissional", "Garrafa térmica 1L"],
  "Glow Cosméticos": ["Sérum vitamina C 30ml", "Protetor solar FPS 60", "Máscara capilar hidratação", "Kit skincare 4 passos"],
};

/** PRNG com semente — o seed precisa ser reproduzível. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function dayUTC(offsetDays: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main() {
  console.log("Limpando dados anteriores...");
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.message.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.dailyMetric.deleteMany();
  await prisma.order.deleteMany();
  await prisma.account.deleteMany();
  await prisma.client.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.oAuthState.deleteMany();

  console.log("Criando equipe...");
  const team = new Map<string, string>();
  for (const m of TEAM) {
    const created = await prisma.teamMember.create({ data: m });
    team.set(m.name, created.id);
  }

  console.log("Criando clientes...");
  const clients = new Map<string, string>();
  for (const c of CLIENTS) {
    const created = await prisma.client.create({
      data: { name: c.name, email: c.email, phone: c.phone },
    });
    clients.set(c.name, created.id);
  }

  console.log("Criando contas e métricas...");
  const random = rng(20260729);

  for (const [index, a] of ACCOUNTS.entries()) {
    const account = await prisma.account.create({
      data: {
        clientId: clients.get(a.client)!,
        ownerId: a.owner ? team.get(a.owner) : null,
        platform: a.platform,
        shopName: a.shopName,
        externalId: `demo-${a.platform.toLowerCase()}-${index + 1}`,
        status: "PENDING",
        statusNote: "Dados de demonstração — conecte via OAuth para dados reais.",
        reputation: a.reputation,
        hasPenalty: Boolean(a.penalty),
        penaltyNote: a.penalty,
        lastSyncAt: new Date(Date.now() - (5 + index * 3) * 60000),
        lastSyncNote: "seed",
      },
    });

    // 60 dias: os 30 mais recentes seguem `trend` sobre os 30 anteriores
    const dailyNow = a.revenue30 / 30;
    const dailyPrev = dailyNow / a.trend;

    for (let d = 59; d >= 0; d--) {
      const recent = d < 30;
      const base = recent ? dailyNow : dailyPrev;
      // ruído ±18% + leve alta em fins de semana
      const weekday = dayUTC(d).getUTCDay();
      const weekend = weekday === 0 || weekday === 6 ? 1.12 : 1;
      const revenue = Math.round(base * (0.82 + random() * 0.36) * weekend);
      const orders = Math.max(1, Math.round(revenue / (90 + random() * 80)));

      await prisma.dailyMetric.create({
        data: {
          accountId: account.id,
          day: dayUTC(d),
          revenue,
          orders,
          units: Math.round(orders * (1 + random())),
          adsSpend: Math.round(revenue * (0.06 + random() * 0.06)),
          fees: Math.round(revenue * (0.11 + random() * 0.05)),
          visits: Math.round(orders * (18 + random() * 22)),
        },
      });
    }

    // catálogo: alguns itens com estoque baixo/zerado para a tela ter alertas
    const catalog = PRODUCTS[a.client] ?? ["Produto A", "Produto B", "Produto C"];
    for (const [k, title] of catalog.entries()) {
      const zeroed = k === 0 && index % 3 === 0;
      const low = k === 1 && index % 2 === 0;
      await prisma.product.create({
        data: {
          accountId: account.id,
          externalId: `demo-item-${index + 1}-${k + 1}`,
          sku: `SKU-${String(index + 1).padStart(2, "0")}${k + 1}`,
          title,
          price: Math.round((49 + random() * 340) * 100) / 100,
          stock: zeroed ? 0 : low ? 1 + Math.floor(random() * 4) : 8 + Math.floor(random() * 120),
          status: "active",
          soldCount: Math.floor(random() * 400),
          // MANUAL porque não vieram de sync nenhum: assim o ajuste de estoque
          // funciona na demo em vez de tentar escrever numa API sem token.
          origin: "MANUAL",
        },
      });
    }
  }

  console.log("Criando contratos e faturas...");
  const now = new Date();
  for (const c of CLIENTS) {
    const clientId = clients.get(c.name)!;

    const startedAt = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const sub = await prisma.subscription.create({
      data: { clientId, amount: c.fee, dueDay: 10, method: "PIX", status: "ATIVA", startedAt },
    });

    // 6 meses de histórico: os anteriores pagos, o mês corrente em aberto
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const dueDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 10);
      const isCurrent = monthOffset === 0;
      const overdue = isCurrent && c.name === "Pet Mania Shop";
      const pending = isCurrent && c.name === "TechFast Acessórios";
      const status = overdue ? "ATRASADO" : pending ? "PENDENTE" : "PAGO";

      await prisma.invoice.create({
        data: {
          clientId,
          subscriptionId: sub.id,
          amount: c.fee,
          dueDay: 10,
          dueDate,
          method: "PIX",
          status,
          paidAt: status === "PAGO" ? dueDate : null,
          paidNote: status === "PAGO" ? "PIX recebido" : null,
          reference: `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`,
        },
      });
    }
  }

  console.log("Criando usuários...");
  // todo mundo da equipe ganha login, cada um com a permissão da própria função
  for (const m of TEAM) {
    await prisma.user.create({
      data: {
        email: m.email,
        name: m.name,
        role: "ADMIN",
        staffRole: m.role,
        passwordHash: hashPassword(m.email === ADMIN_LOGIN.email ? ADMIN_LOGIN.password : STAFF_LOGIN_PASSWORD),
        teamMemberId: team.get(m.name),
      },
    });
  }

  for (const c of CLIENTS) {
    await prisma.user.create({
      data: {
        email: c.email,
        name: c.name,
        role: "CLIENT",
        clientId: clients.get(c.name)!,
        passwordHash: hashPassword(CLIENT_LOGIN_PASSWORD),
        // no seed já entram prontos para uso; acessos reais nascem com troca obrigatória
        mustChangePassword: false,
      },
    });
  }

  console.log("Criando conversas...");
  const CONVERSATIONS: Array<{ client: string; unread: number; messages: Array<[string, string, string]> }> = [
    {
      client: "Casa Bella Decor",
      unread: 2,
      messages: [
        ["SYSTEM", "GoulartERP", "Olá! Já vamos te atender. Por favor, nos diga o que você precisa."],
        ["CLIENT", "Casa Bella Decor", "Oi! Conseguem revisar a campanha de fim de ano?"],
        ["AGENCY", "Mariana", "Claro! Vou abrir o painel agora e te envio um plano em até 1h."],
      ],
    },
    {
      client: "Pet Mania Shop",
      unread: 5,
      messages: [
        ["CLIENT", "Pet Mania Shop", "Recebi um aviso de penalidade, o que fazer?"],
        ["AGENCY", "Pedro", "Já estou vendo. É taxa de envio no prazo — vou montar o plano de correção."],
      ],
    },
    {
      client: "Bella Moda Feminina",
      unread: 0,
      messages: [["CLIENT", "Bella Moda Feminina", "Obrigada pelo relatório!"]],
    },
    {
      client: "TechFast Acessórios",
      unread: 1,
      messages: [["CLIENT", "TechFast Acessórios", "Podemos conversar sobre o TikTok?"]],
    },
    {
      client: "Glow Cosméticos",
      unread: 0,
      messages: [["CLIENT", "Glow Cosméticos", "Tudo certo por aqui."]],
    },
  ];

  for (const [i, conv] of CONVERSATIONS.entries()) {
    const thread = await prisma.thread.create({
      data: { clientId: clients.get(conv.client)!, unread: conv.unread, subject: conv.messages[0][2].slice(0, 60) },
    });
    for (const [j, [authorType, authorName, body]] of conv.messages.entries()) {
      await prisma.message.create({
        data: {
          threadId: thread.id,
          authorType,
          authorName,
          body,
          createdAt: new Date(Date.now() - (i * 3600000 + (conv.messages.length - j) * 120000)),
        },
      });
    }
  }

  console.log("\nSeed concluído. Logins de demonstração:");
  console.log(`  Diretor    : ${ADMIN_LOGIN.email} / ${ADMIN_LOGIN.password}`);
  for (const m of TEAM.filter((t) => t.role !== "diretor")) {
    console.log(`  ${m.role.padEnd(11)}: ${m.email} / ${STAFF_LOGIN_PASSWORD}`);
  }
  console.log(`  Cliente    : ${CLIENTS[0].email} / ${CLIENT_LOGIN_PASSWORD}`);
  console.log("  (todos os clientes usam a mesma senha de demonstração)\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
