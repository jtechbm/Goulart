import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/conta/exportar — portabilidade de dados (LGPD, art. 18, V).
 *
 * Entrega tudo que guardamos sobre o cliente em um JSON, em formato legível.
 *
 * O que este arquivo **nunca** pode conter: hash de senha, token de marketplace
 * e `shopCipher`. Seriam a chave da conta e da loja saindo por um endpoint que
 * qualquer sessão válida alcança — o arquivo acaba no Downloads, no e-mail, no
 * WhatsApp. Por isso os campos são escolhidos um a um, com `select`, em vez de
 * excluídos com `omit`: assim uma coluna nova no schema entra fora do export
 * por padrão, e não dentro dele.
 */
export async function GET() {
  const user = await requireClient();
  const { clientId } = user;

  const [cliente, usuarios, contas, pedidos, produtos, movimentos] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, email: true, phone: true, document: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { clientId },
      select: { email: true, name: true, active: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.account.findMany({
      where: { clientId },
      select: {
        platform: true, shopName: true, externalId: true, region: true,
        status: true, reputation: true, lastSyncAt: true, createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: { account: { clientId } },
      select: {
        externalId: true, status: true, currency: true, gross: true, fees: true,
        shipping: true, itemsCount: true, placedAt: true,
        account: { select: { shopName: true, platform: true } },
        items: {
          select: { title: true, sku: true, quantity: true, unitPrice: true, total: true },
        },
      },
      orderBy: { placedAt: "desc" },
    }),
    prisma.product.findMany({
      where: { account: { clientId } },
      select: {
        sku: true, title: true, price: true, cost: true, extraCost: true,
        stock: true, status: true, origin: true, soldCount: true,
        account: { select: { shopName: true } },
      },
    }),
    prisma.stockMovement.findMany({
      where: { product: { account: { clientId } } },
      select: {
        delta: true, stockBefore: true, stockAfter: true, reason: true,
        note: true, authorName: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
  ]);

  const corpo = JSON.stringify(
    {
      geradoEm: new Date().toISOString(),
      observacao:
        "Export de dados pessoais e operacionais. Senhas e tokens de marketplace " +
        "não são incluídos: as senhas guardamos apenas como hash irreversível, e os " +
        "tokens dariam acesso às suas lojas se este arquivo vazasse.",
      cliente,
      usuarios,
      lojas: contas,
      pedidos,
      produtos,
      movimentosDeEstoque: movimentos,
    },
    null,
    2,
  );

  log.info("conta.exportou", { clientId, pedidos: pedidos.length, produtos: produtos.length });

  const nome = `jtecherp-dados-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(corpo, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}"`,
      // Dado pessoal não pode ficar em cache de proxy nem do navegador.
      "cache-control": "no-store, private",
    },
  });
}
