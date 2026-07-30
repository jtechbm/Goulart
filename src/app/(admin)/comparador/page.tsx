import { ExternalLink, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Delta, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { requireKadu } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brl, variation } from "@/lib/format";
import { searchCompetitors, supportsAutoSearch } from "@/lib/marketSearch";

export const dynamic = "force-dynamic";

/**
 * Ferramenta pessoal do Kadu: ao escolher um produto do cliente, o sistema
 * busca sozinho os concorrentes do MESMO produto na MESMA plataforma e mostra
 * a régua de preços. Nada é digitado à mão.
 */

export default async function ComparadorPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; produto?: string }>;
}) {
  await requireKadu();
  const sp = await searchParams;
  const clientId = sp.cliente ?? "";
  const productId = sp.produto ?? "";

  const [clients, products, product] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    clientId
      ? prisma.product.findMany({
          where: { account: { clientId } },
          include: { account: { select: { shopName: true, platform: true } } },
          orderBy: { title: "asc" },
          take: 500,
        })
      : Promise.resolve([]),
    clientId && productId
      ? prisma.product.findFirst({
          where: { id: productId, account: { clientId } },
          include: { account: { select: { shopName: true, platform: true } } },
        })
      : Promise.resolve(null),
  ]);

  // A busca só acontece depois que há um produto escolhido.
  const resultado = product ? await searchCompetitors(product.account.platform, product.title) : null;

  return (
    <>
      <Topbar crumb="Comparador de preços" />
      <main className="flex-1 px-4 py-8 sm:px-6">
        <PageHeader
          title="Comparador de preços"
          subtitle="Escolha um produto do cliente — o sistema busca os concorrentes na mesma plataforma."
        />

        <Card className="mb-6">
          <CardHeader title="1. Cliente" subtitle="De quem é o produto que você quer comparar." />
          <form className="flex flex-wrap items-center gap-2 px-5 py-4">
            <select
              name="cliente"
              defaultValue={clientId}
              className="min-w-[220px] rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-[13px] text-ink"
            >
              <option value="">Selecione um cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl border border-line px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
            >
              Selecionar
            </button>
          </form>
        </Card>

        {clientId && (
          <Card className="mb-6">
            <CardHeader title="2. Produto" subtitle="Clique em Comparar — a busca é automática." />
            {products.length === 0 ? (
              <Empty
                title="Este cliente não tem produtos"
                hint="Conecte uma loja e rode o sync, ou cadastre um produto no Estoque."
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {products.map((p) => {
                  const auto = supportsAutoSearch(p.account.platform);
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
                          href={`/comparador?cliente=${clientId}&produto=${p.id}`}
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
                          title="Busca automática disponível apenas no Mercado Livre"
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

        {!clientId && (
          <Card>
            <Empty
              title="Escolha um cliente para começar"
              hint="Depois clique em Comparar num produto — o resto é automático."
            />
          </Card>
        )}
      </main>
    </>
  );
}
