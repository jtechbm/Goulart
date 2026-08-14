import { CircleAlert, CircleCheck, Clock, Plug, RefreshCw, ShieldCheck, Store, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, PageHeader, PlatformBadge } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { relative } from "@/lib/format";
import { adapters, PLATFORM_LABEL, PLATFORM_SLUG, PLATFORMS, type Platform } from "@/lib/integrations";

const TEM_ADAPTER = new Set<string>(PLATFORMS);

export const dynamic = "force-dynamic";

/** Passo a passo por marketplace, na linguagem do lojista. */
const GUIDE: Record<Platform, { intro: string; steps: string[]; note?: string }> = {
  MERCADO_LIVRE: {
    intro: "Você será levado ao site do Mercado Livre para autorizar o acesso.",
    steps: [
      "Clique em “Conectar Mercado Livre” abaixo.",
      "Entre com a conta de vendedor da sua loja (não a conta pessoal de compras).",
      "Revise as permissões e clique em “Permitir”.",
      "Você volta para cá automaticamente com a loja conectada.",
    ],
    note: "Se você tem mais de uma conta no Mercado Livre, confira no canto da tela qual está logada antes de autorizar.",
  },
  SHOPEE: {
    intro: "A autorização é feita no Seller Centre da Shopee.",
    steps: [
      "Clique em “Conectar Shopee” abaixo.",
      "Faça login no Seller Centre com o e-mail/telefone da loja.",
      "Selecione a loja que deseja conectar e confirme a autorização.",
      "Você é redirecionado de volta com a loja conectada.",
    ],
    note: "A Shopee pede uma nova autorização a cada 30 dias sem uso. Se aparecer “expirado”, é só reconectar aqui.",
  },
  TIKTOK_SHOP: {
    intro: "A autorização passa pelo Seller Center do TikTok Shop.",
    steps: [
      "Clique em “Conectar TikTok Shop” abaixo.",
      "Entre com a conta do TikTok Shop (Seller Center), não com o perfil pessoal do app.",
      "Escolha a loja e toque em “Autorizar”.",
      "Você volta para cá com a loja conectada.",
    ],
    note: "Se sua loja tem mais de um perfil, autorize com o perfil que tem permissão de administrador.",
  },
};

