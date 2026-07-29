import { CalendarClock, CircleCheck, Wallet } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, InvoicePill, PageHeader, Stat } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { clientBilling } from "@/lib/billing";
import { brl, date } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PortalFaturasPage() {
  const user = await requireClient();
  const billing = await clientBilling(user.clientId);
  const sub = billing.subscription;

  const destaque = billing.open[0] ?? billing.current;

  return (
    <>
      <Topbar crumb="Faturas" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Faturas" subtitle="Sua mensalidade, vencimentos e histórico de pagamento." />

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Mensalidade"
            value={sub ? brl(sub.amount) : "—"}
            hint={sub ? `vence dia ${sub.dueDay} · ${sub.method}` : "sem contrato ativo"}
            icon={<Wallet size={18} />}
            tone="brand"
          />
          <Stat label="Em aberto" value={brl(billing.openTotal)} tone="series-2" />
          <Stat label="Total já pago" value={brl(billing.paidTotal)} icon={<CircleCheck size={18} />} tone="good" />
        </div>

        {destaque && destaque.status !== "PAGO" && (
          <Card className="mt-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  Fatura em aberto · competência {destaque.reference}
                </p>
                <p className="mt-2 text-[32px] font-bold leading-none text-ink">{brl(destaque.amount)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <InvoicePill status={destaque.status as "PAGO" | "PENDENTE" | "ATRASADO"} />
                  <span className="text-[13px] text-ink-2">Vencimento em {date(destaque.dueDate)}</span>
                </div>
              </div>

              <div className="min-w-[240px] rounded-xl border border-line bg-surface-2 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  Pagamento via {destaque.method}
                </p>
                <p className="mt-2 text-[13px] text-ink-2">
                  Faça o pagamento e envie o comprovante pelo Suporte. Seu gestor dá a baixa e o status atualiza aqui.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <CardHeader title="Histórico" subtitle={`${billing.all.length} fatura(s).`} />
            {billing.all.length === 0 ? (
              <Empty title="Nenhuma fatura ainda" hint="Suas mensalidades aparecerão aqui assim que forem geradas." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                      <th className="px-5 py-3.5">Competência</th>
                      <th className="px-5 py-3.5 text-right">Valor</th>
                      <th className="px-5 py-3.5">Vencimento</th>
                      <th className="px-5 py-3.5">Pago em</th>
                      <th className="px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {billing.all.map((i) => (
                      <tr key={i.id} className="transition-colors hover:bg-surface-2">
                        <td className="px-5 py-4 font-medium text-ink tabular">{i.reference}</td>
                        <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(i.amount)}</td>
                        <td className="px-5 py-4 text-ink-2 tabular">{date(i.dueDate)}</td>
                        <td className="px-5 py-4 text-ink-2 tabular">{i.paidAt ? date(i.paidAt) : "—"}</td>
                        <td className="px-5 py-4">
                          <InvoicePill status={i.status as "PAGO" | "PENDENTE" | "ATRASADO"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Próximos vencimentos" />
            {billing.upcoming.length === 0 ? (
              <p className="px-5 py-5 text-[13px] text-ink-muted">Nenhum vencimento programado.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {billing.upcoming.map((d) => (
                  <li key={d.toISOString()} className="flex items-center gap-3 px-5 py-3.5">
                    <CalendarClock size={16} className="text-ink-muted" aria-hidden />
                    <span className="flex-1 text-sm text-ink-2 tabular">{date(d)}</span>
                    <span className="text-sm font-semibold text-ink tabular">{brl(sub?.amount ?? 0)}</span>
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
