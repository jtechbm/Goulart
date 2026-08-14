import { Plug } from "lucide-react";
import Link from "next/link";
import { SyncButton } from "@/components/SyncButton";
import { Topbar } from "@/components/Topbar";
import { Card, Delta, Empty, PageHeader, PlatformBadge } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { brl, num, relative } from "@/lib/format";
import { accountRollups, WINDOW_DAYS } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LojasPage() {
  const user = await requireClient();
  const rollups = await accountRollups(user.clientId, WINDOW_DAYS);

  return (
    <>
      <Topbar crumb="Minhas lojas" />
      <main className="flex-1 px-6 py-8">
        <PageHeader
          title="Minhas lojas"
          subtitle={`Desempenho de cada conta nos últimos ${WINDOW_DAYS} dias.`}
          action={rollups.length > 0 ? <SyncButton label="Atualizar agora" /> : undefined}
        />

        {rollups.length === 0 ? (
          <Card>
            <Empty
              title="Nenhuma loja conectada"
              hint="Conecte suas contas de marketplace para acompanhar o desempenho aqui."
              action={
                <Link
                  href="/integracoes"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
                >
                  <Plug size={15} /> Conectar uma loja
                </Link>
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    <th className="px-5 py-3.5">Loja</th>
                    <th className="px-5 py-3.5">Plataforma</th>
                    <th className="px-5 py-3.5 text-right">Faturamento</th>
                    <th className="px-5 py-3.5 text-right">Variação</th>
                    <th className="px-5 py-3.5 text-right">Pedidos</th>
                    <th className="px-5 py-3.5">Reputação</th>
                    <th className="px-5 py-3.5">Atualizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rollups.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-4 font-semibold text-ink">{r.shopName}</td>
                      <td className="px-5 py-4">
                        <PlatformBadge platform={r.platform} />
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(r.revenue)}</td>
                      <td className="px-5 py-4 text-right">
                        <Delta value={r.variation} />
                      </td>
                      <td className="px-5 py-4 text-right text-ink-2 tabular">{num(r.orders)}</td>
                      <td className="px-5 py-4">
                        <span className="text-[13px] text-ink-2">{r.reputation ?? "—"}</span>
                        {r.hasPenalty && (
                          <span className="block text-[12px]" style={{ color: "var(--critical)" }}>
                            {r.penaltyNote ?? "penalidade ativa"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-ink-muted">{relative(r.lastSyncAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
