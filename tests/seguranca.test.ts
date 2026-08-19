import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("senha", () => {
  it("aceita a senha certa e recusa a errada", () => {
    const guardado = hashPassword("jtechdash2026");
    expect(verifyPassword("jtechdash2026", guardado)).toBe(true);
    expect(verifyPassword("jtechdash2027", guardado)).toBe(false);
    expect(verifyPassword("", guardado)).toBe(false);
  });

  /** Sal aleatório: duas contas com a mesma senha não podem ter o mesmo hash. */
  it("nunca gera o mesmo hash duas vezes", () => {
    expect(hashPassword("igual")).not.toBe(hashPassword("igual"));
  });

  it("guarda no formato scrypt:sal:hash e não em texto puro", () => {
    const guardado = hashPassword("segredo");
    expect(guardado.startsWith("scrypt:")).toBe(true);
    expect(guardado.split(":")).toHaveLength(3);
    expect(guardado).not.toContain("segredo");
  });

  /**
   * Linha corrompida no banco tem de virar "senha inválida", nunca exceção:
   * um 500 no login é indistinguível de sistema fora do ar.
   */
  it("devolve false — sem lançar — para hash malformado", () => {
    for (const ruim of ["", "texto-puro", "scrypt:", "scrypt:soAlSemHash", "bcrypt:a:b", "a:b:c"]) {
      expect(() => verifyPassword("x", ruim)).not.toThrow();
      expect(verifyPassword("x", ruim)).toBe(false);
    }
  });
});

describe("cifra dos tokens de marketplace", () => {
  it("cifra e decifra de volta", () => {
    const token = "APP_USR-1234567890-abcdef";
    const cifrado = encrypt(token);
    expect(cifrado).not.toBeNull();
    expect(cifrado).not.toContain(token);
    expect(decrypt(cifrado)).toBe(token);
  });

  it("preserva acento e caractere fora do ASCII", () => {
    const texto = "ação · refresh · ção";
    expect(decrypt(encrypt(texto))).toBe(texto);
  });

  /** IV novo a cada chamada: mesmo token não pode gerar o mesmo texto cifrado. */
  it("não repete o texto cifrado para a mesma entrada", () => {
    expect(encrypt("mesmo")).not.toBe(encrypt("mesmo"));
  });

  it("vazio e nulo viram null, em vez de cifrar lixo", () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeNull();
    expect(encrypt("")).toBeNull();
    expect(decrypt(null)).toBeNull();
  });

  it("marca o esquema com v1: para permitir rotação futura", () => {
    expect(encrypt("x")!.startsWith("v1:")).toBe(true);
  });

  /** GCM autentica: adulterar o texto cifrado tem de falhar, não devolver lixo. */
  it("recusa texto cifrado adulterado", () => {
    const cifrado = encrypt("token-real")!;
    const partes = cifrado.split(":");
    partes[3] = partes[3].slice(0, -4) + "AAAA";
    expect(() => decrypt(partes.join(":"))).toThrow();
  });

  it("recusa formato desconhecido", () => {
    expect(() => decrypt("v2:a:b:c")).toThrow();
    expect(() => decrypt("so-um-pedaco")).toThrow();
  });
});
