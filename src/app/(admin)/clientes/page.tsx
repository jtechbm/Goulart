import { ArrowRight, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { Card, Empty, HealthPill, PageHeader, PlatformBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { brl } from "@/lib/format";
import { accountRollups, healthOfClient } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission("clientes");
  const { q } = await searchParams;
  const [clients, rollups] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      include: { accounts: true, users: { select: { id: true, active: true } } },
    }),
    accountRollups(),
  ]);

  const term = (q ?? "").trim().toLowerCase();
  const filtered = term
    ? clients.filter((c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term))
    : clients;

  return (
    <>
      <Topbar crumb="Clientes" />
      <main className="flex-1 px-6 py-8">
        <PageHeader
          title="Clientes"
          subtitle={`${clients.length} cliente(s) na carteira.`}
          action={
            <Link
              href="/clientes/novo"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
            >
              <Plus size={16} /> Novo cliente
            </Link>
          }
        />

        <form className="mb-5 max-w-md">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar cliente..."
            aria-label="Buscar cliente"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
          />
        </form>

        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <Empty
              title={term ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              hint={term ? "Tente outro termo de busca." : "Cadastre um cliente para conectar as lojas dele."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                    <th className="px-5 py-3.5">Cliente</th>
                    <th className="px-5 py-3.5">Telefone</th>
                    <th className="px-5 py-3.5">Contas</th>
                    <th className="px-5 py-3.5 text-right">Faturamento 30d</th>
                    <th className="px-5 py-3.5">Acesso</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((c) => {
                    const mine = rollups.filter((r) => r.clientId === c.id);
                    const revenue = mine.reduce((s, r) => s + r.revenue, 0);
                    return (
                      <tr key={c.id} className="transition-colors hover:bg-surface-2">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-ink">{c.name}</p>
                          <p className="text-[13px] text-ink-muted">{c.email}</p>
                        </td>
                        <td className="px-5 py-4 text-ink-2 tabular">{c.phone ?? "—"}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {c.accounts.length === 0 ? (
                              <span className="text-[13px] text-ink-muted">nenhuma</span>
                            ) : (
                              c.accounts.map((a) => <PlatformBadge key={a.id} platform={a.platform} short />)
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(revenue)}</td>
                        <td className="px-5 py-4">
                          {c.users.some((u) => u.active) ? (
                            <span className="text-[13px] text-ink-2">portal ativo</span>
                          ) : (
                            <span className="text-[13px] text-ink-muted">sem login</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <HealthPill health={healthOfClient(mine)} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/clientes/${c.id}`}
                            aria-label={`Abrir ${c.name}`}
                            className="inline-grid size-8 place-items-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                          >
                            <ArrowRight size={15} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
