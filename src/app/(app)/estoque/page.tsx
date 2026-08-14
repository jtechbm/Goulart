import { Boxes, Minus, PackageX, Plus, TriangleAlert } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { comAviso, requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brl, num, relative } from "@/lib/format";
import {
  createManualProduct,
  LOW_STOCK,
  moveStock,
  REASON_LABEL,
  REASONS,
  type Reason,
} from "@/lib/inventory";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "baixo", label: `Estoque ≤ ${LOW_STOCK}` },
  { key: "zerado", label: "Esgotados" },
];

/** Selo ao lado do saldo. Cor sozinha não basta — vai sempre com ícone e texto. */
function stockTone(stock: number) {
  if (stock === 0) return { color: "var(--critical)", label: "Esgotado", Icon: PackageX };
  if (stock <= LOW_STOCK) return { color: "var(--warning)", label: "Estoque baixo", Icon: TriangleAlert };
  return null;
}

async function movimentar(formData: FormData) {
  "use server";
  const user = await requireClient();

  const productId = String(formData.get("productId") ?? "");
  const qty = Math.abs(Number(formData.get("quantidade") ?? 0));
  const direcao = String(formData.get("direcao") ?? "entrada");
  const reason = String(formData.get("motivo") ?? "AJUSTE") as Reason;
  const note = String(formData.get("nota") ?? "").trim() || null;

  if (!REASONS.includes(reason)) redirect(comAviso("/estoque", "erro", "Motivo inválido."));

  const result = await moveStock({
    productId,
    delta: direcao === "saida" ? -qty : qty,
    reason,
    note,
    authorId: user.id,
    authorName: user.name,
    clientId: user.clientId, // escopo: o produto tem que ser deste cliente
  });

  revalidatePath("/estoque");
  redirect(
    result.ok
      ? `/estoque?ok=${encodeURIComponent(`Estoque atualizado para ${result.stock} unidade(s).`)}`
      : `/estoque?erro=${encodeURIComponent(result.message ?? "Não foi possível atualizar.")}`,
  );
}

