import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { Progresso } from "@/lib/onboarding";

/**
 * Cartão de primeiros passos.
 *
 * Some sozinho quando os três passos estão feitos — não há botão de "dispensar"
 * de propósito: enquanto houver passo pendente, o painel ao lado está mostrando
 * número incompleto, e esconder isso seria esconder que o dado não fecha.
 */
export function PrimeirosPassos({ progresso }: { progresso: Progresso }) {
  if (progresso.concluido) return null;

  const { passos, feitos, total } = progresso;

  return (
    <section className="mb-6 rounded-2xl border border-brand bg-surface p-6" aria-labelledby="primeiros-passos">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="primeiros-passos" className="text-base font-bold text-ink">
          Vamos configurar seu sistema
        </h2>
        <p className="text-xs font-semibold text-ink-muted">
          {feitos} de {total} concluídos
        </p>
      </div>

      {/* Barra de progresso: o texto acima já diz o número, então ela é decorativa. */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500"
          style={{ width: `${(feitos / total) * 100}%` }}
        />
      </div>

      <ol className="mt-5 space-y-3">
        {passos.map((passo, i) => {
          // Só o primeiro pendente ganha botão: uma lista com três botões
          // iguais não diz por onde começar.
          const ehProximo = progresso.proximo?.id === passo.id;

          return (
            <li key={passo.id} className="flex gap-3">
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  passo.feito ? "bg-brand text-brand-ink" : "border border-line text-ink-muted"
                }`}
                aria-hidden
              >
                {passo.feito ? <Check size={13} /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${passo.feito ? "text-ink-muted line-through" : "text-ink"}`}>
                  {passo.titulo}
                  <span className="sr-only">{passo.feito ? " (concluído)" : ""}</span>
                </p>
                {!passo.feito && <p className="mt-0.5 text-[13px] text-ink-2">{passo.descricao}</p>}
              </div>

              {ehProximo && (
                <Link
                  href={passo.href}
                  className="flex h-9 shrink-0 items-center gap-1.5 self-start rounded-xl bg-brand px-3.5 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
                >
                  {passo.rotuloAcao}
                  <ArrowRight size={14} aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
