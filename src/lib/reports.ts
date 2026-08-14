import { prisma } from "./db";
import { calcularLinha, somar, type Resultado } from "./sales";
import { TAX_RATE } from "./queries";

/**
 * Relatório de faturamento e lucro do período.
 *
 * Tudo sai dos pedidos e dos itens — nunca do agregado diário (`DailyMetric`).
 * O agregado é bom para gráfico, mas não conhece custo de produto, então um
 * relatório montado a partir dele mostraria lucro errado. Usando a mesma
 * função de `sales.ts` que a tela de Vendas usa, as duas telas não divergem.
 */

export type LinhaPlataforma = {
  plataforma: string;
  faturamento: number;
  liquido: number;
  lucro: number;
  margem: number;
  pedidos: number;
};

export type LinhaProduto = {
  id: string | null;
  titulo: string;
  sku: string | null;
  unidades: number;
  faturamento: number;
  lucro: number;
  margem: number;
  semCusto: boolean;
};

export type Relatorio = {
  de: Date;
  ate: Date;
  faturamento: number;
  // o que o marketplace reteve, por tipo
  comissao: number;
  frete: number;
  taxaServico: number;
  taxaCartao: number;
  moedas: number;
  retido: number;
  liquido: number;
  // o que sai depois
  imposto: number;
  custoProduto: number;
  custoExtra: number;
  lucro: number;
  margem: number;
  aliquota: number;
  // volume
  pedidos: number;
  unidades: number;
  ticket: number;
  // qualidade do dado
  itensSemVinculo: number;
  itensSemCusto: number;
  /**
   * Diferença entre a retenção somada nos pedidos e a somada nos itens.
   * Deveria ser zero; se o sync de algum marketplace ratear diferente, o
   * relatório avisa em vez de esconder a inconsistência.
   */
  divergenciaTaxas: number;
  porPlataforma: LinhaPlataforma[];
  porProduto: LinhaProduto[];
};

export async function gerarRelatorio(clientId: string, dias: number): Promise<Relatorio> {
  const ate = new Date();
  const de = new Date(ate.getTime() - dias * 86400000);

  const pedidos = await prisma.order.findMany({
    where: { account: { clientId }, placedAt: { gte: de, lte: ate } },
    include: {
      account: { select: { platform: true } },
      items: { include: { product: { select: { id: true, cost: true, extraCost: true, sku: true } } } },
    },
  });

  const zeroLinha = () => ({ faturamento: 0, liquido: 0, lucro: 0, pedidos: 0 });
  const plataformas = new Map<string, ReturnType<typeof zeroLinha>>();
  const produtos = new Map<string, LinhaProduto>();

  let comissao = 0, frete = 0, taxaServico = 0, taxaCartao = 0, moedas = 0;
  let unidades = 0, itensSemVinculo = 0, itensSemCusto = 0, taxasDosItens = 0;
  const todas: Resultado[] = [];

  for (const p of pedidos) {
    comissao += p.commission;
    frete += p.shipping;
    taxaServico += p.serviceFee;
    taxaCartao += p.cardFee;
    moedas += p.coins;

    const daPlataforma = plataformas.get(p.account.platform) ?? zeroLinha();
    daPlataforma.pedidos += 1;

    for (const item of p.items) {
      const r = calcularLinha(item);
      todas.push(r);
      taxasDosItens += item.fees;
      unidades += item.quantity;
      if (!item.productId) itensSemVinculo += 1;
      else if ((item.product?.cost ?? 0) <= 0) itensSemCusto += 1;

      daPlataforma.faturamento += r.total;
      daPlataforma.liquido += r.liquido;
      daPlataforma.lucro += r.lucro;

      // Itens sem produto vinculado viram uma linha só, agrupada pelo título:
      // não têm id para agrupar, e listá-los soltos poluiria o ranking.
      const chave = item.productId ?? `sem-vinculo:${item.title}`;
      const atual = produtos.get(chave) ?? {
        id: item.productId,
        titulo: item.title,
        sku: item.sku ?? item.product?.sku ?? null,
        unidades: 0, faturamento: 0, lucro: 0, margem: 0,
        semCusto: !item.productId || (item.product?.cost ?? 0) <= 0,
      };
      atual.unidades += item.quantity;
      atual.faturamento += r.total;
      atual.lucro += r.lucro;
      atual.margem = atual.faturamento ? (atual.lucro / atual.faturamento) * 100 : 0;
      produtos.set(chave, atual);
    }

    plataformas.set(p.account.platform, daPlataforma);
  }

  const t = somar(todas);
  const retido = comissao + frete + taxaServico + taxaCartao - moedas;

  return {
    de, ate,
    faturamento: t.total,
    comissao, frete, taxaServico, taxaCartao, moedas, retido,
    liquido: t.liquido,
    imposto: t.imposto,
    custoProduto: t.custoProduto,
    custoExtra: t.custoExtra,
    lucro: t.lucro,
    margem: t.margem,
    aliquota: TAX_RATE,
    pedidos: pedidos.length,
    unidades,
    ticket: pedidos.length ? t.total / pedidos.length : 0,
    itensSemVinculo,
    itensSemCusto,
    divergenciaTaxas: Math.abs(retido - taxasDosItens),
    porPlataforma: [...plataformas.entries()]
      .map(([plataforma, v]) => ({
        plataforma,
        ...v,
        margem: v.faturamento ? (v.lucro / v.faturamento) * 100 : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento),
    porProduto: [...produtos.values()].sort((a, b) => b.lucro - a.lucro),
  };
}
