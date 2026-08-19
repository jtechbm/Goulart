import {
  IntegrationError,
  redirectUri,
  type MarketplaceAdapter,
  type NormalizedOrder,
  type NormalizedProduct,
  type TokenSet,
} from "./types";

/**
 * Mercado Livre — OAuth 2.0 com PKCE (obrigatório desde 2024).
 * Docs: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao
 *
 * Atenção: o redirect_uri cadastrado no DevCenter precisa ser HTTPS.
 * Em dev, use um túnel (cloudflared/ngrok) e aponte APP_URL pra ele.
 */

const API = "https://api.mercadolibre.com";
const SLUG = "mercadolivre";

function creds() {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new IntegrationError("MERCADO_LIVRE", "ML_CLIENT_ID/ML_CLIENT_SECRET não configurados no .env");
  }
  return { clientId, clientSecret };
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new IntegrationError("MERCADO_LIVRE", `falha ao obter token (HTTP ${res.status})`, json, res.status);
  }

  const accessToken = String(json.access_token ?? "");
  const userId = json.user_id != null ? String(json.user_id) : "";
  if (!accessToken || !userId) {
    throw new IntegrationError("MERCADO_LIVRE", "resposta de token sem access_token/user_id", json);
  }

  return {
    accessToken,
    refreshToken: json.refresh_token ? String(json.refresh_token) : null,
    expiresIn: Number(json.expires_in ?? 21600),
    // refresh token do ML vale 6 meses
    refreshExpiresIn: 60 * 60 * 24 * 180,
    externalId: userId,
  };
}

async function api<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new IntegrationError("MERCADO_LIVRE", `GET ${path} falhou (HTTP ${res.status})`, json, res.status);
  }
  return json as T;
}

type MLOrder = {
  id: number | string;
  status: string;
  currency_id?: string;
  total_amount?: number;
  paid_amount?: number;
  date_created: string;
  buyer?: { id?: number | string; nickname?: string };
  payments?: Array<{ shipping_cost?: number; marketplace_fee?: number }>;
  order_items?: Array<{ quantity?: number; sale_fee?: number }>;
};

