import { hmacHex } from "../crypto";
import {
  IntegrationError,
  redirectUri,
  type MarketplaceAdapter,
  type NormalizedOrder,
  type NormalizedProduct,
  type TokenSet,
} from "./types";

/**
 * Shopee Open Platform API v2.
 * Docs: https://open.shopee.com/developer-guide/20
 *
 * Toda chamada é assinada com HMAC-SHA256(partner_key, base_string), e a
 * base_string muda conforme o tipo de endpoint:
 *   - público (auth):  partner_id + path + timestamp
 *   - por loja (shop): partner_id + path + timestamp + access_token + shop_id
 */

const SLUG = "shopee";

function creds() {
  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  if (!partnerId || !partnerKey) {
    throw new IntegrationError("SHOPEE", "SHOPEE_PARTNER_ID/SHOPEE_PARTNER_KEY não configurados no .env");
  }
  return { partnerId, partnerKey, host: process.env.SHOPEE_HOST || "https://partner.shopeemobile.com" };
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/** Monta a querystring assinada de um endpoint público (fluxo de auth). */
function publicQuery(path: string) {
  const { partnerId, partnerKey } = creds();
  const timestamp = nowSeconds();
  const sign = hmacHex(partnerKey, `${partnerId}${path}${timestamp}`);
  return new URLSearchParams({ partner_id: partnerId, timestamp: String(timestamp), sign });
}

/** Monta a querystring assinada de um endpoint por loja. */
function shopQuery(path: string, accessToken: string, shopId: string) {
  const { partnerId, partnerKey } = creds();
  const timestamp = nowSeconds();
  const sign = hmacHex(partnerKey, `${partnerId}${path}${timestamp}${accessToken}${shopId}`);
  return new URLSearchParams({
    partner_id: partnerId,
    timestamp: String(timestamp),
    sign,
    access_token: accessToken,
    shop_id: shopId,
  });
}

type ShopeeEnvelope = { error?: string; message?: string; request_id?: string } & Record<string, unknown>;

async function call<T extends ShopeeEnvelope>(
  path: string,
  query: URLSearchParams,
  body?: unknown,
): Promise<T> {
  const { host } = creds();
  const url = `${host}${path}?${query.toString()}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as T;
  // A Shopee devolve HTTP 200 mesmo em erro de negócio: o campo `error` é a fonte da verdade.
  if (!res.ok || (json.error && json.error !== "")) {
    throw new IntegrationError("SHOPEE", `${path} falhou: ${json.error || res.status} ${json.message ?? ""}`, json, res.status);
  }
  return json;
}

type ShopeeOrder = {
  order_sn: string;
  order_status?: string;
  currency?: string;
  total_amount?: number;
  create_time?: number;
  buyer_username?: string;
  estimated_shipping_fee?: number;
  actual_shipping_fee?: number;
  item_list?: Array<{ model_quantity_purchased?: number }>;
};

export const shopee: MarketplaceAdapter = {
  platform: "SHOPEE",

  isConfigured() {
    return Boolean(process.env.SHOPEE_PARTNER_ID && process.env.SHOPEE_PARTNER_KEY);
  },

  buildAuthUrl({ state }) {
    const { host } = creds();
    const path = "/api/v2/shop/auth_partner";
    const q = publicQuery(path);
    // A Shopee só devolve o `state` se ele viajar dentro da URL de redirect.
    const redirect = new URL(redirectUri(SLUG));
    redirect.searchParams.set("state", state);
    q.set("redirect", redirect.toString());
    return `${host}${path}?${q.toString()}`;
  },

  async exchangeCode({ params }) {
    const { partnerId } = creds();
    const code = params.get("code");
    const shopId = params.get("shop_id");
    if (!code || !shopId) {
      throw new IntegrationError("SHOPEE", "callback sem `code`/`shop_id`", Object.fromEntries(params));
    }

    const path = "/api/v2/auth/token/get";
    const json = await call(path, publicQuery(path), {
      code,
      shop_id: Number(shopId),
      partner_id: Number(partnerId),
    });

    const accessToken = String(json.access_token ?? "");
    if (!accessToken) {
      throw new IntegrationError("SHOPEE", "resposta sem access_token", json);
    }

    const tokens: TokenSet = {
      accessToken,
      refreshToken: json.refresh_token ? String(json.refresh_token) : null,
      expiresIn: Number(json.expire_in ?? 14400),
      // refresh token da Shopee vale 30 dias
      refreshExpiresIn: 60 * 60 * 24 * 30,
      externalId: String(shopId),
      shopName: `Loja ${shopId}`,
    };

    try {
      const infoPath = "/api/v2/shop/get_shop_info";
      const info = await call(infoPath, shopQuery(infoPath, accessToken, String(shopId)));
      if (info.shop_name) tokens.shopName = String(info.shop_name);
      if (info.region) tokens.region = String(info.region);
    } catch {
      // nome é cosmético — não vale derrubar a conexão por causa disso
    }

    return tokens;
  },

  async refresh({ refreshToken, externalId }) {
    const { partnerId } = creds();
    const path = "/api/v2/auth/access_token/get";
    const json = await call(path, publicQuery(path), {
      refresh_token: refreshToken,
      shop_id: Number(externalId),
      partner_id: Number(partnerId),
    });

    return {
      accessToken: String(json.access_token ?? ""),
      refreshToken: json.refresh_token ? String(json.refresh_token) : refreshToken,
      expiresIn: Number(json.expire_in ?? 14400),
      refreshExpiresIn: 60 * 60 * 24 * 30,
      externalId,
    };
  },

  async fetchOrders({ accessToken, externalId, from, to }) {
    const listPath = "/api/v2/order/get_order_list";
    const detailPath = "/api/v2/order/get_order_detail";
    const out: NormalizedOrder[] = [];

    // A Shopee limita cada consulta a uma janela de 15 dias.
    const WINDOW = 15 * 24 * 60 * 60;
    const fromSec = Math.floor(from.getTime() / 1000);
    const toSec = Math.floor(to.getTime() / 1000);

    for (let start = fromSec; start < toSec; start += WINDOW) {
      const end = Math.min(start + WINDOW, toSec);
      let cursor = "";

      for (let page = 0; page < 50; page++) {
        const q = shopQuery(listPath, accessToken, externalId);
        q.set("time_range_field", "create_time");
        q.set("time_from", String(start));
        q.set("time_to", String(end));
        q.set("page_size", "100");
        if (cursor) q.set("cursor", cursor);

        const list = await call(listPath, q);
        const response = (list.response ?? {}) as {
          order_list?: Array<{ order_sn: string }>;
          next_cursor?: string;
          more?: boolean;
        };
        const sns = (response.order_list ?? []).map((o) => o.order_sn);
        if (sns.length === 0) break;

        // detalhes vêm em lotes de até 50 order_sn
        for (let i = 0; i < sns.length; i += 50) {
          const chunk = sns.slice(i, i + 50);
          const dq = shopQuery(detailPath, accessToken, externalId);
          dq.set("order_sn_list", chunk.join(","));
          dq.set(
            "response_optional_fields",
            "total_amount,buyer_username,item_list,actual_shipping_fee,estimated_shipping_fee,order_status,currency",
          );

          const detail = await call(detailPath, dq);
          const orders = ((detail.response ?? {}) as { order_list?: ShopeeOrder[] }).order_list ?? [];

          for (const o of orders) {
            out.push({
              externalId: o.order_sn,
              status: String(o.order_status ?? "unknown"),
              currency: o.currency ?? "BRL",
              gross: Number(o.total_amount ?? 0),
              fees: 0, // comissão vem do relatório de escrow (/payment/get_escrow_detail)
              shipping: Number(o.actual_shipping_fee ?? o.estimated_shipping_fee ?? 0),
              itemsCount: (o.item_list ?? []).reduce((s, i) => s + Number(i.model_quantity_purchased ?? 0), 0),
              buyerRef: o.buyer_username ?? null,
              placedAt: new Date(Number(o.create_time ?? start) * 1000),
              raw: o,
            });
          }
        }

        if (!response.more || !response.next_cursor) break;
        cursor = response.next_cursor;
      }
    }

    return out;
  },

  async fetchProducts({ accessToken, externalId }) {
    const listPath = "/api/v2/product/get_item_list";
    const infoPath = "/api/v2/product/get_item_base_info";
    const out: NormalizedProduct[] = [];
    let offset = 0;

    for (let page = 0; page < 100; page++) {
      const q = shopQuery(listPath, accessToken, externalId);
      q.set("offset", String(offset));
      q.set("page_size", "100");
      // sem esse filtro a Shopee devolve lista vazia
      q.set("item_status", "NORMAL");

      const list = await call(listPath, q);
      const response = (list.response ?? {}) as {
        item?: Array<{ item_id: number }>;
        has_next_page?: boolean;
        next_offset?: number;
      };
      const ids = (response.item ?? []).map((i) => i.item_id);
      if (ids.length === 0) break;

      // base_info aceita até 50 ids por chamada
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const iq = shopQuery(infoPath, accessToken, externalId);
        iq.set("item_id_list", chunk.join(","));

        const info = await call(infoPath, iq);
        const items = ((info.response ?? {}) as { item_list?: ShopeeItem[] }).item_list ?? [];

        for (const it of items) {
          // o estoque fica no modelo; somamos os seller_stock dos modelos
          const stock =
            it.stock_info_v2?.summary_info?.total_available_stock ??
            (it.stock_info_v2?.seller_stock ?? []).reduce((s, m) => s + Number(m.stock ?? 0), 0);

          out.push({
            externalId: String(it.item_id),
            sku: it.item_sku || null,
            title: it.item_name ?? "(sem título)",
            price: Number(it.price_info?.[0]?.current_price ?? 0),
            currency: it.price_info?.[0]?.currency ?? "BRL",
            stock: Number(stock ?? 0),
            status: String(it.item_status ?? "unknown").toLowerCase(),
            imageUrl: it.image?.image_url_list?.[0] ?? null,
            permalink: null,
            soldCount: Number(it.sold ?? 0),
          });
        }
      }

      if (!response.has_next_page) break;
      offset = response.next_offset ?? offset + ids.length;
    }

    return out;
  },

  async updateStock({ accessToken, externalId, productExternalId, quantity }) {
    // O model_id não vem no base_info — precisa da consulta dedicada.
    const modelPath = "/api/v2/product/get_model_list";
    const mq = shopQuery(modelPath, accessToken, externalId);
    mq.set("item_id", String(productExternalId));

    const modelRes = await call(modelPath, mq);
    const models = ((modelRes.response ?? {}) as { model?: Array<{ model_id: number }> }).model ?? [];

    if (models.length > 1) {
      throw new IntegrationError(
        "SHOPEE",
        `item ${productExternalId} tem ${models.length} variações — ajuste o estoque por variação no Seller Center`,
      );
    }

    // model_id 0 = item sem variação
    const modelId = models[0]?.model_id ?? 0;

    const path = "/api/v2/product/update_stock";
    await call(path, shopQuery(path, accessToken, externalId), {
      item_id: Number(productExternalId),
      stock_list: [{ model_id: modelId, seller_stock: [{ stock: quantity }] }],
    });
  },
};

type ShopeeItem = {
  item_id: number;
  item_name?: string;
  item_sku?: string;
  item_status?: string;
  sold?: number;
  image?: { image_url_list?: string[] };
  price_info?: Array<{ current_price?: number; currency?: string }>;
  stock_info_v2?: {
    summary_info?: { total_available_stock?: number };
    seller_stock?: Array<{ stock?: number }>;
  };
};
