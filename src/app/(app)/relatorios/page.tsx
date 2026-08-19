import { AlertTriangle, Boxes, CircleAlert, DollarSign, Percent, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, Empty, PageHeader, PlatformBadge, PrintHeader, Stat } from "@/components/ui";
import { requireRecurso } from "@/lib/planGuard";
import { lancamentos, resumoFinanceiro, STATUS_COR, STATUS_LABEL } from "@/lib/finance";
import { brl, date, num } from "@/lib/format";
import { LOW_STOCK } from "@/lib/inventory";
import { prisma } from "@/lib/db";
import { gerarAnalitico, gerarRelatorio } from "@/lib/reports";
import { faixaMargem } from "@/lib/sales";
import { configuracoes } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PERIODOS = [7, 30, 90];
const TIPOS = [
  { key: "analitico", label: "Analítico" },
  { key: "faturamento", label: "Faturamento" },
  { key: "produtos", label: "Produtos" },
  { key: "estoque", label: "Estoque" },
  { key: "financeiro", label: "Financeiro" },
];
const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

const TITULO_TIPO: Record<string, string> = {
  analitico: "Relatório analítico",
  faturamento: "Relatório de faturamento e lucro",
  produtos: "Relatório por produto",
  estoque: "Relatório de estoque",
  financeiro: "Relatório financeiro",
};

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; tipo?: string }>;
}) {
  // Tela do plano Pro: a trava é aqui, no servidor. Esconder o item do
  // menu é conveniência visual, nunca controle de acesso — a URL é pública.
  const { user } = await requireRecurso("relatorios");
  const sp = await searchParams;
  const dias = PERIODOS.some((d) => String(d) === sp.dias) ? Number(sp.dias) : 30;
  const tipo = TIPOS.some((t) => t.key === sp.tipo) ? sp.tipo! : "analitico";
  const config = await configuracoes(user.clientId);

  const query = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (dias !== 30) q.set("dias", String(dias));
    if (tipo !== "analitico") q.set("tipo", tipo);
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `/relatorios?${s}` : "/relatorios";
  };

  return (
    <>
      <Topbar crumb="Relatórios" />
      <main className="flex-1 px-6 py-8 print:px-0 print:py-0">
        <PrintHeader empresa={config.companyName} periodo={`${TITULO_TIPO[tipo]} · últimos ${dias} dias`} />
        <PageHeader
          title={TITULO_TIPO[tipo]}
          subtitle={`Últimos ${dias} dias`}
          action={<PrintButton />}
        />

        <div className="mb-3 flex w-fit flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1 print:hidden">
          {TIPOS.map((t) => (
            <Link
              key={t.key}
              href={query({ tipo: t.key === "analitico" ? undefined : t.key })}
              aria-current={tipo === t.key ? "true" : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                tipo === t.key ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div className="mb-6 flex w-fit gap-1.5 rounded-xl border border-line bg-surface p-1 print:hidden">
          {PERIODOS.map((d) => (
            <Link
              key={d}
              href={query({ dias: d === 30 ? undefined : String(d) })}
              aria-current={d === dias ? "true" : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                d === dias ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {d} dias
            </Link>
          ))}
        </div>

        {tipo === "analitico" && <RelatorioAnalitico clientId={user.clientId} dias={dias} />}
        {tipo === "faturamento" && <RelatorioFaturamento clientId={user.clientId} dias={dias} />}
        {tipo === "produtos" && <RelatorioProdutos clientId={user.clientId} dias={dias} />}
        {tipo === "estoque" && <RelatorioEstoque clientId={user.clientId} />}
        {tipo === "financeiro" && <RelatorioFinanceiro clientId={user.clientId} dias={dias} />}
      </main>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Analítico                                                                   */
/* -------------------------------------------------------------------------- */

async function RelatorioAnalitico({ clientId, dias }: { clientId: string; dias: number }) {
  const a = await gerarAnalitico(clientId, dias);

  if (a.pedidos === 0) {
    return (
      <Card>
        <Empty title="Nenhuma venda no período" hint="O analítico é montado a partir dos pedidos de marketplace e de atacado." />
      </Card>
    );
  }

  const cascata: Array<{ rotulo: string; valor: number; sinal: "+" | "-" | "="; nota?: string }> = [
    { rotulo: "Líquido marketplace", valor: a.liquidoMarketplace, sinal: "=" },
    { rotulo: "Líquido atacado", valor: a.liquidoAtacado, sinal: "=" },
    { rotulo: "Líquido total", valor: a.liquidoTotal, sinal: "=" },
    { rotulo: "Custo dos produtos (CMV)", valor: -a.custoProduto, sinal: "-" },
    ...(a.custoExtra ? [{ rotulo: "Custo extra", valor: -a.custoExtra, sinal: "-" as const }] : []),
    { rotulo: "LUCRO BRUTO", valor: a.lucroBruto, sinal: "=", nota: `margem de ${pct(a.margemBruta)}` },
    { rotulo: "Imposto estimado", valor: -a.imposto, sinal: "-", nota: `alíquota de ${pct(a.aliquota * 100)}` },
    { rotulo: "Despesas operacionais", valor: -a.despesasOperacionais, sinal: "-" },
    ...(a.ads ? [{ rotulo: "Investimento em ADS", valor: -a.ads, sinal: "-" as const }] : []),
    { rotulo: "LUCRO OPERACIONAL", valor: a.lucroOperacional, sinal: "=", nota: `margem de ${pct(a.margemOperacional)}` },
  ];

  return (
    <>
      {a.despesasOperacionais === 0 && a.ads === 0 && (
        <div
          className="mb-6 rounded-xl border px-4 py-3"
          style={{ borderColor: "var(--warning)", backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)" }}
        >
          <p className="flex items-center gap-2 text-[13px] text-ink">
            <CircleAlert size={15} style={{ color: "var(--warning)" }} aria-hidden />
            Nenhuma despesa cadastrada no período — o lucro operacional ainda é igual ao bruto. Lance despesas em{" "}
            <Link href="/financeiro?aba=pagar" className="font-semibold text-brand hover:underline">
              Financeiro
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faturamento total" value={brl(a.faturamentoTotal)} icon={<DollarSign size={18} />} tone="series-1" />
        <Stat label="Lucro bruto" value={brl(a.lucroBruto)} hint={pct(a.margemBruta)} icon={<TrendingUp size={18} />} tone="series-2" />
        <Stat
          label="Lucro operacional"
          value={brl(a.lucroOperacional)}
          hint={pct(a.margemOperacional)}
          icon={<Wallet size={18} />}
          tone={a.lucroOperacional >= 0 ? "good" : "critical"}
        />
        <Stat label="Margem operacional" value={pct(a.margemOperacional)} hint={faixaMargem(a.margemOperacional).rotulo} icon={<Percent size={18} />} tone="brand" />
      </div>

      <Card className="mt-6 overflow-hidden break-inside-avoid">
        <CardHeader title="Faturamento por canal" subtitle="Marketplaces e atacado, lado a lado." />
        <dl>
          {a.porCanal.map((c) => (
            <div key={c.canal} className="flex items-center justify-between gap-4 px-5 py-2.5">
              <dt>
                <PlatformBadge platform={c.canal} />
              </dt>
              <dd className="text-sm text-ink-2 tabular">{brl(c.faturamento)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t border-line bg-surface-2 px-5 py-3.5">
            <dt className="text-sm font-semibold text-ink">Faturamento total</dt>
            <dd className="text-base font-bold text-ink tabular">{brl(a.faturamentoTotal)}</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-6 break-inside-avoid">
        <CardHeader title="Do líquido ao lucro operacional" />
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
                    color: ultimo ? (a.lucroOperacional >= 0 ? "var(--good-text)" : "var(--critical)") : total ? "var(--ink)" : "var(--ink-2)",
                  }}
                >
                  {brl(l.valor)}
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>

      {a.porCategoriaDespesa.length > 0 && (
        <Card className="mt-6 overflow-hidden break-inside-avoid">
          <CardHeader title="Despesas operacionais por categoria" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {a.porCategoriaDespesa.map((d) => (
                  <tr key={d.categoria}>
                    <td className="px-5 py-3 text-ink-2">{d.label}</td>
                    <td className="px-5 py-3 text-right font-medium text-ink tabular">{brl(d.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-[12px] text-ink-muted">
        Imposto pela alíquota de {pct(a.aliquota * 100)} configurada em Configurações. Despesas vêm do Financeiro; ADS
        vem do investimento sincronizado das lojas.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Faturamento (relatório original, intacto)                                   */
/* -------------------------------------------------------------------------- */

async function RelatorioFaturamento({ clientId, dias }: { clientId: string; dias: number }) {
  const r = await gerarRelatorio(clientId, dias);

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

  if (r.pedidos === 0) {
    return (
      <Card>
        <Empty title="Nenhuma venda no período" hint="O relatório é montado a partir dos pedidos sincronizados das suas lojas." />
      </Card>
    );
  }

  return (
    <>
      {avisos.length > 0 && (
        <div className="mb-6 rounded-xl border px-4 py-3" style={{ borderColor: "var(--warning)", backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)" }}>
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
        <Stat label="Líquido do marketplace" value={brl(r.liquido)} hint={r.faturamento ? `${pct((r.liquido / r.faturamento) * 100)} do bruto` : undefined} icon={<Wallet size={18} />} tone="series-2" />
        <Stat label="Lucro" value={brl(r.lucro)} icon={<TrendingUp size={18} />} tone={r.lucro >= 0 ? "good" : "series-3"} />
        <Stat label="Margem" value={pct(r.margem)} hint={faixaGeral.rotulo} icon={<Percent size={18} />} tone="brand" />
      </div>

      <Card className="mt-6 break-inside-avoid">
        <CardHeader title="De cada real vendido, o que sobra" subtitle={`Ticket médio de ${brl(r.ticket)}.`} />
        <dl>
          {cascata.map((l, i) => {
            const total = l.sinal === "=";
            const ultimo = i === cascata.length - 1;
            return (
              <div key={l.rotulo} className={`flex items-baseline justify-between gap-4 px-5 ${total ? "border-y border-line bg-surface-2 py-3.5" : "py-2.5"}`}>
                <dt className={total ? "text-sm font-semibold text-ink" : "pl-4 text-[13px] text-ink-2"}>
                  {!total && <span className="mr-1.5 text-ink-muted">{l.sinal}</span>}
                  {l.rotulo}
                  {l.nota && <span className="ml-2 text-[12px] text-ink-muted">{l.nota}</span>}
                </dt>
                <dd
                  className={`shrink-0 tabular ${total ? "text-base font-bold" : "text-sm"}`}
                  style={{ color: ultimo ? (r.lucro >= 0 ? "var(--good-text)" : "var(--critical)") : total ? "var(--ink)" : "var(--ink-2)" }}
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
                    <td className="px-5 py-4 text-right font-semibold tabular" style={{ color: p.lucro >= 0 ? "var(--ink)" : "var(--critical)" }}>{brl(p.lucro)}</td>
                    <td className="px-5 py-4 text-right tabular" style={{ color: faixaMargem(p.margem).cor }}>{pct(p.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-[12px] text-ink-muted">
        O imposto é uma estimativa pela alíquota de {pct(r.aliquota * 100)} configurada em Configurações, não um
        cálculo fiscal. O custo dos produtos usa o valor atual cadastrado no Estoque.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Produtos                                                                     */
/* -------------------------------------------------------------------------- */

async function RelatorioProdutos({ clientId, dias }: { clientId: string; dias: number }) {
  const r = await gerarRelatorio(clientId, dias);

  if (r.porProduto.length === 0) {
    return (
      <Card>
        <Empty title="Nenhuma venda no período" hint="O relatório por produto é montado a partir dos itens vendidos." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden break-inside-avoid">
      <CardHeader title="Por produto" subtitle="Do que mais dá lucro para o que mais tira." />
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
                    {p.semCusto && <span style={{ color: "var(--warning)" }}> · sem custo, lucro superestimado</span>}
                  </p>
                </td>
                <td className="px-5 py-4 text-right text-ink-2 tabular">{num(p.unidades)}</td>
                <td className="px-5 py-4 text-right text-ink-2 tabular">{brl(p.faturamento)}</td>
                <td className="px-5 py-4 text-right font-semibold tabular" style={{ color: p.lucro >= 0 ? "var(--ink)" : "var(--critical)" }}>{brl(p.lucro)}</td>
                <td className="px-5 py-4 text-right tabular" style={{ color: faixaMargem(p.margem).cor }}>{pct(p.margem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Estoque                                                                      */
/* -------------------------------------------------------------------------- */

async function RelatorioEstoque({ clientId }: { clientId: string }) {
  const config = await configuracoes(clientId);
  const limite = config.lowStockThreshold || LOW_STOCK;

  const produtos = await prisma.product.findMany({
    where: { account: { clientId } },
    include: { account: { select: { shopName: true, platform: true } } },
    orderBy: [{ stock: "asc" }, { title: "asc" }],
  });

  const esgotados = produtos.filter((p) => p.stock === 0);
  const baixos = produtos.filter((p) => p.stock > 0 && p.stock <= limite);
  const valorTotal = produtos.reduce((s, p) => s + p.price * p.stock, 0);
  const criticos = [...esgotados, ...baixos];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Produtos" value={num(produtos.length)} icon={<Boxes size={18} />} tone="brand" />
        <Stat label="Esgotados" value={num(esgotados.length)} tone="critical" />
        <Stat label={`Estoque ≤ ${limite}`} value={num(baixos.length)} tone="series-2" icon={<AlertTriangle size={18} />} />
        <Stat label="Valor em estoque" value={brl(valorTotal)} tone="series-1" />
      </div>

      <Card className="mt-6 overflow-hidden break-inside-avoid">
        <CardHeader title="Produtos que pedem atenção" subtitle="Esgotados e abaixo do limite configurado — o catálogo completo fica em Estoque." />
        {criticos.length === 0 ? (
          <p className="px-5 py-5 text-[13px] text-ink-muted">Nenhum produto esgotado ou com estoque baixo. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  <th className="px-5 py-3.5">Produto</th>
                  <th className="px-5 py-3.5">Canal</th>
                  <th className="px-5 py-3.5 text-right">Estoque</th>
                  <th className="px-5 py-3.5 text-right">Valor parado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {criticos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-4">
                      <p className="line-clamp-1 font-medium text-ink">{p.title}</p>
                      <p className="text-[12px] text-ink-muted">{p.sku ? `SKU ${p.sku}` : "sem SKU"}</p>
                    </td>
                    <td className="px-5 py-4"><PlatformBadge platform={p.account.platform} short /></td>
                    <td className="px-5 py-4 text-right tabular" style={{ color: p.stock === 0 ? "var(--critical)" : "var(--warning)" }}>{num(p.stock)}</td>
                    <td className="px-5 py-4 text-right text-ink-2 tabular">{brl(p.price * p.stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Financeiro                                                                   */
/* -------------------------------------------------------------------------- */

async function RelatorioFinanceiro({ clientId, dias }: { clientId: string; dias: number }) {
  const desde = new Date(Date.now() - dias * 86400000);
  const [resumo, receber, pagar] = await Promise.all([
    resumoFinanceiro(clientId),
    lancamentos(clientId, { kind: "RECEBER" }),
    lancamentos(clientId, { kind: "PAGAR" }),
  ]);

  const noPeriodo = (rows: typeof receber) => rows.filter((r) => r.dueDate >= desde);
  const linhas = [...noPeriodo(receber), ...noPeriodo(pagar)].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Saldo do mês" value={brl(resumo.saldoMes)} tone={resumo.saldoMes >= 0 ? "good" : "critical"} />
        <Stat label="A receber" value={brl(resumo.aReceber)} tone="series-1" />
        <Stat label="A pagar" value={brl(resumo.aPagar)} tone="series-2" />
        <Stat label="Vencido" value={brl(resumo.vencido)} tone="critical" icon={<AlertTriangle size={18} />} />
      </div>

      <Card className="mt-6 overflow-hidden break-inside-avoid">
        <CardHeader title="Lançamentos do período" />
        {linhas.length === 0 ? (
          <p className="px-5 py-5 text-[13px] text-ink-muted">Nenhum lançamento com vencimento no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  <th className="px-5 py-3.5">Descrição</th>
                  <th className="px-5 py-3.5">Tipo</th>
                  <th className="px-5 py-3.5">Vencimento</th>
                  <th className="px-5 py-3.5 text-right">Valor</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {linhas.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-4 font-medium text-ink">{r.description}</td>
                    <td className="px-5 py-4 text-ink-2">{r.kind === "RECEBER" ? "A receber" : "A pagar"}</td>
                    <td className="px-5 py-4 text-ink-2 tabular">{date(r.dueDate)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-ink tabular">{brl(r.amount)}</td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ color: STATUS_COR[r.status], backgroundColor: `color-mix(in srgb, ${STATUS_COR[r.status]} 16%, transparent)` }}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
