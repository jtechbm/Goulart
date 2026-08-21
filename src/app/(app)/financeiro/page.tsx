import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Plus, Wallet } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CashFlowLine, CostDonut } from "@/components/charts";
import { PrintButton } from "@/components/PrintButton";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, PageHeader, PlatformBadge, PrintHeader, Stat } from "@/components/ui";
import { comAviso, requireClient } from "@/lib/auth";
import { CANAL_LABEL } from "@/lib/canais";
import { listarCustomers } from "@/lib/customers";
import {
  baixarLancamento,
  CATEGORIA_LABEL,
  CATEGORIAS_PAGAR,
  CATEGORIAS_RECEBER,
  criarLancamento,
  despesasPorCategoria,
  fluxoDeCaixa,
  lancamentos,
  repasses,
  resumoFinanceiro,
  STATUS_COR,
  STATUS_LABEL,
} from "@/lib/finance";
import { brl, date } from "@/lib/format";
import { configuracoes } from "@/lib/settings";

export const dynamic = "force-dynamic";

const ABAS = [
  { key: "visao-geral", label: "Visão geral" },
  { key: "receber", label: "A receber" },
  { key: "pagar", label: "A pagar" },
  { key: "repasses", label: "Repasses" },
];

async function baixar(formData: FormData) {
  "use server";
  const user = await requireClient();
  const id = String(formData.get("id") ?? "");
  const aba = String(formData.get("aba") ?? "visao-geral");
  const ok = await baixarLancamento(id, user.clientId);
  revalidatePath("/financeiro");
  redirect(
    ok
      ? comAviso(`/financeiro?aba=${aba}`, "ok", "Lançamento baixado.")
      : comAviso(`/financeiro?aba=${aba}`, "erro", "Não foi possível baixar."),
  );
}

async function novoLancamento(formData: FormData) {
  "use server";
  const user = await requireClient();
  const aba = String(formData.get("aba") ?? "receber");
  const kind = aba === "pagar" ? "PAGAR" : "RECEBER";

  try {
    await criarLancamento({
      clientId: user.clientId,
      kind,
      category: String(formData.get("category") ?? ""),
      description: String(formData.get("description") ?? ""),
      amount: Number(String(formData.get("amount") ?? "0").replace(",", ".")),
      dueDate: new Date(String(formData.get("dueDate") ?? "")),
      customerId: String(formData.get("customerId") ?? "") || null,
    });
  } catch (err) {
    redirect(comAviso(`/financeiro?aba=${aba}`, "erro", err instanceof Error ? err.message : String(err)));
  }

  revalidatePath("/financeiro");
  redirect(comAviso(`/financeiro?aba=${aba}`, "ok", "Lançamento criado."));
}

