/**
 * Estatística de preços de concorrentes.
 *
 * Separado de qualquer fonte de dados de propósito: a coleta (Shopee, ML,
 * agregador) muda conforme o que estiver acessível, mas o cálculo é o mesmo.
 * Para plugar uma fonte nova basta produzir `CompetitorProduct[]`.
 */

export type CompetitorProduct = {
  externalId: string;
  shopId?: string | null;
  title: string;
  /** Em BRL, já convertido. */
  price: number;
  soldCount?: number | null;
  imageUrl?: string | null;
  url?: string | null;
};

export type PriceAnalysis = {
  medianPrice: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  totalAnalyzed: number;
  productsList: CompetitorProduct[];
};

/**
 * A Shopee devolve preço como inteiro multiplicado por 100.000
 * (R$ 50,00 => 5000000). Isolado aqui porque é fácil de esquecer e o erro
 * passa despercebido — vira um preço 100 mil vezes maior sem quebrar nada.
 */
export const SHOPEE_PRICE_DIVISOR = 100_000;

export function shopeePriceToBRL(raw: number): number {
  return raw / SHOPEE_PRICE_DIVISOR;
}

type ShopeeItem = {
  itemid: number | string;
  shopid?: number | string;
  name?: string;
  price?: number;
  historical_sold?: number;
  image?: string;
};

/** Normaliza o payload de busca da Shopee. Não faz requisição — só traduz. */
export function parseShopeeItems(items: Array<{ item_basic?: ShopeeItem } | ShopeeItem>): CompetitorProduct[] {
  const out: CompetitorProduct[] = [];

  for (const entry of items) {
    // /search_items aninha em item_basic; outros endpoints devolvem cru
    const it = ("item_basic" in entry ? entry.item_basic : entry) as ShopeeItem | undefined;
    if (!it?.itemid || typeof it.price !== "number") continue;

    const price = shopeePriceToBRL(it.price);
    if (!Number.isFinite(price) || price <= 0) continue;

    out.push({
      externalId: String(it.itemid),
      shopId: it.shopid != null ? String(it.shopid) : null,
      title: it.name ?? "(sem título)",
      price,
      soldCount: it.historical_sold ?? null,
      imageUrl: it.image ? `https://cf.shopee.com.br/file/${it.image}` : null,
      url: it.shopid != null ? `https://shopee.com.br/product/${it.shopid}/${it.itemid}` : null,
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Cálculo                                                                     */
/* -------------------------------------------------------------------------- */

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * Média descartando os `trim` extremos de cada ponta (padrão 10%).
 *
 * Numa busca por "cabo USB-C" entram capinha de R$ 5 e kit profissional de
 * R$ 400 no meio dos cabos — a média simples fica inútil. Cortar as pontas
 * devolve um número que representa o miolo real do mercado.
 *
 * Com poucos itens o corte arredondaria para zero e viraria média simples;
 * nesse caso preferimos a mediana, que já é robusta a outlier.
 */
export function trimmedMean(values: readonly number[], trim = 0.1): number {
  if (values.length === 0) return 0;

  const s = [...values].sort((a, b) => a - b);
  const cut = Math.floor(s.length * trim);
  if (cut === 0) return median(s);

  const core = s.slice(cut, s.length - cut);
  if (core.length === 0) return median(s);

  return core.reduce((sum, v) => sum + v, 0) / core.length;
}

export function analyzePrices(products: readonly CompetitorProduct[]): PriceAnalysis {
  const prices = products.map((p) => p.price).filter((p) => Number.isFinite(p) && p > 0);

  if (prices.length === 0) {
    return {
      medianPrice: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      totalAnalyzed: 0,
      productsList: [],
    };
  }

  return {
    medianPrice: median(prices),
    averagePrice: trimmedMean(prices),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    totalAnalyzed: prices.length,
    productsList: [...products].sort((a, b) => a.price - b.price),
  };
}