async function novoProduto(formData: FormData) {
  "use server";
  const user = await requireClient();

  const title = String(formData.get("title") ?? "").trim();
  const accountId = String(formData.get("accountId") ?? "");
  if (!title || !accountId) redirect("/estoque?erro=Informe o produto e a loja.");

  try {
    await createManualProduct({
      accountId,
      title,
      sku: String(formData.get("sku") ?? "").trim() || null,
      price: Number(formData.get("price") ?? 0),
      stock: Number(formData.get("stock") ?? 0),
      authorId: user.id,
      authorName: user.name,
      clientId: user.clientId,
    });
  } catch (err) {
    redirect(`/estoque?erro=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`);
  }

  revalidatePath("/estoque");
  redirect("/estoque?ok=Produto criado.");
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; ok?: string; erro?: string; produto?: string }>;
}) {
  const user = await requireClient();
  const sp = await searchParams;
  const filtro = sp.filtro ?? "todos";

  const scope = { account: { clientId: user.clientId } };

  const [rows, all, accounts, movements] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...scope,
        ...(filtro === "zerado" ? { stock: 0 } : filtro === "baixo" ? { stock: { lte: LOW_STOCK } } : {}),
      },
      include: { account: { select: { shopName: true, platform: true } } },
      orderBy: [{ stock: "asc" }, { title: "asc" }],
      take: 300,
    }),
    prisma.product.findMany({ where: scope, select: { stock: true, price: true } }),
    prisma.account.findMany({
      where: { clientId: user.clientId },
      select: { id: true, shopName: true, platform: true },
      orderBy: { shopName: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { product: scope },
      include: { product: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const out = all.filter((p) => p.stock === 0).length;
  const low = all.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length;
  const value = all.reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <>
      <Topbar crumb="Estoque" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Estoque" subtitle="Seus produtos em todos os marketplaces." />

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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Produtos" value={num(all.length)} icon={<Boxes size={18} />} tone="brand" />
          <Stat label="Esgotados" value={num(out)} icon={<PackageX size={18} />} tone="series-2" />
          <Stat label={`Estoque ≤ ${LOW_STOCK}`} value={num(low)} icon={<TriangleAlert size={18} />} tone="series-3" />
          <Stat label="Valor em estoque" value={brl(value)} tone="series-1" />
        </div>

        <div className="my-5 flex w-fit flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "todos" ? "/estoque" : `/estoque?filtro=${f.key}`}
              aria-current={filtro === f.key ? "true" : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                filtro === f.key ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <Card>
            <Empty
              title="Nenhum produto"
              hint="Conecte uma loja em Integrações ou cadastre um produto manual abaixo."
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    <th className="px-5 py-3.5">Produto</th>
                    <th className="px-5 py-3.5">Loja</th>
                    <th className="px-5 py-3.5 text-right">Preço</th>
                    <th className="px-5 py-3.5 text-right">Estoque</th>
                    <th className="px-5 py-3.5">Movimentar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((p) => {
                    const tone = stockTone(p.stock);
                    return (
                      <tr key={p.id} className="align-top transition-colors hover:bg-surface-2">
                        <td className="px-5 py-4">
                          <p className="line-clamp-1 font-medium text-ink">{p.title}</p>
                          <p className="text-[13px] text-ink-muted">
                            {p.sku ? `SKU ${p.sku}` : "sem SKU"}
                            {p.origin === "MANUAL" && " · manual"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <PlatformBadge platform={p.account.platform} short />
                            <span className="text-[13px] text-ink-muted">{p.account.shopName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right text-ink-2 tabular">{brl(p.price)}</td>
                        <td className="px-5 py-4 text-right">
                          <span className="font-semibold text-ink tabular">{num(p.stock)}</span>
                          {tone && (
                            <span
                              className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[11px] font-medium"
                              style={{
                                color: tone.color,
                                backgroundColor: `color-mix(in srgb, ${tone.color} 14%, transparent)`,
                              }}
                            >
                              <tone.Icon size={11} aria-hidden />
                              {tone.label}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <form action={movimentar} className="flex flex-wrap items-center gap-1.5">
                            <input type="hidden" name="productId" value={p.id} />
                            <input
                              name="quantidade"
                              type="number"
                              min="1"
                              defaultValue={1}
                              aria-label={`Quantidade para ${p.title}`}
                              className="w-16 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink tabular"
                            />
                            <select
                              name="motivo"
                              aria-label={`Motivo para ${p.title}`}
                              className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink"
                            >
                              {REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {REASON_LABEL[r]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              name="direcao"
                              value="entrada"
                              aria-label={`Adicionar estoque de ${p.title}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
                            >
                              <Plus size={12} /> Entrada
                            </button>
                            <button
                              type="submit"
                              name="direcao"
                              value="saida"
                              aria-label={`Retirar estoque de ${p.title}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
                            >
                              <Minus size={12} /> Saída
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Cadastrar produto manual"
              subtitle="Para itens que você controla aqui e não têm anúncio no marketplace."
            />
            {accounts.length === 0 ? (
              <p className="px-5 py-5 text-[13px] text-ink-muted">
                Conecte uma loja primeiro em{" "}
                <Link href="/integracoes" className="font-semibold text-brand hover:underline">
                  Integrações
                </Link>
                .
              </p>
            ) : (
              <form action={novoProduto} className="space-y-3 px-5 py-5">
                <input
                  name="title"
                  required
                  placeholder="Nome do produto"
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    name="sku"
                    placeholder="SKU"
                    className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                  />
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Preço"
                    className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular placeholder:text-ink-muted"
                  />
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    defaultValue={0}
                    aria-label="Estoque inicial"
                    className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular"
                  />
                </div>
                <select
                  name="accountId"
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.shopName}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
                >
                  <Plus size={15} /> Criar produto
                </button>
              </form>
            )}
          </Card>

          <Card>
            <CardHeader title="Últimas movimentações" />
            {movements.length === 0 ? (
              <p className="px-5 py-5 text-[13px] text-ink-muted">Nenhuma movimentação registrada.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {movements.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className="w-12 shrink-0 text-right text-sm font-bold tabular"
                      style={{ color: m.delta > 0 ? "var(--good-text)" : "var(--critical)" }}
                    >
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[13px] font-medium text-ink">{m.product.title}</p>
                      <p className="text-[12px] text-ink-muted">
                        {REASON_LABEL[m.reason as Reason] ?? m.reason} · {m.authorName}
                        {!m.pushed && m.stockAfter === m.stockBefore && " · não aplicado"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] text-ink-muted">{relative(m.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
