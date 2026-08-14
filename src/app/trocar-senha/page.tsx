import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { comAviso, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Troca voluntária de senha — ninguém é obrigado a passar por aqui. */
async function trocar(formData: FormData) {
  "use server";

  const user = await requireUser();

  const atual = String(formData.get("atual") ?? "");
  const nova = String(formData.get("nova") ?? "");
  const confirma = String(formData.get("confirma") ?? "");

  if (nova.length < 8) {
    redirect(comAviso("/trocar-senha", "erro", "A nova senha precisa ter ao menos 8 caracteres."));
  }
  if (nova !== confirma) redirect(comAviso("/trocar-senha", "erro", "A confirmação não confere."));

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row || !verifyPassword(atual, row.passwordHash)) {
    redirect(comAviso("/trocar-senha", "erro", "Senha atual incorreta."));
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(nova) } });

  redirect(comAviso("/", "ok", "Senha alterada."));
}

export default async function TrocarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requireUser();
  const { erro } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <KeyRound size={24} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink">Trocar senha</h1>
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

          <form action={trocar} className="space-y-4">
            {[
              { name: "atual", label: "Senha atual", autoComplete: "current-password" },
              { name: "nova", label: "Nova senha (mín. 8 caracteres)", autoComplete: "new-password" },
              { name: "confirma", label: "Confirmar nova senha", autoComplete: "new-password" },
            ].map((f) => (
              <label key={f.name} className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  {f.label}
                </span>
                <input
                  name={f.name}
                  type="password"
                  required
                  autoComplete={f.autoComplete}
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink"
                />
              </label>
            ))}

            <button
              type="submit"
              className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
            >
              Salvar senha
            </button>
          </form>
        </div>

        <p className="mt-5 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} /> Voltar
          </Link>
        </p>
      </div>
    </main>
  );
}
