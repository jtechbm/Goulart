import OpenAI from "openai";
import { cache } from "react";
import type { CompetitorProduct } from "./priceCompare";

/**
 * Busca de preços de concorrentes na Shopee e no TikTok Shop.
 *
 * Nenhuma das duas expõe API pública de busca no marketplace — as APIs delas
 * cobrem apenas a própria loja do vendedor autenticado. O que existe é o
 * conteúdo indexado na web, e ele é sujo de um jeito específico: **o frete
 * aparece no mesmo formato do preço**. Um trecho como "Frete grátis R$8,39"
 * seria lido por qualquer extrator por expressão regular como um cabo de
 * R$ 8,39, quando o produto custa R$ 56,99.
 *
 * Distinguir os dois é leitura de contexto, não casamento de padrão — por isso
 * aqui é um modelo de linguagem com busca web em vez de um parser. Ainda assim
 * o resultado é ESTIMATIVA, e a tela precisa rotular como tal: diferente do
 * Mercado Livre, onde o preço vem da API oficial e é exato.
 */

export const AI_SEARCH_PLATFORMS = ["SHOPEE", "TIKTOK_SHOP"] as const;

/**
 * Teto de anúncios gravados por busca. Existe como rede de segurança: num
 * teste com gpt-4.1 o modelo entrou em repetição e devolveu 199 entradas —
 * os mesmos 10 anúncios vinte vezes. Para a mediana, uma dúzia de anúncios
 * distintos já basta.
 */
const MAX_ANUNCIOS = 12;

export function supportsAiSearch(platform: string): boolean {
  return (AI_SEARCH_PLATFORMS as readonly string[]).includes(platform);
}

const PLATAFORMA: Record<string, { nome: string; site: string }> = {
  SHOPEE: { nome: "Shopee Brasil", site: "shopee.com.br" },
  TIKTOK_SHOP: { nome: "TikTok Shop Brasil", site: "tiktok.com" },
};

export type AiSearchResult =
  | { ok: true; produtos: CompetitorProduct[]; observacao: string | null }
  | {
      ok: false;
      motivo: "unsupported" | "sem_credencial" | "sem_resultado" | "erro";
      mensagem: string;
    };

/* -------------------------------------------------------------------------- */
/* Esquema da resposta                                                         */
/* -------------------------------------------------------------------------- */

/**
 * `strict: true` obriga o modelo a devolver exatamente esta forma, em vez de
 * prosa que eu teria de interpretar.
 *
 * `trecho_origem` é a defesa contra alucinação: o modelo precisa colar o texto
 * de onde tirou o preço, e o código confere que o número aparece nele. Sem
 * isso, um valor inventado entraria na média sem deixar rastro.
 */
const ESQUEMA = {
  type: "object",
  properties: {
    anuncios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título do anúncio concorrente." },
          vendedor: { type: "string", description: "Nome da loja. String vazia se não identificado." },
          preco: { type: "number", description: "Preço de VENDA do produto em reais. Nunca o frete." },
          url: { type: "string", description: "URL do anúncio. String vazia se não houver." },
          trecho_origem: {
            type: "string",
            description: "Trecho literal da página contendo o valor lido. Obrigatório.",
          },
        },
        required: ["titulo", "vendedor", "preco", "url", "trecho_origem"],
        additionalProperties: false,
      },
    },
    observacao: {
      type: "string",
      description: "Ressalva relevante (ex.: variantes com preços distintos). Vazia se não houver.",
    },
  },
  required: ["anuncios", "observacao"],
  additionalProperties: false,
} as const;

function montarPergunta(nome: string, site: string, titulo: string): string {
  return `Busque em ${nome} (${site}) anúncios do produto: "${titulo}".

Extraia os preços de VENDA dos concorrentes.

Regra que mais importa: FRETE NÃO É PREÇO. Trechos como "Frete grátis R$8,39",
"Frete R$ 12,90" ou um "R$ 0,00" de entrega são custo de envio — ignore-os.

Descarte também:
- Páginas de categoria ou de busca (várias ofertas numa listagem só), porque não
  dá para atribuir o preço a um anúncio específico.
- Anúncios que claramente não são o mesmo produto procurado.
- Qualquer preço que você não consiga localizar literalmente no texto da página.

Se um anúncio tiver variantes com preços diferentes (por exemplo 1m/2m/3m) e não
der para saber qual corresponde ao produto procurado, registre isso na observação
em vez de escolher no chute.

Preencha o campo "url" de cada anúncio com o endereço da página do produto.
Prefira poucos resultados confiáveis a muitos duvidosos; se nada for confiável,
devolva a lista vazia.`;
}