export const mercadoLivre: MarketplaceAdapter = {
  platform: "MERCADO_LIVRE",

  isConfigured() {
    return Boolean(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET);
  },

  buildAuthUrl({ state, challenge }) {
    const { clientId } = creds();
    if (!challenge) {
      throw new IntegrationError("MERCADO_LIVRE", "PKCE code_challenge ausente");
    }
    const domain = process.env.ML_AUTH_DOMAIN || "https://auth.mercadolivre.com.br";
    const qs = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri(SLUG),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `${domain}/authorization?${qs.toString()}`;
  },

  async exchangeCode({ params, verifier }) {
    const { clientId, clientSecret } = creds();
    const code = params.get("code");
    if (!code) {
      throw new IntegrationError("MERCADO_LIVRE", "callback sem parâmetro `code`", Object.fromEntries(params));
    }
    if (!verifier) {
      throw new IntegrationError("MERCADO_LIVRE", "code_verifier não encontrado para este state");
    }

    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri(SLUG),
      code_verifier: verifier,
    });

    // nome da loja pra exibir no painel
    try {
      const me = await api<{ nickname?: string; site_id?: string }>("/users/me", tokens.accessToken);
      tokens.shopName = me.nickname ?? `Conta ${tokens.externalId}`;
      tokens.region = me.site_id ?? "MLB";
    } catch {
      tokens.shopName = `Conta ${tokens.externalId}`;
    }

    return tokens;
  },

  async refresh({ refreshToken }) {
    const { clientId, clientSecret } = creds();
    return tokenRequest({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });
  },

  async fetchOrders({ accessToken, externalId, from, to }) {
    const out: NormalizedOrder[] = [];
    const limit = 50;
    let offset = 0;

    // /orders/search pagina em blocos de 50 e cobre no máximo ~1 ano por janela
    for (let page = 0; page < 40; page++) {
      const qs = new URLSearchParams({
        seller: externalId,
        "order.date_created.from": from.toISOString(),
        "order.date_created.to": to.toISOString(),
        sort: "date_desc",
        limit: String(limit),
        offset: String(offset),
      });

      const data = await api<{ results?: MLOrder[]; paging?: { total?: number } }>(
        `/orders/search?${qs.toString()}`,
        accessToken,
      );
      const results = data.results ?? [];

      for (const o of results) {
        const gross = Number(o.total_amount ?? o.paid_amount ?? 0);
        const shipping = (o.payments ?? []).reduce((s, p) => s + Number(p.shipping_cost ?? 0), 0);
        const fees = (o.order_items ?? []).reduce((s, i) => s + Number(i.sale_fee ?? 0), 0);
        const itemsCount = (o.order_items ?? []).reduce((s, i) => s + Number(i.quantity ?? 0), 0);

        out.push({
          externalId: String(o.id),
          status: String(o.status ?? "unknown"),
          currency: o.currency_id ?? "BRL",
          gross,
          fees,
          shipping,
          itemsCount,
          buyerRef: o.buyer?.nickname ?? (o.buyer?.id != null ? String(o.buyer.id) : null),
          placedAt: new Date(o.date_created),
          raw: o,
        });
      }

      offset += limit;
      const total = data.paging?.total ?? 0;
      if (results.length < limit || offset >= total) break;
    }

    return out;
  },

  async fetchProducts({ accessToken, externalId }) {
    const out: NormalizedProduct[] = [];
    // scan_id é o único jeito de paginar além de 1000 anúncios
    let scrollId: string | null = null;

    for (let page = 0; page < 100; page++) {
      const qs = new URLSearchParams({ search_type: "scan", limit: "100" });
      if (scrollId) qs.set("scroll_id", scrollId);

      const search: { results?: string[]; scroll_id?: string } = await api(
        `/users/${externalId}/items/search?${qs.toString()}`,
        accessToken,
      );
      const ids = search.results ?? [];
      if (ids.length === 0) break;

      // multiget aceita 20 ids por chamada
      for (let i = 0; i < ids.length; i += 20) {
        const chunk = ids.slice(i, i + 20);
        const fields =
          "id,title,price,currency_id,available_quantity,status,thumbnail,permalink,sold_quantity,seller_custom_field,variations";
        const items = await api<Array<{ code: number; body?: MLItem }>>(
          `/items?ids=${chunk.join(",")}&attributes=${fields}`,
          accessToken,
        );

        for (const entry of items) {
          const it = entry.body;
          if (entry.code !== 200 || !it) continue;
          out.push({
            externalId: String(it.id),
            sku: it.seller_custom_field ?? null,
            title: it.title ?? "(sem título)",
            price: Number(it.price ?? 0),
            currency: it.currency_id ?? "BRL",
            stock: Number(it.available_quantity ?? 0),
            status: String(it.status ?? "unknown"),
            imageUrl: it.thumbnail ?? null,
            permalink: it.permalink ?? null,
            soldCount: Number(it.sold_quantity ?? 0),
            meta: { variations: (it.variations ?? []).map((v) => String(v.id)) },
          });
        }
      }

      if (!search.scroll_id) break;
      scrollId = search.scroll_id;
    }

    return out;
  },

  async updateStock({ accessToken, productExternalId, quantity, meta }) {
    // Anúncio com variações: o estoque mora em cada variação, não no item.
    const variations = (meta?.variations as string[] | undefined) ?? [];
    if (variations.length > 1) {
      throw new IntegrationError(
        "MERCADO_LIVRE",
        `anúncio ${productExternalId} tem ${variations.length} variações — ajuste o estoque por variação no painel do Mercado Livre`,
      );
    }

    const body =
      variations.length === 1
        ? { variations: [{ id: variations[0], available_quantity: quantity }] }
        : { available_quantity: quantity };

    const res = await fetch(`${API}/items/${productExternalId}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new IntegrationError("MERCADO_LIVRE", `falha ao atualizar estoque (HTTP ${res.status})`, json, res.status);
    }
  },
};

type MLItem = {
  id: string;
  title?: string;
  price?: number;
  currency_id?: string;
  available_quantity?: number;
  status?: string;
  thumbnail?: string;
  permalink?: string;
  sold_quantity?: number;
  seller_custom_field?: string;
  variations?: Array<{ id: string | number }>;
};
