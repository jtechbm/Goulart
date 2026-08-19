"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Tela de erro de rota.
 *
 * Precisa ser client component (contrato do Next), então o registro no servidor
 * já aconteceu quando o erro estourou lá — aqui só marcamos no console do
 * navegador, com o `digest`, que é o único fio que liga o que o lojista viu ao
 * que está no log do servidor. Sem ele, "deu erro na tela" é impossível de
 * investigar.
 */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ nivel: "erro", evento: "ui.erro", digest: error.digest }));
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-[440px] text-center">
        <h1 className="text-xl font-bold text-ink">Alguma coisa quebrou aqui</h1>
        <p className="mt-2 text-sm text-ink-2">
          O erro foi registrado e vamos olhar. Seus dados não foram afetados — nada
          desta tela é gravado até você confirmar.
        </p>

        {error.digest && (
          <p className="mt-4 text-xs text-ink-muted">
            Se for falar com o suporte, mencione este código:{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-ink-2">{error.digest}</code>
          </p>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
          >
            <RotateCw size={15} aria-hidden />
            Tentar de novo
          </button>
          <Link
            href="/"
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </main>
  );
}
