import crypto from "node:crypto";
import {
  IntegrationError,
  type MarketplaceAdapter,
  type NormalizedOrder,
  type NormalizedProduct,
  type TokenSet,
} from "./types";

/**
 * TikTok Shop Partner API (versões 202309+).
 * Docs: https://partner.tiktokshop.com/docv2
 *
 * Assinatura: HMAC-SHA256(app_secret, app_secret + path + <params ordenados
 * concatenados como chave+valor, excluindo sign e access_token> + body + app_secret)
 */

function creds() {
  const appKey = process.env.TIKTOK_APP_KEY;
  const appSecret = process.env.TIKTOK_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new IntegrationError("TIKTOK_SHOP", "TIKTOK_APP_KEY/TIKTOK_APP_SECRET não configurados no .env");
  }
  return {
    appKey,
    appSecret,
    apiHost: process.env.TIKTOK_API_HOST || "https://open-api.tiktokglobalshop.com",
    tokenHost: process.env.TIKTOK_TOKEN_HOST || "https://auth.tiktok-shops.com",
    authHost: process.env.TIKTOK_AUTH_HOST || "https://services.tiktokshop.com",
  };
}

function sign(path: string, params: URLSearchParams, body: string, appSecret: string): string {
  const keys = [...params.keys()].filter((k) => k !== "sign" && k !== "access_token").sort();
  const joined = keys.map((k) => `${k}${params.get(k)}`).join("");
  const base = `${appSecret}${path}${joined}${body}${appSecret}`;
  return crypto.createHmac("sha256", appSecret).update(base).digest("hex");
}

type TTEnvelope<T> = { code?: number; message?: string; data?: T; request_id?: string };

