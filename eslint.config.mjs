import { FlatCompat } from "@eslint/eslintrc";

/**
 * ESLint em flat config. `next lint` foi depreciado e, sem configuração, abre
 * um prompt interativo — no CI isso trava o job até o timeout em vez de falhar.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "src/generated/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Descartar valor com `_` é intencional (ex.: tirar senha de um objeto).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
];

export default config;
