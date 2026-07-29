import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { pct } from "@/lib/format";

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</Tag>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status — escala fixa, sempre com ícone + rótulo (nunca cor sozinha)         */
/* -------------------------------------------------------------------------- */

export type Health = "SAUDAVEL" | "ATENCAO" | "CRITICO";

const HEALTH = {
  SAUDAVEL: { label: "Saudável", color: "var(--good)", Icon: CircleCheck },
  ATENCAO: { label: "Atenção", color: "var(--warning)", Icon: TriangleAlert },
  CRITICO: { label: "Crítico", color: "var(--critical)", Icon: CircleAlert },
} as const;

export function HealthPill({ health }: { health: Health }) {
  const { label, color, Icon } = HEALTH[health];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <Icon size={13} aria-hidden />
      {label}
    </span>
  );
}

const INVOICE = {
  PAGO: { label: "Pago", color: "var(--good)", Icon: CircleCheck },
  PENDENTE: { label: "Pendente", color: "var(--warning)", Icon: TriangleAlert },
  ATRASADO: { label: "Atrasado", color: "var(--critical)", Icon: CircleAlert },
} as const;

export function InvoicePill({ status }: { status: keyof typeof INVOICE }) {
  const { label, color, Icon } = INVOICE[status] ?? INVOICE.PENDENTE;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <Icon size={13} aria-hidden />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Marketplaces                                                                */
/* -------------------------------------------------------------------------- */

const PLATFORM_STYLE = {
  MERCADO_LIVRE: { label: "Mercado Livre", short: "ML", fg: "var(--ml)", bg: "var(--ml-bg)" },
  SHOPEE: { label: "Shopee", short: "Shopee", fg: "var(--shopee)", bg: "var(--shopee-bg)" },
  TIKTOK_SHOP: { label: "TikTok Shop", short: "TikTok", fg: "var(--tiktok)", bg: "var(--tiktok-bg)" },
} as const;

export type PlatformKey = keyof typeof PLATFORM_STYLE;

export function PlatformBadge({ platform, short = false }: { platform: string; short?: boolean }) {
  const s = PLATFORM_STYLE[platform as PlatformKey] ?? {
    label: platform,
    short: platform,
    fg: "var(--ink-2)",
    bg: "var(--surface-3)",
  };
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: s.fg, backgroundColor: s.bg }}
    >
      {short ? s.short : s.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Métricas                                                                    */
/* -------------------------------------------------------------------------- */

export function Delta({ value }: { value: number }) {
  if (!Number.isFinite(value) || value === 0) {
    return <span className="text-xs text-ink-muted">—</span>;
  }
  const up = value > 0;
  const color = up ? "var(--good-text)" : "var(--critical)";
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <Icon size={12} aria-hidden />
      {pct(Math.abs(value)).replace("+", "")}
      <span className="sr-only">{up ? "alta" : "queda"}</span>
    </span>
  );
}

/**
 * Stat tile — número herói. Sem gráfico embutido, então não leva tooltip.
 */
export function Stat({
  label,
  value,
  hint,
  delta,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  icon?: ReactNode;
  tone?: "brand" | "series-1" | "series-2" | "series-3" | "good";
}) {
  const toneColor = {
    brand: "var(--brand)",
    "series-1": "var(--series-1)",
    "series-2": "var(--series-2)",
    "series-3": "var(--series-3)",
    good: "var(--good)",
  }[tone];

  return (
    <Card className="p-5">
      {icon && (
        <div
          className="mb-4 grid size-10 place-items-center rounded-xl"
          style={{ color: toneColor, backgroundColor: `color-mix(in srgb, ${toneColor} 14%, transparent)` }}
        >
          {icon}
        </div>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-2 text-[28px] font-bold leading-none text-ink">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {delta !== undefined && <Delta value={delta} />}
        {hint && <span className="text-[13px] text-ink-muted">{hint}</span>}
      </div>
    </Card>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="max-w-md text-[13px] text-ink-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-brand-ink"
      style={{ width: size, height: size, fontSize: size * 0.36, background: "var(--brand)" }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
