import { prisma } from "./db";
import { adapterFor, type Platform } from "./integrations";
import { validAccessToken } from "./tokens";

/** Limite abaixo do qual o produto vira alerta de reposição. */
export const LOW_STOCK = 5;

export const REASONS = ["COMPRA", "AJUSTE", "PERDA", "DEVOLUCAO", "VENDA"] as const;
export type Reason = (typeof REASONS)[number];

export const REASON_LABEL: Record<Reason, string> = {
  COMPRA: "Entrada de compra",
  AJUSTE: "Ajuste de inventário",
  PERDA: "Perda / avaria",
  DEVOLUCAO: "Devolução",
  VENDA: "Saída por venda",
};

export type MoveResult = { ok: boolean; stock: number; pushed: boolean; message?: string };

/**
 * Aplica uma entrada (delta > 0) ou saída (delta < 0) de estoque.
 *
 * Para produto SYNCED o saldo é escrito de volta no marketplace — senão o
 * próximo sync sobrescreveria o ajuste e o lojista veria o número "voltar".
 * Se a escrita falhar, o movimento é registrado com `pushed: false` e o erro
 * fica visível na tela, em vez de sumir silenciosamente.
 */
export async function moveStock(input: {
  productId: string;
  delta: number;
  reason: Reason;
  note?: string | null;
  authorId: string;
  authorName: string;
  /** Escopo de segurança: o produto precisa pertencer a este cliente. */
  clientId?: string;
}): Promise<MoveResult> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: { account: true },
  });

  if (!product) return { ok: false, stock: 0, pushed: false, message: "Produto não encontrado." };
  if (input.clientId && product.account.clientId !== input.clientId) {
    return { ok: false, stock: 0, pushed: false, message: "Produto não pertence a esta conta." };
  }
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    return { ok: false, stock: product.stock, pushed: false, message: "Informe uma quantidade diferente de zero." };
  }

  const stockBefore = product.stock;
  const stockAfter = stockBefore + input.delta;
  if (stockAfter < 0) {
    return {
      ok: false,
      stock: stockBefore,
      pushed: false,
      message: `Saída maior que o disponível (${stockBefore} em estoque).`,
    };
  }

  let pushed = false;
  let pushError: string | null = null;

  if (product.origin === "SYNCED") {
    try {
      const accessToken = await validAccessToken(product.account);
      await adapterFor(product.account.platform as Platform).updateStock({
        accessToken,
        externalId: product.account.externalId,
        shopCipher: product.account.shopCipher,
        productExternalId: product.externalId,
        quantity: stockAfter,
        meta: product.meta ? (JSON.parse(product.meta) as Record<string, unknown>) : null,
      });
      pushed = true;
    } catch (err) {
      pushError = (err instanceof Error ? err.message : String(err)).slice(0, 400);
    }
  }

  // Sem propagar, não mexemos no saldo local: o sync desfaria em minutos e o
  // lojista ficaria com um número que não corresponde ao anúncio.
  if (product.origin === "SYNCED" && !pushed) {
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        delta: input.delta,
        stockBefore,
        stockAfter: stockBefore,
        reason: input.reason,
        note: input.note ?? null,
        authorId: input.authorId,
        authorName: input.authorName,
        pushed: false,
        pushError,
      },
    });
    return { ok: false, stock: stockBefore, pushed: false, message: pushError ?? "Falha ao atualizar no marketplace." };
  }

  await prisma.$transaction([
    prisma.product.update({ where: { id: product.id }, data: { stock: stockAfter } }),
    prisma.stockMovement.create({
      data: {
        productId: product.id,
        delta: input.delta,
        stockBefore,
        stockAfter,
        reason: input.reason,
        note: input.note ?? null,
        authorId: input.authorId,
        authorName: input.authorName,
        pushed,
      },
    }),
  ]);

  return { ok: true, stock: stockAfter, pushed };
}

/** Produto criado à mão (sem anúncio no marketplace). O sync não toca nele. */
export async function createManualProduct(input: {
  accountId: string;
  title: string;
  sku: string | null;
  price: number;
  stock: number;
  authorId: string;
  authorName: string;
  clientId?: string;
}) {
  const account = await prisma.account.findUnique({ where: { id: input.accountId } });
  if (!account) throw new Error("Loja não encontrada.");
  if (input.clientId && account.clientId !== input.clientId) throw new Error("Loja não pertence a esta conta.");

  const product = await prisma.product.create({
    data: {
      accountId: input.accountId,
      externalId: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title: input.title,
      sku: input.sku,
      price: input.price,
      stock: Math.max(0, input.stock),
      status: "active",
      origin: "MANUAL",
    },
  });

  if (product.stock > 0) {
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        delta: product.stock,
        stockBefore: 0,
        stockAfter: product.stock,
        reason: "AJUSTE",
        note: "Estoque inicial",
        authorId: input.authorId,
        authorName: input.authorName,
        pushed: false,
      },
    });
  }

  return product;
}

export async function deleteManualProduct(productId: string, clientId?: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { account: { select: { clientId: true } } },
  });
  if (!product) throw new Error("Produto não encontrado.");
  if (clientId && product.account.clientId !== clientId) throw new Error("Produto não pertence a esta conta.");
  if (product.origin !== "MANUAL") {
    throw new Error("Só é possível excluir produtos criados manualmente — os do marketplace saem pelo anúncio.");
  }
  await prisma.product.delete({ where: { id: productId } });
}