function StatusPill({ status }: { status: keyof typeof STATUS_LABEL }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ color: STATUS_COR[status], backgroundColor: `color-mix(in srgb, ${STATUS_COR[status]} 16%, transparent)` }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; ok?: string; erro?: string }>;
}) {
  const user = await requireClient();
  const sp = await searchParams;
  const aba = ABAS.some((a) => a.key === sp.aba) ? sp.aba! : "visao-geral";

  const [resumo, config] = await Promise.all([resumoFinanceiro(user.clientId), configuracoes(user.clientId)]);
  const abaLabel = ABAS.find((a) => a.key === aba)?.label ?? "Visão geral";

  return (
    <>
      <Topbar crumb="Financeiro" />
      <main className="flex-1 px-6 py-8 print:px-0 print:py-0">
        <PrintHeader empresa={config.companyName} periodo={`Financeiro · ${abaLabel}`} />
        <PageHeader title="Financeiro" subtitle="Caixa, contas e repasses da loja." action={<PrintButton />} />

        {sp.ok && (
          <p role="status" className="mb-5 rounded-xl border px-4 py-3 text-[13px] print:hidden" style={{ borderColor: "var(--good)", backgroundColor: "color-mix(in srgb, var(--good) 10%, transparent)", color: "var(--good-text)" }}>
            {sp.ok}
          </p>
        )}
        {sp.erro && (
          <p role="alert" className="mb-5 rounded-xl border px-4 py-3 text-[13px] print:hidden" style={{ borderColor: "var(--critical)", backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)", color: "var(--critical)" }}>
            {sp.erro}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Saldo do mês" value={brl(resumo.saldoMes)} icon={<Wallet size={18} />} tone={resumo.saldoMes >= 0 ? "good" : "critical"} />
          <Stat label="A receber" value={brl(resumo.aReceber)} icon={<ArrowUpCircle size={18} />} tone="series-1" />
          <Stat label="A pagar" value={brl(resumo.aPagar)} icon={<ArrowDownCircle size={18} />} tone="series-2" />
          <Stat
            label="Vencido"
            value={brl(resumo.vencido)}
            hint={`${brl(resumo.vencidoPagar)} a pagar · ${brl(resumo.vencidoReceber)} a receber`}
            icon={<AlertTriangle size={18} />}
            tone="critical"
          />
        </div>

        <div className="my-5 flex w-fit flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1 print:hidden">
          {ABAS.map((a) => (
            <Link
              key={a.key}
              href={a.key === "visao-geral" ? "/financeiro" : `/financeiro?aba=${a.key}`}
              aria-current={aba === a.key ? "true" : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                aba === a.key ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {a.label}
            </Link>
          ))}
        </div>

        {aba === "visao-geral" && <AbaVisaoGeral clientId={user.clientId} />}
        {aba === "receber" && <AbaLancamentos clientId={user.clientId} kind="RECEBER" />}
        {aba === "pagar" && <AbaLancamentos clientId={user.clientId} kind="PAGAR" />}
        {aba === "repasses" && <AbaRepasses clientId={user.clientId} />}
      </main>
    </>
  );
}

async function AbaVisaoGeral({ clientId }: { clientId: string }) {
  const de = new Date();
  de.setDate(de.getDate() - 30);
  const [fluxo, despesas] = await Promise.all([fluxoDeCaixa(clientId, 30), despesasPorCategoria(clientId, de, new Date())]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5 break-inside-avoid">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-ink">Fluxo de caixa</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Entradas, saídas e saldo acumulado nos últimos 30 dias.</p>
        </div>
        <CashFlowLine data={fluxo} />
      </Card>
      <Card className="p-5 break-inside-avoid">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-ink">Despesas por categoria</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Últimos 30 dias.</p>
        </div>
        {despesas.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">Nenhuma despesa cadastrada no período.</p>
        ) : (
          <CostDonut fatias={despesas.map((d) => ({ label: d.label, value: d.valor }))} />
        )}
      </Card>
    </div>
  );
}

async function AbaLancamentos({ clientId, kind }: { clientId: string; kind: "RECEBER" | "PAGAR" }) {
  const [rows, clientes] = await Promise.all([
    lancamentos(clientId, { kind }),
    kind === "RECEBER" ? listarCustomers(clientId, "CLIENTE") : listarCustomers(clientId, "FORNECEDOR"),
  ]);
  const categorias = kind === "RECEBER" ? CATEGORIAS_RECEBER : CATEGORIAS_PAGAR;
  const aba = kind === "RECEBER" ? "receber" : "pagar";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden break-inside-avoid">
        {rows.length === 0 ? (
          <Empty title={kind === "RECEBER" ? "Nenhum recebível" : "Nenhuma conta a pagar"} hint="Lance o primeiro no formulário abaixo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  <th className="px-5 py-3.5">Descrição</th>
                  <th className="px-5 py-3.5">Categoria</th>
                  <th className="px-5 py-3.5">Vencimento</th>
                  <th className="px-5 py-3.5 text-right">Valor</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 print:hidden" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink">{r.description}</p>
                      {r.customer && <p className="text-[13px] text-ink-muted">{r.customer.name}</p>}
                    </td>
                    <td className="px-5 py-4 text-ink-2">{CATEGORIA_LABEL[r.category] ?? r.category}</td>
                    <td className="px-5 py-4 text-ink-2 tabular">{date(r.dueDate)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(r.amount)}</td>
                    <td className="px-5 py-4">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-right print:hidden">
                      {r.status !== "PAGO" && (
                        <form action={baixar}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="aba" value={aba} />
                          <button type="submit" className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink">
                            Dar baixa
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="print:hidden">
        <CardHeader title={kind === "RECEBER" ? "Novo recebível" : "Nova conta a pagar"} />
        <form action={novoLancamento} className="space-y-3 px-5 py-5">
          <input type="hidden" name="aba" value={aba} />
          <input name="description" required placeholder="Descrição" className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted" />
          <div className="grid gap-3 sm:grid-cols-3">
            <select name="category" required className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink">
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c] ?? c}
                </option>
              ))}
            </select>
            <input name="amount" inputMode="decimal" required placeholder="Valor" className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular placeholder:text-ink-muted" />
            <input name="dueDate" type="date" required className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink" />
          </div>
          {clientes.length > 0 && (
            <select name="customerId" className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink">
              <option value="">{kind === "RECEBER" ? "Sem cliente vinculado" : "Sem fornecedor vinculado"}</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover">
            <Plus size={15} /> Lançar
          </button>
        </form>
      </Card>
    </div>
  );
}

async function AbaRepasses({ clientId }: { clientId: string }) {
  const rows = await repasses(clientId);

  if (rows.length === 0) {
    return (
      <Card>
        <Empty title="Nenhum repasse registrado" hint="Repasses de marketplace aparecem aqui conforme o financeiro é lançado." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden break-inside-avoid">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              <th className="px-5 py-3.5">Canal</th>
              <th className="px-5 py-3.5">Data prevista</th>
              <th className="px-5 py-3.5 text-right">Valor</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-surface-2">
                <td className="px-5 py-4">
                  <PlatformBadge platform={r.platform ?? ""} short />
                  <span className="ml-2 text-[13px] text-ink-muted">{CANAL_LABEL[(r.platform ?? "") as keyof typeof CANAL_LABEL] ?? r.platform}</span>
                </td>
                <td className="px-5 py-4 text-ink-2 tabular">{date(r.dueDate)}</td>
                <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(r.amount)}</td>
                <td className="px-5 py-4">
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
