import { CircleAlert, DollarSign, Percent, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, PageHeader, PlatformBadge, Stat } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { brl, date, num } from "@/lib/format";
import { gerarRelatorio } from "@/lib/reports";
import { faixaMargem } from "@/lib/sales";

export const dynamic = "force-dynamic";

const PERIODOS = [7, 30, 90];
const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const user = await requireClient();
  const sp = await searchParams;
  const dias = PERIODOS.some((d) => String(d) === sp.dias) ? Number(sp.dias) : 30;

  const r = await gerarRelatorio(user.clientId, dias);

  /**
   * A cascata é o relatório inteiro em uma coluna: de cada real vendido, o que
   * o marketplace levou, o que o imposto levou, o que o produto custou, e o que
   * sobrou. Cada linha guarda o sinal para a leitura não depender só da cor.
   */
  const cascata: Array<{ rotulo: string; valor: number; sinal: "+" | "-" | "="; nota?: string }> = [
    { rotulo: "Faturamento", valor: r.faturamento, sinal: "+", nota: `${num(r.pedidos)} pedido(s) · ${num(r.unidades)} unidade(s)` },
    { rotulo: "Comissão do marketplace", valor: -r.comissao, sinal: "-" },
    { rotulo: "Frete pago por você", valor: -r.frete, sinal: "-" },
    ...(r.taxaServico ? [{ rotulo: "Taxa de serviço", valor: -r.taxaServico, sinal: "-" as const }] : []),
    ...(r.taxaCartao ? [{ rotulo: "Taxa de cartão", valor: -r.taxaCartao, sinal: "-" as const }] : []),
    ...(r.moedas ? [{ rotulo: "Moedas / cashback", valor: r.moedas, sinal: "+" as const }] : []),
    { rotulo: "Líquido do marketplace", valor: r.liquido, sinal: "=" },
    { rotulo: "Imposto estimado", valor: -r.imposto, sinal: "-", nota: `alíquota de ${pct(r.aliquota * 100)}` },
    { rotulo: "Custo dos produtos", valor: -r.custoProduto, sinal: "-" },
    ...(r.custoExtra ? [{ rotulo: "Custo extra", valor: -r.custoExtra, sinal: "-" as const }] : []),
    { rotulo: "Lucro", valor: r.lucro, sinal: "=", nota: `margem de ${pct(r.margem)}` },
  ];

  const avisos: string[] = [];
  if (r.itensSemVinculo > 0)
    avisos.push(`${r.itensSemVinculo} item/itens sem produto vinculado — não têm custo, então o lucro está superestimado.`);
  if (r.itensSemCusto > 0)
    avisos.push(`${r.itensSemCusto} item/itens de produto com custo zerado — preencha o custo no Estoque.`);
  if (r.divergenciaTaxas > 0.01)
    avisos.push(`As taxas somadas nos pedidos e nos itens diferem em ${brl(r.divergenciaTaxas)}.`);

  const faixaGeral = faixaMargem(r.margem);

  return (
    <>
      <Topbar crumb="Relatórios" />
      <main className="flex-1 px-6 py-8 print:px-0 print:py-0">
        <PageHeader
          title="Relatório de faturamento e lucro"
          subtitle={`${date(r.de)} a ${date(r.ate)} · últimos ${dias} dias`}
          action={<PrintButton />}
        />

        <div className="mb-6 flex w-fit gap-1.5 rounded-xl border border-line bg-surface p-1 print:hidden">
          {PERIODOS.map((d) => (
            <Link
              key={d}
              href={d === 30 ? "/relatorios" : `/relatorios?dias=${d}`}
              aria-current={d === dias ? "true" : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                d === dias ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {d} dias
            </Link>
          ))}
        </div>

        {r.pedidos === 0 ? (
          <Card>
            <Empty
              title="Nenhuma venda no período"
              hint="O relatório é montado a partir dos pedidos sincronizados das suas lojas."
            />
          </Card>
        ) : (
          <>
            {avisos.length > 0 && (
              <div
                className="mb-6 rounded-xl border px-4 py-3"
                style={{
                  borderColor: "var(--warning)",
                  backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)",
                }}
              >
                <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <CircleAlert size={15} style={{ color: "var(--warning)" }} aria-hidden />
                  O que pode distorcer estes números
                </p>
                <ul className="mt-1.5 space-y-1 pl-6">
                  {avisos.map((a) => (
                    <li key={a} className="list-disc text-[13px] text-ink-2">{a}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Faturamento" value={brl(r.faturamento)} icon={<DollarSign size={18} />} tone="series-1" />
              <Stat
                label="Líquido do marketplace"
                value={brl(r.liquido)}
                hint={r.faturamento ? `${pct((r.liquido / r.faturamento) * 100)} do bruto` : undefined}
                icon={<Wallet size={18} />}
                tone="series-2"
              />
              <Stat
                label="Lucro"
                value={brl(r.lucro)}
                icon={<TrendingUp size={18} />}
                tone={r.lucro >= 0 ? "good" : "series-3"}
              />
              <Stat label="Margem" value={pct(r.margem)} hint={faixaGeral.rotulo} icon={<Percent size={18} />} tone="brand" />
            </div>

            <Card className="mt-6 break-inside-avoid">
              <CardHeader
                title="De cada real vendido, o que sobra"
                subtitle={`Ticket médio de ${brl(r.ticket)}.`}
              />
              <dl>
                {cascata.map((l, i) => {
                  const total = l.sinal === "=";
                  const ultimo = i === cascata.length - 1;
                  return (
                    <div
                      key={l.rotulo}
                      className={`flex items-baseline justify-between gap-4 px-5 ${total ? "border-y border-line bg-surface-2 py-3.5" : "py-2.5"}`}
                    >
                      <dt className={total ? "text-sm font-semibold text-ink" : "pl-4 text-[13px] text-ink-2"}>
                        {!total && <span className="mr-1.5 text-ink-muted">{l.sinal}</span>}
                        {l.rotulo}
                        {l.nota && <span className="ml-2 text-[12px] text-ink-muted">{l.nota}</span>}
                      </dt>
                      <dd
                        className={`shrink-0 tabular ${total ? "text-base font-bold" : "text-sm"}`}
                        style={{
                          color: ultimo
                            ? r.lucro >= 0
                              ? "var(--good-text)"
                              : "var(--critical)"
                            : total
                              ? "var(--ink)"
                              : "var(--ink-2)",
                        }}
                      >
                        {brl(l.valor)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Card>

            {r.porPlataforma.length > 1 && (
              <Card className="mt-6 overflow-hidden break-inside-avoid">
                <CardHeader title="Por marketplace" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                        <th className="px-5 py-3.5">Canal</th>
                        <th className="px-5 py-3.5 text-right">Pedidos</th>
                        <th className="px-5 py-3.5 text-right">Faturamento</th>
                        <th className="px-5 py-3.5 text-right">Líquido</th>
                        <th className="px-5 py-3.5 text-right">Lucro</th>
                        <th className="px-5 py-3.5 text-right">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {r.porPlataforma.map((p) => (
                        <tr key={p.plataforma}>
                          <td className="px-5 py-4"><PlatformBadge platform={p.plataforma} /></td>
                          <td className="px-5 py-4 text-right text-ink-2 tabular">{num(p.pedidos)}</td>
                          <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(p.faturamento)}</td>
                          <td className="px-5 py-4 text-right text-ink-2 tabular">{brl(p.liquido)}</td>
                          <td
                            className="px-5 py-4 text-right font-semibold tabular"
                            style={{ color: p.lucro >= 0 ? "var(--ink)" : "var(--critical)" }}
                          >
                            {brl(p.lucro)}
                          </td>
                          <td className="px-5 py-4 text-right tabular" style={{ color: faixaMargem(p.margem).cor }}>
                            {pct(p.margem)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <Card className="mt-6 overflow-hidden">
              <CardHeader
                title="Por produto"
                subtitle="Do que mais dá lucro para o que mais tira. É aqui que aparece o item que vende bem e mesmo assim custa dinheiro."
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                      <th className="px-5 py-3.5">Produto</th>
                      <th className="px-5 py-3.5 text-right">Unid.</th>
                      <th className="px-5 py-3.5 text-right">Faturamento</th>
                      <th className="px-5 py-3.5 text-right">Lucro</th>
                      <th className="px-5 py-3.5 text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {r.porProduto.map((p) => (
                      <tr key={p.id ?? p.titulo}>
                        <td className="max-w-[380px] px-5 py-4">
                          <p className="line-clamp-1 font-medium text-ink">{p.titulo}</p>
                          <p className="text-[12px] text-ink-muted">
                            {p.sku ? `SKU ${p.sku}` : "sem SKU"}
                            {p.semCusto && (
                              <span style={{ color: "var(--warning)" }}> · sem custo, lucro superestimado</span>
                            )}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right text-ink-2 tabular">{num(p.unidades)}</td>
                        <td className="px-5 py-4 text-right text-ink-2 tabular">{brl(p.faturamento)}</td>
                        <td
                          className="px-5 py-4 text-right font-semibold tabular"
                          style={{ color: p.lucro >= 0 ? "var(--ink)" : "var(--critical)" }}
                        >
                          {brl(p.lucro)}
                        </td>
                        <td className="px-5 py-4 text-right tabular" style={{ color: faixaMargem(p.margem).cor }}>
                          {pct(p.margem)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <p className="mt-4 text-[12px] text-ink-muted">
              O imposto é uma estimativa pela alíquota de {pct(r.aliquota * 100)} configurada em{" "}
              <code className="rounded bg-surface-3 px-1.5 py-0.5">TAX_RATE</code>, não um cálculo fiscal. O custo dos
              produtos usa o valor atual cadastrado no Estoque — alterá-lo recalcula este relatório.
            </p>
          </>
        )}
      </main>
    </>
  );
}
