import { Plus, UserCheck, UserX } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Campo, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { comAviso } from "@/lib/auth";
import { requireClientAtivo } from "@/lib/planGuard";
import { alternarAtivoCustomer, criarCustomer, listarCustomers, type CustomerKind } from "@/lib/customers";
import { brl, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const ABAS: Array<{ key: CustomerKind; slug: string; label: string }> = [
  { key: "CLIENTE", slug: "clientes", label: "Clientes" },
  { key: "FORNECEDOR", slug: "fornecedores", label: "Fornecedores" },
];

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

async function novoRegistro(formData: FormData) {
  "use server";
  const user = await requireClientAtivo();
  const kind = (String(formData.get("kind") ?? "CLIENTE") === "FORNECEDOR" ? "FORNECEDOR" : "CLIENTE") as CustomerKind;
  const aba = kind === "CLIENTE" ? "clientes" : "fornecedores";

  try {
    await criarCustomer({
      clientId: user.clientId,
      kind,
      name: String(formData.get("name") ?? ""),
      document: String(formData.get("document") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      city: String(formData.get("city") ?? ""),
      uf: String(formData.get("uf") ?? ""),
    });
  } catch (err) {
    redirect(comAviso(`/gerenciamento?aba=${aba}`, "erro", err instanceof Error ? err.message : String(err)));
  }

  revalidatePath("/gerenciamento");
  redirect(comAviso(`/gerenciamento?aba=${aba}`, "ok", "Cadastro criado."));
}

async function alternarAtivo(formData: FormData) {
  "use server";
  const user = await requireClientAtivo();
  const id = String(formData.get("id") ?? "");
  const aba = String(formData.get("aba") ?? "clientes");
  await alternarAtivoCustomer(id, user.clientId);
  revalidatePath("/gerenciamento");
  redirect(`/gerenciamento?aba=${aba}`);
}

export default async function GerenciamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; ok?: string; erro?: string }>;
}) {
  const user = await requireClientAtivo();
  const sp = await searchParams;
  const atual = ABAS.find((a) => a.slug === sp.aba) ?? ABAS[0];

  const rows = await listarCustomers(user.clientId, atual.key);

  return (
    <>
      <Topbar crumb="Gerenciamento" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Gerenciamento" subtitle="Clientes e fornecedores da loja." />

        {sp.ok && (
          <p role="status" className="mb-5 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: "var(--good)", backgroundColor: "color-mix(in srgb, var(--good) 10%, transparent)", color: "var(--good-text)" }}>
            {sp.ok}
          </p>
        )}
        {sp.erro && (
          <p role="alert" className="mb-5 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: "var(--critical)", backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)", color: "var(--critical)" }}>
            {sp.erro}
          </p>
        )}

        <div className="my-5 flex w-fit flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1">
          {ABAS.map((a) => (
            <Link
              key={a.slug}
              href={a.slug === "clientes" ? "/gerenciamento" : `/gerenciamento?aba=${a.slug}`}
              aria-current={atual.slug === a.slug ? "true" : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                atual.slug === a.slug ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {a.label}
            </Link>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            {rows.length === 0 ? (
              <Empty title={atual.key === "CLIENTE" ? "Nenhum cliente cadastrado" : "Nenhum fornecedor cadastrado"} hint="Cadastre no formulário abaixo." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                      <th className="px-5 py-3.5">Nome</th>
                      <th className="px-5 py-3.5">Documento</th>
                      <th className="px-5 py-3.5">Contato</th>
                      <th className="px-5 py-3.5">Cidade</th>
                      {atual.key === "CLIENTE" && (
                        <>
                          <th className="px-5 py-3.5 text-right">Pedidos</th>
                          <th className="px-5 py-3.5 text-right">Total comprado</th>
                          <th className="px-5 py-3.5">Último pedido</th>
                        </>
                      )}
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.map((c) => (
                      <tr key={c.id} className={`transition-colors hover:bg-surface-2 ${c.active ? "" : "opacity-50"}`}>
                        <td className="px-5 py-4 font-medium text-ink">
                          {atual.key === "CLIENTE" ? (
                            <Link href={`/atacado?aba=pedidos`} className="hover:text-brand hover:underline">
                              {c.name}
                            </Link>
                          ) : (
                            c.name
                          )}
                        </td>
                        <td className="px-5 py-4 text-ink-2 tabular">{c.document ?? "—"}</td>
                        <td className="px-5 py-4">
                          <p className="text-[13px] text-ink-2">{c.email ?? "—"}</p>
                          <p className="text-[12px] text-ink-muted">{c.phone ?? "—"}</p>
                        </td>
                        <td className="px-5 py-4 text-ink-2">{c.city ? `${c.city}/${c.uf ?? ""}` : "—"}</td>
                        {atual.key === "CLIENTE" && (
                          <>
                            <td className="px-5 py-4 text-right text-ink-2 tabular">{num(c.pedidos)}</td>
                            <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(c.totalComprado)}</td>
                            <td className="px-5 py-4 text-ink-2 tabular">{c.ultimoPedido ? date(c.ultimoPedido) : "—"}</td>
                          </>
                        )}
                        <td className="px-5 py-4 text-right">
                          <form action={alternarAtivo}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="aba" value={atual.slug} />
                            <button
                              type="submit"
                              aria-label={c.active ? `Inativar ${c.name}` : `Reativar ${c.name}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
                            >
                              {c.active ? <UserX size={12} /> : <UserCheck size={12} />}
                              {c.active ? "Inativar" : "Reativar"}
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

          <Card>
            <CardHeader title={atual.key === "CLIENTE" ? "Cadastrar cliente" : "Cadastrar fornecedor"} />
            <form action={novoRegistro} className="space-y-3 px-5 py-5">
              <input type="hidden" name="kind" value={atual.key} />
              <Campo label="Nome / razão social">
                <input name="name" required className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink" />
              </Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="CNPJ / CPF" hint="Opcional.">
                  <input name="document" className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink" />
                </Campo>
                <Campo label="Telefone" hint="Opcional.">
                  <input name="phone" className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink" />
                </Campo>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px]">
                <Campo label="E-mail" hint="Opcional.">
                  <input name="email" type="email" className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink" />
                </Campo>
                <Campo label="Cidade" hint="Opcional.">
                  <input name="city" className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink" />
                </Campo>
                <Campo label="UF">
                <select name="uf" className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink">
                  <option value="">UF</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                </Campo>
              </div>
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover">
                <Plus size={15} /> Cadastrar
              </button>
            </form>
          </Card>
        </div>
      </main>
    </>
  );
}
