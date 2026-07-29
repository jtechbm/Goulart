import type { Account } from "@prisma/client";
import { decrypt, encrypt } from "./crypto";
import { prisma } from "./db";
import { adapterFor, IntegrationError, type Platform, type TokenSet } from "./integrations";

/** Renova o token quando faltam menos de 10 minutos para expirar. */
const SKEW_MS = 10 * 60 * 1000;

export async function persistTokens(accountId: string, tokens: TokenSet) {
  const now = Date.now();
  return prisma.account.update({
    where: { id: accountId },
    data: {
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      accessExpiresAt: new Date(now + tokens.expiresIn * 1000),
      refreshExpires: tokens.refreshExpiresIn ? new Date(now + tokens.refreshExpiresIn * 1000) : undefined,
      shopCipher: tokens.shopCipher ?? undefined,
      status: "CONNECTED",
      statusNote: null,
    },
  });
}

/**
 * Devolve um access token válido para a conta, renovando de forma transparente.
 * Marca a conta como EXPIRED/ERROR quando não dá pra recuperar — a tela de
 * Configurações usa esse status pra pedir reconexão.
 */
export async function validAccessToken(account: Account): Promise<string> {
  const access = decrypt(account.accessToken);
  const stillValid = account.accessExpiresAt && account.accessExpiresAt.getTime() - SKEW_MS > Date.now();

  if (access && stillValid) return access;

  const refresh = decrypt(account.refreshToken);
  if (!refresh) {
    await markBroken(account.id, "EXPIRED", "Sem refresh token — reconecte a loja.");
    throw new IntegrationError(account.platform as Platform, "conta sem refresh token; reconecte a loja");
  }

  if (account.refreshExpires && account.refreshExpires.getTime() < Date.now()) {
    await markBroken(account.id, "EXPIRED", "Refresh token expirado — reconecte a loja.");
    throw new IntegrationError(account.platform as Platform, "refresh token expirado; reconecte a loja");
  }

  try {
    const tokens = await adapterFor(account.platform as Platform).refresh({
      refreshToken: refresh,
      externalId: account.externalId,
    });
    await persistTokens(account.id, tokens);
    await prisma.syncLog.create({
      data: { accountId: account.id, kind: "token_refresh", ok: true, endedAt: new Date() },
    });
    return tokens.accessToken;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markBroken(account.id, "ERROR", message.slice(0, 500));
    await prisma.syncLog.create({
      data: { accountId: account.id, kind: "token_refresh", ok: false, message: message.slice(0, 500), endedAt: new Date() },
    });
    throw err;
  }
}

async function markBroken(accountId: string, status: "EXPIRED" | "ERROR", note: string) {
  await prisma.account.update({ where: { id: accountId }, data: { status, statusNote: note } });
}
