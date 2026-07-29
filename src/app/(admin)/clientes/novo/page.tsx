import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { hashPassword, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function tempPassword() {
  return crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "a").slice(0, 10);
}

async function criar(formData: FormData) {
  "use server";
  await requirePermission("clientes");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name || !email) redirect("/clientes/novo?erro=Informe nome e e-mail.");

  const criarAcesso = formData.get("acesso") === "on";
  const mensalidade = Number(formData.get("mensalidade") ?? 0);
  const dueDay = Math.min(28, Math.max(1, Number(formData.get("dueDay") ?? 10)));

  // checa o e-mail antes de criar o cliente, para não deixar cadastro órfão
  if (criarAcesso) {
    const jaExiste = await prisma.user.findUnique({ where: { email } });
    if (jaExiste) redirect("/clientes/novo?erro=Já existe um login com esse e-mail.");
  }

  const client = await prisma.client.create({
    data: {
      name,
      email,
      phone: String(formData.get("phone") ?? "").trim() || null,
      document: String(formData.get("document") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  // contrato é opcional aqui — dá para definir depois em Mensalidades
  if (mensalidade > 0) {
    await prisma.subscription.create({
      data: { clientId: client.id, amount: mensalidade, dueDay, method: "PIX", status: "ATIVA" },
    });
  }

  revalidatePath("/clientes");
  revalidatePath("/mensalidades");

  if (!criarAcesso) redirect(`/clientes/${client.id}`);

  const senha = tempPassword();
  await prisma.user.create({
    data: {
      email,
      name,
      role: "CLIENT",
      clientId: client.id,
      passwordHash: hashPassword(senha),
      mustChangePassword: true,
    },
  });

  redirect(`/clientes/${client.id}?senha=${encodeURIComponent(senha)}&para=${encodeURIComponent(email)}`);
}

const FIELDS = [
  { name: "name", label: "Nome do cliente", required: true, placeholder: "Casa Bella Decor" },
  { name: "email", label: "E-mail", required: true, type: "email", placeholder: "contato@casabella.com.br" },
  { name: "phone", label: "Telefone", placeholder: "(11) 98765-4321" },
  { name: "document", label: "CNPJ / CPF", placeholder: "00.000.000/0001-00" },
];

export default async function NovoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("clientes");
  const { erro } = await searchParams;

  return (
    <>
      <Topbar crumb="Clientes / Novo" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Novo cliente" subtitle="Cadastro, contrato e acesso ao portal em um passo só." />

        {erro && (
          <p
            role="alert"
            className="mb-5 max-w-2xl rounded-xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: "var(--critical)",
              backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)",
              color: "var(--critical)",
            }}
          >
            {erro}
          </p>
        )}

        <Card className="max-w-2xl">
          <CardHeader title="Dados do cliente" />
          <form action={criar} className="space-y-4 px-5 py-5">
            {FIELDS.map((f) => (
              <label key={f.name} className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  {f.label}
                  {f.required && <span style={{ color: "var(--critical)" }}> *</span>}
                </span>
                <input
                  name={f.name}
                  type={f.type ?? "text"}
                  required={f.required}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                />
              </label>
            ))}

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                Observações
              </span>
              <textarea
                name="notes"
                rows={2}
                className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
              />
            </label>

            <fieldset className="rounded-xl border border-line p-4">
              <legend className="px-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                Contrato (opcional)
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-ink-2">Mensalidade (R$)</span>
                  <input
                    name="mensalidade"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="2500"
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular placeholder:text-ink-muted"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-ink-2">Dia do vencimento</span>
                  <input
                    name="dueDay"
                    type="number"
                    min="1"
                    max="28"
                    defaultValue={10}
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular"
                  />
                </label>
              </div>
              <p className="mt-2 text-[12px] text-ink-muted">
                Deixe em branco para definir depois em Mensalidades.
              </p>
            </fieldset>

            <label className="flex items-start gap-2.5">
              <input name="acesso" type="checkbox" defaultChecked className="mt-0.5 size-4 accent-[var(--brand)]" />
              <span className="text-[13px] text-ink-2">
                Criar acesso ao portal
                <span className="block text-[12px] text-ink-muted">
                  Usa o e-mail acima como login e gera uma senha provisória, exibida uma única vez.
                </span>
              </span>
            </label>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
              >
                Criar cliente
              </button>
              <Link href="/clientes" className="text-sm font-medium text-ink-2 hover:text-ink">
                Cancelar
              </Link>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
