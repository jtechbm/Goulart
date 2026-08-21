/**
 * Dinheiro **sempre com centavos**.
 *
 * Arredondar para o real inteiro era aceitável enquanto as telas só mostravam
 * totais, mas quebra onde há conta à vista: um lucro de R$ 4,95 virava "R$ 5",
 * e uma cascata de subtrações passava a não fechar aos olhos de quem confere.
 *
 * `compact` continua abreviando ("R$ 12,3 mil") e existe só para eixo e rótulo
 * de gráfico, onde o espaço é o limite e o número exato está na tabela ao lado.
 */
export const brl = (v: number, compact = false) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: compact ? "compact" : "standard",
    ...(compact ? { maximumFractionDigits: 1 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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

/**
 * "São Paulo/SP", "São Paulo", "SP" ou "" — nunca "São Paulo/null".
 *
 * Existe porque montar isso na mão com template literal imprime o `null` na
 * cara do lojista assim que um dos dois campos fica vazio, e os dois são
 * opcionais no cadastro.
 */
export function local(city?: string | null, uf?: string | null): string {
  const c = city?.trim();
  const u = uf?.trim();
  if (c && u) return `${c}/${u}`;
  return c || u || "";
}
