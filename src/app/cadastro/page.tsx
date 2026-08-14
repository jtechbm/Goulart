import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { comAviso, createSession, currentUser, hashPassword, homeFor } from "@/lib/auth";
import { larguraPara, LOGO_ALT, LOGO_ALTURA_LOGIN, LOGO_SRC } from "@/lib/brand";
import { prisma } from "@/lib/db";
import { consumirPorIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** Cadastros por IP numa janela de 15 minutos. */
const LIMITE_POR_IP = 5;
const SENHA_MINIMA = 8;

async function cadastrar(formData: FormData) {
  "use server";

  const empresa = String(formData.get("empresa") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const confirma = String(formData.get("confirma") ?? "");

  if (!empresa || !nome || !email || !senha) {
    redirect(comAviso("/cadastro", "erro", "Preencha todos os campos."));
  }
  if (senha.length < SENHA_MINIMA) {
    redirect(comAviso("/cadastro", "erro", `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`));
  }
  if (senha !== confirma) redirect(comAviso("/cadastro", "erro", "A confirmação não confere."));

  /**
   * O limite entra antes de qualquer escrita. Sem confirmação por e-mail, é o
   * que impede alguém de abrir contas em massa — e conta cadastro bem-sucedido
   * também, porque o abuso aqui é criar muitas contas que "deram certo".
   */
  const limite = await consumirPorIp("cadastro", LIMITE_POR_IP);
  if (!limite.permitido) {
    const min = Math.ceil(limite.segundos / 60);
    redirect(comAviso("/cadastro", "erro", `Muitos cadastros deste local. Tente de novo em ${min} minuto(s).`));
  }

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    redirect(comAviso("/cadastro", "erro", "Já existe uma conta com este e-mail."));
  }

  /**
   * Empresa e acesso nascem juntos, numa transação: um `Client` órfão deixaria
   * o e-mail ocupado sem ninguém conseguir entrar nele.
   *
   * Cada cadastro cria a **própria** empresa, mesmo que outra já tenha nome
   * igual — `clientId` é o escopo de segurança do sistema inteiro, e reaproveitar
   * por nome colocaria dois desconhecidos dentro dos mesmos dados.
   */
  const user = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: { name: empresa, email } });
    return tx.user.create({
      data: { name: nome, email, passwordHash: hashPassword(senha), clientId: client.id },
    });
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);

  // Mesmo motivo do login: sem isso, o cache do router ainda lembra da versão
  // sem sessão de "/" e só troca depois de um F5.
  revalidatePath("/", "layout");
  redirect(homeFor());
}

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  if (await currentUser()) redirect(homeFor());

  const campos = [
    { name: "empresa", label: "Nome da empresa", type: "text", autoComplete: "organization" },
    { name: "nome", label: "Seu nome", type: "text", autoComplete: "name" },
    { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
    { name: "senha", label: `Senha (mín. ${SENHA_MINIMA} caracteres)`, type: "password", autoComplete: "new-password" },
    { name: "confirma", label: "Confirmar senha", type: "password", autoComplete: "new-password" },
  ];

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src={LOGO_SRC}
            alt={LOGO_ALT}
            width={larguraPara(LOGO_ALTURA_LOGIN)}
            height={LOGO_ALTURA_LOGIN}
            priority
            className="h-[76px] w-auto max-w-full object-contain"
          />
          <h1 className="mt-3 text-2xl font-bold text-ink">Criar conta</h1>
          <p className="mt-1 text-sm text-ink-2">Conecte suas lojas e acompanhe tudo em um lugar.</p>
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

          <form action={cadastrar} className="space-y-4">
            {campos.map((f, i) => (
              <label key={f.name} className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  {f.label}
                </span>
                <input
                  name={f.name}
                  type={f.type}
                  required
                  autoComplete={f.autoComplete}
                  autoFocus={i === 0}
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
                />
              </label>
            ))}

            <button
              type="submit"
              className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
            >
              Criar conta
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[13px] text-ink-muted">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
