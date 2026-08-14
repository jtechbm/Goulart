import { cache } from "react";
import { analyzePrices, type CompetitorProduct, type PriceAnalysis } from "./priceCompare";

/**
 * Busca automática de preços de concorrentes.
 *
 * Mercado Livre usa a API oficial de catálogo: `/products/search` acha os
 * produtos de catálogo pelo título e `/products/{id}/items` devolve todos os
 * vendedores daquele mesmo produto com seus preços. Como a comparação é feita
 * dentro de um produto de catálogo, é sempre o mesmo item na mesma plataforma
 * — não é aproximação por palavra-chave.
 *
 * Shopee e TikTok Shop não têm busca pública equivalente; ver SUPPORTED.
 */

/** Plataformas com busca automática disponível hoje. */
export const SUPPORTED_PLATFORMS = ["MERCADO_LIVRE"] as const;

export function supportsAutoSearch(platform: string): boolean {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(platform);
}

export type MarketSearchResult =
  | { ok: true; analysis: PriceAnalysis }
  | { ok: false; reason: "unsupported" | "no_results" | "error"; message: string };

const API = "https://api.mercadolibre.com";

/** Quantos produtos de catálogo abrir por busca. Cada um custa uma chamada. */
const CATALOG_LIMIT = 8;

/* -------------------------------------------------------------------------- */
/* Token de aplicação                                                          */
/* -------------------------------------------------------------------------- */

let tokenCache: { value: string; expiresAt: number } | null = null;

/**
 * Token de aplicação (client_credentials) — não depende de nenhuma loja estar
 * conectada, porque a consulta é de catálogo público. Vale ~6h; guardamos em
 * memória para não pedir um novo a cada busca.
 */
async function appToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;

  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ML_CLIENT_ID/ML_CLIENT_SECRET não configurados.");
  }

  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Falha ao autenticar no Mercado Livre (HTTP ${res.status}).`);

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Mercado Livre não devolveu access_token.");

  tokenCache = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 21600) * 1000,
  };
  return tokenCache.value;
}

/* -------------------------------------------------------------------------- */
/* Chamadas                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `revalidate` deixa o Next servir a mesma resposta por 1h: abrir a tela de
 * novo não gasta chamada nova, e o preço de concorrente não muda de minuto
 * em minuto.
 */
async function mlGet<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate: 3600 },
  });
  // 404 é esperado: produto de catálogo sem nenhum anúncio ativo
  // ("No winners found"). Não é erro, só não entra na conta.
  if (!res.ok) return null;
  return (await res.json()) as T;
}

type CatalogSearch = { results?: Array<{ id: string; name?: string }> };

type CatalogItems = {
  results?: Array<{
    item_id: string;
    seller_id?: number | string;
    price?: number;
    condition?: string;
    permalink?: string;
  }>;
};

async function searchMercadoLivre(
  title: string,
): Promise<{ ofertas: CompetitorProduct[]; catalogos: number }> {
  const token = await appToken();

  const search = await mlGet<CatalogSearch>(
    `/products/search?site_id=MLB&status=active&q=${encodeURIComponent(title)}`,
    token,
  );

  const produtos = (search?.results ?? []).slice(0, CATALOG_LIMIT);
  if (produtos.length === 0) return { ofertas: [], catalogos: 0 };

  // Em paralelo: são independentes e o gargalo é a latência de rede.
  const lotes = await Promise.all(
    produtos.map(async (p) => {
      const itens = await mlGet<CatalogItems>(`/products/${p.id}/items`, token);
      return (itens?.results ?? [])
        .filter((it) => typeof it.price === "number" && it.price > 0)
        .map<CompetitorProduct>((it) => ({
          externalId: it.item_id,
          shopId: it.seller_id != null ? String(it.seller_id) : null,
          title: p.name ?? title,
          price: it.price as number,
          url: it.permalink ?? `https://produto.mercadolivre.com.br/${it.item_id.replace(/^MLB/, "MLB-")}`,
        }));
    }),
  );

  return { ofertas: lotes.flat(), catalogos: produtos.length };
}

/* -------------------------------------------------------------------------- */
/* Entrada                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Em `cache()` porque a página pode pedir a mesma análise mais de uma vez na
 * mesma renderização (cartões de resumo + lista).
 */
export const searchCompetitors = cache(async function searchCompetitors(
  platform: string,
  title: string,
): Promise<MarketSearchResult> {
  if (!supportsAutoSearch(platform)) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Busca automática ainda não disponível nesta plataforma.",
    };
  }

  try {
    const { ofertas, catalogos } = await searchMercadoLivre(title);
    if (ofertas.length === 0) {
      /**
       * Dois "vazios" bem diferentes, e confundi-los faz o lojista achar que a
       * ferramenta quebrou:
       *
       * - Nenhum produto de catálogo: o título não casou com nada.
       * - Catálogo existe, mas `/products/{id}/items` devolve 404 "No winners
       *   found". Esse endpoint lista só quem disputa a Buy Box de um produto
       *   de catálogo, e em categorias como decoração quase ninguém publica no
       *   catálogo — cada vendedor cria o próprio anúncio. A alternativa seria
       *   `/sites/MLB/search`, que o Mercado Livre restringiu (403).
       */
      return {
        ok: false,
        reason: "no_results",
        message:
          catalogos > 0
            ? `Encontrei ${catalogos} produto(s) de catálogo parecidos, mas nenhum tem anúncios ` +
              "concorrentes ativos. Isso é comum fora de eletrônicos: no Mercado Livre a comparação " +
              "só existe quando os vendedores publicam dentro do mesmo produto de catálogo, e em " +
              "categorias como decoração cada um cria o próprio anúncio."
            : "Nenhum produto de catálogo casou com este título. Tente um nome mais curto e genérico.",
      };
    }
    return { ok: true, analysis: analyzePrices(ofertas) };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
});
