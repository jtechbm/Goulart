import { PackageX, TriangleAlert } from "lucide-react";
import { Card, Empty, PlatformBadge } from "./ui";
import { brl, num, relative } from "@/lib/format";
import { LOW_STOCK } from "@/lib/inventory";

export type InventoryRow = {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  stock: number;
  status: string;
  soldCount: number;
  permalink: string | null;
  syncedAt: Date;
  account: { shopName: string; platform: string; client?: { name: string } | null };
};

// reexportado para as telas continuarem importando daqui junto com a tabela
export { LOW_STOCK };

export function stockTone(stock: number) {
  if (stock === 0) return { color: "var(--critical)", label: "Esgotado", Icon: PackageX };
  if (stock <= LOW_STOCK) return { color: "var(--warning)", label: "Estoque baixo", Icon: TriangleAlert };
  return null;
}

export function InventoryTable({
  rows,
  showClient = false,
  emptyHint,
}: {
  rows: InventoryRow[];
  showClient?: boolean;
  emptyHint?: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <Empty
          title="Nenhum produto sincronizado"
          hint={emptyHint ?? "O estoque é preenchido no sync das lojas conectadas."}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              <th className="px-5 py-3.5">Produto</th>
              {showClient && <th className="px-5 py-3.5">Cliente</th>}
              <th className="px-5 py-3.5">Loja</th>
              <th className="px-5 py-3.5 text-right">Preço</th>
              <th className="px-5 py-3.5 text-right">Estoque</th>
              <th className="px-5 py-3.5 text-right">Vendidos</th>
              <th className="px-5 py-3.5">Atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((p) => {
              const tone = stockTone(p.stock);
              return (
                <tr key={p.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-5 py-4">
                    <p className="line-clamp-1 font-medium text-ink">
                      {p.permalink ? (
                        <a href={p.permalink} target="_blank" rel="noreferrer" className="hover:underline">
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      {p.sku ? `SKU ${p.sku}` : "sem SKU"}
                      {p.status !== "active" && ` · ${p.status}`}
                    </p>
                  </td>
                  {showClient && <td className="px-5 py-4 text-ink-2">{p.account.client?.name ?? "—"}</td>}
                  <td className="px-5 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <PlatformBadge platform={p.account.platform} short />
                      <span className="text-[13px] text-ink-muted">{p.account.shopName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-ink-2 tabular">{brl(p.price)}</td>
                  <td className="px-5 py-4 text-right">
                    <span className="font-semibold text-ink tabular">{num(p.stock)}</span>
                    {tone && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium align-middle"
                        style={{ color: tone.color, backgroundColor: `color-mix(in srgb, ${tone.color} 14%, transparent)` }}
                      >
                        <tone.Icon size={11} aria-hidden />
                        {tone.label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right text-ink-2 tabular">{num(p.soldCount)}</td>
                  <td className="px-5 py-4 text-[13px] text-ink-muted">{relative(p.syncedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
