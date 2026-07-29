import { DollarSign, Megaphone, Receipt, TrendingUp } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { CostDonut, MarginBars } from "@/components/charts";
import { Topbar } from "@/components/Topbar";
import { Card, PageHeader, Stat } from "@/components/ui";
import { brl } from "@/lib/format";
import { accountRollups, financials, TAX_RATE, WINDOW_DAYS } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "todas", label: "Todas" },
  { key: "MERCADO_LIVRE", label: "Mercado Livre" },
  { key: "SHOPEE", label: "Shopee" },
  { key: "TIKTOK_SHOP", label: "TikTok Shop" },
];

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ plataforma?: string }>;
}) {
  await requirePermission("financeiro");
  const { plataforma = "todas" } = await searchParams;
  const all = await accountRollups();
  const rows = plataforma === "todas" ? all : all.filter((r) => r.platform === plataforma);

  const { revenue, ads, fees, tax, profit, margin } = financials(rows);

  const byPlatform = ["MERCADO_LIVRE", "SHOPEE", "TIKTOK_SHOP"]
    .map((p) => {
      const g = financials(all.filter((r) => r.platform === p));
      return { platform: p, revenue: g.revenue, margin: g.margin };
    })
    .filter((p) => p.revenue > 0);

  const share = (v: number) => (revenue ? `${((v / revenue) * 100).toFixed(1).replace(".", ",")}% da receita` : undefined);

  return (
    <>
      <Topbar crumb="Financeiro" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Financeiro" subtitle={`Consolidado da carteira — últimos ${WINDOW_DAYS} dias.`} />

        <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => {
            const active = plataforma === t.key;
            return (
              <Link
                key={t.key}
                href={t.key === "todas" ? "/financeiro" : `/financeiro?plataforma=${t.key}`}
                aria-current={active ? "true" : undefined}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={`Faturamento ${WINDOW_DAYS}d`} value={brl(revenue)} icon={<DollarSign size={18} />} tone="good" />
          <Stat label="Imposto" value={brl(tax)} hint={share(tax)} icon={<Receipt size={18} />} tone="series-2" />
          <Stat label="ADS" value={brl(ads)} hint={share(ads)} icon={<Megaphone size={18} />} tone="series-3" />
          <Stat
            label="Lucro líquido"
            value={brl(profit)}
            hint={`${margin.toFixed(1).replace(".", ",")}% de margem`}
            icon={<TrendingUp size={18} />}
            tone="series-1"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-ink">Composição de custo</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                Comissões do marketplace ({brl(fees)}) entram no lucro já descontadas.
              </p>
            </div>
            <CostDonut profit={profit} tax={tax} ads={ads} />
          </Card>

          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-ink">Margem por plataforma</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">Lucro líquido sobre faturamento.</p>
            </div>
            <MarginBars data={byPlatform} />
          </Card>
        </div>
      </main>
    </>
  );
}
