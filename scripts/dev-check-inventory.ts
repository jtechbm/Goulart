/**
 * Verificação de desenvolvimento do módulo de estoque:
 * entrada, saída, bloqueio de saldo negativo e escopo por cliente.
 *
 *   npx tsx scripts/dev-check-inventory.ts
 */
import { PrismaClient } from "@prisma/client";
import { moveStock } from "../src/lib/inventory";

const prisma = new PrismaClient();

async function main() {
  const meu = await prisma.client.findFirst({ where: { name: "Casa Bella Decor" } });
  const outro = await prisma.client.findFirst({ where: { name: "Pet Mania Shop" } });
  if (!meu || !outro) throw new Error("Rode `npm run db:seed` antes.");

  const produto = await prisma.product.findFirst({
    where: { account: { clientId: meu.id }, stock: { gte: 10 } },
  });
  const produtoAlheio = await prisma.product.findFirst({ where: { account: { clientId: outro.id } } });
  if (!produto || !produtoAlheio) throw new Error("Sem produtos no seed.");

  const autor = { authorId: "teste", authorName: "Script de verificação" };
  const inicial = produto.stock;
  console.log(`produto: ${produto.title} (estoque ${inicial})`);

  const entrada = await moveStock({ productId: produto.id, delta: 5, reason: "COMPRA", clientId: meu.id, ...autor });
  console.log(`  entrada +5   -> ok=${entrada.ok} estoque=${entrada.stock} (esperado ${inicial + 5})`);

  const saida = await moveStock({ productId: produto.id, delta: -3, reason: "PERDA", clientId: meu.id, ...autor });
  console.log(`  saida  -3    -> ok=${saida.ok} estoque=${saida.stock} (esperado ${inicial + 2})`);

  const demais = await moveStock({
    productId: produto.id,
    delta: -99999,
    reason: "AJUSTE",
    clientId: meu.id,
    ...autor,
  });
  console.log(`  saida enorme -> ok=${demais.ok} (esperado false) | ${demais.message}`);

  const alheio = await moveStock({
    productId: produtoAlheio.id,
    delta: 10,
    reason: "COMPRA",
    clientId: meu.id, // cliente errado de propósito
    ...autor,
  });
  console.log(`  produto de outro cliente -> ok=${alheio.ok} (esperado false) | ${alheio.message}`);

  const movimentos = await prisma.stockMovement.count({ where: { productId: produto.id } });
  console.log(`  movimentos registrados: ${movimentos} (esperado 2)`);

  // devolve o estoque ao valor original para não sujar a demo
  await prisma.product.update({ where: { id: produto.id }, data: { stock: inicial } });
  await prisma.stockMovement.deleteMany({ where: { authorId: "teste" } });
  console.log("  estado restaurado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
