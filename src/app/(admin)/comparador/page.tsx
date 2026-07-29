import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Delta, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { requireKadu } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brl, date, variation } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Ferramenta pessoal do Kadu: comparar o preço de um produto do cliente com o
 * que a concorrência cobra na MESMA plataforma. Sem integração ainda — os
 * dados do concorrente são digitados à mão (fictícios ou pesquisados).
 */

async function adicionarComparacao(formData: FormData) {
  "use server";
  const user = await requireKadu();

  const clientId = String(formData.get("clientId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const back = (qs = "") => `/comparador?cliente=${clientId}&produto=${productId}${qs}`;

  const competitorSeller = String(formData.get("competitorSeller") ?? "").trim();
  const competitorTitle = String(formData.get("competitorTitle") ?? "").trim();
  const competitorPrice = Number(formData.get("competitorPrice") ?? 0);
  const competitorUrl = String(formData.get("competitorUrl") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!competitorSeller || !competitorTitle || !(competitorPrice > 0)) {
    redirect(back(`&erro=${encodeURIComponent("Preencha vendedor, anúncio e um preço válido.")}`));
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { account: true } });
  if (!product || product.account.clientId !== clientId) {
    redirect(back(`&erro=${encodeURIComponent("Produto não encontrado para este cliente.")}`));
  }

  await prisma.marketComparison.create({
    data: {
      productId,
      platform: product.account.platform,
      competitorSeller,
      competitorTitle,
      competitorPrice,
      competitorUrl,
      note,
      authorId: user.id,
      authorName: user.name,
    },
  });

  revalidatePath("/comparador");
  redirect(back("&ok=Comparação adicionada."));
}

async function removerComparacao(formData: FormData) {
  "use server";
  await requireKadu();

  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const productId = String(formData.get("productId") ?? "");

  if (id) await prisma.marketComparison.delete({ where: { id } }).catch(() => {});

  revalidatePath("/comparador");
  redirect(`/comparador?cliente=${clientId}&produto=${productId}&ok=Comparação removida.`);
}

export default async function ComparadorPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; produto?: string; ok?: string; erro?: string }>;
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
          include: {
            account: { select: { shopName: true, platform: true, client: { select: { name: true } } } },
            marketComparisons: { orderBy: { createdAt: "desc" } },
          },
        })
      : Promise.resolve(null),
  ]);

  const prices = product?.marketComparisons.map((c) => c.competitorPrice) ?? [];
  const cheapest = prices.length ? Math.min(...prices) : null;

  return (
    <>
      <Topbar crumb="Comparador de preços" />
      <main className="flex-1 px-6 py-8">
        <PageHeader
          title="Comparador de preços"
          subtitle="Ferramenta pessoal — compare o preço de um produto do cliente com a concorrência na mesma plataforma."
        />

        {sp.ok && (
          <p
            role="status"
            className="mb-5 rounded-xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: "var(--good)",
              backgroundColor: "color-mix(in srgb, var(--good) 10%, transparent)",
              color: "var(--good-text)",
            }}
          >
            {sp.ok}
          </p>
        )}
        {sp.erro && (
          <p
            role="alert"
            className="mb-5 rounded-xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: "var(--critical)",
              backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)",
              color: "var(--critical)",
            }}
          >
            {sp.erro}
          </p>
        )}

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
            <CardHeader title="2. Produto" subtitle="O anúncio do cliente que você quer olhar contra o mercado." />
            {products.length === 0 ? (
              <Empty
                title="Este cliente não tem produtos"
                hint="Conecte uma loja e rode o sync, ou cadastre um produto manual no Estoque."
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-ink">{p.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <PlatformBadge platform={p.account.platform} short />
                        <span className="text-[13px] text-ink-muted">{p.account.shopName}</span>
                        {p.sku && <span className="text-[13px] text-ink-muted">· SKU {p.sku}</span>}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-ink tabular">{brl(p.price)}</span>
                    <Link
                      href={`/comparador?cliente=${clientId}&produto=${p.id}`}
                      aria-current={p.id === productId ? "true" : undefined}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                        p.id === productId
                          ? "border-brand bg-brand-soft text-brand"
                          : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
                      }`}
                    >
                      Comparar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {product && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <Stat label="Seu preço" value={brl(product.price)} tone="brand" />
              <Stat
                label="Menor preço encontrado"
                value={cheapest !== null ? brl(cheapest) : "—"}
                hint={cheapest !== null && cheapest < product.price ? "abaixo do seu preço" : undefined}
                tone="series-2"
              />
              <Stat label="Comparações registradas" value={String(product.marketComparisons.length)} tone="series-1" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title="Adicionar comparação"
                  subtitle="Anúncio concorrente na mesma plataforma do produto."
                  action={<PlatformBadge platform={product.account.platform} short />}
                />
                <form action={adicionarComparacao} className="space-y-3 px-5 py-5">
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="productId" value={product.id} />
                  <input
                    name="competitorSeller"
                    required
                    placeholder="Vendedor / loja concorrente"
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                  />
                  <input
                    name="competitorTitle"
                    required
                    placeholder="Título do anúncio encontrado"
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      name="competitorPrice"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="Preço encontrado"
                      className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular placeholder:text-ink-muted"
                    />
                    <input
                      name="competitorUrl"
                      type="url"
                      placeholder="Link do anúncio (opcional)"
                      className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                    />
                  </div>
                  <textarea
                    name="note"
                    rows={2}
                    placeholder="Nota (opcional) — frete, condição, cupom..."
                    className="w-full resize-none rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
                  >
                    <Plus size={15} /> Adicionar comparação
                  </button>
                </form>
              </Card>

              <Card>
                <CardHeader title="Comparações" subtitle={product.title} />
                {product.marketComparisons.length === 0 ? (
                  <Empty
                    title="Nenhuma comparação ainda"
                    hint="Adicione um anúncio concorrente ao lado — pode ser fictício, é só pra ter o que comparar."
                  />
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {product.marketComparisons.map((c) => {
                      const diff = variation(c.competitorPrice, product.price);
                      return (
                        <li key={c.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-1 text-sm font-medium text-ink">{c.competitorTitle}</p>
                              <p className="mt-0.5 text-[13px] text-ink-muted">{c.competitorSeller}</p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-ink tabular">
                              {brl(c.competitorPrice)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Delta value={diff} />
                            <span className="text-[12px] text-ink-muted">
                              {diff > 0 ? "concorrente mais caro que você" : diff < 0 ? "concorrente mais barato que você" : "mesmo preço"}
                            </span>
                          </div>

                          {c.note && <p className="mt-2 text-[13px] text-ink-2">{c.note}</p>}

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {c.competitorUrl && (
                                <a
                                  href={c.competitorUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
                                >
                                  Ver anúncio <ExternalLink size={12} />
                                </a>
                              )}
                              <span className="text-[12px] text-ink-muted">{date(c.createdAt)}</span>
                            </div>
                            <form action={removerComparacao}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="clientId" value={clientId} />
                              <input type="hidden" name="productId" value={product.id} />
                              <button
                                type="submit"
                                aria-label="Remover comparação"
                                className="grid size-7 place-items-center rounded-lg text-ink-muted transition-colors hover:text-critical"
                              >
                                <Trash2 size={14} />
                              </button>
                            </form>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}

        {!clientId && (
          <Card>
            <Empty
              title="Escolha um cliente para começar"
              hint="Depois selecione o produto dele e adicione o que encontrar na concorrência."
            />
          </Card>
        )}
      </main>
    </>
  );
}
