import { describe, expect, it } from "vitest";
import { brl, pct, variation } from "@/lib/format";

/** Intl separa "R$" do número com espaço fino (U+00A0). */
const limpo = (s: string) => s.replace(/ /g, " ");

describe("brl", () => {
  /**
   * Regressão de um defeito real: o formatador arredondava para o real inteiro,
   * e um lucro de R$ 4,95 aparecia como "R$ 5" numa tela onde a cascata de
   * subtrações precisa fechar na conferência.
   */
  it("nunca esconde os centavos", () => {
    expect(limpo(brl(4.95))).toBe("R$ 4,95");
    expect(limpo(brl(0.01))).toBe("R$ 0,01");
    expect(limpo(brl(1234.5))).toBe("R$ 1.234,50");
  });

  it("mantém o sinal do prejuízo", () => {
    expect(limpo(brl(-8.95))).toBe("-R$ 8,95");
  });

  it("zera com centavos, e não como 'R$ 0'", () => {
    expect(limpo(brl(0))).toBe("R$ 0,00");
  });

  it("compacto abrevia — existe só para eixo de gráfico", () => {
    expect(limpo(brl(12300, true))).toMatch(/mil/);
  });
});

describe("pct", () => {
  it("põe o sinal só no positivo e usa vírgula", () => {
    expect(pct(12.34)).toBe("+12,3%");
    expect(pct(-8.77)).toBe("-8,8%");
    expect(pct(0)).toBe("0,0%");
  });
});

describe("variation", () => {
  it("calcula a variação normal", () => {
    expect(variation(150, 100)).toBeCloseTo(50, 6);
    expect(variation(50, 100)).toBeCloseTo(-50, 6);
  });

  /** Base zero dividiria por zero; o contrato é 0% se nada mudou, 100% se cresceu. */
  it("não estoura quando o período anterior foi zero", () => {
    expect(variation(0, 0)).toBe(0);
    expect(variation(10, 0)).toBe(100);
    expect(Number.isFinite(variation(10, 0))).toBe(true);
  });
});
