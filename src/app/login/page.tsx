import { FlaskConical, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import { createSession, currentUser, homeFor, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function entrar(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?erro=Informe e-mail e senha.");

  const user = await prisma.user.findUnique({ where: { email } });

  // Mensagem única para credencial errada e usuário inexistente: não entregamos
  // quais e-mails existem na base.
  const genericError = "/login?erro=E-mail ou senha inválidos.";
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    redirect(genericError);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);

  redirect(user.mustChangePassword ? "/trocar-senha" : homeFor(user));
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  const already = await currentUser();
  if (already) redirect(homeFor(already));

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand text-brand-ink">
            <Zap size={26} strokeWidth={2.5} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink">GoulartERP</h1>
          <p className="mt-1 text-sm text-ink-2">Gestão multi-marketplace</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          {erro && (
            <p
              role="alert"
              className="mb-4 rounded-xl border px-4 py-3 text-[13px]"
              style={{
                borderColor: "var(--critical)",
                backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)",
                color: "var(--critical)",
              }}
            >
              {erro}
            </p>
          )}

          <form action={entrar} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                E-mail
              </span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                placeholder="voce@empresa.com.br"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                Senha
              </span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
            >
              Entrar
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[13px] text-ink-muted">
          Ainda não tem acesso? Fale com seu gestor para receber o login.
        </p>

        <p className="mt-6 text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
            style={{
              color: "var(--warning)",
              backgroundColor: "color-mix(in srgb, var(--warning) 16%, transparent)",
            }}
          >
            <FlaskConical size={11} aria-hidden />
            Protótipo · dados de demonstração
          </span>
        </p>
      </div>
    </main>
  );
}
