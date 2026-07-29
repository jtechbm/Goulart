import { mercadoLivre } from "./mercadolivre";
import { shopee } from "./shopee";
import { tiktokShop } from "./tiktok";
import { SLUG_TO_PLATFORM, type MarketplaceAdapter, type Platform } from "./types";

export const adapters: Record<Platform, MarketplaceAdapter> = {
  MERCADO_LIVRE: mercadoLivre,
  SHOPEE: shopee,
  TIKTOK_SHOP: tiktokShop,
};

export function adapterFor(platform: Platform): MarketplaceAdapter {
  return adapters[platform];
}

export function adapterBySlug(slug: string): MarketplaceAdapter | null {
  const platform = SLUG_TO_PLATFORM[slug];
  return platform ? adapters[platform] : null;
}

export * from "./types";
