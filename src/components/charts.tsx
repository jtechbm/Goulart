"use client";

import { useId, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CANAIS, CANAL_LABEL, CANAL_SERIE } from "@/lib/canais";
import { brl } from "@/lib/format";

/**
 * Paleta categórica validada (dataviz/scripts/validate_palette.js) nos dois modos,
 * all-pairs. Ordem fixa — nunca ciclar, nunca reatribuir por ranking.
 *   slot 1 violeta (ML) · 2 laranja (Shopee) · 3 aqua (TikTok) · 4 azul (SHEIN) · 5 vinho (Atacado)
 */
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"] as const;

const PLATFORM_SERIES: Record<string, string> = CANAL_SERIE;
const PLATFORM_NAME: Record<string, string> = CANAL_LABEL;

const axisTick = { fill: "var(--axis-ink)", fontSize: 11 };

/* -------------------------------------------------------------------------- */
/* Chrome compartilhado                                                        */
/* -------------------------------------------------------------------------- */

function TooltipBox({ title, rows }: { title: string; rows: Array<{ label: string; value: string; color?: string }> }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[13px]">
            {r.color && (
              <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
            )}
            <span className="text-ink-2">{r.label}</span>
            <span className="ml-auto font-semibold text-ink tabular">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Legenda: swatch colorido + rótulo em tinta de texto (nunca na cor da série). */
function Legend({ items }: { items: Array<{ label: string; color: string; value?: string }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-[13px]">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
          <span className="text-ink-2">{i.label}</span>
          {i.value && <span className="font-semibold text-ink tabular">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Tabela alternativa — canal de leitura obrigatório quando o contraste do
 *  preenchimento fica abaixo de 3:1 (caso do aqua no tema claro). */
function TableView({ head, rows }: { head: string[]; rows: string[][] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="text-[12px] font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
      >
        {open ? "Ocultar tabela" : "Ver como tabela"}
      </button>
      {open && (
        <div id={id} className="mt-2 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                {head.map((h, i) => (
                  <th key={h} className={`py-1.5 font-medium ${i > 0 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]} className="border-b border-line/60 last:border-0">
                  {r.map((c, i) => (
                    <td key={i} className={`py-1.5 ${i > 0 ? "text-right tabular text-ink" : "text-ink-2"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Linha — faturamento diário por plataforma                                   */
/* -------------------------------------------------------------------------- */

export type RevenuePoint = { day: number } & Partial<Record<(typeof CANAIS)[number], number>>;

export function RevenueLine({ data }: { data: RevenuePoint[] }) {
  const totals = Object.fromEntries(
    CANAIS.map((c) => [c, data.reduce((s, d) => s + (d[c] ?? 0), 0)]),
  ) as Record<string, number>;
  // Cinco linhas rentes ao zero destroem a leitura — só desenha o canal que
  // teve movimento no período.
  const platforms = CANAIS.filter((c) => totals[c] > 0);

  const fmtDay = (v: number) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(v));

  if (platforms.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-muted">Sem dados no período.</p>;
  }

  return (
    <div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={fmtDay}
              tick={axisTick}
              axisLine={{ stroke: "var(--axis)" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(v: number) => brl(v, true)}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={fmtDay(Number(label))}
                    rows={payload.map((p) => ({
                      label: PLATFORM_NAME[String(p.dataKey)] ?? String(p.dataKey),
                      value: brl(Number(p.value ?? 0)),
                      color: PLATFORM_SERIES[String(p.dataKey)],
                    }))}
                  />
                ) : null
              }
            />
            {platforms.map((p) => (
              <Line
                key={p}
                type="monotone"
                dataKey={p}
                stroke={PLATFORM_SERIES[p]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3">
        <Legend
          items={platforms.map((p) => ({
            label: PLATFORM_NAME[p],
            color: PLATFORM_SERIES[p],
            value: brl(totals[p], true),
          }))}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Rosca — composição de custo                                                 */
/* -------------------------------------------------------------------------- */

export function CostDonut({ fatias }: { fatias: Array<{ label: string; value: number }> }) {
  const data = fatias.map((f, i) => ({ name: f.label, value: Math.max(0, f.value), color: SERIES[i % SERIES.length] }));
  const total = data.reduce((s, d) => s + d.value, 0);
  const share = (v: number) => (total ? `${((v / total) * 100).toFixed(1).replace(".", ",")}%` : "0%");

  if (total === 0) {
    return <p className="py-12 text-center text-sm text-ink-muted">Sem dados no período.</p>;
  }

  return (
    <div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String(payload[0].name)}
                    rows={[
                      { label: "Valor", value: brl(Number(payload[0].value ?? 0)) },
                      { label: "Participação", value: share(Number(payload[0].value ?? 0)) },
                    ]}
                  />
                ) : null
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={92}
              /* 2px de superfície entre segmentos */
              paddingAngle={1.5}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* rótulos diretos com valor — também servem de alívio de contraste */}
      <div className="mt-3">
        <Legend
          items={data.map((d) => ({ label: d.name, color: d.color, value: `${brl(d.value, true)} · ${share(d.value)}` }))}
        />
      </div>
      <TableView
        head={["Componente", "Valor", "Participação"]}
        rows={data.map((d) => [d.name, brl(d.value), share(d.value)])}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Barras — margem por plataforma                                              */
/* -------------------------------------------------------------------------- */

/**
 * Categorias nominais numa única série: todas as barras usam o slot 1.
 * Colorir cada barra por plataforma gastaria o canal de identidade
 * re-codificando o que o comprimento já mostra.
 */
export function MarginBars({ data }: { data: Array<{ platform: string; margin: number; revenue: number }> }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-muted">Sem dados no período.</p>;
  }

  const rows = data.map((d) => ({ ...d, name: PLATFORM_NAME[d.platform] ?? d.platform }));

  return (
    <div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: -16 }} barCategoryGap="34%">
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "var(--axis)" }} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) => `${v}%`}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={[0, 100]}
            />
            <Tooltip
              cursor={{ fill: "var(--brand-soft)" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String(payload[0].payload.name)}
                    rows={[
                      { label: "Margem", value: `${Number(payload[0].value ?? 0).toFixed(1).replace(".", ",")}%` },
                      { label: "Faturamento", value: brl(Number(payload[0].payload.revenue ?? 0)) },
                    ]}
                  />
                ) : null
              }
            />
            {/* extremidade arredondada em 4px, ancorada na linha de base */}
            <Bar dataKey="margin" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView
        head={["Plataforma", "Margem", "Faturamento"]}
        rows={rows.map((r) => [r.name, `${r.margin.toFixed(1).replace(".", ",")}%`, brl(r.revenue)])}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Linha — fluxo de caixa                                                      */
/* -------------------------------------------------------------------------- */

export type CashFlowPoint = { dia: string; entrada: number; saida: number; saldo: number };

/**
 * Entrada/saída usam as cores de status (bom/crítico) — aqui não é
 * identidade categórica, é dinheiro entrando ou saindo. Saldo acumulado fica
 * na cor da marca, terceira linha.
 */
export function CashFlowLine({ data }: { data: CashFlowPoint[] }) {
  const temMovimento = data.some((d) => d.entrada > 0 || d.saida > 0);
  if (!temMovimento) {
    return <p className="py-12 text-center text-sm text-ink-muted">Sem movimentação no período.</p>;
  }

  const fmtDia = (v: string) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${v}T00:00:00Z`));

  const SERIES_FLUXO = { entrada: "var(--good)", saida: "var(--critical)", saldo: "var(--brand)" };
  const NOME_FLUXO = { entrada: "Entradas", saida: "Saídas", saldo: "Saldo acumulado" };

  return (
    <div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dia" tickFormatter={fmtDia} tick={axisTick} axisLine={{ stroke: "var(--axis)" }} tickLine={false} minTickGap={28} />
            <YAxis tickFormatter={(v: number) => brl(v, true)} tick={axisTick} axisLine={false} tickLine={false} width={64} />
            <Tooltip
              cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={fmtDia(String(label))}
                    rows={payload.map((p) => ({
                      label: NOME_FLUXO[p.dataKey as keyof typeof NOME_FLUXO] ?? String(p.dataKey),
                      value: brl(Number(p.value ?? 0)),
                      color: SERIES_FLUXO[p.dataKey as keyof typeof SERIES_FLUXO],
                    }))}
                  />
                ) : null
              }
            />
            {(["entrada", "saida", "saldo"] as const).map((k) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={SERIES_FLUXO[k]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <Legend items={(["entrada", "saida", "saldo"] as const).map((k) => ({ label: NOME_FLUXO[k], color: SERIES_FLUXO[k] }))} />
      </div>
    </div>
  );
}
