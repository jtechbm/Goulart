import { BrainCircuit, Sparkles } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, HealthPill, PageHeader, PlatformBadge } from "@/components/ui";
import { parseFocuses, runAnalysis } from "@/lib/analysis";
import { prisma } from "@/lib/db";
import { relative } from "@/lib/format";

export const dynamic = "force-dynamic";

async function analisar(formData: FormData) {
  "use server";
  await requirePermission("analise");
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;
  const analysis = await runAnalysis(accountId);
  revalidatePath("/analise");
  revalidatePath("/relatorios");
  redirect(`/analise?conta=${accountId}&resultado=${analysis.id}`);
}

export default async function AnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string; resultado?: string }>;
}) {
  await requirePermission("analise");
  const sp = await searchParams;
  const accounts = await prisma.account.findMany({
    include: { client: { select: { name: true } } },
    orderBy: [{ client: { name: "asc" } }, { shopName: "asc" }],
  });

  const selectedId = sp.conta ?? accounts[0]?.id;
  const selected = accounts.find((a) => a.id === selectedId);

  const result = sp.resultado
    ? await prisma.analysis.findUnique({ where: { id: sp.resultado } })
    : selectedId
      ? await prisma.analysis.findFirst({ where: { accountId: selectedId }, orderBy: { createdAt: "desc" } })
      : null;

  const focuses = result ? parseFocuses(result.focuses) : [];

  return (
    <>
      <Topbar crumb="Análise de IA" />
      <main className="flex-1 px-6 py-8">
        <div className="mb-6 flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <BrainCircuit size={22} />
          </span>
          <PageHeader title="Análise de IA" subtitle="Fluxo GoulartERP — 5 focos sobre os dados sincronizados." />
        </div>

        {accounts.length === 0 ? (
          <Card>
            <Empty
              title="Nenhuma conta conectada"
              hint="Conecte uma loja em Configurações → Integrações para rodar a análise."
            />
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader title="Selecionar conta" />
              <form action={analisar} className="flex flex-wrap items-end gap-4 px-5 py-5">
                <label className="min-w-[280px] flex-1">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    Conta para analisar
                  </span>
                  <select
                    name="accountId"
                    defaultValue={selectedId}
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.client.name} — {a.shopName}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
                >
                  <Sparkles size={16} /> Rodar análise
                </button>
              </form>

              {selected && (
                <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3.5">
                  <PlatformBadge platform={selected.platform} />
                  <span className="text-[13px] text-ink-2">{selected.client.name}</span>
                  <span className="text-[13px] text-ink-muted">
                    último sync {relative(selected.lastSyncAt)}
                  </span>
                </div>
              )}
            </Card>

            {result && (
              <Card className="mt-6">
                <CardHeader
                  title={result.title}
                  subtitle={result.summary}
                  action={<HealthPill health={result.verdict as "SAUDAVEL" | "ATENCAO" | "CRITICO"} />}
                />
                <ol className="divide-y divide-[var(--border)]">
                  {focuses.map((f, i) => (
                    <li key={f.title} className="px-5 py-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid size-7 place-items-center rounded-lg bg-surface-3 text-[12px] font-bold text-ink-2 tabular">
                          {i + 1}
                        </span>
                        <h3 className="text-[15px] font-semibold text-ink">{f.title}</h3>
                        <HealthPill health={f.verdict} />
                      </div>
                      <p className="mt-2.5 text-sm text-ink-2">{f.finding}</p>
                      <p className="mt-2 text-sm">
                        <span className="font-semibold text-ink">Ação: </span>
                        <span className="text-ink-2">{f.action}</span>
                      </p>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}