/** Chamada assinada na API principal (open-api), autenticada por loja. */
async function api<T>(
  path: string,
  opts: {
    accessToken: string;
    shopCipher?: string | null;
    method?: "GET" | "POST";
    query?: Record<string, string>;
    body?: unknown;
  },
): Promise<T> {
  const { appKey, appSecret, apiHost } = creds();
  const params = new URLSearchParams({
    app_key: appKey,
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...(opts.query ?? {}),
  });
  if (opts.shopCipher) params.set("shop_cipher", opts.shopCipher);

  const bodyStr = opts.body ? JSON.stringify(opts.body) : "";
  params.set("sign", sign(path, params, bodyStr, appSecret));

  const res = await fetch(`${apiHost}${path}?${params.toString()}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": opts.accessToken,
    },
    body: bodyStr || undefined,
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as TTEnvelope<T>;
  // code 0 = sucesso; qualquer outro é erro de negócio, ainda que HTTP 200
  if (!res.ok || (json.code ?? 0) !== 0) {
    throw new IntegrationError("TIKTOK_SHOP", `${path} falhou: code=${json.code} ${json.message ?? res.status}`, json);
  }
  return json.data as T;
}

/** Endpoints de token ficam em outro host e não usam a assinatura acima. */
async function tokenCall(path: string, query: Record<string, string>): Promise<TokenSet> {
  const { appKey, appSecret, tokenHost } = creds();
  const qs = new URLSearchParams({ app_key: appKey, app_secret: appSecret, ...query });

  const res = await fetch(`${tokenHost}${path}?${qs.toString()}`, {
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as TTEnvelope<Record<string, unknown>>;
  if (!res.ok || (json.code ?? 0) !== 0 || !json.data) {
    throw new IntegrationError("TIKTOK_SHOP", `${path} falhou: ${json.message ?? res.status}`, json);
  }

  const d = json.data;
  const accessToken = String(d.access_token ?? "");
  if (!accessToken) throw new IntegrationError("TIKTOK_SHOP", "resposta sem access_token", json);

  const nowSec = Math.floor(Date.now() / 1000);
  return {
    accessToken,
    refreshToken: d.refresh_token ? String(d.refresh_token) : null,
    // a API devolve o instante absoluto de expiração, não a duração
    expiresIn: Math.max(60, Number(d.access_token_expire_in ?? nowSec + 7 * 24 * 3600) - nowSec),
    refreshExpiresIn: Math.max(60, Number(d.refresh_token_expire_in ?? nowSec + 365 * 24 * 3600) - nowSec),
    externalId: "", // preenchido depois via /authorization/202309/shops
  };
}

type TTShop = { id?: string; name?: string; cipher?: string; region?: string; seller_type?: string };
type TTOrder = {
  id: string;
  status?: string;
  create_time?: number;
  payment?: { currency?: string; total_amount?: string; shipping_fee?: string; original_shipping_fee?: string };
  line_items?: Array<{ id?: string; sale_price?: string; platform_discount?: string }>;
  buyer_email?: string;
  user_id?: string;
};

export const tiktokShop: MarketplaceAdapter = {
  platform: "TIKTOK_SHOP",

  isConfigured() {
    return Boolean(process.env.TIKTOK_APP_KEY && process.env.TIKTOK_APP_SECRET && process.env.TIKTOK_SERVICE_ID);
  },

  buildAuthUrl({ state }) {
    const { authHost } = creds();
    const serviceId = process.env.TIKTOK_SERVICE_ID;
    if (!serviceId) {
      throw new IntegrationError("TIKTOK_SHOP", "TIKTOK_SERVICE_ID não configurado no .env");
    }
    // O redirect é o "Callback URL" cadastrado no app do Partner Center,
    // por isso não vai na query — só o state.
    const qs = new URLSearchParams({ service_id: serviceId, state });
    return `${authHost}/open/authorize?${qs.toString()}`;
  },

  async exchangeCode({ params }) {
    const code = params.get("code") ?? params.get("auth_code");
    if (!code) {
      throw new IntegrationError("TIKTOK_SHOP", "callback sem `code`/`auth_code`", Object.fromEntries(params));
    }

    const tokens = await tokenCall("/api/v2/token/get", {
      auth_code: code,
      grant_type: "authorized_code",
    });

    // Descobre a loja autorizada e o cipher exigido nas demais chamadas.
    const data = await api<{ shops?: TTShop[] }>("/authorization/202309/shops", {
      accessToken: tokens.accessToken,
    });
    const shop = data.shops?.[0];
    if (!shop?.id) {
      throw new IntegrationError("TIKTOK_SHOP", "nenhuma loja retornada em /authorization/202309/shops", data);
    }

    tokens.externalId = String(shop.id);
    tokens.shopName = shop.name ?? `Loja ${shop.id}`;
    tokens.shopCipher = shop.cipher;
    tokens.region = shop.region;
    return tokens;
  },

  async refresh({ refreshToken, externalId }) {
    const tokens = await tokenCall("/api/v2/token/refresh", {
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    tokens.externalId = externalId;

    // o cipher pode mudar; revalida sempre que renovar
    try {
      const data = await api<{ shops?: TTShop[] }>("/authorization/202309/shops", {
        accessToken: tokens.accessToken,
      });
      const shop = data.shops?.find((s) => String(s.id) === externalId) ?? data.shops?.[0];
      if (shop?.cipher) tokens.shopCipher = shop.cipher;
    } catch {
      // mantém o cipher atual se a consulta falhar
    }

    return tokens;
  },

  async fetchOrders({ accessToken, shopCipher, from, to }) {
    const path = "/order/202309/orders/search";
    const out: NormalizedOrder[] = [];
    let pageToken = "";

    for (let page = 0; page < 100; page++) {
      const query: Record<string, string> = { page_size: "50", sort_field: "create_time", sort_order: "DESC" };
      if (pageToken) query.page_token = pageToken;

      const data = await api<{ orders?: TTOrder[]; next_page_token?: string; total_count?: number }>(path, {
        accessToken,
        shopCipher,
        method: "POST",
        query,
        body: {
          create_time_ge: Math.floor(from.getTime() / 1000),
          create_time_lt: Math.floor(to.getTime() / 1000),
        },
      });

      const orders = data.orders ?? [];
      for (const o of orders) {
        const p = o.payment ?? {};
        out.push({
          externalId: String(o.id),
          status: String(o.status ?? "unknown"),
          currency: p.currency ?? "BRL",
          gross: Number(p.total_amount ?? 0),
          fees: 0, // comissão vem de /finance/202309/statements
          shipping: Number(p.shipping_fee ?? p.original_shipping_fee ?? 0),
          itemsCount: (o.line_items ?? []).length,
          buyerRef: o.buyer_email ?? o.user_id ?? null,
          placedAt: new Date(Number(o.create_time ?? 0) * 1000),
          raw: o,
        });
      }

      if (!data.next_page_token || orders.length === 0) break;
      pageToken = data.next_page_token;
    }

    return out;
  },

  async fetchProducts({ accessToken, shopCipher }) {
    const path = "/product/202309/products/search";
    const out: NormalizedProduct[] = [];
    let pageToken = "";

    for (let page = 0; page < 100; page++) {
      const query: Record<string, string> = { page_size: "100" };
      if (pageToken) query.page_token = pageToken;

      const data = await api<{ products?: TTProduct[]; next_page_token?: string }>(path, {
        accessToken,
        shopCipher,
        method: "POST",
        query,
        body: { status: "ACTIVATE" },
      });

      const products = data.products ?? [];
      for (const p of products) {
        // um produto tem N SKUs; o estoque do anúncio é a soma deles
        const skus = p.skus ?? [];
        const stock = skus.reduce(
          (s, sku) => s + (sku.inventory ?? []).reduce((n, i) => n + Number(i.quantity ?? 0), 0),
          0,
        );
        const price = Number(skus[0]?.price?.sale_price ?? 0);

        out.push({
          externalId: String(p.id),
          sku: skus[0]?.seller_sku ?? null,
          title: p.title ?? "(sem título)",
          price,
          currency: skus[0]?.price?.currency ?? "BRL",
          stock,
          status: String(p.status ?? "unknown").toLowerCase(),
          imageUrl: p.main_images?.[0]?.uri ?? null,
          permalink: null,
          soldCount: 0, // não vem no search de produtos
          // a escrita de estoque exige sku_id + warehouse_id, que só vêm aqui
          meta: {
            skus: skus.map((s) => ({
              id: s.id,
              warehouses: (s.inventory ?? []).map((i) => i.warehouse_id).filter(Boolean),
            })),
          },
        });
      }

      if (!data.next_page_token || products.length === 0) break;
      pageToken = data.next_page_token;
    }

    return out;
  },

  async updateStock({ accessToken, shopCipher, productExternalId, quantity, meta }) {
    const skus = (meta?.skus as Array<{ id?: string; warehouses?: string[] }> | undefined) ?? [];

    if (skus.length > 1) {
      throw new IntegrationError(
        "TIKTOK_SHOP",
        `produto ${productExternalId} tem ${skus.length} SKUs — ajuste o estoque por SKU no Seller Center`,
      );
    }

    const sku = skus[0];
    if (!sku?.id || !sku.warehouses?.length) {
      throw new IntegrationError(
        "TIKTOK_SHOP",
        `produto ${productExternalId} sem sku_id/warehouse_id conhecidos — rode o sync antes de ajustar o estoque`,
      );
    }

    await api(`/product/202309/products/${productExternalId}/inventory/update`, {
      accessToken,
      shopCipher,
      method: "POST",
      body: {
        skus: [
          {
            id: sku.id,
            inventory: sku.warehouses.map((warehouseId) => ({
              warehouse_id: warehouseId,
              quantity,
            })),
          },
        ],
      },
    });
  },
};

type TTProduct = {
  id: string;
  title?: string;
  status?: string;
  main_images?: Array<{ uri?: string }>;
  skus?: Array<{
    id?: string;
    seller_sku?: string;
    price?: { sale_price?: string; currency?: string };
    inventory?: Array<{ quantity?: number; warehouse_id?: string }>;
  }>;
};
