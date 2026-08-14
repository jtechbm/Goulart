"use client";

import { Boxes, DollarSign, LayoutDashboard, Plug, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { APP_NAME, LOGO_SRC } from "@/lib/brand";
import { NavLink } from "./NavLink";
import { useSidebar } from "./SidebarContext";

/** Menu do lojista. Tudo aqui é escopo do próprio cliente logado. */
const NAV = [
  { href: "/", label: "Início", Icon: LayoutDashboard },
  { href: "/faturamento", label: "Faturamento", Icon: DollarSign },
  { href: "/lojas", label: "Minhas lojas", Icon: Store },
  { href: "/estoque", label: "Estoque", Icon: Boxes },
  { href: "/integracoes", label: "Integrações", Icon: Plug },
];

export function Sidebar({ subtitle }: { subtitle: string }) {
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
        <Link href="/" className="flex items-center gap-3 px-5 py-6">
          <Image
            src={LOGO_SRC}
            alt=""
            width={40}
            height={40}
            priority
            className="size-10 shrink-0 rounded-xl object-contain"
          />
          <span className="min-w-0 leading-tight">
            <span className="block text-[17px] font-bold text-ink">{APP_NAME}</span>
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              {subtitle}
            </span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map(({ href, label, Icon }) => {
            // "/" casa com tudo em startsWith — a home só fica ativa no exato.
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
                {label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
