import crypto from "node:crypto";

/**
 * Cifra os tokens OAuth guardados no banco.
 *
 * AES-256-GCM. O formato armazenado é `v1:<iv>:<tag>:<ciphertext>` em base64url,
 * então dá pra rotacionar o esquema no futuro sem quebrar linhas antigas.
 */

const PREFIX = "v1";

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não definida. Gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY precisa ter 32 bytes (base64 de 32 bytes).");
  }
  return buf;
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(":");
}

export function decrypt(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Token cifrado em formato desconhecido.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/** HMAC-SHA256 em hex — assinatura usada por Shopee e TikTok Shop. */
export function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** Par PKCE (S256) exigido pelo Mercado Livre. */
export function pkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function randomState(): string {
  return crypto.randomBytes(24).toString("base64url");
}
