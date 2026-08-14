"use client";

import {
  Boxes,
  DollarSign,
  FileText,
  LayoutDashboard,
  MessageCircle,
  PackageSearch,
  Plug,
  Receipt,
  Scale,
  Settings,
  Sparkles,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { larguraPara, LOGO_ALT, LOGO_ALTURA_MENU, LOGO_SRC } from "@/lib/brand";
import { NavLink } from "./NavLink";
import { useSidebar } from "./SidebarContext";

/**
 * Menu do lojista, agrupado por área — 13 rotas de uma vez cansam numa lista
 * corrida. "Início" fica solto no topo, sem título de seção. Tudo aqui é
 * escopo do próprio cliente logado.
 */
const NAV: Array<{ titulo?: string; itens: Array<{ href: string; label: string; Icon: typeof LayoutDashboard; badge?: "chat" }> }> = [
  { itens: [{ href: "/", label: "Início", Icon: LayoutDashboard }] },
  {
    titulo: "Vendas",
    itens: [
      { href: "/vendas", label: "Vendas", Icon: Receipt },
      { href: "/atacado", label: "Atacado", Icon: PackageSearch },
      { href: "/chat", label: "Chat", Icon: MessageCircle, badge: "chat" },
      { href: "/comparador", label: "Comparador de preços", Icon: Scale },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { href: "/faturamento", label: "Faturamento", Icon: DollarSign },
      { href: "/financeiro", label: "Financeiro", Icon: Wallet },
      { href: "/relatorios", label: "Relatórios", Icon: FileText },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/estoque", label: "Estoque", Icon: Boxes },
      { href: "/lojas", label: "Minhas lojas", Icon: Store },
      { href: "/gerenciamento", label: "Gerenciamento", Icon: Users },
      { href: "/integracoes", label: "Integrações", Icon: Plug },
      { href: "/configuracoes", label: "Configurações", Icon: Settings },
    ],
  },
];

export function Sidebar({ subtitle, chatNaoLidas = 0 }: { subtitle: string; chatNaoLidas?: number }) {
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
          <Image
            src={LOGO_SRC}
            alt={LOGO_ALT}
            width={larguraPara(LOGO_ALTURA_MENU)}
            height={LOGO_ALTURA_MENU}
            priority
            className="h-11 w-auto max-w-full object-contain object-left"
          />
          <span className="mt-2 block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {subtitle}
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map((secao, i) => (
            <div key={secao.titulo ?? `raiz-${i}`} className={i > 0 ? "pt-4" : undefined}>
              {secao.titulo && (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  {secao.titulo}
                </p>
              )}
              <div className="space-y-1">
                {secao.itens.map(({ href, label, Icon, badge }) => {
                  // "/" casa com tudo em startsWith — a home só fica ativa no exato.
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  const contador = badge === "chat" ? chatNaoLidas : 0;
                  return (
                    <NavLink
                      key={href}
                      href={href}
                      active={active}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-brand-soft font-semibold text-brand"
                          : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <Icon size={18} aria-hidden />
                      <span className="flex-1">{label}</span>
                      {contador > 0 && (
                        <span className="grid min-w-[20px] place-items-center rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold tabular text-brand-ink">
                          {contador}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Deixa claro que os números são fictícios — sem isso, dado de demo
            fica indistinguível de dado real de cliente. */}
        <div className="shrink-0 border-t border-line px-3 py-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: "var(--brand)", backgroundColor: "var(--brand-soft)" }}
            title="Sistema em fase de demonstração — dados fictícios."
          >
            <Sparkles size={12} aria-hidden />
            MVP · Versão de demonstração
          </span>
        </div>
      </aside>
    </>
  );
}
