import { DollarSign, Link2Off, Package, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { Card, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brl, num } from "@/lib/format";
import { calcularLinha, faixaMargem, somar } from "@/lib/sales";
import { configuracoes } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];

const COLUNAS = [
  "Item",
  "Qtd",
  "Total",
  "Preço unit.",
  "Líquido do marketplace",
  "Imposto",
  "Custo do produto",
  "Custo extra",
  "Lucro",
  "Margem",
];

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; loja?: string }>;
}) {
  const user = await requireClient();
  const sp = await searchParams;

  const dias = PERIODOS.some((p) => String(p.dias) === sp.dias) ? Number(sp.dias) : 30;
  const desde = new Date(Date.now() - dias * 86400000);

  const [pedidos, lojas, config] = await Promise.all([
    prisma.order.findMany({
      where: {
        account: { clientId: user.clientId, ...(sp.loja ? { id: sp.loja } : {}) },
        placedAt: { gte: desde },
      },
      include: {
        account: { select: { id: true, shopName: true, platform: true } },
        items: { include: { product: { select: { cost: true, extraCost: true } } } },
      },
      orderBy: { placedAt: "desc" },
      take: 200,
    }),
    prisma.account.findMany({
      where: { clientId: user.clientId },
      select: { id: true, shopName: true },
      orderBy: { shopName: "asc" },
    }),
    configuracoes(user.clientId),
  ]);

  // Calcula uma vez e reaproveita no resumo e nas linhas.
  const calculados = pedidos.map((p) => ({
    pedido: p,
    linhas: p.items.map((i) => ({ item: i, r: calcularLinha(i, config.taxRate) })),
  }));
  const todas = calculados.flatMap((c) => c.linhas.map((l) => l.r));
  const resumo = somar(todas);
  const semVinculo = calculados.flatMap((c) => c.linhas).filter((l) => !l.item.productId).length;

  const query = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (dias !== 30) q.set("dias", String(dias));
    if (sp.loja) q.set("loja", sp.loja);
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `/vendas?${s}` : "/vendas";
  };

  return (
    <>
      <Topbar crumb="Vendas" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Vendas" subtitle={`Lucro e margem de cada item vendido nos últimos ${dias} dias.`} />

        {semVinculo > 0 && (
          <Link
            href="/estoque"
            className="mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] transition-colors"
            style={{
              borderColor: "var(--warning)",
              backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)",
            }}
          >
            <Link2Off size={16} style={{ color: "var(--warning)" }} aria-hidden />
            <span className="flex-1 text-ink">
              <strong>{semVinculo} venda(s) sem produto vinculado.</strong> Sem o produto não há custo, então lucro e
              margem dessas linhas estão incompletos.
            </span>
            <span className="font-semibold text-brand">Ver estoque →</span>
          </Link>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Vendido" value={brl(resumo.total)} icon={<DollarSign size={18} />} tone="series-1" />
          <Stat
            label="Líquido do marketplace"
            value={brl(resumo.liquido)}
            hint={resumo.total ? `${((resumo.liquido / resumo.total) * 100).toFixed(1).replace(".", ",")}% do bruto` : undefined}
            icon={<Package size={18} />}
            tone="series-2"
          />
          <Stat label="Lucro" value={brl(resumo.lucro)} icon={<TrendingUp size={18} />} tone={resumo.lucro >= 0 ? "good" : "series-3"} />
          <Stat
            label="Margem"
            value={`${resumo.margem.toFixed(2).replace(".", ",")}%`}
            hint={faixaMargem(resumo.margem).rotulo}
            tone="brand"
          />
        </div>

        <div className="my-5 flex flex-wrap items-center gap-3">
          <div className="flex w-fit gap-1.5 rounded-xl border border-line bg-surface p-1">
            {PERIODOS.map((p) => (
              <Link
                key={p.dias}
                href={query({ dias: p.dias === 30 ? undefined : String(p.dias) })}
                aria-current={p.dias === dias ? "true" : undefined}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  p.dias === dias ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {p.rotulo}
              </Link>
            ))}
          </div>

          {lojas.length > 1 && (
            <div className="flex w-fit flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1">
              <Link
                href={query({ loja: undefined })}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  !sp.loja ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                Todas as lojas
              </Link>
              {lojas.map((l) => (
                <Link
                  key={l.id}
                  href={query({ loja: l.id })}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    sp.loja === l.id ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {l.shopName}
                </Link>
              ))}
            </div>
          )}
        </div>

        {calculados.length === 0 ? (
          <Card>
            <Empty
              title="Nenhuma venda no período"
              hint="As vendas aparecem aqui depois que uma loja conectada sincroniza os pedidos."
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {calculados.map(({ pedido, linhas }) => {
              const totalPedido = somar(linhas.map((l) => l.r));
              return (
                <Card key={pedido.id} className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-5 py-3">
                    <span className="text-[13px] font-medium text-ink tabular">{dia.format(pedido.placedAt)}</span>
                    <span className="text-[13px] text-ink-muted tabular">{hora.format(pedido.placedAt)}</span>
                    {pedido.shippingMode && (
                      <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-2">
                        {pedido.shippingMode}
                      </span>
                    )}
                    <span className="text-[12px] text-ink-muted">#{pedido.externalId}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <PlatformBadge platform={pedido.account.platform} short />
                      <span className="text-[13px] font-semibold text-ink">{pedido.account.shopName}</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                          {COLUNAS.map((c, i) => (
                            <th key={c} className={`px-4 py-3 ${i === 0 ? "" : "text-right"}`}>
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {linhas.map(({ item, r }) => {
                          const faixa = faixaMargem(r.margem);
                          return (
                            <tr key={item.id} className="transition-colors hover:bg-surface-2">
                              <td className="max-w-[280px] px-4 py-3.5">
                                <p className="line-clamp-2 font-medium text-ink">{item.title}</p>
                                <p className="text-[12px] text-ink-muted">
                                  {item.sku ? `SKU ${item.sku}` : "sem SKU"}
                                  {!item.productId && (
                                    <span style={{ color: "var(--warning)" }}> · sem produto vinculado</span>
                                  )}
                                </p>
                              </td>
                              <td className="px-4 py-3.5 text-right text-ink-2 tabular">{num(item.quantity)}</td>
                              <td className="px-4 py-3.5 text-right font-semibold text-ink tabular">{brl(r.total)}</td>
                              <td className="px-4 py-3.5 text-right text-ink-2 tabular">{brl(item.unitPrice)}</td>
                              <td className="px-4 py-3.5 text-right text-ink-2 tabular">{brl(r.liquido)}</td>
                              <td className="px-4 py-3.5 text-right text-ink-2 tabular">{brl(r.imposto)}</td>
                              <td className="px-4 py-3.5 text-right text-ink-2 tabular">
                                {r.incompleto ? <span className="text-ink-muted">—</span> : brl(r.custoProduto)}
                              </td>
                              <td className="px-4 py-3.5 text-right text-ink-2 tabular">{brl(r.custoExtra)}</td>
                              <td
                                className="px-4 py-3.5 text-right font-semibold tabular"
                                style={{ color: r.lucro >= 0 ? "var(--ink)" : "var(--critical)" }}
                              >
                                {brl(r.lucro)}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <span
                                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tabular"
                                  style={{
                                    color: faixa.cor,
                                    backgroundColor: `color-mix(in srgb, ${faixa.cor} 16%, transparent)`,
                                  }}
                                  title={r.incompleto ? "Custo desconhecido — margem inflada" : faixa.rotulo}
                                >
                                  {r.margem.toFixed(2).replace(".", ",")}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {linhas.length > 1 && (
                        <tfoot>
                          <tr className="border-t border-line bg-surface-2 text-[13px]">
                            <td className="px-4 py-3 font-semibold text-ink-2">Total do pedido</td>
                            <td colSpan={1} />
                            <td className="px-4 py-3 text-right font-semibold text-ink tabular">{brl(totalPedido.total)}</td>
                            <td colSpan={5} />
                            <td
                              className="px-4 py-3 text-right font-semibold tabular"
                              style={{ color: totalPedido.lucro >= 0 ? "var(--ink)" : "var(--critical)" }}
                            >
                              {brl(totalPedido.lucro)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-ink-2 tabular">
                              {totalPedido.margem.toFixed(2).replace(".", ",")}%
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
