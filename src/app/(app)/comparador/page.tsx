import { ExternalLink, Search, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { BuscarPrecosBotao } from "@/components/BuscarPrecosBotao";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Delta, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { supportsAiSearch } from "@/lib/aiMarketSearch";
import { requireRecurso } from "@/lib/planGuard";
import { prisma } from "@/lib/db";
import { brl, relative, variation } from "@/lib/format";
import { searchCompetitors, supportsAutoSearch } from "@/lib/marketSearch";
import { analyzePrices, type CompetitorProduct } from "@/lib/priceCompare";

export const dynamic = "force-dynamic";

/**
 * A busca na Shopee/TikTok leva ~30–40s. O teto padrão da função na Vercel é
 * de 10s, o que cortaria a busca no meio em produção.
 */
export const maxDuration = 60;

/**
 * Escolha um dos seus produtos e o sistema busca sozinho os concorrentes do
 * MESMO produto na MESMA plataforma, mostrando a régua de preços. Nada é
 * digitado à mão.
 */

export default async function ComparadorPage({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string }>;
}) {
  // Tela do plano Pro: a trava é aqui, no servidor. Esconder o item do
  // menu é conveniência visual, nunca controle de acesso — a URL é pública.
  const { user } = await requireRecurso("comparador");
  const sp = await searchParams;
  const productId = sp.produto ?? "";

  const [products, product] = await Promise.all([
    prisma.product.findMany({
      where: { account: { clientId: user.clientId } },
      include: { account: { select: { shopName: true, platform: true } } },
      orderBy: { title: "asc" },
      take: 500,
    }),
    // O escopo entra na própria consulta: trocar o id na URL não alcança
    // produto de outro lojista.
    productId
      ? prisma.product.findFirst({
          where: { id: productId, account: { clientId: user.clientId } },
          include: { account: { select: { shopName: true, platform: true } } },
        })
      : Promise.resolve(null),
  ]);

  const plataforma = product?.account.platform ?? "";
  const viaApi = Boolean(product) && supportsAutoSearch(plataforma);
  const viaIa = Boolean(product) && supportsAiSearch(plataforma);

  // Mercado Livre: consulta a API oficial na hora — é rápido e o preço é exato.
  const resultado = viaApi ? await searchCompetitors(plataforma, product!.title) : null;

  // Shopee/TikTok: lê o que já foi gravado. A busca leva ~26s e custa dinheiro,
  // então roda por ação explícita do Kadu, nunca ao abrir a tela.
  const gravadas = viaIa
    ? await prisma.marketComparison.findMany({
        where: { productId: product!.id },
        orderBy: { competitorPrice: "asc" },
      })
    : [];

  const analiseIa = gravadas.length
    ? analyzePrices(
        gravadas.map<CompetitorProduct>((c) => ({
          externalId: c.id,
          shopId: c.competitorSeller,
          title: c.competitorTitle,
          price: c.competitorPrice,
          url: c.competitorUrl,
          sourceExcerpt: c.sourceExcerpt,
        })),
      )
    : null;

  const buscadoEm = gravadas[0]?.createdAt ?? null;
  const observacaoIa = gravadas.find((c) => c.note)?.note ?? null;

  return (
    <>
      <Topbar crumb="Comparador de preços" />
      <main className="flex-1 px-4 py-8 sm:px-6">
        <PageHeader
          title="Comparador de preços"
          subtitle="Escolha um produto seu — o sistema busca os concorrentes na mesma plataforma."
        />

        <Card className="mb-6">
          <CardHeader
            title="Seus produtos"
            subtitle="Mercado Livre busca na hora; Shopee e TikTok abrem um botão de busca."
          />
          {products.length === 0 ? (
              <Empty
                title="Nenhum produto ainda"
                hint="Conecte uma loja e rode o sync, ou cadastre um produto no Estoque."
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {products.map((p) => {
                  const auto = supportsAutoSearch(p.account.platform) || supportsAiSearch(p.account.platform);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-ink">{p.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <PlatformBadge platform={p.account.platform} short />
                          <span className="text-[13px] text-ink-muted">{p.account.shopName}</span>
                          {p.sku && <span className="text-[13px] text-ink-muted">· SKU {p.sku}</span>}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-ink tabular">{brl(p.price)}</span>
                      {auto ? (
                        <Link
                          href={`/comparador?produto=${p.id}`}
                          aria-current={p.id === productId ? "true" : undefined}
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                            p.id === productId
                              ? "border-brand bg-brand-soft text-brand"
                              : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
                          }`}
                        >
                          <Search size={13} /> Comparar
                        </Link>
                      ) : (
                        <span
                          title="Sem fonte de preços para esta plataforma"
                          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-muted"
                        >
                          Indisponível
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
        </Card>

        {/* Shopee e TikTok: painel próprio, com rótulo de estimativa. */}
        {product && viaIa && (
          <>
            <Card className="mb-6">
              <CardHeader
                title={product.title}
                subtitle={
                  buscadoEm
                    ? `Última busca ${relative(buscadoEm)}.`
                    : "Nenhuma busca feita ainda para este produto."
                }
                action={<PlatformBadge platform={plataforma} short />}
              />
              <div className="px-5 py-4">
                <BuscarPrecosBotao productId={product.id} jaTemResultado={gravadas.length > 0} />
              </div>
            </Card>

            {analiseIa && (
              <>
                <div
                  className="mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px]"
                  style={{
                    borderColor: "var(--warning)",
                    backgroundColor: "color-mix(in srgb, var(--warning) 8%, transparent)",
                    color: "var(--warning)",
                  }}
                >
                  <Sparkles size={15} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    <strong>Estimativa.</strong> A Shopee e o TikTok não têm API pública de preços — estes
                    valores vêm de busca na web e foram conferidos contra o trecho de origem, mas não têm a
                    exatidão do Mercado Livre. Confira o anúncio antes de decidir preço.
                  </span>
                </div>

                <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Stat label="Seu preço" value={brl(product.price)} tone="brand" />
                  <Stat
                    label="Mediana estimada"
                    value={brl(analiseIa.medianPrice)}
                    hint={(() => {
                      const d = variation(product.price, analiseIa.medianPrice);
                      return Math.abs(d) < 1
                        ? "seu preço está no mesmo nível"
                        : `seu preço está ${Math.abs(d).toFixed(0)}% ${d > 0 ? "acima" : "abaixo"}`;
                    })()}
                    tone={variation(product.price, analiseIa.medianPrice) > 15 ? "series-2" : "series-1"}
                  />
                  <Stat
                    label="Média (sem extremos)"
                    value={brl(analiseIa.averagePrice)}
                    hint="descarta 10% de cada ponta"
                    tone="series-3"
                  />
                  <Stat label="Menor preço" value={brl(analiseIa.minPrice)} tone="good" />
                  <Stat
                    label="Anúncios analisados"
                    value={String(analiseIa.totalAnalyzed)}
                    hint={`até ${brl(analiseIa.maxPrice)}`}
                    tone="series-2"
                  />
                </div>

                <Card>
                  <CardHeader title="Concorrentes" subtitle="Preços encontrados na web, com a fonte de cada um." />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                          <th className="px-5 py-3.5">Anúncio</th>
                          <th className="px-5 py-3.5">Vendedor</th>
                          <th className="px-5 py-3.5 text-right">Preço</th>
                          <th className="px-5 py-3.5 text-right">vs. seu preço</th>
                          <th className="px-5 py-3.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {analiseIa.productsList.map((c) => (
                          <tr key={c.externalId} className="align-top transition-colors hover:bg-surface-2">
                            <td className="px-5 py-3">
                              <p className="line-clamp-1 text-ink">{c.title}</p>
                              {c.sourceExcerpt && (
                                <p className="mt-0.5 text-[12px] text-ink-muted">
                                  fonte: <span className="tabular">{c.sourceExcerpt.slice(0, 60)}</span>
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-3 text-[13px] text-ink-muted">{c.shopId ?? "—"}</td>
                            <td className="px-5 py-3 text-right font-semibold text-ink tabular">{brl(c.price)}</td>
                            <td className="px-5 py-3 text-right">
                              <Delta value={variation(c.price, product.price)} />
                            </td>
                            <td className="px-5 py-3 text-right">
                              {c.url && (
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Abrir anúncio de ${c.title}`}
                                  className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
                                >
                                  Ver <ExternalLink size={12} />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {observacaoIa && (
                  <p className="mt-4 flex items-start gap-2 text-[13px] text-ink-muted">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                    {observacaoIa}
                  </p>
                )}
              </>
            )}
          </>
        )}

        {product && resultado && (
          <>
            {!resultado.ok ? (
              <Card>
                <CardHeader title={product.title} action={<PlatformBadge platform={product.account.platform} short />} />
                <Empty
                  title={
                    resultado.reason === "unsupported"
                      ? "Busca automática indisponível nesta plataforma"
                      : resultado.reason === "no_results"
                        ? "Nenhum concorrente encontrado"
                        : "Não foi possível buscar agora"
                  }
                  hint={resultado.message}
                />
              </Card>
            ) : (
              (() => {
                const a = resultado.analysis;
                const vsMediana = variation(product.price, a.medianPrice);
                return (
                  <>
                    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      <Stat label="Seu preço" value={brl(product.price)} tone="brand" />
                      {/* Sem o componente Delta aqui de propósito: ele pinta
                          alta de verde, e estar acima da mediana é justamente
                          o alerta — o verde leria como se fosse bom. */}
                      <Stat
                        label="Mediana do mercado"
                        value={brl(a.medianPrice)}
                        hint={
                          Math.abs(vsMediana) < 1
                            ? "seu preço está no mesmo nível"
                            : `seu preço está ${Math.abs(vsMediana).toFixed(0)}% ${vsMediana > 0 ? "acima" : "abaixo"}`
                        }
                        tone={vsMediana > 15 ? "series-2" : "series-1"}
                      />
                      <Stat
                        label="Média (sem extremos)"
                        value={brl(a.averagePrice)}
                        hint="descarta 10% de cada ponta"
                        tone="series-3"
                      />
                      <Stat label="Menor preço" value={brl(a.minPrice)} tone="good" />
                      <Stat
                        label="Ofertas analisadas"
                        value={String(a.totalAnalyzed)}
                        hint={`até ${brl(a.maxPrice)}`}
                        tone="series-2"
                      />
                    </div>

                    <Card>
                      <CardHeader
                        title="Concorrentes"
                        subtitle={`Mesmo produto de catálogo — ${product.title}`}
                        action={<PlatformBadge platform={product.account.platform} short />}
                      />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                              <th className="px-5 py-3.5">Anúncio</th>
                              <th className="px-5 py-3.5">Vendedor</th>
                              <th className="px-5 py-3.5 text-right">Preço</th>
                              <th className="px-5 py-3.5 text-right">vs. seu preço</th>
                              <th className="px-5 py-3.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {a.productsList.map((c) => {
                              const diff = variation(c.price, product.price);
                              return (
                                <tr key={c.externalId} className="transition-colors hover:bg-surface-2">
                                  <td className="px-5 py-3">
                                    <p className="line-clamp-1 text-ink">{c.title}</p>
                                  </td>
                                  <td className="px-5 py-3 text-[13px] text-ink-muted tabular">{c.shopId ?? "—"}</td>
                                  <td className="px-5 py-3 text-right font-semibold text-ink tabular">
                                    {brl(c.price)}
                                  </td>
                                  <td className="px-5 py-3 text-right">
                                    <Delta value={diff} />
                                  </td>
                                  <td className="px-5 py-3 text-right">
                                    {c.url && (
                                      <a
                                        href={c.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Abrir anúncio de ${c.title}`}
                                        className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
                                      >
                                        Ver <ExternalLink size={12} />
                                      </a>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <p className="mt-4 flex items-start gap-2 text-[13px] text-ink-muted">
                      <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                      Preços do catálogo do Mercado Livre, atualizados a cada hora. A correspondência é por título —
                      confira o anúncio antes de decidir preço.
                    </p>
                  </>
                );
              })()
            )}
          </>
        )}

        {!product && products.length > 0 && (
          <Card>
            <Empty
              title="Escolha um produto acima"
              hint="Clique em Comparar — o resto é automático."
            />
          </Card>
        )}
      </main>
    </>
  );
}
