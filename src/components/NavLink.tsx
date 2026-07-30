"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

/**
 * Item do menu com retorno visual imediato.
 *
 * `useLinkStatus` fica pendente no instante do clique — antes mesmo de o
 * servidor responder. Sem isso o primeiro sinal só vinha quando o esqueleto
 * aparecia, e nesse intervalo a tela ficava idêntica: parecia que o clique
 * não tinha registrado.
 */

function Indicador() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      {/* barra fina no topo da janela */}
      <span className="route-progress" aria-hidden />
      {/* e um giro no próprio item, para saber qual foi clicado */}
      <span
        className="ml-auto size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        aria-hidden
      />
      <span className="sr-only">Carregando…</span>
    </>
  );
}

export function NavLink({
  href,
  active,
  className,
  children,
}: {
  href: string;
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {children}
      <Indicador />
    </Link>
  );
}
