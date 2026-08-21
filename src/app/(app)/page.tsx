import { DollarSign, PackageX, ShoppingCart, Store, TicketPercent } from "lucide-react";
import Link from "next/link";
import { RevenueLine } from "@/components/charts";
import { PrimeirosPassos } from "@/components/PrimeirosPassos";
import { Topbar } from "@/components/Topbar";
import { BotaoLink, Card, CardHeader, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brl, num } from "@/lib/format";
import { LOW_STOCK } from "@/lib/inventory";
import { progressoDoLojista } from "@/lib/onboarding";
import { accountRollups, revenueSeries, WINDOW_DAYS } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const user = await requireClient();

  const [rollups, series, lowStock, progresso] = await Promise.all([
    accountRollups(user.clientId, WINDOW_DAYS),
    revenueSeries(user.clientId, WINDOW_DAYS),
    prisma.product.count({
      where: { account: { clientId: user.clientId }, stock: { lte: LOW_STOCK } },
    }),
    progressoDoLojista(user.clientId),
  ]);

  const revenue = rollups.reduce((s, r) => s + r.revenue, 0);
  const prevRevenue = rollups.reduce((s, r) => s + r.prevRevenue, 0);
  const orders = rollups.reduce((s, r) => s + r.orders, 0);
  const ticket = orders ? revenue / orders : 0;
  const revenueVariation = prevRevenue ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

  return (
    <>
      <Topbar crumb="Início" />
      <main className="flex-1 px-6 py-8">
        <PageHeader
          title={`Olá, ${user.name.split(" ")[0]}`}
          subtitle={`Resumo das suas lojas nos últimos ${WINDOW_DAYS} dias.`}
        />

        <PrimeirosPassos progresso={progresso} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={`Faturamento ${WINDOW_DAYS}d`}
            value={brl(revenue)}
            delta={revenueVariation}
            icon={<DollarSign size={18} />}
            tone="good"
          />
          <Stat label="Pedidos" value={num(orders)} icon={<ShoppingCart size={18} />} tone="series-1" />
          <Stat label="Ticket médio" value={brl(ticket)} icon={<TicketPercent size={18} />} tone="series-2" />
          <Stat
            label="Lojas conectadas"
            value={num(rollups.length)}
            hint={lowStock > 0 ? `${lowStock} produto(s) com estoque baixo` : undefined}
            icon={<Store size={18} />}
            tone="series-3"
          />
        </div>

        {lowStock > 0 && (
          <Link
            href="/estoque?filtro=baixo"
            className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-brand hover:underline"
          >
            <PackageX size={14} /> Ver os {lowStock} produto(s) que precisam de reposição
          </Link>
        )}

        <Card className="mt-6 p-5">
          <div className="mb-4">
            <h2 className="text-[15px] font-semibold text-ink">Faturamento diário</h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">Por marketplace, últimos {WINDOW_DAYS} dias.</p>
          </div>
          <RevenueLine data={series} />
        </Card>

        <Card className="mt-6">
          <CardHeader title="Suas lojas" subtitle={`${rollups.length} conectada(s).`} />
          {rollups.length === 0 ? (
            <Empty
              title="Nenhuma loja conectada"
              hint="Conecte sua primeira loja para os números aparecerem aqui."
              action={<BotaoLink href="/integracoes">Conectar uma loja</BotaoLink>}
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {rollups.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <PlatformBadge platform={r.platform} />
                  <span className="min-w-0 flex-1 font-medium text-ink">{r.shopName}</span>
                  <span className="text-sm font-semibold text-ink tabular">{brl(r.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </>
  );
}