const STATUS = {
  CONNECTED: { label: "Conectada", color: "var(--good)", Icon: CircleCheck },
  PENDING: { label: "Pendente", color: "var(--warning)", Icon: TriangleAlert },
  EXPIRED: { label: "Expirada", color: "var(--warning)", Icon: TriangleAlert },
  ERROR: { label: "Com erro", color: "var(--critical)", Icon: CircleAlert },
} as const;

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await requireClient();
  const sp = await searchParams;

  const accounts = await prisma.account.findMany({
    where: { clientId: user.clientId },
    orderBy: [{ platform: "asc" }, { shopName: "asc" }],
  });

  /**
   * Só entram as plataformas cujas credenciais existem. Um card que só sabe
   * dizer "indisponível" ocupa espaço e convida o lojista a tentar algo que
   * não vai funcionar. Quando as chaves da Shopee/TikTok forem configuradas,
   * os cards voltam sozinhos — não é preciso mexer aqui de novo.
   */
  const disponiveis = PLATFORMS.filter((p) => adapters[p].isConfigured());

  return (
    <>
      <Topbar crumb="Integrações" />
      <main className="flex-1 px-6 py-8">
        <PageHeader
          title="Integrações"
          subtitle="Conecte suas lojas você mesmo — leva menos de um minuto por marketplace."
        />

        {sp.ok && (
          <p
            role="status"
            className="mb-5 rounded-xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: "var(--good)",
              backgroundColor: "color-mix(in srgb, var(--good) 10%, transparent)",
              color: "var(--good-text)",
            }}
          >
            {sp.ok}
          </p>
        )}
        {sp.erro && (
          <p
            role="alert"
            className="mb-5 rounded-xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: "var(--critical)",
              backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)",
              color: "var(--critical)",
            }}
          >
            {sp.erro}
          </p>
        )}

        <Card className="mb-6 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <p className="text-sm font-semibold text-ink">Você não precisa passar sua senha para ninguém</p>
              <p className="mt-1 text-[13px] text-ink-2">
                A conexão usa o login oficial do próprio marketplace. Sua senha é digitada no site deles, nunca aqui — e
                a autorização pode ser revogada por você a qualquer momento no painel do marketplace.
              </p>
            </div>
          </div>
        </Card>

        {accounts.length > 0 && (
          <Card className="mb-6">
            <CardHeader title="Suas lojas conectadas" subtitle={`${accounts.length} conectada(s).`} />
            <ul className="divide-y divide-[var(--border)]">
              {accounts.map((a) => {
                const s = STATUS[a.status as keyof typeof STATUS] ?? STATUS.PENDING;
                const temAdapter = TEM_ADAPTER.has(a.platform);
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <PlatformBadge platform={a.platform} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{a.shopName}</p>
                      <p className="text-[13px] text-ink-muted">atualizada {relative(a.lastSyncAt)}</p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ color: s.color, backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)` }}
                    >
                      <s.Icon size={13} aria-hidden />
                      {s.label}
                    </span>
                    {temAdapter ? (
                      <a
                        href={`/api/oauth/${PLATFORM_SLUG[a.platform as Platform]}/start`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                      >
                        <RefreshCw size={13} /> Reconectar
                      </a>
                    ) : (
                      <span className="text-[12px] text-ink-muted">
                        {a.platform === "ATACADO" ? "canal interno, sem OAuth" : "integração automática em breve"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {disponiveis.length === 0 ? (
          <Card>
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-ink">Nenhum marketplace disponível no momento</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
                Assim que a integração com um marketplace estiver liberada, ela aparece aqui
                automaticamente.
              </p>
            </div>
          </Card>
        ) : (
        <div className={`grid gap-6 ${disponiveis.length > 1 ? "lg:grid-cols-3" : "max-w-xl"}`}>
          {disponiveis.map((platform) => {
            const guide = GUIDE[platform];
            const slug = PLATFORM_SLUG[platform];
            const conectada = accounts.some((a) => a.platform === platform && a.status === "CONNECTED");

            return (
              <Card key={platform} className="flex flex-col p-5">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={platform} />
                  {conectada && (
                    <span className="text-[12px] font-medium" style={{ color: "var(--good-text)" }}>
                      já conectada
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[13px] text-ink-2">{guide.intro}</p>

                <ol className="mt-4 flex-1 space-y-2.5">
                  {guide.steps.map((step, i) => (
                    <li key={step} className="flex gap-2.5 text-[13px] text-ink-2">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-bold text-ink-2 tabular">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>

                {guide.note && (
                  <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-muted">{guide.note}</p>
                )}

                <a
                  href={`/api/oauth/${slug}/start`}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
                >
                  <Plug size={15} /> Conectar {PLATFORM_LABEL[platform]}
                </a>
              </Card>
            );
          })}
        </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="flex flex-col p-5">
            <div className="flex items-center gap-2">
              <PlatformBadge platform="SHEIN" />
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-muted">
                <Clock size={12} /> em breve
              </span>
            </div>
            <p className="mt-3 flex-1 text-[13px] text-ink-2">
              A integração automática com a SHEIN ainda não está disponível — quando abrir, a autorização funciona
              igual à dos outros marketplaces. Os números que você vê hoje em Faturamento e Relatórios são de
              demonstração.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted opacity-60"
            >
              <Plug size={15} /> Em breve
            </button>
          </Card>

          <Card className="flex flex-col p-5">
            <div className="flex items-center gap-2">
              <PlatformBadge platform="ATACADO" />
              <span className="text-[12px] font-medium text-ink-muted">canal interno</span>
            </div>
            <p className="mt-3 flex-1 text-[13px] text-ink-2">
              O Atacado não é um marketplace — é o canal de vendas por fora, direto para seus clientes. Não precisa de
              OAuth: você cadastra o cliente e o pedido, e o estoque sai do mesmo lugar de sempre.
            </p>
            <Link
              href="/atacado"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
            >
              <Store size={15} /> Ir para o Atacado
            </Link>
          </Card>
        </div>
      </main>
    </>
  );
}
