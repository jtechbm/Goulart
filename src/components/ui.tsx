import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";
import { CANAL_COR, CANAL_LABEL, CANAL_SHORT, type Canal } from "@/lib/canais";
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

/**
 * Cabeçalho só de impressão — a tela nunca mostra, o PDF sempre. O título já
 * sai do `PageHeader` normal (que não se esconde no print); aqui só entra o
 * que falta pra identificar o documento: de quem é e quando foi gerado.
 */
export function PrintHeader({ empresa, periodo }: { empresa: string; periodo: string }) {
  return (
    <div className="mb-4 hidden border-b border-line pb-3 print:block">
      <p className="text-base font-bold text-ink">{empresa || APP_NAME}</p>
      <p className="text-[13px] text-ink-2">
        {periodo} · gerado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Canais de venda                                                             */
/* -------------------------------------------------------------------------- */

export type PlatformKey = Canal;

export function PlatformBadge({ platform, short = false }: { platform: string; short?: boolean }) {
  const cor = CANAL_COR[platform as Canal] ?? { fg: "var(--ink-2)", bg: "var(--surface-3)" };
  const label = CANAL_LABEL[platform as Canal] ?? platform;
  const shortLabel = CANAL_SHORT[platform as Canal] ?? platform;
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: cor.fg, backgroundColor: cor.bg }}
    >
      {short ? shortLabel : label}
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
  tone?: "brand" | "series-1" | "series-2" | "series-3" | "series-4" | "series-5" | "good" | "critical";
}) {
  const toneColor = {
    brand: "var(--brand)",
    "series-1": "var(--series-1)",
    "series-2": "var(--series-2)",
    "series-3": "var(--series-3)",
    "series-4": "var(--series-4)",
    "series-5": "var(--series-5)",
    good: "var(--good)",
    critical: "var(--critical)",
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

/**
 * Rótulo + campo.
 *
 * Existe para o rótulo ser o caminho mais fácil, não uma lembrança. Todo campo
 * do sistema precisa dizer, visível e o tempo todo, o que se espera dentro
 * dele — `placeholder` não serve: some assim que a pessoa digita, e num campo
 * numérico que já vem preenchido ("0", "1") ele nunca chega a aparecer. O
 * usuário via um número solto sem saber se era estoque, preço ou quantidade.
 *
 * O `<label>` envolve o campo, então a associação com leitor de tela vale sem
 * precisar de `id`/`htmlFor` — e clicar no texto foca o campo.
 */
export function Campo({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  /** Linha de apoio para unidade ou formato ("em reais", "un."). */
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span>}
    </label>
  );
}
