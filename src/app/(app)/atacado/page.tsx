import { DollarSign, Package, PackagePlus, Plus, Store, Trash2, TrendingUp, Upload } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, PageHeader, PlatformBadge, PrintHeader, Stat } from "@/components/ui";
import { comAviso, requireClient } from "@/lib/auth";
import { listarClientesAtivos } from "@/lib/customers";
import { brl, num } from "@/lib/format";
import { createManualProduct } from "@/lib/inventory";
import { faixaMargem } from "@/lib/sales";
import { configuracoes } from "@/lib/settings";
import {
  catalogoAtacado,
  catalogoParaImportar,
  contaAtacado,
  criarPedidoAtacado,
  definirPrecoAtacado,
  pedidosAtacado,
  removerDoAtacado,
  resumoAtacado,
} from "@/lib/wholesale";

export const dynamic = "force-dynamic";

const ABAS = [
  { key: "pedidos", label: "Pedidos" },
  { key: "catalogo", label: "Catálogo" },
  { key: "novo-pedido", label: "Novo pedido" },
];

const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

async function precificar(formData: FormData) {
  "use server";
  const user = await requireClient();
  const r = await definirPrecoAtacado({
    productId: String(formData.get("productId") ?? ""),
    clientId: user.clientId,
    wholesalePrice: Number(String(formData.get("wholesalePrice") ?? "0").replace(",", ".")),
    wholesaleMinQty: Number(formData.get("wholesaleMinQty") ?? 1),
  });
  revalidatePath("/atacado");
  redirect(
    r.ok
      ? comAviso("/atacado?aba=catalogo", "ok", "Preço de atacado definido.")
      : comAviso("/atacado?aba=catalogo", "erro", r.message ?? "Não foi possível salvar."),
  );
}

async function remover(formData: FormData) {
  "use server";
  const user = await requireClient();
  await removerDoAtacado(String(formData.get("productId") ?? ""), user.clientId);
  revalidatePath("/atacado");
  redirect(comAviso("/atacado?aba=catalogo", "ok", "Produto removido do atacado."));
}

async function novoProdutoAtacado(formData: FormData) {
  "use server";
  const user = await requireClient();
  const title = String(formData.get("title") ?? "").trim();
  const wholesalePrice = Number(String(formData.get("wholesalePrice") ?? "0").replace(",", "."));
  if (!title || wholesalePrice <= 0) {
    redirect(comAviso("/atacado?aba=catalogo", "erro", "Informe o produto e o preço de atacado."));
  }

  try {
    const conta = await contaAtacado(user.clientId);
    const produto = await createManualProduct({
      accountId: conta.id,
      title,
      sku: String(formData.get("sku") ?? "").trim() || null,
      price: wholesalePrice,
      stock: Number(formData.get("stock") ?? 0),
      authorId: user.id,
      authorName: user.name,
      clientId: user.clientId,
    });
    await definirPrecoAtacado({
      productId: produto.id,
      clientId: user.clientId,
      wholesalePrice,
      wholesaleMinQty: Number(formData.get("wholesaleMinQty") ?? 1),
    });
  } catch (err) {
    redirect(comAviso("/atacado?aba=catalogo", "erro", err instanceof Error ? err.message : String(err)));
  }

  revalidatePath("/atacado");
  redirect(comAviso("/atacado?aba=catalogo", "ok", "Produto de atacado criado."));
}

async function criarPedido(formData: FormData) {
  "use server";
  const user = await requireClient();

  const customerId = String(formData.get("customerId") ?? "");
  const productIds = formData.getAll("productId").map(String);
  const quantidades = formData.getAll("quantidade").map(Number);
  const precos = formData.getAll("precoUnitario").map(Number);

  const itens = productIds
    .map((productId, i) => ({ productId, quantidade: quantidades[i] ?? 0, precoUnitario: precos[i] ?? 0 }))
    .filter((i) => i.quantidade > 0);

  if (!customerId || itens.length === 0) {
    redirect(comAviso("/atacado?aba=novo-pedido", "erro", "Escolha o cliente e ao menos um item com quantidade."));
  }

  try {
    await criarPedidoAtacado({ clientId: user.clientId, customerId, authorId: user.id, authorName: user.name, itens });
  } catch (err) {
    redirect(comAviso("/atacado?aba=novo-pedido", "erro", err instanceof Error ? err.message : String(err)));
  }

  revalidatePath("/atacado");
  revalidatePath("/estoque");
  redirect(comAviso("/atacado", "ok", "Pedido de atacado registrado e estoque atualizado."));
}

