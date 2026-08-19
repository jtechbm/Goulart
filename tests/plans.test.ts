import { describe, expect, it } from "vitest";
import { lerEstado, planoInclui, PLANOS } from "@/lib/plans";

const AGORA = new Date("2026-06-15T12:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000);

function sub(over: Partial<Parameters<typeof lerEstado>[0] & object> = {}) {
  return {
    plan: "BASICO", status: "active", trialEndsAt: null,
    currentPeriodEnd: dias(10), cancelAtPeriodEnd: false, ...over,
  };
}

describe("catálogo de planos", () => {
  it("Relatórios e Comparador são só do Pro", () => {
    expect(planoInclui("PRO", "relatorios")).toBe(true);
    expect(planoInclui("PRO", "comparador")).toBe(true);
    expect(planoInclui("BASICO", "relatorios")).toBe(false);
    expect(planoInclui("BASICO", "comparador")).toBe(false);
  });

  it("Pro custa mais que Básico", () => {
    expect(PLANOS.PRO.preco).toBeGreaterThan(PLANOS.BASICO.preco);
  });
});

describe("lerEstado — quem entra", () => {
  /** Falha fechada: sem registro, ninguém entra. */
  it("sem assinatura, bloqueia", () => {
    const e = lerEstado(null, AGORA);
    expect(e.liberada).toBe(false);
    expect(e.status).toBe("sem_assinatura");
  });

  it("assinatura ativa libera", () => {
    expect(lerEstado(sub({ status: "active" }), AGORA).liberada).toBe(true);
  });

  it("cancelada e fora do período pago bloqueia", () => {
    const e = lerEstado(sub({ status: "canceled", currentPeriodEnd: dias(-1) }), AGORA);
    expect(e.liberada).toBe(false);
  });

  /**
   * A regra que protege o cliente: cartão recusado não corta o acesso no dia.
   * Ele fica até o fim do período que já pagou.
   */
  it("past_due continua liberado até o fim do período já pago", () => {
    expect(lerEstado(sub({ status: "past_due", currentPeriodEnd: dias(5) }), AGORA).liberada).toBe(true);
    expect(lerEstado(sub({ status: "past_due", currentPeriodEnd: dias(-1) }), AGORA).liberada).toBe(false);
  });

  it("cancelou mas o período pago não acabou: continua entrando", () => {
    const e = lerEstado(sub({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: dias(3) }), AGORA);
    expect(e.liberada).toBe(true);
    expect(e.cancelAtPeriodEnd).toBe(true);
  });
});

describe("lerEstado — teste grátis", () => {
  it("em teste libera o Pro inteiro, mesmo com Básico contratado", () => {
    const e = lerEstado(sub({ plan: "BASICO", status: "trialing", trialEndsAt: dias(7), currentPeriodEnd: null }), AGORA);
    expect(e.liberada).toBe(true);
    expect(e.emTeste).toBe(true);
    expect(e.plano).toBe("PRO");
    expect(e.planoContratado).toBe("BASICO");
    expect(planoInclui(e.plano, "relatorios")).toBe(true);
  });

  it("acabado o teste, cai para o plano contratado e perde o Pro", () => {
    const e = lerEstado(sub({ plan: "BASICO", status: "trialing", trialEndsAt: dias(-1), currentPeriodEnd: null }), AGORA);
    expect(e.emTeste).toBe(false);
    expect(e.plano).toBe("BASICO");
    expect(e.liberada).toBe(false);
    expect(planoInclui(e.plano, "relatorios")).toBe(false);
  });

  it("conta os dias restantes para cima — meio dia ainda é 1 dia", () => {
    expect(lerEstado(sub({ status: "trialing", trialEndsAt: dias(7), currentPeriodEnd: null }), AGORA).diasDeTeste).toBe(7);
    const meio = new Date(AGORA.getTime() + 43_200_000);
    expect(lerEstado(sub({ status: "trialing", trialEndsAt: meio, currentPeriodEnd: null }), AGORA).diasDeTeste).toBe(1);
  });

  it("fora do teste não anuncia dias restantes", () => {
    expect(lerEstado(sub({ status: "active" }), AGORA).diasDeTeste).toBeNull();
  });
});

describe("lerEstado — robustez", () => {
  it("plano desconhecido no banco vira Básico, e não quebra a página", () => {
    const e = lerEstado(sub({ plan: "ENTERPRISE_QUE_NAO_EXISTE" }), AGORA);
    expect(e.planoContratado).toBe("BASICO");
    expect(e.liberada).toBe(true);
  });
});
