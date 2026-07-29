import { ArrowRight, CircleAlert, DollarSign, Megaphone, Store, TrendingUp, TriangleAlert, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { RevenueLine } from "@/components/charts";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { brl, num } from "@/lib/format";
import { criticalAlerts, portfolioSummary, revenueSeries, WINDOW_DAYS } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  await requirePermission("painel");
  const [s, alerts, series] = await Promise.all([portfolioSummary(), criticalAlerts(), revenueSeries()]);

  const platformSummary = [
    ["ML", s.byPlatform.MERCADO_LIVRE ?? 0],
    ["Shopee", s.byPlatform.SHOPEE ?? 0],
    ["TikTok", s.byPlatform.TIKTOK_SHOP ?? 0],
  ]
    .filter(([, n]) => Number(n) > 0)
    .map(([l, n]) => `${l} ${n}`)
    .join(" · ");

  const adsShare = s.revenue ? (s.adsSpend / s.revenue) * 100 : 0;

  return (
    <>
      <Topbar crumb="Painel" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Painel" subtitle="Visão consolidada de toda a sua carteira." />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Clientes ativos" value={num(s.clients)} icon={<Users size={18} />} tone="brand" />
          <Stat
            label="Contas gerenciadas"
            value={num(s.accounts)}
            hint={platformSummary || undefined}
            icon={<Store size={18} />}
            tone="series-1"
          />
          <Stat
            label={`Faturamento ${WINDOW_DAYS}d`}
            value={brl(s.revenue)}
            delta={s.revenueVariation}
            icon={<DollarSign size={18} />}
            tone="good"
          />
          <Stat
            label={`Investimento ADS ${WINDOW_DAYS}d`}
            value={brl(s.adsSpend)}
            hint={s.revenue ? `${adsShare.toFixed(1).replace(".", ",")}% da receita` : undefined}
            icon={<Megaphone size={18} />}
            tone="series-2"
          />
          <Stat
            label="Crescimento médio"
            value={`${s.avgGrowth.toFixed(1).replace(".", ",")}%`}
            delta={s.avgGrowth}
            icon={<TrendingUp size={18} />}
            tone="series-3"
          />
        </div>

        <Card className="mt-6">
          <CardHeader
            title="Alertas críticos"
            subtitle={
              alerts.length ? `${alerts.length} pendente(s) que precisam de atenção` : "Nenhum alerta no momento"
            }
          />
          {alerts.length === 0 ? (
            <Empty title="Tudo em ordem" hint="Nenhuma penalidade, queda relevante ou integração quebrada na carteira." />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {alerts.map((a, i) => {
                const color = a.severity === "CRITICO" ? "var(--critical)" : "var(--warning)";
                const Icon = a.severity === "CRITICO" ? CircleAlert : TriangleAlert;
                return (
                  <li key={`${a.accountId}-${i}`} className="flex items-center gap-4 px-5 py-4">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-full"
                      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
                    >
                      <Icon size={17} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <PlatformBadge platform={a.platform} />
                      <p className="mt-1.5 text-sm font-medium text-ink">{a.title}</p>
                    </div>
                    <Link
                      href={`/contas?conta=${a.accountId}`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                    >
                      Ver conta <ArrowRight size={14} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="mt-6 p-5">
          <div className="mb-4">
            <h2 className="text-[15px] font-semibold text-ink">Faturamento diário por plataforma</h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">Últimos {WINDOW_DAYS} dias.</p>
          </div>
          <RevenueLine data={series} />
        </Card>
      </main>
    </>
  );
}
