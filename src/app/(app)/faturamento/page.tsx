import { DollarSign, Megaphone, Receipt, ShoppingCart, TrendingUp } from "lucide-react";
import { CostDonut, MarginBars, RevenueLine } from "@/components/charts";
import { Topbar } from "@/components/Topbar";
import { BotaoLink, Card, Delta, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { CANAIS } from "@/lib/canais";
import { brl, num } from "@/lib/format";
import { accountRollups, financials, revenueSeries, WINDOW_DAYS } from "@/lib/queries";
import { configuracoes } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function FaturamentoPage() {
  const user = await requireClient();

  const [rollups, series, config] = await Promise.all([
    accountRollups(user.clientId, WINDOW_DAYS),
    revenueSeries(user.clientId, WINDOW_DAYS),
    configuracoes(user.clientId),
  ]);

  const f = financials(rollups, config.taxRate);

  const byPlatform = CANAIS
    .map((p) => {
      const scoped = rollups.filter((r) => r.platform === p);
      const g = financials(scoped, config.taxRate);
      return { platform: p, revenue: g.revenue, margin: g.margin };
    })
    .filter((p) => p.revenue > 0);

  const share = (v: number) =>
    f.revenue ? `${((v / f.revenue) * 100).toFixed(1).replace(".", ",")}% da receita` : undefined;

  if (rollups.length === 0) {
    return (
      <>
        <Topbar crumb="Faturamento" />
        <main className="flex-1 px-6 py-8">
          <PageHeader title="Faturamento" subtitle="Receita, custos e margem das suas lojas." />
          <Card>
            <Empty
              title="Nenhuma loja conectada"
              hint="Conecte sua primeira loja para o faturamento aparecer aqui."
              action={<BotaoLink href="/integracoes">Conectar uma loja</BotaoLink>}
            />
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar crumb="Faturamento" />
      <main className="flex-1 px-6 py-8">
        <PageHeader
          title="Faturamento"
          subtitle={`Receita, custos e margem nos últimos ${WINDOW_DAYS} dias.`}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Receita bruta"
            value={brl(f.revenue)}
            delta={f.revenueVariation}
            icon={<DollarSign size={18} />}
            tone="good"
          />
          <Stat
            label="Imposto estimado"
            value={brl(f.tax)}
            hint={`alíquota de ${(config.taxRate * 100).toFixed(1).replace(".", ",")}%`}
            icon={<Receipt size={18} />}
            tone="series-2"
          />
          <Stat label="Investimento em ADS" value={brl(f.ads)} hint={share(f.ads)} icon={<Megaphone size={18} />} tone="series-3" />
          <Stat
            label="Comissões"
            value={brl(f.fees)}
            hint={share(f.fees)}
            icon={<ShoppingCart size={18} />}
            tone="series-1"
          />
          <Stat
            label="Lucro líquido"
            value={brl(f.profit)}
            hint={`${f.margin.toFixed(1).replace(".", ",")}% de margem`}
            icon={<TrendingUp size={18} />}
            tone="brand"
          />
        </div>

        <Card className="mt-6 p-5">
          <div className="mb-4">
            <h2 className="text-[15px] font-semibold text-ink">Receita diária por canal</h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">Últimos {WINDOW_DAYS} dias.</p>
          </div>
          <RevenueLine data={series} />
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-ink">Para onde vai a receita</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                Comissões de {brl(f.fees)} já descontadas do lucro.
              </p>
            </div>
            <CostDonut
              fatias={[
                { label: "Lucro líquido", value: f.profit },
                { label: "Imposto", value: f.tax },
                { label: "ADS", value: f.ads },
              ]}
            />
          </Card>

          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-ink">Margem por canal</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">Lucro líquido sobre a receita de cada canal.</p>
            </div>
            <MarginBars data={byPlatform} />
          </Card>
        </div>

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink">Detalhe por loja</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  <th className="px-5 py-3.5">Loja</th>
                  <th className="px-5 py-3.5">Canal</th>
                  <th className="px-5 py-3.5 text-right">Receita</th>
                  <th className="px-5 py-3.5 text-right">Variação</th>
                  <th className="px-5 py-3.5 text-right">Pedidos</th>
                  <th className="px-5 py-3.5 text-right">ADS</th>
                  <th className="px-5 py-3.5 text-right">Comissões</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rollups.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-4 font-medium text-ink">{r.shopName}</td>
                    <td className="px-5 py-4">
                      <PlatformBadge platform={r.platform} short />
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(r.revenue)}</td>
                    <td className="px-5 py-4 text-right">
                      <Delta value={r.variation} />
                    </td>
                    <td className="px-5 py-4 text-right text-ink-2 tabular">{num(r.orders)}</td>
                    <td className="px-5 py-4 text-right text-ink-2 tabular">{brl(r.adsSpend)}</td>
                    <td className="px-5 py-4 text-right text-ink-2 tabular">{brl(r.fees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="mt-4 text-[12px] text-ink-muted">
          O imposto é uma estimativa pela alíquota configurada, não um cálculo fiscal. Comissões vêm do repasse de cada
          marketplace.
        </p>
      </main>
    </>
  );
}
