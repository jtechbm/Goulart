import { ArrowRight, CircleAlert, CircleCheck, RefreshCw, Repeat, Wallet } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, InvoicePill, PageHeader, Stat } from "@/components/ui";
import { billingRows, runBilling } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { brl, date } from "@/lib/format";

export const dynamic = "force-dynamic";

async function gerarFaturas() {
  "use server";
  await requirePermission("mensalidades");
  await runBilling();
  revalidatePath("/mensalidades");
}

async function darBaixa(formData: FormData) {
  "use server";
  await requirePermission("mensalidades");
  const id = String(formData.get("invoiceId") ?? "");
  if (!id) return;
  await prisma.invoice.update({
    where: { id },
    data: { status: "PAGO", paidAt: new Date(), paidNote: "Baixa manual" },
  });
  revalidatePath("/mensalidades");
}

export default async function MensalidadesPage() {
  await requirePermission("mensalidades");
  const rows = await billingRows();

  const mrr = rows
    .filter((r) => r.subscription?.status === "ATIVA")
    .reduce((s, r) => s + (r.subscription?.amount ?? 0), 0);
  const toReceive = rows.filter((r) => r.current && r.current.status !== "PAGO").reduce((s, r) => s + (r.current?.amount ?? 0), 0);
  const received = rows.filter((r) => r.current?.status === "PAGO").reduce((s, r) => s + (r.current?.amount ?? 0), 0);
  const overdue = rows.reduce(
    (s, r) => s + [r.current, ...r.history].filter((i) => i?.status === "ATRASADO").reduce((n, i) => n + (i?.amount ?? 0), 0),
    0,
  );

  const semContrato = rows.filter((r) => !r.subscription).length;

  return (
    <>
      <Topbar crumb="Mensalidades" />
      <main className="flex-1 px-6 py-8">
        <PageHeader
          title="Mensalidades"
          subtitle="Contratos, faturas do mês e histórico de cada cliente."
          action={
            <form action={gerarFaturas}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
              >
                <RefreshCw size={16} /> Gerar faturas do mês
              </button>
            </form>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Receita recorrente" value={brl(mrr)} hint="contratos ativos" icon={<Repeat size={18} />} tone="brand" />
          <Stat label="A receber no mês" value={brl(toReceive)} icon={<Wallet size={18} />} tone="series-1" />
          <Stat label="Recebido no mês" value={brl(received)} icon={<CircleCheck size={18} />} tone="good" />
          <Stat label="Em atraso" value={brl(overdue)} icon={<CircleAlert size={18} />} tone="series-2" />
        </div>

        {semContrato > 0 && (
          <p className="mt-4 text-[13px] text-ink-muted">
            {semContrato} cliente(s) ainda sem contrato cadastrado — abra o cliente para definir o valor da mensalidade.
          </p>
        )}

        <Card className="mt-6 overflow-hidden">
          <CardHeader title="Clientes" subtitle={`${rows.length} na carteira.`} />
          {rows.length === 0 ? (
            <Empty title="Nenhum cliente" hint="Cadastre um cliente para começar a cobrar." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    <th className="px-5 py-3.5">Cliente</th>
                    <th className="px-5 py-3.5 text-right">Mensalidade</th>
                    <th className="px-5 py-3.5">Fatura do mês</th>
                    <th className="px-5 py-3.5">Próximo vencimento</th>
                    <th className="px-5 py-3.5 text-right">Já pago</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((r) => (
                    <tr key={r.clientId} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-ink">{r.clientName}</p>
                        <p className="text-[13px] text-ink-muted">
                          {r.subscription
                            ? `cliente há ${r.monthsAsClient} ${r.monthsAsClient === 1 ? "mês" : "meses"}`
                            : "sem contrato"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {r.subscription ? (
                          <>
                            <p className="font-semibold text-ink tabular">{brl(r.subscription.amount)}</p>
                            <p className="text-[13px] text-ink-muted">
                              dia {r.subscription.dueDay} · {r.subscription.method}
                            </p>
                          </>
                        ) : (
                          <span className="text-[13px] text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {r.current ? (
                          <div className="flex items-center gap-2">
                            <InvoicePill status={r.current.status as "PAGO" | "PENDENTE" | "ATRASADO"} />
                            {r.current.status !== "PAGO" && (
                              <form action={darBaixa}>
                                <input type="hidden" name="invoiceId" value={r.current.id} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                                >
                                  Dar baixa
                                </button>
                              </form>
                            )}
                          </div>
                        ) : (
                          <span className="text-[13px] text-ink-muted">não gerada</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-ink-2 tabular">
                        {r.upcoming[0] ? date(r.upcoming[0]) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(r.paidTotal)}</td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/mensalidades/${r.clientId}`}
                          aria-label={`Abrir mensalidades de ${r.clientName}`}
                          className="inline-grid size-8 place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
