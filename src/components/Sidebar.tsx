"use client";

import { Boxes, DollarSign, FileText, LayoutDashboard, Lock, Plug, Receipt, Scale, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { planoInclui, type Plano, type Recurso } from "@/lib/plans";
import { Marca } from "./Logo";
import { NavLink } from "./NavLink";
import { useSidebar } from "./SidebarContext";

/**
 * Menu do lojista. Tudo aqui é escopo do próprio cliente logado.
 *
 * `recurso` marca o item que pertence ao plano Pro. O cadeado é só sinalização:
 * quem bloqueia de verdade é `requireRecurso` dentro da página, porque digitar
 * a URL na barra de endereço ignora qualquer coisa que o menu faça.
 */
const NAV: Array<{ href: string; label: string; Icon: typeof LayoutDashboard; recurso?: Recurso }> = [
  { href: "/", label: "Início", Icon: LayoutDashboard },
  { href: "/vendas", label: "Vendas", Icon: Receipt },
  { href: "/faturamento", label: "Faturamento", Icon: DollarSign },
  { href: "/relatorios", label: "Relatórios", Icon: FileText, recurso: "relatorios" },
  { href: "/comparador", label: "Comparador de preços", Icon: Scale, recurso: "comparador" },
  { href: "/lojas", label: "Minhas lojas", Icon: Store },
  { href: "/estoque", label: "Estoque", Icon: Boxes },
  { href: "/integracoes", label: "Integrações", Icon: Plug },
];

export function Sidebar({
  subtitle,
  plano,
  diasDeTeste,
}: {
  subtitle: string;
  plano: Plano;
  /** Preenchido só durante o teste grátis. */
  diasDeTeste: number | null;
}) {
  const pathname = usePathname();
  const { open, close } = useSidebar();

  // Fecha o drawer sempre que a rota muda (ex.: tocou num link do menu).
  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={close} aria-hidden="true" />
      )}
      <aside
        className={`sticky top-0 z-40 flex h-dvh w-[260px] shrink-0 flex-col border-r border-line bg-surface transition-transform duration-200 ease-out max-lg:fixed max-lg:inset-y-0 max-lg:left-0 ${
          open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        }`}
      >
        <Link href="/" className="block px-5 py-6">
          <Marca priority />
          {/* Abaixo da marca do produto vem a loja em que voce esta:
              e o endereco do multi-tenant, nao um segundo nome do sistema. */}
          <span className="mt-2 block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {subtitle}
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map(({ href, label, Icon, recurso }) => {
            // "/" casa com tudo em startsWith — a home só fica ativa no exato.
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const travado = recurso != null && !planoInclui(plano, recurso);

            return (
              <NavLink
                key={href}
                href={travado ? `/assinatura?recurso=${recurso}` : href}
                active={active && !travado}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active && !travado
                    ? "bg-brand-soft font-semibold text-brand"
                    : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon size={18} aria-hidden />
                <span className={travado ? "text-ink-muted" : undefined}>{label}</span>
                {travado && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                    <Lock size={11} aria-hidden />
                    Pro
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {diasDeTeste != null && (
          <Link
            href="/assinatura"
            className="mx-3 mb-4 block rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs transition-colors hover:border-brand"
          >
            <span className="block font-semibold text-ink">
              {diasDeTeste === 1 ? "Último dia de teste" : `${diasDeTeste} dias de teste`}
            </span>
            <span className="mt-0.5 block text-ink-muted">Escolher um plano →</span>
          </Link>
        )}
      </aside>
    </>
  );
}
