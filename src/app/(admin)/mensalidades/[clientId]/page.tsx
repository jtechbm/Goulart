import { ArrowLeft, CalendarClock } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, InvoicePill, PageHeader, Stat } from "@/components/ui";
import { clientBilling } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { brl, date } from "@/lib/format";

export const dynamic = "force-dynamic";

async function salvarContrato(formData: FormData) {
  "use server";
  await requirePermission("mensalidades");
  const clientId = String(formData.get("clientId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const dueDay = Math.min(28, Math.max(1, Number(formData.get("dueDay") ?? 10)));
  const method = String(formData.get("method") ?? "PIX");
  const status = String(formData.get("status") ?? "ATIVA");
  if (!clientId || amount <= 0) return;

  await prisma.subscription.upsert({
    where: { clientId },
    create: { clientId, amount, dueDay, method, status },
    update: { amount, dueDay, method, status, canceledAt: status === "CANCELADA" ? new Date() : null },
  });

  revalidatePath(`/mensalidades/${clientId}`);
  revalidatePath("/mensalidades");
}

async function alternarPagamento(formData: FormData) {
  "use server";
  await requirePermission("mensalidades");
  const id = String(formData.get("invoiceId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return;

  const pago = invoice.status === "PAGO";
  await prisma.invoice.update({
    where: { id },
    data: pago
      ? { status: invoice.dueDate < new Date() ? "ATRASADO" : "PENDENTE", paidAt: null, paidNote: null }
      : { status: "PAGO", paidAt: new Date(), paidNote: "Baixa manual" },
  });

  revalidatePath(`/mensalidades/${clientId}`);
  redirect(`/mensalidades/${clientId}`);
}

export default async function ClienteMensalidadesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requirePermission("mensalidades");
  const { clientId } = await params;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  const billing = await clientBilling(clientId);
  const sub = billing.subscription;

  return (
    <>
      <Topbar crumb={`Mensalidades / ${client.name}`} />
      <main className="flex-1 px-6 py-8">
        <Link
          href="/mensalidades"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} /> Todas as mensalidades
        </Link>

        <PageHeader title={client.name} subtitle={client.email} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Mensalidade" value={sub ? brl(sub.amount) : "—"} hint={sub ? `vence dia ${sub.dueDay}` : "sem contrato"} />
          <Stat label="Total já pago" value={brl(billing.paidTotal)} tone="good" />
          <Stat label="Em aberto" value={brl(billing.openTotal)} tone="series-2" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden">
            <CardHeader title="Histórico de faturas" subtitle={`${billing.all.length} lançamento(s).`} />
            {billing.all.length === 0 ? (
              <Empty
                title="Nenhuma fatura"
                hint="Defina o contrato ao lado e use “Gerar faturas do mês” na listagem."
              />
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
                      <th className="px-5 py-3.5" />
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
                        <td className="px-5 py-4 text-right">
                          <form action={alternarPagamento}>
                            <input type="hidden" name="invoiceId" value={i.id} />
                            <input type="hidden" name="clientId" value={clientId} />
                            <button
                              type="submit"
                              className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                            >
                              {i.status === "PAGO" ? "Estornar" : "Dar baixa"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Contrato" />
              <form action={salvarContrato} className="space-y-4 px-5 py-5">
                <input type="hidden" name="clientId" value={clientId} />

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    Valor mensal (R$)
                  </span>
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    defaultValue={sub?.amount ?? ""}
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    Dia do vencimento (1–28)
                  </span>
                  <input
                    name="dueDay"
                    type="number"
                    min="1"
                    max="28"
                    required
                    defaultValue={sub?.dueDay ?? 10}
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    Forma de pagamento
                  </span>
                  <select
                    name="method"
                    defaultValue={sub?.method ?? "PIX"}
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink"
                  >
                    {["PIX", "Boleto", "Transferência", "Cartão"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    Situação
                  </span>
                  <select
                    name="status"
                    defaultValue={sub?.status ?? "ATIVA"}
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink"
                  >
                    {["ATIVA", "PAUSADA", "CANCELADA"].map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
                >
                  {sub ? "Atualizar contrato" : "Criar contrato"}
                </button>
              </form>
            </Card>

            <Card>
              <CardHeader title="Próximos vencimentos" />
              {billing.upcoming.length === 0 ? (
                <p className="px-5 py-5 text-[13px] text-ink-muted">
                  Nenhuma projeção — o contrato precisa estar ativo.
                </p>
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
        </div>
      </main>
    </>
  );
}
