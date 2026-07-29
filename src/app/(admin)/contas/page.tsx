import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { SyncButton } from "@/components/SyncButton";
import { Topbar } from "@/components/Topbar";
import { Card, Delta, Empty, HealthPill, PageHeader, PlatformBadge } from "@/components/ui";
import { brl, relative } from "@/lib/format";
import { accountRollups, healthOf, WINDOW_DAYS } from "@/lib/queries";

export const dynamic = "force-dynamic";

const PLATFORM_FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "MERCADO_LIVRE", label: "ML" },
  { key: "SHOPEE", label: "Shopee" },
  { key: "TIKTOK_SHOP", label: "TikTok" },
];

const HEALTH_FILTERS = [
  { key: "todos", label: "Status" },
  { key: "SAUDAVEL", label: "Saudável" },
  { key: "ATENCAO", label: "Atenção" },
  { key: "CRITICO", label: "Crítico" },
];

function FilterRow({
  options,
  active,
  param,
  current,
}: {
  options: Array<{ key: string; label: string }>;
  active: string;
  param: string;
  current: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1">
      {options.map((o) => {
        const next = new URLSearchParams(current);
        if (o.key === options[0].key) next.delete(param);
        else next.set(param, o.key);
        const isActive = active === o.key;
        return (
          <Link
            key={o.key}
            href={`/contas${next.toString() ? `?${next}` : ""}`}
            aria-current={isActive ? "true" : undefined}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              isActive ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<{ plataforma?: string; saude?: string; cliente?: string; penalidade?: string }>;
}) {
  await requirePermission("contas");
  const sp = await searchParams;
  const rollups = await accountRollups();

  const plataforma = sp.plataforma ?? "todas";
  const saude = sp.saude ?? "todos";

  let rows = rollups;
  if (plataforma !== "todas") rows = rows.filter((r) => r.platform === plataforma);
  if (saude !== "todos") rows = rows.filter((r) => healthOf(r) === saude);
  if (sp.cliente) rows = rows.filter((r) => r.clientId === sp.cliente);
  if (sp.penalidade === "1") rows = rows.filter((r) => r.hasPenalty);

  const current = Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>;
  const penaltyParams = new URLSearchParams(current);
  if (sp.penalidade === "1") penaltyParams.delete("penalidade");
  else penaltyParams.set("penalidade", "1");

  return (
    <>
      <Topbar crumb="Contas" />
      <main className="flex-1 px-6 py-8">
        <PageHeader
          title="Contas"
          subtitle={`${rollups.length} conta(s) conectada(s) em 3 marketplaces.`}
          action={<SyncButton label="Sincronizar tudo" />}
        />

        {/* filtros em uma linha, acima da tabela */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <FilterRow options={PLATFORM_FILTERS} active={plataforma} param="plataforma" current={current} />
          <FilterRow options={HEALTH_FILTERS} active={saude} param="saude" current={current} />
          <Link
            href={`/contas${penaltyParams.toString() ? `?${penaltyParams}` : ""}`}
            className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors ${
              sp.penalidade === "1"
                ? "border-brand bg-brand-soft text-brand"
                : "border-line text-ink-2 hover:text-ink"
            }`}
          >
            Só com penalidade
          </Link>
        </div>

        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <Empty
              title="Nenhuma conta encontrada"
              hint="Ajuste os filtros ou conecte uma loja em Configurações → Integrações."
              action={
                <Link href="/configuracoes" className="text-[13px] font-semibold text-brand hover:underline">
                  Ir para Integrações
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    <th className="px-5 py-3.5">Loja</th>
                    <th className="px-5 py-3.5">Plataforma</th>
                    <th className="px-5 py-3.5">Cliente</th>
                    <th className="px-5 py-3.5 text-right">Faturamento {WINDOW_DAYS}d</th>
                    <th className="px-5 py-3.5 text-right">Variação</th>
                    <th className="px-5 py-3.5">Situação</th>
                    <th className="px-5 py-3.5">Sync</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-ink">{r.shopName}</p>
                        {r.reputation && <p className="text-[13px] text-ink-muted">{r.reputation}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <PlatformBadge platform={r.platform} />
                      </td>
                      <td className="px-5 py-4 text-ink-2">{r.clientName}</td>
                      <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(r.revenue)}</td>
                      <td className="px-5 py-4 text-right">
                        <Delta value={r.variation} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <HealthPill health={healthOf(r)} />
                          {r.hasPenalty && (
                            <span className="text-[11px]" style={{ color: "var(--critical)" }}>
                              {r.penaltyNote ?? "penalidade ativa"}
                            </span>
                          )}
                          {r.statusNote && <span className="text-[11px] text-ink-muted">{r.statusNote}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[13px] text-ink-muted">{relative(r.lastSyncAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <SyncButton accountId={r.id} label="Sync" />
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
