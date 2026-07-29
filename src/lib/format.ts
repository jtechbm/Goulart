export const brl = (v: number, compact = false) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(v);

export const num = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

export const pct = (v: number, digits = 1) =>
  `${v > 0 ? "+" : ""}${v.toFixed(digits).replace(".", ",")}%`;

export const date = (d: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    typeof d === "string" ? new Date(d) : d,
  );

/** "há 5 min" / "há 2 h" / "ontem" — usado nas colunas de sync. */
export function relative(d: Date | string | null | undefined): string {
  if (!d) return "nunca";
  const then = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - then.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return date(then);
}

/** Variação percentual entre dois períodos, tolerante a base zero. */
export function variation(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}
