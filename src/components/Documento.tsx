import Link from "next/link";
import { Marca } from "@/components/Logo";
import { ATUALIZADO_EM, faltaPreencher } from "@/lib/legal";

/** Moldura comum de termos e política — páginas públicas, sem menu. */
export function Documento({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-10">
      <header className="mb-8">
        <Link href="/">
          <Marca />
        </Link>
      </header>

      <h1 className="text-2xl font-bold text-ink">{titulo}</h1>
      <p className="mt-1 text-sm text-ink-muted">Atualizado em {ATUALIZADO_EM}.</p>

      {faltaPreencher() && (
        <p
          role="status"
          className="mt-5 rounded-xl border px-4 py-3 text-[13px]"
          style={{
            borderColor: "var(--warning)",
            backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)",
          }}
        >
          Documento em preenchimento: a identificação da empresa ainda não foi
          concluída. Enquanto isso, fale conosco pelo e-mail indicado abaixo.
        </p>
      )}

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-2">{children}</div>

      <nav className="mt-12 flex gap-4 border-t border-line pt-6 text-sm">
        <Link href="/termos" className="text-ink-2 hover:text-ink">Termos de uso</Link>
        <Link href="/privacidade" className="text-ink-2 hover:text-ink">Privacidade</Link>
        <Link href="/login" className="text-ink-2 hover:text-ink">Entrar</Link>
      </nav>
    </main>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-ink">{titulo}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
