"use server";

import { revalidatePath } from "next/cache";
import { searchWithAi, supportsAiSearch } from "./aiMarketSearch";
import { requireClient } from "./auth";
import { prisma } from "./db";

/**
 * Dispara a busca de preços na Shopee/TikTok e grava o resultado.
 *
 * É uma ação explícita, não algo que roda ao abrir a tela: a busca leva ~26s
 * (não cabe numa renderização) e cada execução custa dinheiro. O que a tela
 * mostra é sempre o último resultado gravado.
 */
export async function buscarPrecosConcorrentes(
  productId: string,
): Promise<{ ok: boolean; mensagem: string }> {
  const user = await requireClient();

  // O escopo entra na consulta: a ação recebe um id do cliente, e sem isso
  // daria para disparar uma busca sobre o produto de outro lojista.
  const produto = await prisma.product.findFirst({
    where: { id: productId, account: { clientId: user.clientId } },
    include: { account: { select: { platform: true } } },
  });
  if (!produto) return { ok: false, mensagem: "Produto não encontrado." };

  const plataforma = produto.account.platform;
  if (!supportsAiSearch(plataforma)) {
    return { ok: false, mensagem: "Esta plataforma não usa busca por IA." };
  }

  const resultado = await searchWithAi(plataforma, produto.title);
  if (!resultado.ok) return { ok: false, mensagem: resultado.mensagem };

  // Substitui o resultado anterior: é uma fotografia do mercado agora, não um
  // histórico — misturar buscas de datas diferentes distorceria a mediana.
  await prisma.$transaction([
    prisma.marketComparison.deleteMany({ where: { productId } }),
    prisma.marketComparison.createMany({
      data: resultado.produtos.map((p) => ({
        productId,
        platform: plataforma,
        competitorSeller: p.shopId ?? "(não identificado)",
        competitorTitle: p.title,
        competitorPrice: p.price,
        competitorUrl: p.url,
        sourceExcerpt: p.sourceExcerpt,
        note: resultado.observacao,
        authorId: user.id,
        authorName: user.name,
      })),
    }),
  ]);

  revalidatePath("/comparador");
  return { ok: true, mensagem: `${resultado.produtos.length} anúncio(s) encontrado(s).` };
}