/* -------------------------------------------------------------------------- */
/* Chamada                                                                     */
/* -------------------------------------------------------------------------- */

let cliente: OpenAI | null = null;

function getCliente(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  cliente ??= new OpenAI();
  return cliente;
}

/**
 * Confere que o preço aparece no trecho citado. É esta função que impede um
 * número inventado de entrar na conta — sem ela, todo o resto é fé.
 */
export function precoConfere(preco: number, trecho: string): boolean {
  if (!trecho) return false;
  const numeros = trecho.match(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2}|\d+/g) ?? [];
  return numeros.some((n) => {
    const v = Number(n.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(v) && Math.abs(v - preco) < 0.011; // tolera arredondamento
  });
}

type Anuncio = {
  titulo?: string;
  vendedor?: string;
  preco?: number;
  url?: string;
  trecho_origem?: string;
};

/**
 * Em `cache()` porque a página pode pedir a mesma análise mais de uma vez na
 * mesma renderização — e cada chamada aqui custa dinheiro.
 */
export const searchWithAi = cache(async function searchWithAi(
  platform: string,
  titulo: string,
): Promise<AiSearchResult> {
  if (!supportsAiSearch(platform)) {
    return { ok: false, motivo: "unsupported", mensagem: "Plataforma não atendida por esta busca." };
  }

  const client = getCliente();
  if (!client) {
    return { ok: false, motivo: "sem_credencial", mensagem: "OPENAI_API_KEY não configurada." };
  }

  const { nome, site } = PLATAFORMA[platform];

  try {
    const resposta = await client.responses.create({
      model: "gpt-5",
      // Esforço baixo de propósito: medido em 26s contra 89s no médio, com a
      // mesma taxa de acerto (todos os preços conferiram com a fonte nos dois).
      // O médio estoura o teto de 60s da função na Vercel.
      reasoning: { effort: "low" },
      tools: [{ type: "web_search" }],
      input: montarPergunta(nome, site, titulo),
      text: {
        format: {
          type: "json_schema",
          name: "anuncios_concorrentes",
          strict: true,
          schema: ESQUEMA as unknown as Record<string, unknown>,
        },
      },
    });

    const texto = resposta.output_text;
    if (!texto) {
      return { ok: false, motivo: "sem_resultado", mensagem: "Resposta sem conteúdo utilizável." };
    }

    const dados = JSON.parse(texto) as { anuncios?: Anuncio[]; observacao?: string };

    const produtos: CompetitorProduct[] = [];
    const vistos = new Set<string>();
    let descartados = 0;
    let repetidos = 0;

    for (const [i, a] of (dados.anuncios ?? []).entries()) {
      if (produtos.length >= MAX_ANUNCIOS) break;

      const preco = Number(a.preco);
      if (!Number.isFinite(preco) || preco <= 0) continue;
      if (!precoConfere(preco, a.trecho_origem ?? "")) {
        descartados++;
        continue;
      }

      // Um modelo pode entrar em repetição e devolver o mesmo anúncio dezenas
      // de vezes (visto com gpt-4.1 neste mesmo esquema). Sem esta guarda, a
      // repetição entraria no banco e enviesaria a mediana.
      const chave = `${a.url?.trim() || ""}|${a.titulo?.trim() ?? ""}|${preco}`;
      if (vistos.has(chave)) {
        repetidos++;
        continue;
      }
      vistos.add(chave);

      produtos.push({
        externalId: `ai-${platform}-${i}`,
        shopId: a.vendedor?.trim() || null,
        title: a.titulo?.trim() || titulo,
        price: preco,
        url: a.url?.trim() || null,
        sourceExcerpt: a.trecho_origem?.trim() || null,
      });
    }

    if (produtos.length === 0) {
      return {
        ok: false,
        motivo: "sem_resultado",
        mensagem:
          descartados > 0
            ? `Nenhum preço confiável — ${descartados} descartado(s) por não conferir com a fonte citada.`
            : "Nenhum anúncio concorrente encontrado para este título.",
      };
    }

    const notas = [
      dados.observacao?.trim(),
      descartados > 0 ? `${descartados} resultado(s) descartado(s) por não conferir com a fonte.` : "",
      repetidos > 0 ? `${repetidos} repetido(s) ignorado(s).` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return { ok: true, produtos, observacao: notas || null };
  } catch (err) {
    return { ok: false, motivo: "erro", mensagem: err instanceof Error ? err.message : String(err) };
  }
});
