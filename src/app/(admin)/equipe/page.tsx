import crypto from "node:crypto";
import { KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Avatar, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { hashPassword, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { num, relative } from "@/lib/format";
import { isStaffRole, STAFF_ROLE_KEYS, STAFF_ROLES, type StaffRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function tempPassword() {
  return crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "a").slice(0, 10);
}

async function adicionarPessoa(formData: FormData) {
  "use server";
  await requirePermission("equipe");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "analista");
  const comAcesso = formData.get("acesso") === "on";

  if (!name || !email) redirect("/equipe?erro=Informe nome e e-mail.");
  if (!isStaffRole(role)) redirect("/equipe?erro=Função inválida.");

  const jaExiste = await prisma.teamMember.findUnique({ where: { email } });
  if (jaExiste) redirect("/equipe?erro=Já existe alguém na equipe com esse e-mail.");

  const member = await prisma.teamMember.create({ data: { name, email, role } });

  if (!comAcesso) {
    revalidatePath("/equipe");
    redirect("/equipe?ok=Pessoa adicionada à equipe.");
  }

  const usuarioExiste = await prisma.user.findUnique({ where: { email } });
  if (usuarioExiste) {
    redirect("/equipe?erro=Pessoa criada, mas já existe um login com esse e-mail.");
  }

  const senha = tempPassword();
  await prisma.user.create({
    data: {
      email,
      name,
      role: "ADMIN",
      // é a função que define o que essa pessoa enxerga na área da agência
      staffRole: role,
      passwordHash: hashPassword(senha),
      mustChangePassword: true,
      teamMemberId: member.id,
    },
  });

  revalidatePath("/equipe");
  redirect(`/equipe?senha=${encodeURIComponent(senha)}&para=${encodeURIComponent(email)}`);
}

async function resetarSenha(formData: FormData) {
  "use server";
  await requirePermission("equipe");

  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ADMIN") return;

  const senha = tempPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(senha), mustChangePassword: true },
  });
  await prisma.session.deleteMany({ where: { userId } });

  redirect(`/equipe?senha=${encodeURIComponent(senha)}&para=${encodeURIComponent(user.email)}`);
}

async function alterarFuncao(formData: FormData) {
  "use server";
  const me = await requirePermission("equipe");

  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!isStaffRole(role)) redirect("/equipe?erro=Função inválida.");

  const member = await prisma.teamMember.findUnique({ where: { id: memberId }, include: { users: true } });
  if (!member) return;

  // rebaixar a si mesmo tiraria seu acesso a esta tela na mesma hora
  if (member.users.some((u) => u.id === me.id) && role !== "diretor") {
    redirect("/equipe?erro=Você não pode rebaixar a sua própria função.");
  }

  await prisma.teamMember.update({ where: { id: memberId }, data: { role } });
  await prisma.user.updateMany({ where: { teamMemberId: memberId }, data: { staffRole: role } });

  revalidatePath("/equipe");
  redirect(`/equipe?ok=${encodeURIComponent(`Função de ${member.name} alterada para ${STAFF_ROLES[role].label}.`)}`);
}

