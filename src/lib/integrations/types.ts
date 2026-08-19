export const PLATFORMS = ["MERCADO_LIVRE", "SHOPEE", "TIKTOK_SHOP"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** slug usado nas rotas /api/oauth/[platform]/... */
export const PLATFORM_SLUG: Record<Platform, string> = {
  MERCADO_LIVRE: "mercadolivre",
  SHOPEE: "shopee",
  TIKTOK_SHOP: "tiktok",
};

export const SLUG_TO_PLATFORM: Record<string, Platform> = {
  mercadolivre: "MERCADO_LIVRE",
  shopee: "SHOPEE",
  tiktok: "TIKTOK_SHOP",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  MERCADO_LIVRE: "Mercado Livre",
  SHOPEE: "Shopee",
  TIKTOK_SHOP: "TikTok Shop",
};

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  /** segundos de validade do access token */
  expiresIn: number;
  /** segundos de validade do refresh token (quando a plataforma informa) */
  refreshExpiresIn?: number;
  /** id da loja/vendedor na plataforma */
  externalId: string;
  shopName?: string;
  /** TikTok Shop: cipher obrigatório nas chamadas por loja */
  shopCipher?: string;
  region?: string;
};

export type NormalizedProduct = {
  externalId: string;
  sku: string | null;
  title: string;
  price: number;
  currency: string;
  stock: number;
  status: string;
  imageUrl: string | null;
  permalink: string | null;
  soldCount: number;
  /** Handles da plataforma exigidos para escrever estoque de volta. */
  meta?: Record<string, unknown>;
};

export type NormalizedOrder = {
  externalId: string;
  status: string;
  currency: string;
  gross: number;
  fees: number;
  shipping: number;
  itemsCount: number;
  buyerRef: string | null;
  placedAt: Date;
  raw: unknown;
};

/**
 * Contrato que todo marketplace implementa. As telas e o job de sync só
 * conhecem esta interface — nunca as particularidades de cada API.
 */
export interface MarketplaceAdapter {
  platform: Platform;
  /** true quando as credenciais da plataforma estão no .env */
  isConfigured(): boolean;
  /** URL para onde redirecionar o lojista. `challenge` é o PKCE S256 (só o ML usa). */
  buildAuthUrl(input: { state: string; challenge?: string }): string;
  /** troca o código do callback por tokens */
  exchangeCode(input: {
    params: URLSearchParams;
    verifier?: string | null;
  }): Promise<TokenSet>;
  /** renova o access token */
  refresh(input: { refreshToken: string; externalId: string }): Promise<TokenSet>;
  /** busca pedidos em uma janela de tempo */
  fetchOrders(input: {
    accessToken: string;
    externalId: string;
    shopCipher?: string | null;
    from: Date;
    to: Date;
  }): Promise<NormalizedOrder[]>;
  /** busca o catálogo com o estoque atual */
  fetchProducts(input: {
    accessToken: string;
    externalId: string;
    shopCipher?: string | null;
  }): Promise<NormalizedProduct[]>;
  /** grava o novo saldo de estoque no marketplace */
  updateStock(input: {
    accessToken: string;
    externalId: string;
    shopCipher?: string | null;
    productExternalId: string;
    quantity: number;
    meta?: Record<string, unknown> | null;
  }): Promise<void>;
}

export class IntegrationError extends Error {
  constructor(
    public platform: Platform,
    message: string,
    public detail?: unknown,
    /**
     * Código HTTP da resposta, quando houve uma.
     *
     * Fica em campo próprio e não só no texto porque quem decide se vale a pena
     * tentar de novo precisa do número: 503 é a plataforma tropeçando e passa,
     * 401 é autorização revogada e vai falhar igual para sempre. As três
     * plataformas escrevem a mensagem em formatos diferentes, então ler o
     * código de dentro do texto quebraria na primeira mudança de formato.
     */
    public status?: number,
  ) {
    super(`[${platform}] ${message}`);
    this.name = "IntegrationError";
  }
}

/**
 * URL pública da aplicação, usada para montar o `redirect_uri` do OAuth.
 *
 * `APP_URL` manda quando existe, porque o endereço precisa bater EXATAMENTE
 * com o que está cadastrado em cada plataforma. Sem ela, cai no domínio de
 * produção que a própria Vercel injeta — antes o app simplesmente quebrava
 * quando alguém esquecia de configurar a variável.
 *
 * Preferimos `VERCEL_PROJECT_PRODUCTION_URL` a `VERCEL_URL`: esta última muda
 * a cada deploy (inclui um hash), e um redirect_uri diferente do cadastrado é
 * recusado pela plataforma.
 */
export function appUrl(): string {
  const explicita = process.env.APP_URL?.trim();
  if (explicita) return explicita.replace(/\/$/, "");

  const daVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (daVercel) return `https://${daVercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  throw new Error(
    "APP_URL não definida. Configure-a com a URL pública da aplicação " +
      "(ex.: https://goulart.vercel.app) — precisa ser idêntica ao redirect URI " +
      "cadastrado na plataforma.",
  );
}

export function redirectUri(slug: string): string {
  return `${appUrl()}/api/oauth/${slug}/callback`;
}
