import { describe, expect, it } from "vitest";
import { calcularLinha, faixaMargem, somar, type LinhaVenda } from "@/lib/sales";

/** Linha de venda mínima; cada teste sobrescreve só o que lhe interessa. */
function linha(over: Partial<LinhaVenda> = {}): LinhaVenda {
  return { quantity: 1, unitPrice: 100, total: 100, fees: 0, product: { cost: 0, extraCost: 0 }, ...over };
}

describe("calcularLinha — casos conferidos contra extrato real", () => {
  /**
   * Os dois casos do cabeçalho de `sales.ts`, que vieram de um extrato de
   * concorrente. A alíquota entra explícita porque no extrato ela variava por
   * item (10% num, 7,5% no outro) — o padrão do sistema é outro número.
   */
  it("venda com lucro: 29,90 → 4,95 (16,56%)", () => {
    const r = calcularLinha(
      linha({ total: 29.9, fees: 9.98, product: { cost: 11.98, extraCost: 0 } }),
      0.1,
    );
    expect(r.liquido).toBeCloseTo(19.92, 2);
    expect(r.imposto).toBeCloseTo(2.99, 2);
    expect(r.lucro).toBeCloseTo(4.95, 2);
    expect(r.margem).toBeCloseTo(16.56, 2);
  });

  it("venda no prejuízo: 102,00 → −8,95 (−8,77%)", () => {
    const r = calcularLinha(
      linha({ total: 102, fees: 64.18, product: { cost: 39.12, extraCost: 0 } }),
      0.075,
    );
    expect(r.liquido).toBeCloseTo(37.82, 2);
    expect(r.imposto).toBeCloseTo(7.65, 2);
    expect(r.lucro).toBeCloseTo(-8.95, 2);
    expect(r.margem).toBeCloseTo(-8.77, 2);
  });
});

describe("calcularLinha — regras que não podem regredir", () => {
  /**
   * A margem é sobre o TOTAL da venda, nunca sobre o líquido. Sobre o líquido
   * o número sairia bem maior e o lojista tomaria decisão com dado inflado.
   */
  it("mede a margem sobre o total, não sobre o líquido", () => {
    const r = calcularLinha(linha({ total: 100, fees: 50, product: { cost: 10, extraCost: 0 } }), 0.1);
    // lucro = 50 − 10 − 10 = 30 ; sobre o total = 30% ; sobre o líquido seria 60%
    expect(r.lucro).toBeCloseTo(30, 2);
    expect(r.margem).toBeCloseTo(30, 2);
    expect(r.margem).not.toBeCloseTo(60, 2);
  });

  it("multiplica custo unitário e custo extra pela quantidade", () => {
    const r = calcularLinha(
      linha({ quantity: 3, total: 300, fees: 0, product: { cost: 10, extraCost: 5 } }),
      0,
    );
    expect(r.custoProduto).toBe(30);
    expect(r.custoExtra).toBe(15);
    expect(r.lucro).toBe(255);
  });

  it("marca incompleto quando o anúncio não tem produto vinculado", () => {
    expect(calcularLinha(linha({ product: null })).incompleto).toBe(true);
  });

  it("marca incompleto quando o custo é zero — zero é 'não sei', não 'de graça'", () => {
    expect(calcularLinha(linha({ product: { cost: 0, extraCost: 0 } })).incompleto).toBe(true);
    expect(calcularLinha(linha({ product: { cost: 1, extraCost: 0 } })).incompleto).toBe(false);
  });

  it("não divide por zero quando a venda é de valor zero", () => {
    const r = calcularLinha(linha({ total: 0, unitPrice: 0 }));
    expect(r.margem).toBe(0);
    expect(Number.isNaN(r.margem)).toBe(false);
  });
});

describe("somar", () => {
  it("recalcula a margem sobre o total somado, e não pela média das margens", () => {
    const caro = calcularLinha(linha({ total: 1000, fees: 0, product: { cost: 900, extraCost: 0 } }), 0);
    const barato = calcularLinha(linha({ total: 10, fees: 0, product: { cost: 1, extraCost: 0 } }), 0);
    const t = somar([caro, barato]);

    expect(t.total).toBeCloseTo(1010, 2);
    expect(t.lucro).toBeCloseTo(109, 2); // 100 + 9
    expect(t.margem).toBeCloseTo((109 / 1010) * 100, 2);
    // a média simples das margens (10% e 90%) daria 50% — bem longe da verdade
    expect(t.margem).not.toBeCloseTo(50, 1);
  });

  it("contamina o total com incompleto se qualquer linha estiver incompleta", () => {
    const ok = calcularLinha(linha({ product: { cost: 5, extraCost: 0 } }));
    const semCusto = calcularLinha(linha({ product: null }));
    expect(somar([ok, semCusto]).incompleto).toBe(true);
    expect(somar([ok, ok]).incompleto).toBe(false);
  });

  it("soma vazia não vira NaN", () => {
    const t = somar([]);
    expect(t.total).toBe(0);
    expect(t.margem).toBe(0);
  });
});

describe("faixaMargem", () => {
  it("separa prejuízo, margem apertada e saudável nos cortes 0 e 20", () => {
    expect(faixaMargem(-0.1).rotulo).toBe("prejuízo");
    expect(faixaMargem(0).rotulo).toBe("margem apertada");
    expect(faixaMargem(19.99).rotulo).toBe("margem apertada");
    expect(faixaMargem(20).rotulo).toBe("margem saudável");
  });
});
