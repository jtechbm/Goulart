import { describe, expect, it, vi } from "vitest";
import { IntegrationError } from "@/lib/integrations/types";
import { comRetentativa, ehFalhaDeAutorizacao, ehTransitorio } from "@/lib/retry";

const erroHttp = (status: number) => new IntegrationError("MERCADO_LIVRE", `falhou (HTTP ${status})`, null, status);
/** Espera instantânea: o teste mede comportamento, não relógio. */
const semEsperar = { dormir: async () => {} };

describe("ehTransitorio", () => {
  it("repete o que passa sozinho", () => {
    for (const s of [408, 425, 429, 500, 502, 503, 504]) expect(ehTransitorio(erroHttp(s))).toBe(true);
  });

  it("não repete o que vai falhar igual para sempre", () => {
    for (const s of [400, 401, 403, 404, 422]) expect(ehTransitorio(erroHttp(s))).toBe(false);
  });

  it("erro sem status é de rede — o pedido nem chegou lá", () => {
    expect(ehTransitorio(new IntegrationError("SHOPEE", "socket hang up"))).toBe(true);
    expect(ehTransitorio(new Error("ETIMEDOUT"))).toBe(true);
    expect(ehTransitorio(new Error("connect ECONNRESET"))).toBe(true);
  });

  it("erro comum de programação não vira retentativa", () => {
    expect(ehTransitorio(new Error("cannot read property of undefined"))).toBe(false);
  });
});

describe("comRetentativa", () => {
  it("não repete quando deu certo de primeira", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await comRetentativa(fn, semEsperar)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("insiste no erro transitório e devolve o resultado da vez que deu certo", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(erroHttp(503))
      .mockRejectedValueOnce(erroHttp(503))
      .mockResolvedValue("veio");
    expect(await comRetentativa(fn, semEsperar)).toBe("veio");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  /**
   * A regra que protege a cota da aplicação inteira: 401 é autorização
   * revogada. Insistir não conserta e ainda nos aproxima de um bloqueio.
   */
  it("desiste na hora do erro permanente — uma tentativa só", async () => {
    const fn = vi.fn().mockRejectedValue(erroHttp(401));
    await expect(comRetentativa(fn, semEsperar)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respeita o teto de tentativas e propaga o último erro", async () => {
    const fn = vi.fn().mockRejectedValue(erroHttp(500));
    await expect(comRetentativa(fn, { ...semEsperar, tentativas: 4 })).rejects.toThrow(/HTTP 500/);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("cresce a espera a cada rodada, sem passar do teto", async () => {
    const esperas: number[] = [];
    const fn = vi.fn().mockRejectedValue(erroHttp(503));
    await expect(comRetentativa(fn, {
      ...semEsperar, tentativas: 5, esperaInicialMs: 1000, esperaMaximaMs: 4000,
      aoRepetir: ({ esperaMs }) => esperas.push(esperaMs),
    })).rejects.toThrow();

    expect(esperas).toHaveLength(4);
    // com jitter de 50–100%, cada espera fica entre metade e o total da base
    const bases = [1000, 2000, 4000, 4000];
    esperas.forEach((e, i) => {
      expect(e).toBeGreaterThanOrEqual(bases[i] * 0.5);
      expect(e).toBeLessThanOrEqual(bases[i]);
    });
    // e nunca ultrapassa o teto, mesmo na quinta rodada
    expect(Math.max(...esperas)).toBeLessThanOrEqual(4000);
  });

  it("avisa quem observa, a cada repetição", async () => {
    const aoRepetir = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(erroHttp(502)).mockResolvedValue("ok");
    await comRetentativa(fn, { ...semEsperar, aoRepetir });
    expect(aoRepetir).toHaveBeenCalledTimes(1);
    expect(aoRepetir.mock.calls[0][0]).toMatchObject({ tentativa: 1 });
  });
});

describe("ehFalhaDeAutorizacao", () => {
  it("reconhece 401 e 403 como 'precisa reconectar'", () => {
    expect(ehFalhaDeAutorizacao(erroHttp(401))).toBe(true);
    expect(ehFalhaDeAutorizacao(erroHttp(403))).toBe(true);
    expect(ehFalhaDeAutorizacao(erroHttp(500))).toBe(false);
  });

  it("reconhece a conta sem refresh token", () => {
    expect(ehFalhaDeAutorizacao(new Error("conta sem refresh token; reconecte a loja"))).toBe(true);
    expect(ehFalhaDeAutorizacao(new Error("invalid_grant"))).toBe(true);
  });
});
