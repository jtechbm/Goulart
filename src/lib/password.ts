import crypto from "node:crypto";

/**
 * Hashing de senha isolado do resto do auth de propósito: o seed e scripts de
 * CLI importam daqui sem arrastar `next/headers` junto.
 */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, "base64url");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64url"), expected.length);
  // timingSafeEqual exige buffers do mesmo tamanho — o length vem do hash guardado
  return crypto.timingSafeEqual(expected, actual);
}
