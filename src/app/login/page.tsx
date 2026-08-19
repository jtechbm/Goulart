import Link from "next/link";
import { redirect } from "next/navigation";
import { comAviso, createSession, currentUser, homeFor, verifyPassword } from "@/lib/auth";
import { Marca } from "@/components/Logo";
import { APP_TAGLINE, LOGO_ALTURA_LOGIN } from "@/lib/brand";
import { prisma } from "@/lib/db";
import { checarLimite, limparFalhas, registrarFalha } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

async function entrar(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(comAviso("/login", "erro", "Informe e-mail e senha."));

  // Antes de tocar no banco de usuários: quem já estourou o limite não passa,
  // senão o scrypt (que é caro de propósito) vira o próprio vetor de ataque.
  const limite = await checarLimite(email);
  if (!limite.permitido) {
    const min = Math.ceil(limite.segundos / 60);
    redirect(comAviso("/login", "erro", `Muitas tentativas. Tente de novo em ${min} minuto(s).`));
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Mensagem única para credencial errada e usuário inexistente: não entregamos
  // quais e-mails existem na base.
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    await registrarFalha(email);
    redirect(comAviso("/login", "erro", "E-mail ou senha inválidos."));
  }

  // Todo acesso é de lojista: sem `clientId` não há escopo e não há tela para
  // abrir. Barramos aqui, com senha já conferida, em vez de deixar a pessoa
  // entrar e esbarrar no guard depois.
  if (!user.clientId) {
    redirect(comAviso("/login", "erro", "Este acesso não está vinculado a nenhuma loja."));
  }

  await limparFalhas(email);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);

  redirect(homeFor());
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  const already = await currentUser();
  if (already) redirect(homeFor());

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <h1>
            <Marca altura={LOGO_ALTURA_LOGIN} priority tamanhoNome="text-2xl" />
          </h1>
          <p className="mt-3 text-sm text-ink-2">{APP_TAGLINE}</p>
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
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-semibold text-brand hover:underline">
            Criar conta
          </Link>
        </p>
        <nav className="mt-8 flex justify-center gap-4 text-xs text-ink-muted">
          <Link href="/termos" className="hover:text-ink-2">Termos de uso</Link>
          <Link href="/privacidade" className="hover:text-ink-2">Privacidade</Link>
        </nav>
      </div>
    </main>
  );
}
