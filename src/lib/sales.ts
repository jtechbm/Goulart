import { TAX_RATE } from "./queries";

/**
 * A conta de lucro por item vendido — fonte única.
 *
 * A fórmula foi conferida contra um extrato real de concorrente:
 *
 *   total 29,90 · líquido 19,92 · imposto 2,99 · custo 11,98 → lucro 4,95 (16,56%)
 *   total 102,00 · líquido 37,82 · imposto 7,65 · custo 39,12 → lucro −8,95 (−8,77%)
 *
 * Detalhe que importa: a **margem é sobre o total da venda**, não sobre o
 * líquido. Sobre o líquido os números pareceriam melhores do que são.
 */

export type LinhaVenda = {
  quantity: number;
  unitPrice: number;
  total: number;
  /** Parte da retenção do marketplace que cabe a esta linha. */
  fees: number;
  /** Nulo quando o anúncio não está casado com um produto do cadastro. */
  product: { cost: number; extraCost: number } | null;
};

export type Resultado = {
  total: number;
  /** O que sobra do marketplace depois da retenção dele. */
  liquido: number;
  imposto: number;
  custoProduto: number;
  custoExtra: number;
  lucro: number;
  /** Percentual sobre o total da venda. */
  margem: number;
  /** Sem produto vinculado não há custo, então lucro e margem seriam mentira. */
  incompleto: boolean;
};

export function calcularLinha(linha: LinhaVenda, aliquota = TAX_RATE): Resultado {
  const total = linha.total;
  const liquido = total - linha.fees;
  const imposto = total * aliquota;
  const custoProduto = (linha.product?.cost ?? 0) * linha.quantity;
  const custoExtra = (linha.product?.extraCost ?? 0) * linha.quantity;
  const lucro = liquido - imposto - custoProduto - custoExtra;

  return {
    total,
    liquido,
    imposto,
    custoProduto,
    custoExtra,
    lucro,
    margem: total ? (lucro / total) * 100 : 0,
    // Custo zero é indistinguível de "não sei o custo": nos dois casos o lucro
    // sai inflado. Marcamos para a tela avisar em vez de exibir um número bonito.
    incompleto: !linha.product || linha.product.cost <= 0,
  };
}

/** Soma de várias linhas — usada nos totais de um pedido e do período. */
export function somar(linhas: Resultado[]): Resultado {
  const zero: Resultado = {
    total: 0, liquido: 0, imposto: 0, custoProduto: 0, custoExtra: 0,
    lucro: 0, margem: 0, incompleto: false,
  };
  const s = linhas.reduce((a, r) => ({
    total: a.total + r.total,
    liquido: a.liquido + r.liquido,
    imposto: a.imposto + r.imposto,
    custoProduto: a.custoProduto + r.custoProduto,
    custoExtra: a.custoExtra + r.custoExtra,
    lucro: a.lucro + r.lucro,
    margem: 0,
    incompleto: a.incompleto || r.incompleto,
  }), zero);
  return { ...s, margem: s.total ? (s.lucro / s.total) * 100 : 0 };
}

/**
 * Faixa da margem. Cor sozinha nunca decide nada na interface — o número
 * aparece junto —, mas o corte precisa estar num lugar só.
 */
export function faixaMargem(margem: number): { cor: string; rotulo: string } {
  if (margem < 0) return { cor: "var(--critical)", rotulo: "prejuízo" };
  if (margem < 20) return { cor: "var(--warning)", rotulo: "margem apertada" };
  return { cor: "var(--good)", rotulo: "margem saudável" };
}
