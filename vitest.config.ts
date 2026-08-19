import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Só lógica pura roda aqui: nada de banco, rede ou React. São as contas que,
 * se errarem, mandam número errado de dinheiro para a tela do lojista — o
 * resto o typecheck e o build já cobrem.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Chaves que o código lê do ambiente. Valor de teste, não de produção.
    env: {
      ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    },
  },
});
