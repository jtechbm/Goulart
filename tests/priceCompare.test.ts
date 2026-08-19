import { describe, expect, it } from "vitest";
import { analyzePrices, median, parseShopeeItems, shopeePriceToBRL, trimmedMean } from "@/lib/priceCompare";

describe("shopeePriceToBRL", () => {
  /** Erra aqui e o preço sai 100 mil vezes maior sem quebrar nada. */
  it("divide pelo fator 100.000 da Shopee", () => {
    expect(shopeePriceToBRL(5_000_000)).toBe(50);
    expect(shopeePriceToBRL(499_000)).toBeCloseTo(4.99, 6);
  });
});

describe("median", () => {
  it("ímpar pega o do meio; par tira a média dos dois centrais", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("não depende da ordem de entrada", () => {
    expect(median([10, 1, 5])).toBe(median([1, 5, 10]));
  });

  it("lista vazia devolve 0 em vez de NaN", () => {
    expect(median([])).toBe(0);
  });
});

describe("trimmedMean", () => {
  /** O ponto da função: um outlier gigante não pode arrastar o número. */
  it("descarta os extremos de cada ponta", () => {
    const precos = [10, 10, 10, 10, 10, 10, 10, 10, 10, 1000];
    expect(trimmedMean(precos)).toBe(10);
    // a média simples seria 109 — inútil para decidir preço
    const simples = precos.reduce((a, b) => a + b, 0) / precos.length;
    expect(simples).toBeCloseTo(109, 0);
  });

  it("com poucos itens o corte daria zero, então cai na mediana", () => {
    expect(trimmedMean([1, 2, 100])).toBe(median([1, 2, 100]));
  });

  it("lista vazia devolve 0", () => {
    expect(trimmedMean([])).toBe(0);
  });
});

describe("parseShopeeItems", () => {
  it("aceita tanto o formato aninhado quanto o cru", () => {
    const r = parseShopeeItems([
      { item_basic: { itemid: 1, shopid: 9, name: "Cabo", price: 5_000_000 } },
      { itemid: 2, shopid: 8, name: "Fonte", price: 9_900_000 },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].price).toBe(50);
    expect(r[1].price).toBe(99);
  });

  it("descarta item sem id ou sem preço utilizável", () => {
    const r = parseShopeeItems([
      { itemid: 0, price: 5_000_000 },
      { itemid: 3 },
      { itemid: 4, price: 0 },
    ] as never);
    expect(r).toHaveLength(0);
  });
});

describe("analyzePrices", () => {
  it("resume e ordena do mais barato ao mais caro", () => {
    const a = analyzePrices([
      { externalId: "a", shopId: null, title: "a", price: 30, url: null },
      { externalId: "b", shopId: null, title: "b", price: 10, url: null },
      { externalId: "c", shopId: null, title: "c", price: 20, url: null },
    ]);
    expect(a.minPrice).toBe(10);
    expect(a.maxPrice).toBe(30);
    expect(a.medianPrice).toBe(20);
    expect(a.totalAnalyzed).toBe(3);
    expect(a.productsList.map((p) => p.price)).toEqual([10, 20, 30]);
  });

  it("sem concorrente devolve zeros, não NaN", () => {
    const a = analyzePrices([]);
    expect(a.medianPrice).toBe(0);
    expect(a.totalAnalyzed).toBe(0);
    expect(a.productsList).toEqual([]);
  });
});
