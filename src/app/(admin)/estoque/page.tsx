import { Boxes, PackageX, TriangleAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { InventoryTable, LOW_STOCK } from "@/components/InventoryTable";
import { Topbar } from "@/components/Topbar";
import { PageHeader, Stat } from "@/components/ui";
import { prisma } from "@/lib/db";
import { brl, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "baixo", label: `Estoque ≤ ${LOW_STOCK}` },
  { key: "zerado", label: "Esgotados" },
];

export default async function EstoqueAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; cliente?: string }>;
}) {
  await requirePermission("estoque");
  const sp = await searchParams;
  const filtro = sp.filtro ?? "todos";

  const where = {
    ...(sp.cliente ? { account: { clientId: sp.cliente } } : {}),
    ...(filtro === "zerado" ? { stock: 0 } : filtro === "baixo" ? { stock: { lte: LOW_STOCK } } : {}),
  };

  const [rows, all, clients] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { account: { select: { shopName: true, platform: true, client: { select: { name: true } } } } },
      orderBy: [{ stock: "asc" }, { title: "asc" }],
      take: 300,
    }),
    prisma.product.findMany({ select: { stock: true, price: true } }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const out = all.filter((p) => p.stock === 0).length;
  const low = all.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length;
  const value = all.reduce((s, p) => s + p.price * p.stock, 0);

  const link = (next: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...next })) if (v) qs.set(k, v);
    return `/estoque${qs.toString() ? `?${qs}` : ""}`;
  };

  return (
    <>
      <Topbar crumb="Estoque" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Estoque" subtitle="Catálogo consolidado de todas as lojas da carteira." />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Produtos" value={num(all.length)} icon={<Boxes size={18} />} tone="brand" />
          <Stat label="Esgotados" value={num(out)} icon={<PackageX size={18} />} tone="series-2" />
          <Stat label={`Estoque ≤ ${LOW_STOCK}`} value={num(low)} icon={<TriangleAlert size={18} />} tone="series-3" />
          <Stat label="Valor em estoque" value={brl(value)} tone="series-1" />
        </div>

        <div className="my-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={link({ filtro: f.key === "todos" ? undefined : f.key })}
                aria-current={filtro === f.key ? "true" : undefined}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  filtro === f.key ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>

          <form className="flex items-center gap-2">
            <input type="hidden" name="filtro" value={filtro === "todos" ? "" : filtro} />
            <select
              name="cliente"
              defaultValue={sp.cliente ?? ""}
              className="rounded-xl border border-line bg-surface px-3.5 py-2 text-[13px] text-ink"
            >
              <option value="">Todos os clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl border border-line px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
            >
              Filtrar
            </button>
          </form>
        </div>

        <InventoryTable
          rows={rows}
          showClient
          emptyHint="Conecte uma loja e rode o sync — o catálogo vem junto com os pedidos."
        />
      </main>
    </>
  );
}
