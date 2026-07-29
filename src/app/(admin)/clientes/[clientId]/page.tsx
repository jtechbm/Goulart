import { ArrowLeft, KeyRound, Mail, Receipt, ShieldCheck, ShieldOff } from "lucide-react";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { hashPassword, requirePermission } from "@/lib/auth";
import { clientBilling } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { brl, date, relative } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Senha provisória legível, entregue ao cliente uma única vez. */
function tempPassword() {
  return crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "a").slice(0, 10);
}

async function criarAcesso(formData: FormData) {
  "use server";
  await requirePermission("clientes");
  const clientId = String(formData.get("clientId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!clientId || !email || !name) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(`/clientes/${clientId}?erro=Já existe um acesso com esse e-mail.`);
  }

  const senha = tempPassword();
  await prisma.user.create({
    data: {
      email,
      name,
      role: "CLIENT",
      clientId,
      passwordHash: hashPassword(senha),
      mustChangePassword: true,
    },
  });

  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?senha=${encodeURIComponent(senha)}&para=${encodeURIComponent(email)}`);
}

async function resetarSenha(formData: FormData) {
  "use server";
  await requirePermission("clientes");
  const userId = String(formData.get("userId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "CLIENT") return;

  const senha = tempPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(senha), mustChangePassword: true },
  });
  // derruba as sessões abertas com a senha antiga
  await prisma.session.deleteMany({ where: { userId } });

  redirect(`/clientes/${clientId}?senha=${encodeURIComponent(senha)}&para=${encodeURIComponent(user.email)}`);
}

async function alternarAcesso(formData: FormData) {
  "use server";
  await requirePermission("clientes");
  const userId = String(formData.get("userId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "CLIENT") return;

  await prisma.user.update({ where: { id: userId }, data: { active: !user.active } });
  if (user.active) await prisma.session.deleteMany({ where: { userId } });

  revalidatePath(`/clientes/${clientId}`);
}

export default async function ClienteDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ senha?: string; para?: string; erro?: string }>;
}) {
  await requirePermission("clientes");
  const { clientId } = await params;
  const sp = await searchParams;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { accounts: true, users: { orderBy: { createdAt: "asc" } } },
  });
  if (!client) notFound();

  const billing = await clientBilling(clientId);

  return (
    <>
      <Topbar crumb={`Clientes / ${client.name}`} />
      <main className="flex-1 px-6 py-8">
        <Link
          href="/clientes"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} /> Todos os clientes
        </Link>

        <PageHeader
          title={client.name}
          subtitle={`${client.email}${client.phone ? ` · ${client.phone}` : ""}`}
          action={
            <Link
              href={`/mensalidades/${clientId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
            >
              <Receipt size={16} /> Mensalidade
            </Link>
          }
        />

        {sp.senha && (
          <div
            className="mb-5 rounded-xl border px-5 py-4"
            role="status"
            style={{
              borderColor: "var(--good)",
              backgroundColor: "color-mix(in srgb, var(--good) 10%, transparent)",
            }}
          >
            <p className="text-sm font-semibold text-ink">Senha provisória gerada para {sp.para}</p>
            <p className="mt-2 font-mono text-lg font-bold text-ink">{sp.senha}</p>
            <p className="mt-2 text-[13px] text-ink-2">
              Copie e envie agora — ela não será exibida de novo. O cliente troca a senha no primeiro acesso.
            </p>
          </div>
        )}
        {sp.erro && (
          <p
            role="alert"
            className="mb-5 rounded-xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: "var(--critical)",
              backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)",
              color: "var(--critical)",
            }}
          >
            {sp.erro}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Lojas conectadas" value={String(client.accounts.length)} />
          <Stat
            label="Mensalidade"
            value={billing.subscription ? brl(billing.subscription.amount) : "—"}
            hint={billing.subscription ? `dia ${billing.subscription.dueDay}` : "sem contrato"}
          />
          <Stat label="Em aberto" value={brl(billing.openTotal)} tone="series-2" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Acessos ao portal" subtitle="Quem desse cliente pode entrar no sistema." />

            {client.users.length === 0 ? (
              <Empty title="Nenhum acesso criado" hint="Crie o login abaixo e envie a senha provisória ao cliente." />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {client.users.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{u.name}</p>
                      <p className="text-[13px] text-ink-muted">{u.email}</p>
                      <p className="text-[12px] text-ink-muted">
                        {u.mustChangePassword
                          ? "aguardando primeiro acesso"
                          : `último acesso ${relative(u.lastLoginAt)}`}
                      </p>
                    </div>

                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        color: u.active ? "var(--good)" : "var(--ink-muted)",
                        backgroundColor: u.active
                          ? "color-mix(in srgb, var(--good) 14%, transparent)"
                          : "var(--surface-3)",
                      }}
                    >
                      {u.active ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
                      {u.active ? "Ativo" : "Bloqueado"}
                    </span>

                    <form action={resetarSenha}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="clientId" value={clientId} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
                      >
                        <KeyRound size={12} /> Nova senha
                      </button>
                    </form>

                    <form action={alternarAcesso}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="clientId" value={clientId} />
                      <button
                        type="submit"
                        className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
                      >
                        {u.active ? "Bloquear" : "Reativar"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <form action={criarAcesso} className="space-y-3 border-t border-line px-5 py-5">
              <input type="hidden" name="clientId" value={clientId} />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Criar novo acesso</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="name"
                  required
                  placeholder="Nome da pessoa"
                  className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                />
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={client.users.length === 0 ? client.email : ""}
                  placeholder="email@empresa.com.br"
                  className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
              >
                <Mail size={15} /> Gerar acesso
              </button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Lojas" subtitle={`${client.accounts.length} conta(s) conectada(s).`} />
            {client.accounts.length === 0 ? (
              <Empty
                title="Nenhuma loja"
                hint="Conecte em Configurações → Integrações."
                action={
                  <Link href="/configuracoes" className="text-[13px] font-semibold text-brand hover:underline">
                    Ir para Integrações
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {client.accounts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <PlatformBadge platform={a.platform} />
                    <span className="min-w-0 flex-1 font-medium text-ink">{a.shopName}</span>
                    <span className="text-[13px] text-ink-muted">sync {relative(a.lastSyncAt)}</span>
                  </li>
                ))}
              </ul>
            )}

            {billing.current && (
              <p className="border-t border-line px-5 py-3.5 text-[13px] text-ink-muted">
                Fatura do mês: {brl(billing.current.amount)} · vence {date(billing.current.dueDate)} ·{" "}
                {billing.current.status.toLowerCase()}
              </p>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
