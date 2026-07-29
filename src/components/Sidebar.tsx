"use client";

import {
  BrainCircuit,
  Boxes,
  DollarSign,
  FileText,
  FlaskConical,
  LayoutDashboard,
  MessageCircle,
  Plug,
  Receipt,
  Settings,
  Store,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSidebar } from "./SidebarContext";

/**
 * Menu da agência. Cada item declara a permissão que o libera — o menu mostra
 * só o que a função da pessoa alcança, e a página confirma de novo no servidor.
 */
const ADMIN_NAV = [
  { href: "/", label: "Painel", Icon: LayoutDashboard, permission: "painel" },
  { href: "/clientes", label: "Clientes", Icon: Users, permission: "clientes" },
  { href: "/contas", label: "Contas", Icon: Store, permission: "contas" },
  { href: "/estoque", label: "Estoque", Icon: Boxes, permission: "estoque" },
  { href: "/analise", label: "Análise de IA", Icon: BrainCircuit, permission: "analise" },
  { href: "/financeiro", label: "Financeiro", Icon: DollarSign, permission: "financeiro" },
  { href: "/mensalidades", label: "Mensalidades", Icon: Receipt, permission: "mensalidades" },
  { href: "/suporte", label: "Suporte", Icon: MessageCircle, permission: "suporte" },
  { href: "/relatorios", label: "Relatórios", Icon: FileText, permission: "relatorios" },
  { href: "/equipe", label: "Equipe", Icon: UsersRound, permission: "equipe" },
  { href: "/configuracoes", label: "Configurações", Icon: Settings, permission: "configuracoes" },
];

/**
 * Menu do lojista — só o que é dele.
 * Sem "Relatórios": a análise de IA é ferramenta interna da agência.
 */
const PORTAL_NAV = [
  { href: "/portal", label: "Início", Icon: LayoutDashboard, permission: null },
  { href: "/portal/financeiro", label: "Faturamento", Icon: DollarSign, permission: null },
  { href: "/portal/lojas", label: "Minhas lojas", Icon: Store, permission: null },
  { href: "/portal/estoque", label: "Estoque", Icon: Boxes, permission: null },
  { href: "/portal/integracoes", label: "Integrações", Icon: Plug, permission: null },
  { href: "/portal/faturas", label: "Faturas", Icon: Receipt, permission: null },
  { href: "/portal/suporte", label: "Suporte", Icon: MessageCircle, permission: null },
];

export function Sidebar({
  variant,
  subtitle,
  permissions = [],
  home: homeHref,
}: {
  variant: "admin" | "portal";
  subtitle: string;
  /** Permissões da sessão; ignorado no portal, onde o cliente vê tudo que é dele. */
  permissions?: readonly string[];
  home?: string;
}) {
  const pathname = usePathname();
  const home = homeHref ?? (variant === "admin" ? "/" : "/portal");
  const nav = (variant === "admin" ? ADMIN_NAV : PORTAL_NAV).filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );

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
      <Link href={home} className="flex items-center gap-3 px-5 py-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink">
          <Zap size={20} strokeWidth={2.5} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[17px] font-bold text-ink">GoulartERP</span>
          <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {subtitle}
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {nav.map(({ href, label, Icon }) => {
          const active = href === home ? pathname === home : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-brand-soft font-semibold text-brand"
                  : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon size={18} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Deixa explícito que é protótipo — evita que alguém tome os números
          de demonstração como reais. */}
      <div className="border-t border-line px-5 py-4">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
          style={{
            color: "var(--warning)",
            backgroundColor: "color-mix(in srgb, var(--warning) 16%, transparent)",
          }}
        >
          <FlaskConical size={11} aria-hidden />
          Protótipo
        </span>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
          v1.0 · dados de demonstração
        </p>
      </div>
      </aside>
    </>
  );
}
