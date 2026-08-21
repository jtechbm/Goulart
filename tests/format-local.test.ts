import { describe, expect, it } from "vitest";
import { local } from "@/lib/format";

describe("local", () => {
  /** O defeito real: a tela imprimia "148,50/null" quando a UF ficava vazia. */
  it("nunca imprime null", () => {
    expect(local("São Paulo", null)).toBe("São Paulo");
    expect(local(null, "SP")).toBe("SP");
    expect(local("São Paulo", "SP")).toBe("São Paulo/SP");
  });

  it("vazio de verdade vira string vazia, e não barra solta", () => {
    expect(local(null, null)).toBe("");
    expect(local("", "")).toBe("");
    expect(local("  ", null)).toBe("");
    expect(local(undefined, undefined)).toBe("");
  });
});
