/**
 * Fonte única dos canais de venda — marketplaces com adapter OAuth (ver
 * `integrations/types.ts`) mais os dois canais só de exibição: SHEIN (demo,
 * sem integração real) e Atacado (interno, sem OAuth nenhum). Tudo que hoje
 * precisa saber "quais canais existem" — badge, gráfico, filtro — importa
 * daqui em vez de manter a própria cópia da lista.
 */
export const CANAIS = ["MERCADO_LIVRE", "SHOPEE", "TIKTOK_SHOP", "SHEIN", "ATACADO"] as const;
export type Canal = (typeof CANAIS)[number];

/** Canais que representam venda por fora dos marketplaces (hoje só o Atacado). */
export const MARKETPLACES = CANAIS.filter((c) => c !== "ATACADO") as Exclude<Canal, "ATACADO">[];

export const CANAL_LABEL: Record<Canal, string> = {
  MERCADO_LIVRE: "Mercado Livre",
  SHOPEE: "Shopee",
  TIKTOK_SHOP: "TikTok Shop",
  SHEIN: "SHEIN",
  ATACADO: "Atacado",
};

export const CANAL_SHORT: Record<Canal, string> = {
  MERCADO_LIVRE: "ML",
  SHOPEE: "Shopee",
  TIKTOK_SHOP: "TikTok",
  SHEIN: "SHEIN",
  ATACADO: "Atacado",
};

export const CANAL_COR: Record<Canal, { fg: string; bg: string }> = {
  MERCADO_LIVRE: { fg: "var(--ml)", bg: "var(--ml-bg)" },
  SHOPEE: { fg: "var(--shopee)", bg: "var(--shopee-bg)" },
  TIKTOK_SHOP: { fg: "var(--tiktok)", bg: "var(--tiktok-bg)" },
  SHEIN: { fg: "var(--shein)", bg: "var(--shein-bg)" },
  ATACADO: { fg: "var(--atacado)", bg: "var(--atacado-bg)" },
};

/**
 * Slot fixo de série por canal — nunca ciclar, nunca reatribuir por ranking
 * (ver dataviz/scripts/validate_palette.js). ML=1, Shopee=2, TikTok=3,
 * SHEIN=4, Atacado=5.
 */
export const CANAL_SERIE: Record<Canal, string> = {
  MERCADO_LIVRE: "var(--series-1)",
  SHOPEE: "var(--series-2)",
  TIKTOK_SHOP: "var(--series-3)",
  SHEIN: "var(--series-4)",
  ATACADO: "var(--series-5)",
};
