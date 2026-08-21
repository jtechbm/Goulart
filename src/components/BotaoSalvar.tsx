"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/**
 * Botão de enviar formulário que se desabilita enquanto o servidor responde.
 *
 * Não é enfeite: sem retorno visual a pessoa acha que o clique não pegou e
 * clica de novo. Foi assim que nasceram dois produtos "saida de praia"
 * idênticos, criados com segundos de diferença — o sistema obedeceu as duas
 * vezes, porque as duas eram pedidos legítimos.
 *
 * `useFormStatus` precisa estar DENTRO do <form>, num componente separado —
 * por isso este arquivo existe em vez de um `disabled` no botão da página.
 */
export function BotaoSalvar({
  children,
  carregando = "Salvando…",
  className = "",
}: {
  children: ReactNode;
  /** Texto durante o envio. Diga o que está acontecendo, não "Aguarde". */
  carregando?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? (
        <>
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          {carregando}
        </>
      ) : (
        children
      )}
    </button>
  );
}
