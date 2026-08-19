import { ArrowLeft, Check, LogOut } from "lucide-react";
import Link from "next/link";
import { Marca } from "@/components/Logo";
import { logout } from "@/lib/actions";
import { requireClient } from "@/lib/auth";
import { brl } from "@/lib/format";
import { PLANOS, RECURSOS, type Plano, type Recurso } from "@/lib/plans";
import { estadoAssinatura } from "@/lib/subscription";

export const dynamic = "force-dynamic";

/**
 * Assinatura. Fica FORA do grupo `(app)` de propósito: é para cá que o layout
 * do grupo manda quem está bloqueado, e se ela morasse lá dentro o próprio
 * bloqueio a bloquearia, num laço de redirecionamento.
 *
 * Por isso também não usa a Sidebar — quem chega aqui pode não ter direito a
 * nenhuma tela do menu.
 */
export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ recurso?: string }>;
}) {
  const user = await requireClient();
  const estado = await estadoAssinatura(user.clientId);
  const { recurso } = await searchParams;

  const pedido = recurso && recurso in RECURSOS ? RECURSOS[recurso as Recurso] : null;

  return (
    <main className="mx-auto w-full max-w-[880px] px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Marca />
        <div className="flex items-center gap-2">
          {estado.liberada && (
            <Link
              href="/"
              className="flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm text-ink-2 transition-colors hover:text-ink"
            >
              <ArrowLeft size={15} />
              Voltar
            </Link>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm text-ink-2 transition-colors hover:text-ink"
            >
              <LogOut size={15} />
              Sair
            </button>
          </form>
        </div>
      </header>

      <Aviso estado={estado} pedido={pedido} />

      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(PLANOS) as Plano[]).map((id) => (
          <CartaoPlano key={id} id={id} atual={estado.planoContratado} emTeste={estado.emTeste} />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-ink-muted">
        Você pode trocar de plano ou cancelar quando quiser. Ao cancelar, o acesso
        continua até o fim do período já pago.
      </p>
    </main>
  );
}

/** Faixa do topo: diz onde a pessoa está e por que chegou aqui. */
function Aviso({
  estado,
  pedido,
}: {
  estado: Awaited<ReturnType<typeof estadoAssinatura>>;
  pedido: { nome: string; href: string } | null;
}) {
  // O caso mais comum: clicou num item Pro estando no Básico.
  if (pedido) {
    return (
      <Faixa titulo={`${pedido.nome} faz parte do plano Pro`} tom="brand">
        Seu plano atual é o {PLANOS[estado.planoContratado].nome}. Mude para o Pro
        para liberar esta tela.
      </Faixa>
    );
  }

  if (estado.emTeste) {
    return (
      <Faixa
        titulo={
          estado.diasDeTeste === 1
            ? "Último dia do seu teste grátis"
            : `Faltam ${estado.diasDeTeste} dias do seu teste grátis`
        }
        tom="brand"
      >
        Durante o teste você usa o Pro inteiro, sem cartão. Escolha um plano antes
        do fim para não perder o acesso.
      </Faixa>
    );
  }

  if (!estado.liberada) {
    return (
      <Faixa titulo="Seu acesso está bloqueado" tom="critical">
        {estado.status === "past_due"
          ? "A última cobrança não foi aprovada. Atualize a forma de pagamento para voltar."
          : "Escolha um plano para voltar a usar o sistema. Seus dados continuam aqui, intactos."}
      </Faixa>
    );
  }

  if (estado.cancelAtPeriodEnd && estado.currentPeriodEnd) {
    return (
      <Faixa titulo="Assinatura cancelada" tom="warning">
        Você continua com acesso até{" "}
        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(estado.currentPeriodEnd)}.
      </Faixa>
    );
  }

  return (
    <Faixa titulo={`Você está no plano ${PLANOS[estado.planoContratado].nome}`} tom="good">
      Assinatura ativa.
    </Faixa>
  );
}

function Faixa({
  titulo,
  tom,
  children,
}: {
  titulo: string;
  tom: "brand" | "good" | "warning" | "critical";
  children: React.ReactNode;
}) {
  const cor = tom === "brand" ? "var(--brand)" : `var(--${tom})`;
  return (
    <div
      className="mb-6 rounded-2xl border px-5 py-4"
      style={{ borderColor: cor, backgroundColor: `color-mix(in srgb, ${cor} 10%, transparent)` }}
    >
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      <p className="mt-1 text-[13px] text-ink-2">{children}</p>
    </div>
  );
}

function CartaoPlano({ id, atual, emTeste }: { id: Plano; atual: Plano; emTeste: boolean }) {
  const plano = PLANOS[id];
  const ehAtual = id === atual && !emTeste;
  const destaque = id === "PRO";

  // Pro entrega tudo do Básico mais os recursos próprios.
  const itens =
    id === "PRO"
      ? ["Tudo do Básico", ...plano.recursos.map((r) => RECURSOS[r].nome)]
      : ["Vendas com lucro por item", "Faturamento", "Estoque", "Lojas e integrações"];

  return (
    <div
      className="flex flex-col rounded-2xl border bg-surface p-6"
      style={{ borderColor: destaque ? "var(--brand)" : "var(--border)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">{plano.nome}</h2>
        {ehAtual && (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
            Atual
          </span>
        )}
      </div>

      <p className="mt-1 text-sm text-ink-2">{plano.resumo}</p>

      <p className="mt-4">
        <span className="text-3xl font-bold text-ink">{brl(plano.preco)}</span>
        <span className="text-sm text-ink-muted"> /mês</span>
      </p>

      <ul className="mt-5 flex-1 space-y-2">
        {itens.map((i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
            <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            {i}
          </li>
        ))}
      </ul>

      <AssinarBotao plano={id} ehAtual={ehAtual} destaque={destaque} />
    </div>
  );
}

/**
 * O botão ainda não abre checkout: as chaves do Stripe não estão configuradas.
 * Ele fica desabilitado e diz isso, em vez de levar a um erro — botão que
 * parece funcionar e não funciona é pior que botão claramente indisponível.
 */
function AssinarBotao({
  plano,
  ehAtual,
  destaque,
}: {
  plano: Plano;
  ehAtual: boolean;
  destaque: boolean;
}) {
  const configurado = Boolean(process.env.STRIPE_SECRET_KEY);

  if (ehAtual) {
    return (
      <p className="mt-6 rounded-xl border border-line px-4 py-2.5 text-center text-sm text-ink-muted">
        Seu plano atual
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={!configurado}
      className={`mt-6 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        destaque ? "bg-brand text-brand-ink hover:bg-brand-hover" : "border border-line text-ink hover:bg-surface-2"
      }`}
      title={configurado ? undefined : "Pagamento ainda não configurado"}
    >
      {configurado ? `Assinar ${PLANOS[plano].nome}` : "Pagamento em configuração"}
    </button>
  );
}
