import { FileText } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { Card, Empty, HealthPill, PageHeader, PlatformBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { date } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "todas", label: "Todas" },
  { key: "MERCADO_LIVRE", label: "ML" },
  { key: "SHOPEE", label: "Shopee" },
  { key: "TIKTOK_SHOP", label: "TikTok" },
];

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ plataforma?: string }>;
}) {
  await requirePermission("relatorios");
  const { plataforma = "todas" } = await searchParams;

  const analyses = await prisma.analysis.findMany({
    where: plataforma === "todas" ? undefined : { account: { platform: plataforma } },
    include: { account: { include: { client: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <Topbar crumb="Relatórios" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Relatórios" subtitle="Análises geradas para cada conta." />

        <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => {
            const active = plataforma === t.key;
            return (
              <Link
                key={t.key}
                href={t.key === "todas" ? "/relatorios" : `/relatorios?plataforma=${t.key}`}
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

        <Card className="overflow-hidden">
          {analyses.length === 0 ? (
            <Empty
              title="Nenhum relatório gerado"
              hint="Rode uma análise em Análise de IA para gerar o primeiro relatório."
              action={
                <Link href="/analise" className="text-[13px] font-semibold text-brand hover:underline">
                  Ir para Análise de IA
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    <th className="px-5 py-3.5">Relatório</th>
                    <th className="px-5 py-3.5">Cliente</th>
                    <th className="px-5 py-3.5">Plataforma</th>
                    <th className="px-5 py-3.5">Data</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {analyses.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                            <FileText size={16} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">{a.title}</p>
                            <p className="line-clamp-1 text-[13px] text-ink-muted">{a.summary}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-ink-2">{a.account.client.name}</td>
                      <td className="px-5 py-4">
                        <PlatformBadge platform={a.account.platform} />
                      </td>
                      <td className="px-5 py-4 text-ink-2 tabular">{date(a.createdAt)}</td>
                      <td className="px-5 py-4">
                        <HealthPill health={a.verdict as "SAUDAVEL" | "ATENCAO" | "CRITICO"} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/analise?conta=${a.accountId}&resultado=${a.id}`}
                          className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                        >
                          Abrir
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
