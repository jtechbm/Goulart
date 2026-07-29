import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { ConnectStore } from "@/components/ConnectStore";
import { SyncButton } from "@/components/SyncButton";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, PageHeader, PlatformBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { relative } from "@/lib/format";
import { adapters, PLATFORM_LABEL, PLATFORM_SLUG, PLATFORMS } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "integracoes", label: "Integrações" },
  { key: "cobranca", label: "Cobrança" },
  { key: "notificacoes", label: "Notificações" },
];

const STATUS_STYLE = {
  CONNECTED: { label: "Conectado", color: "var(--good)", Icon: CircleCheck },
  PENDING: { label: "Pendente", color: "var(--warning)", Icon: TriangleAlert },
  EXPIRED: { label: "Expirado", color: "var(--warning)", Icon: TriangleAlert },
  ERROR: { label: "Erro", color: "var(--critical)", Icon: CircleAlert },
} as const;

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; ok?: string; erro?: string }>;
}) {
  await requirePermission("configuracoes");
  const sp = await searchParams;
  const aba = sp.aba ?? "integracoes";

  const [accounts, clients] = await Promise.all([
    prisma.account.findMany({
      include: { client: { select: { name: true } } },
      orderBy: [{ platform: "asc" }, { shopName: "asc" }],
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const platformOptions = PLATFORMS.map((p) => ({
    slug: PLATFORM_SLUG[p],
    label: PLATFORM_LABEL[p],
    configured: adapters[p].isConfigured(),
  }));
  const missing = platformOptions.filter((p) => !p.configured);

  return (
    <>
      <Topbar crumb="Configurações" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Configurações" />

        {sp.ok && (
          <div
            className="mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
            role="status"
            style={{
              borderColor: "var(--good)",
              backgroundColor: "color-mix(in srgb, var(--good) 10%, transparent)",
              color: "var(--good-text)",
            }}
          >
            <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
            {sp.ok}
          </div>
        )}
        {sp.erro && (
          <div
            className="mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
            role="alert"
            style={{
              borderColor: "var(--critical)",
              backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)",
              color: "var(--critical)",
            }}
          >
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            {sp.erro}
          </div>
        )}

        <div className="mb-6 flex gap-6 border-b border-line">
          {TABS.map((t) => {
            const active = aba === t.key;
            return (
              <Link
                key={t.key}
                href={t.key === "integracoes" ? "/configuracoes" : `/configuracoes?aba=${t.key}`}
                aria-current={active ? "page" : undefined}
                className={`-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  active ? "border-brand text-brand" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {aba === "integracoes" && (
          <div className="space-y-6">
            {missing.length > 0 && (
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <TriangleAlert size={18} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Credenciais pendentes: {missing.map((m) => m.label).join(", ")}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-2">
                      Preencha as chaves no arquivo <code className="rounded bg-surface-3 px-1.5 py-0.5">.env</code> e
                      reinicie o servidor. Os campos de cada plataforma estão documentados no{" "}
                      <code className="rounded bg-surface-3 px-1.5 py-0.5">.env.example</code>.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <CardHeader title="Conectar nova loja" subtitle="O lojista autoriza direto no marketplace (OAuth)." />
              <ConnectStore clients={clients} platforms={platformOptions} />
            </Card>

            <Card>
              <CardHeader
                title="Marketplaces conectados"
                subtitle={`${accounts.length} loja(s) autorizada(s).`}
                action={<SyncButton label="Sincronizar tudo" />}
              />
              {accounts.length === 0 ? (
                <Empty title="Nenhuma loja conectada" hint="Use o bloco acima para autorizar a primeira loja." />
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {accounts.map((a) => {
                    const s = STATUS_STYLE[a.status as keyof typeof STATUS_STYLE] ?? STATUS_STYLE.PENDING;
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <PlatformBadge platform={a.platform} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink">{a.shopName}</p>
                          <p className="text-[13px] text-ink-muted">
                            {a.client.name} · id {a.externalId} · sync {relative(a.lastSyncAt)}
                          </p>
                          {a.statusNote && (
                            <p className="mt-0.5 text-[12px]" style={{ color: s.color }}>
                              {a.statusNote}
                            </p>
                          )}
                        </div>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{ color: s.color, backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)` }}
                        >
                          <s.Icon size={13} aria-hidden />
                          {s.label}
                        </span>
                        <a
                          href={`/api/oauth/${PLATFORM_SLUG[a.platform as keyof typeof PLATFORM_SLUG]}/start?client=${a.clientId}`}
                          className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                        >
                          Reconectar
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        )}

        {aba === "cobranca" && (
          <Card>
            <CardHeader title="Cobrança" subtitle="Padrões aplicados às novas mensalidades." />
            <dl className="divide-y divide-[var(--border)]">
              {[
                ["Dia de vencimento padrão", "Dia 10"],
                ["Meio de pagamento", "PIX"],
                ["Lembrete automático", "3 dias antes do vencimento"],
                ["Marcar como atrasado", "1 dia após o vencimento"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-5 py-4">
                  <dt className="text-sm text-ink-2">{k}</dt>
                  <dd className="text-sm font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {aba === "notificacoes" && (
          <Card>
            <CardHeader title="Notificações" subtitle="Quando o painel deve te avisar." />
            <dl className="divide-y divide-[var(--border)]">
              {[
                ["Queda de faturamento", "a partir de 15% em 30 dias"],
                ["Penalidade no marketplace", "imediato"],
                ["Integração expirada", "imediato"],
                ["Sync sem rodar", "após 48h"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-5 py-4">
                  <dt className="text-sm text-ink-2">{k}</dt>
                  <dd className="text-sm font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </main>
    </>
  );
}
