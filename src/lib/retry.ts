import { IntegrationError } from "./integrations/types";

/**
 * Retentativa para chamadas de marketplace.
 *
 * O ponto não é tentar de novo — é tentar de novo **só quando adianta**. Um 503
 * da Shopee é ela tropeçando e passa em segundos; um 401 é autorização
 * revogada e vai responder igual para sempre. Repetir o 401 não conserta nada
 * e ainda queima a cota da nossa aplicação, que é compartilhada por todos os
 * lojistas — é assim que se toma um bloqueio da plataforma.
 */

/** Códigos que valem uma segunda chance. */
const TRANSITORIOS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function ehTransitorio(err: unknown): boolean {
  if (err instanceof IntegrationError) {
    // Sem status é erro de rede/DNS/timeout: o pedido nem chegou lá.
    if (err.status == null) return true;
    return TRANSITORIOS.has(err.status);
  }
  // Falha de rede do próprio fetch não vira IntegrationError.
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) return true;
  if (err instanceof Error && /ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(err.message)) {
    return true;
  }
  return false;
}

export type OpcoesRetentativa = {
  /** Total de tentativas, incluindo a primeira. */
  tentativas?: number;
  /** Espera da primeira retentativa, em ms. Dobra a cada rodada. */
  esperaInicialMs?: number;
  /** Teto da espera, para o backoff não estourar o tempo da função. */
  esperaMaximaMs?: number;
  /** Chamado antes de cada espera — usado para registrar no log. */
  aoRepetir?: (info: { tentativa: number; esperaMs: number; erro: unknown }) => void;
  dormir?: (ms: number) => Promise<void>;
};

const soneca = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Backoff exponencial com "jitter".
 *
 * O jitter existe porque o cron dispara todas as lojas juntas: sem ele, uma
 * instabilidade de 2s faria todas repetirem no mesmo milissegundo, batendo na
 * plataforma exatamente quando ela está mal — e o 429 seria culpa nossa.
 */
export async function comRetentativa<T>(fn: () => Promise<T>, opts: OpcoesRetentativa = {}): Promise<T> {
  const {
    tentativas = 3,
    esperaInicialMs = 1000,
    esperaMaximaMs = 15_000,
    aoRepetir,
    dormir = soneca,
  } = opts;

  let ultimo: unknown;
  for (let i = 1; i <= tentativas; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimo = err;
      // Erro permanente ou última rodada: desiste agora, sem esperar à toa.
      if (i === tentativas || !ehTransitorio(err)) break;

      const base = Math.min(esperaInicialMs * 2 ** (i - 1), esperaMaximaMs);
      const esperaMs = Math.round(base * (0.5 + Math.random() * 0.5));
      aoRepetir?.({ tentativa: i, esperaMs, erro: err });
      await dormir(esperaMs);
    }
  }
  throw ultimo;
}

/** Autorização caiu: o lojista precisa reconectar a loja, não adianta esperar. */
export function ehFalhaDeAutorizacao(err: unknown): boolean {
  if (err instanceof IntegrationError && (err.status === 401 || err.status === 403)) return true;
  return err instanceof Error && /invalid_grant|refresh token|reconecte|unauthorized/i.test(err.message);
}
