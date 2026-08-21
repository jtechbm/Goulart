import { describe, expect, it } from "vitest";
import { statusDe } from "@/lib/finance";
import { financials, TAX_RATE, type AccountRollup } from "@/lib/queries";

function rollup(over: Partial<AccountRollup> = {}): AccountRollup {
  return {
    id: "a", shopName: "Loja", platform: "MERCADO_LIVRE",
    revenue: 1000, prevRevenue: 800, variation: 0, orders: 10,
    adsSpend: 0, fees: 0, status: "CONNECTED", statusNote: null,
    reputation: null, hasPenalty: false, penaltyNote: null, lastSyncAt: null,
    ...over,
  };
}

describe("financials — alíquota", () => {
  /**
   * Regressão de um defeito real do merge: /faturamento calculava imposto pela
   * constante enquanto Vendas e Relatórios já usavam a alíquota configurada.
   * As duas telas mostravam impostos diferentes sobre a mesma receita.
   */
  it("respeita a alíquota recebida, e não a constante", () => {
    const r = [rollup({ revenue: 1000 })];
    expect(financials(r, 0.08).tax).toBeCloseTo(80, 6);
    expect(financials(r, 0.15).tax).toBeCloseTo(150, 6);
    // alíquota zero é válida (MEI isento), e não deve cair no padrão
    expect(financials(r, 0).tax).toBe(0);
  });

  it("sem alíquota informada, mantém o padrão do sistema", () => {
    expect(financials([rollup({ revenue: 1000 })]).tax).toBeCloseTo(1000 * TAX_RATE, 6);
  });

  it("desconta imposto, taxas e ads do lucro", () => {
    const f = financials([rollup({ revenue: 1000, fees: 100, adsSpend: 50 })], 0.1);
    expect(f.profit).toBeCloseTo(1000 - 100 - 100 - 50, 6);
    expect(f.margin).toBeCloseTo(75, 6);
  });

  it("receita zero não vira NaN em margem nem ticket", () => {
    const f = financials([rollup({ revenue: 0, prevRevenue: 0, orders: 0 })], 0.1);
    expect(f.margin).toBe(0);
    expect(f.ticket).toBe(0);
    expect(Number.isNaN(f.margin)).toBe(false);
  });
});

describe("statusDe", () => {
  const ontem = new Date(Date.now() - 86400000);
  const amanha = new Date(Date.now() + 86400000);

  it("pago vence qualquer data", () => {
    expect(statusDe({ paidAt: new Date(), dueDate: ontem })).toBe("PAGO");
    expect(statusDe({ paidAt: new Date(), dueDate: amanha })).toBe("PAGO");
  });

  it("vencido e não pago é atrasado", () => {
    expect(statusDe({ paidAt: null, dueDate: ontem })).toBe("ATRASADO");
  });

  it("a vencer é pendente", () => {
    expect(statusDe({ paidAt: null, dueDate: amanha })).toBe("PENDENTE");
  });
});