async function removerPessoa(formData: FormData) {
  "use server";
  const me = await requirePermission("equipe");

  const memberId = String(formData.get("memberId") ?? "");
  const member = await prisma.teamMember.findUnique({ where: { id: memberId }, include: { users: true } });
  if (!member) return;

  // impede a pessoa logada de remover o próprio acesso e se trancar para fora
  if (member.users.some((u) => u.id === me.id)) {
    redirect("/equipe?erro=Você não pode remover o seu próprio acesso.");
  }

  await prisma.teamMember.delete({ where: { id: memberId } });
  revalidatePath("/equipe");
  redirect("/equipe?ok=Pessoa removida da equipe.");
}

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; senha?: string; para?: string }>;
}) {
  await requirePermission("equipe");
  const sp = await searchParams;

  const [members, totalAccounts] = await Promise.all([
    prisma.teamMember.findMany({
      include: { _count: { select: { accounts: true } }, users: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.account.count(),
  ]);

  return (
    <>
      <Topbar crumb="Equipe" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Equipe" subtitle="Analistas e atendentes da agência." />

        {sp.senha && (
          <div
            className="mb-5 rounded-xl border px-5 py-4"
            role="status"
            style={{ borderColor: "var(--good)", backgroundColor: "color-mix(in srgb, var(--good) 10%, transparent)" }}
          >
            <p className="text-sm font-semibold text-ink">Senha provisória gerada para {sp.para}</p>
            <p className="mt-2 font-mono text-lg font-bold text-ink">{sp.senha}</p>
            <p className="mt-2 text-[13px] text-ink-2">
              Copie e envie agora — ela não será exibida de novo. A pessoa troca no primeiro acesso.
            </p>
          </div>
        )}
        {sp.ok && (
          <p
            role="status"
            className="mb-5 rounded-xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: "var(--good)",
              backgroundColor: "color-mix(in srgb, var(--good) 10%, transparent)",
              color: "var(--good-text)",
            }}
          >
            {sp.ok}
          </p>
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

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            {members.length === 0 ? (
              <Card>
                <Empty title="Nenhuma pessoa cadastrada" hint="Use o formulário ao lado para montar a equipe." />
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {members.map((m) => {
                  // o diretor enxerga a carteira inteira; os demais, só o que atendem
                  const count = m.role === "diretor" ? totalAccounts : m._count.accounts;
                  const login = m.users[0];
                  return (
                    <Card key={m.id} className="p-5">
                      <div className="flex items-start gap-3">
                        <Avatar name={m.name} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-ink">{m.name}</p>
                          <p className="text-[13px] text-ink-muted">
                            {isStaffRole(m.role) ? STAFF_ROLES[m.role].label : m.role}
                          </p>
                          <p className="truncate text-[12px] text-ink-muted">{m.email}</p>
                        </div>
                      </div>

                      {isStaffRole(m.role) && (
                        <p className="mt-2.5 text-[12px] text-ink-2">{STAFF_ROLES[m.role].summary}</p>
                      )}

                      <form action={alterarFuncao} className="mt-3 flex items-center gap-2">
                        <input type="hidden" name="memberId" value={m.id} />
                        <select
                          name="role"
                          defaultValue={isStaffRole(m.role) ? m.role : "analista"}
                          aria-label={`Função de ${m.name}`}
                          className="flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink"
                        >
                          {STAFF_ROLE_KEYS.map((key) => (
                            <option key={key} value={key}>
                              {STAFF_ROLES[key].label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
                        >
                          Alterar
                        </button>
                      </form>

                      <div className="mt-3">
                        {login ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{
                              color: "var(--good)",
                              backgroundColor: "color-mix(in srgb, var(--good) 14%, transparent)",
                            }}
                          >
                            <ShieldCheck size={12} />
                            {login.mustChangePassword ? "aguardando 1º acesso" : `acesso ${relative(login.lastLoginAt)}`}
                          </span>
                        ) : (
                          <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] text-ink-muted">
                            sem login
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                          Atende
                        </span>
                        <span className="text-lg font-bold text-ink tabular">
                          {num(count)} <span className="text-[13px] font-medium text-ink-muted">contas</span>
                        </span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {login && (
                          <form action={resetarSenha} className="flex-1">
                            <input type="hidden" name="userId" value={login.id} />
                            <button
                              type="submit"
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
                            >
                              <KeyRound size={12} /> Nova senha
                            </button>
                          </form>
                        )}
                        <form action={removerPessoa} className={login ? "" : "flex-1"}>
                          <input type="hidden" name="memberId" value={m.id} />
                          <button
                            type="submit"
                            aria-label={`Remover ${m.name}`}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
                          >
                            <Trash2 size={12} /> Remover
                          </button>
                        </form>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <Card className="h-fit">
            <CardHeader title="Adicionar pessoa" subtitle="Cria o cadastro e, se quiser, o login de gestor." />
            <form action={adicionarPessoa} className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  Nome
                </span>
                <input
                  name="name"
                  required
                  placeholder="Mariana Souza"
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  E-mail
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="mariana@jtech.com.br"
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  Função
                </span>
                <select
                  name="role"
                  defaultValue="analista"
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink"
                >
                  {STAFF_ROLE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {STAFF_ROLES[key].label}
                    </option>
                  ))}
                </select>
              </label>

              {/* deixa explícito o que cada função libera, antes de criar o acesso */}
              <ul className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
                {STAFF_ROLE_KEYS.map((key) => (
                  <li key={key} className="text-[12px]">
                    <span className="font-semibold text-ink">{STAFF_ROLES[key].label}</span>
                    <span className="block text-ink-muted">{STAFF_ROLES[key].summary}</span>
                  </li>
                ))}
              </ul>

              <label className="flex items-start gap-2.5">
                <input name="acesso" type="checkbox" defaultChecked className="mt-0.5 size-4 accent-[var(--brand)]" />
                <span className="text-[13px] text-ink-2">
                  Criar login
                  <span className="block text-[12px] text-ink-muted">
                    Gera uma senha provisória. A pessoa só enxerga o que a função acima libera.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
              >
                <Plus size={16} /> Adicionar
              </button>
            </form>
          </Card>
        </div>
      </main>
    </>
  );
}