export default async function AtacadoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; ok?: string; erro?: string }>;
}) {
  const user = await requireClient();
  const sp = await searchParams;
  const aba = ABAS.some((a) => a.key === sp.aba) ? sp.aba! : "pedidos";

  const [resumo, config] = await Promise.all([resumoAtacado(user.clientId, 30), configuracoes(user.clientId)]);
  const abaLabel = ABAS.find((a) => a.key === aba)?.label ?? "Pedidos";

  return (
    <>
      <Topbar crumb="Atacado" />
      <main className="flex-1 px-6 py-8 print:px-0 print:py-0">
        <PrintHeader empresa={config.companyName} periodo={`Atacado · ${abaLabel}`} />
        <PageHeader title="Atacado" subtitle="Vendas por fora dos marketplaces — mesmo estoque, canal próprio." action={<PrintButton />} />

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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Faturado (30 dias)" value={brl(resumo.total)} icon={<DollarSign size={18} />} tone="series-5" />
          <Stat label="Líquido" value={brl(resumo.liquido)} icon={<Package size={18} />} tone="series-1" />
          <Stat label="Lucro" value={brl(resumo.lucro)} icon={<TrendingUp size={18} />} tone={resumo.lucro >= 0 ? "good" : "critical"} />
          <Stat label="Margem" value={`${resumo.margem.toFixed(1).replace(".", ",")}%`} hint={faixaMargem(resumo.margem).rotulo} tone="brand" />
          <Stat label="Pedidos (30 dias)" value={num(resumo.pedidos)} icon={<Store size={18} />} tone="series-2" />
        </div>

        <div className="my-5 flex w-fit flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1 print:hidden">
          {ABAS.map((a) => (
            <Link
              key={a.key}
              href={a.key === "pedidos" ? "/atacado" : `/atacado?aba=${a.key}`}
              aria-current={aba === a.key ? "true" : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                aba === a.key ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {a.label}
            </Link>
          ))}
        </div>

        {aba === "pedidos" && <AbaPedidos clientId={user.clientId} />}
        {aba === "catalogo" && <AbaCatalogo clientId={user.clientId} />}
        {aba === "novo-pedido" && <AbaNovoPedido clientId={user.clientId} />}
      </main>
    </>
  );
}

async function AbaPedidos({ clientId }: { clientId: string }) {
  const pedidos = await pedidosAtacado(clientId, 90);

  if (pedidos.length === 0) {
    return (
      <Card>
        <Empty
          title="Nenhum pedido de atacado ainda"
          hint="Crie o primeiro em “Novo pedido”, depois de definir preços de atacado no Catálogo."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pedidos.map(({ pedido, linhas }) => (
        <Card key={pedido.id} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-5 py-3">
            <span className="text-[13px] font-medium text-ink tabular">{dia.format(pedido.placedAt)}</span>
            <span className="text-[13px] text-ink-muted">{pedido.customer?.name ?? "Cliente removido"}</span>
            <span className="ml-auto text-[13px] font-semibold text-ink tabular">{brl(pedido.gross)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Preço unit.</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Lucro</th>
                  <th className="px-4 py-3 text-right">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {linhas.map(({ item, r }) => {
                  const faixa = faixaMargem(r.margem);
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-surface-2">
                      <td className="max-w-[280px] px-4 py-3.5">
                        <p className="line-clamp-2 font-medium text-ink">{item.title}</p>
                        <p className="text-[12px] text-ink-muted">{item.sku ? `SKU ${item.sku}` : "sem SKU"}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right text-ink-2 tabular">{num(item.quantity)}</td>
                      <td className="px-4 py-3.5 text-right text-ink-2 tabular">{brl(item.unitPrice)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-ink tabular">{brl(r.total)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular" style={{ color: r.lucro >= 0 ? "var(--ink)" : "var(--critical)" }}>
                        {brl(r.lucro)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tabular"
                          style={{ color: faixa.cor, backgroundColor: `color-mix(in srgb, ${faixa.cor} 16%, transparent)` }}
                        >
                          {r.margem.toFixed(1).replace(".", ",")}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

async function AbaCatalogo({ clientId }: { clientId: string }) {
  const [noAtacado, paraImportar] = await Promise.all([catalogoAtacado(clientId), catalogoParaImportar(clientId)]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader title="No catálogo de atacado" subtitle={`${noAtacado.length} produto(s) vendável(is) no atacado.`} />
        {noAtacado.length === 0 ? (
          <p className="px-5 py-5 text-[13px] text-ink-muted">Nenhum produto no atacado ainda — importe abaixo ou cadastre um exclusivo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  <th className="px-5 py-3.5">Produto</th>
                  <th className="px-5 py-3.5">Origem</th>
                  <th className="px-5 py-3.5 text-right">Estoque</th>
                  <th className="px-5 py-3.5 text-right">Preço varejo</th>
                  <th className="px-5 py-3.5">Preço de atacado · mín.</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {noAtacado.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-4">
                      <p className="line-clamp-1 font-medium text-ink">{p.title}</p>
                      <p className="text-[13px] text-ink-muted">{p.sku ? `SKU ${p.sku}` : "sem SKU"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <PlatformBadge platform={p.account.platform} short />
                    </td>
                    <td className="px-5 py-4 text-right text-ink-2 tabular">{num(p.stock)}</td>
                    <td className="px-5 py-4 text-right text-ink-2 tabular">{brl(p.price)}</td>
                    <td className="px-5 py-4">
                      <form action={precificar} className="flex flex-wrap items-center gap-1.5">
                        <input type="hidden" name="productId" value={p.id} />
                        <input
                          name="wholesalePrice"
                          inputMode="decimal"
                          defaultValue={p.wholesalePrice?.toFixed(2).replace(".", ",")}
                          aria-label={`Preço de atacado de ${p.title}`}
                          className="w-20 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink tabular"
                        />
                        <input
                          name="wholesaleMinQty"
                          type="number"
                          min="1"
                          defaultValue={p.wholesaleMinQty}
                          aria-label={`Quantidade mínima de ${p.title}`}
                          className="w-14 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink tabular"
                        />
                        <button type="submit" className="rounded-lg border border-line px-2 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink">
                          Salvar
                        </button>
                      </form>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <form action={remover}>
                        <input type="hidden" name="productId" value={p.id} />
                        <button
                          type="submit"
                          aria-label={`Remover ${p.title} do atacado`}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
                        >
                          <Trash2 size={12} /> Remover
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Importar dos marketplaces" subtitle="Define um preço de atacado sem duplicar o produto — o estoque continua um só." />
          {paraImportar.length === 0 ? (
            <p className="px-5 py-5 text-[13px] text-ink-muted">Todos os produtos elegíveis já estão no atacado.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {paraImportar.slice(0, 12).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-medium text-ink">{p.title}</p>
                    <p className="text-[12px] text-ink-muted">
                      {brl(p.price)} no varejo · {num(p.stock)} em estoque
                    </p>
                  </div>
                  <form action={precificar} className="flex shrink-0 items-center gap-1.5">
                    <input type="hidden" name="productId" value={p.id} />
                    <input
                      name="wholesalePrice"
                      inputMode="decimal"
                      placeholder="preço"
                      aria-label={`Preço de atacado de ${p.title}`}
                      className="w-20 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink tabular placeholder:text-ink-muted"
                    />
                    <input type="hidden" name="wholesaleMinQty" value={6} />
                    <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink">
                      <Upload size={12} /> Importar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Cadastrar produto de atacado" subtitle="Exclusivo do atacado, sem anúncio em marketplace nenhum." />
          <form action={novoProdutoAtacado} className="space-y-3 px-5 py-5">
            <input name="title" required placeholder="Nome do produto" className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="sku" placeholder="SKU" className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted" />
              <input name="stock" type="number" min="0" defaultValue={0} aria-label="Estoque inicial" className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="wholesalePrice" inputMode="decimal" required placeholder="Preço de atacado" className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular placeholder:text-ink-muted" />
              <input name="wholesaleMinQty" type="number" min="1" defaultValue={1} aria-label="Quantidade mínima" className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular" />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover">
              <PackagePlus size={15} /> Criar produto
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

async function AbaNovoPedido({ clientId }: { clientId: string }) {
  const [clientes, produtos] = await Promise.all([listarClientesAtivos(clientId), catalogoAtacado(clientId)]);

  if (clientes.length === 0 || produtos.length === 0) {
    return (
      <Card>
        <Empty
          title="Faltam clientes ou produtos de atacado"
          hint={clientes.length === 0 ? "Cadastre um cliente em Gerenciamento primeiro." : "Defina ao menos um preço de atacado na aba Catálogo primeiro."}
          action={
            <Link href={clientes.length === 0 ? "/gerenciamento" : "/atacado?aba=catalogo"} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover">
              {clientes.length === 0 ? "Ir para Gerenciamento" : "Ir para o Catálogo"}
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Novo pedido de atacado" subtitle="Baixa o estoque na hora, do mesmo jeito que o /estoque faz manualmente." />
      <form action={criarPedido} className="space-y-4 px-5 py-5">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Cliente</label>
          <select name="customerId" required className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink">
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.city ? ` — ${c.city}/${c.uf}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Itens</p>
          {produtos.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="precoUnitario" value={p.wholesalePrice ?? 0} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[13px] font-medium text-ink">{p.title}</p>
                <p className="text-[12px] text-ink-muted">
                  {brl(p.wholesalePrice ?? 0)}/un · mín. {p.wholesaleMinQty} · {num(p.stock)} em estoque
                </p>
              </div>
              <input
                name="quantidade"
                type="number"
                min="0"
                max={p.stock}
                defaultValue={0}
                aria-label={`Quantidade de ${p.title}`}
                className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-[13px] text-ink tabular"
              />
            </div>
          ))}
        </div>

        <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover">
          <Plus size={15} /> Registrar pedido
        </button>
      </form>
    </Card>
  );
}
