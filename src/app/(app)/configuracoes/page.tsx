import { Bell, Building2, Palette, Receipt } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { comAviso, requireClient } from "@/lib/auth";
import { configuracoes, salvarConfiguracoes } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function salvarEmpresaFiscal(formData: FormData) {
  "use server";
  const user = await requireClient();

  const r = await salvarConfiguracoes(user.clientId, {
    companyName: String(formData.get("companyName") ?? "").trim(),
    document: String(formData.get("document") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    taxRate: Number(String(formData.get("taxRate") ?? "0").replace(",", ".")) / 100,
    defaultExtraCost: Number(String(formData.get("defaultExtraCost") ?? "0").replace(",", ".")),
    lowStockThreshold: Number(formData.get("lowStockThreshold") ?? 5),
  });

  revalidatePath("/configuracoes");
  redirect(
    r.ok
      ? comAviso("/configuracoes", "ok", "Configurações salvas. Alíquota e custo padrão já valem nas próximas contas.")
      : comAviso("/configuracoes", "erro", r.message ?? "Não foi possível salvar."),
  );
}

async function salvarNotificacoes(formData: FormData) {
  "use server";
  const user = await requireClient();
  await salvarConfiguracoes(user.clientId, {
    notifyLowStock: formData.get("notifyLowStock") === "on",
    notifyFinance: formData.get("notifyFinance") === "on",
  });
  revalidatePath("/configuracoes");
  redirect(comAviso("/configuracoes", "ok", "Preferências de notificação salvas."));
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await requireClient();
  const sp = await searchParams;
  const config = await configuracoes(user.clientId);

  return (
    <>
      <Topbar crumb="Configurações" />
      <main className="flex-1 px-6 py-8">
        <PageHeader title="Configurações" subtitle="Dados da empresa, fiscal, aparência e notificações." />

        {sp.ok && (
          <p role="status" className="mb-5 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: "var(--good)", backgroundColor: "color-mix(in srgb, var(--good) 10%, transparent)", color: "var(--good-text)" }}>
            {sp.ok}
          </p>
        )}
        {sp.erro && (
          <p role="alert" className="mb-5 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: "var(--critical)", backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)", color: "var(--critical)" }}>
            {sp.erro}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader title="Empresa e fiscal" subtitle="Sai no cabeçalho dos relatórios em PDF e vale para o cálculo de imposto e margem." action={<Building2 size={18} className="text-ink-muted" />} />
            <form action={salvarEmpresaFiscal} className="space-y-4 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Razão social</label>
                  <input name="companyName" defaultValue={config.companyName} className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">CNPJ/CPF</label>
                  <input name="document" defaultValue={config.document} className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Telefone</label>
                  <input name="phone" defaultValue={config.phone} className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Endereço</label>
                  <input name="address" defaultValue={config.address} className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Alíquota estimada (%)</label>
                  <input name="taxRate" inputMode="decimal" defaultValue={(config.taxRate * 100).toFixed(1).replace(".", ",")} className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Custo extra padrão</label>
                  <input name="defaultExtraCost" inputMode="decimal" defaultValue={config.defaultExtraCost.toFixed(2).replace(".", ",")} className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Estoque baixo a partir de</label>
                  <input name="lowStockThreshold" type="number" min="0" defaultValue={config.lowStockThreshold} className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink tabular" />
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                <Receipt size={13} aria-hidden /> Essa alíquota alimenta Faturamento, Vendas e Relatórios — mudar aqui recalcula na hora.
              </p>
              <button type="submit" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover">
                Salvar
              </button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Aparência" action={<Palette size={18} className="text-ink-muted" />} />
            <div className="flex items-center justify-between px-5 py-5">
              <div>
                <p className="text-sm font-medium text-ink">Tema</p>
                <p className="text-[13px] text-ink-muted">Claro ou escuro — vale pra você, fica salvo neste navegador.</p>
              </div>
              <ThemeToggle />
            </div>
          </Card>

          <Card>
            <CardHeader title="Notificações" action={<Bell size={18} className="text-ink-muted" />} />
            <form action={salvarNotificacoes} className="space-y-4 px-5 py-5">
              <label className="flex items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium text-ink">Alertar estoque baixo</span>
                  <span className="block text-[13px] text-ink-muted">Sino do topo avisa quando um produto cruza o limite acima.</span>
                </span>
                <input type="checkbox" name="notifyLowStock" defaultChecked={config.notifyLowStock} className="size-5 accent-[var(--brand)]" />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium text-ink">Alertar financeiro vencido</span>
                  <span className="block text-[13px] text-ink-muted">Sino do topo avisa quando um título passa da data.</span>
                </span>
                <input type="checkbox" name="notifyFinance" defaultChecked={config.notifyFinance} className="size-5 accent-[var(--brand)]" />
              </label>
              <button type="submit" className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:text-ink">
                Salvar preferências
              </button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Fiscal avançado e integrações" subtitle="Interface de demonstração — ainda não persiste nem afeta o sistema." />
            <div className="space-y-3 px-5 py-5 opacity-70">
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink">Emissão de NF-e automática</span>
                <input type="checkbox" disabled className="size-5" />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink">Integração com contador (exportar SPED)</span>
                <input type="checkbox" disabled className="size-5" />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink">Regime tributário: Simples Nacional</span>
                <input type="checkbox" disabled defaultChecked className="size-5" />
              </label>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
