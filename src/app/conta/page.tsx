import { ArrowLeft, Download, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/components/Logo";
import { comAviso, destroySession, requireClient, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Palavra que o titular precisa digitar para confirmar a exclusão. */
const CONFIRMACAO = "EXCLUIR";

/**
 * Exclusão definitiva da conta (LGPD, art. 18, VI).
 *
 * Duas barreiras, porque não há desfazer: a senha (prova que é o titular, e não
 * alguém num computador destravado) e a palavra digitada (prova que a pessoa
 * leu o que vai acontecer). Só uma das duas seria fácil demais para um clique
 * errado ou para quem passou pela mesa.
 */
async function excluirConta(formData: FormData) {
  "use server";

  const user = await requireClient();
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "").trim().toUpperCase();

  if (confirmacao !== CONFIRMACAO) {
    redirect(comAviso("/conta", "erro", `Digite ${CONFIRMACAO} para confirmar.`));
  }

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row || !verifyPassword(senha, row.passwordHash)) {
    redirect(comAviso("/conta", "erro", "Senha incorreta."));
  }

  /**
   * Apagar o Client derruba tudo em cascata: usuários, lojas, pedidos, itens,
   * produtos, movimentos de estoque e a assinatura. É essa a intenção — dado
   * pessoal apagado pela metade continua sendo dado pessoal guardado.
   *
   * TODO: quando o Stripe estiver ligado, cancelar a assinatura lá antes deste
   * delete. Hoje não existe assinatura paga, então não há cobrança a interromper.
   */
  log.info("conta.excluida", { clientId: user.clientId, usuarios: 1 });
  await prisma.client.delete({ where: { id: user.clientId } });
  await destroySession();

  redirect(comAviso("/login", "ok", "Sua conta e todos os dados foram excluídos."));
}

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  // De propósito NÃO exige assinatura em dia: segurar os dados de alguém atrás
  // de um paywall para impedir que ele os leve embora contraria o art. 18.
  const user = await requireClient();
  const { erro } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-[640px] px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Marca />
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          Voltar
        </Link>
      </header>

      <h1 className="text-2xl font-bold text-ink">Seus dados</h1>
      <p className="mt-1 text-sm text-ink-2">
        Conta de {user.name} · {user.email}
      </p>

      {erro && (
        <p
          role="alert"
          className="mt-6 rounded-xl border px-4 py-3 text-[13px]"
          style={{
            borderColor: "var(--critical)",
            backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)",
            color: "var(--critical)",
          }}
        >
          {erro}
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-base font-bold text-ink">Baixar tudo que temos sobre você</h2>
        <p className="mt-1 text-[13px] text-ink-2">
          Um arquivo JSON com seu cadastro, lojas, pedidos, produtos e movimentos de
          estoque. Senhas e tokens de marketplace ficam de fora: a senha nós guardamos
          só como hash, e o token daria acesso às suas lojas se o arquivo vazasse.
        </p>
        <a
          href="/api/conta/exportar"
          download
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
        >
          <Download size={16} aria-hidden />
          Baixar meus dados
        </a>
      </section>

      <section
        className="mt-6 rounded-2xl border p-6"
        style={{ borderColor: "var(--critical)" }}
      >
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <TriangleAlert size={18} style={{ color: "var(--critical)" }} aria-hidden />
          Excluir minha conta
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">
          Apaga definitivamente sua empresa, seus acessos, suas lojas conectadas, seus
          pedidos, produtos e o histórico de estoque. <strong className="text-ink">Não
          há como desfazer.</strong> Baixe seus dados antes, se quiser guardá-los.
        </p>

        <form action={excluirConta} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Sua senha</span>
            <input
              type="password"
              name="senha"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Digite <strong className="text-ink">{CONFIRMACAO}</strong> para confirmar
            </span>
            <input
              type="text"
              name="confirmacao"
              required
              autoComplete="off"
              className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand"
            />
          </label>

          <button
            type="submit"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--critical)" }}
          >
            Excluir conta definitivamente
          </button>
        </form>
      </section>

      <nav className="mt-10 flex gap-4 border-t border-line pt-6 text-sm">
        <Link href="/termos" className="text-ink-2 hover:text-ink">Termos de uso</Link>
        <Link href="/privacidade" className="text-ink-2 hover:text-ink">Privacidade</Link>
      </nav>
    </main>
  );
}
