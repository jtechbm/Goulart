/**
 * Planos e o que cada um libera.
 *
 * Este arquivo é PURO de propósito: nada de Prisma nem de `next/*`. A Sidebar
 * é client component e importa `planoInclui` daqui — um import de banco aqui
 * arrastaria o Prisma inteiro para o bundle do navegador. Quem fala com o
 * banco é `subscription.ts`.
 *
 * O corte é por tela, não por volume: Básico entrega a operação do dia a dia
 * (vendas, estoque, faturamento, lojas) e Pro acrescenta as duas telas que dão
 * leitura de margem — Relatórios e Comparador de preços.
 *
 * Preço vive aqui só para a tela de assinatura. Quem cobra de verdade é o
 * Stripe: se os dois divergirem, vale o que está lá.
 */

export const PLANOS = {
  BASICO: {
    nome: "Básico",
    preco: 99,
    resumo: "A operação do dia a dia das suas lojas.",
    recursos: [] as Recurso[],
  },
  PRO: {
    nome: "Pro",
    preco: 249,
    resumo: "Tudo do Básico, mais a leitura de lucro e de mercado.",
    recursos: ["relatorios", "comparador"] as Recurso[],
  },
} as const;

export type Plano = keyof typeof PLANOS;

/** Telas que não são do Básico. O resto do sistema é comum aos dois planos. */
export type Recurso = "relatorios" | "comparador";

export const RECURSOS: Record<Recurso, { nome: string; href: string }> = {
  relatorios: { nome: "Relatórios de lucro", href: "/relatorios" },
  comparador: { nome: "Comparador de preços", href: "/comparador" },
};

/** Dias de teste grátis, sem cartão. */
export const DIAS_DE_TESTE = 14;

export function ehPlano(v: string): v is Plano {
  return v === "BASICO" || v === "PRO";
}

export function planoInclui(plano: Plano, recurso: Recurso): boolean {
  return (PLANOS[plano].recursos as readonly Recurso[]).includes(recurso);
}

/* -------------------------------------------------------------------------- */
/* Estado da assinatura                                                        */
/* -------------------------------------------------------------------------- */

export type EstadoAssinatura = {
  /** O que vale AGORA. Em teste, vale Pro — trial sem os recursos bons não vende. */
  plano: Plano;
  /** Plano contratado, que é para onde cai quando o teste acaba. */
  planoContratado: Plano;
  /** Pode abrir o sistema? Falso trava tudo menos a tela de assinatura. */
  liberada: boolean;
  emTeste: boolean;
  /** Dias inteiros que faltam do teste, para a faixa de aviso. */
  diasDeTeste: number | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
};

type Linha = {
  plan: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Traduz a linha do banco para o que a interface precisa saber.
 *
 * Regra que importa: uma recusa de cartão **não corta o acesso na hora**. O
 * lojista fica até o fim do período que já pagou (`currentPeriodEnd`), porque
 * cortar no dia da recusa tiraria dele o faturamento das próprias lojas por
 * causa de um cartão vencido — e o Stripe ainda vai tentar cobrar de novo.
 */
export function lerEstado(sub: Linha | null, agora = new Date()): EstadoAssinatura {
  if (!sub) {
    // Sem linha ainda: trata como bloqueado, e não como liberado. Errar para o
    // lado de bloquear é recuperável com um clique; o contrário é receita perdida.
    return {
      plano: "BASICO", planoContratado: "BASICO", liberada: false, emTeste: false,
      diasDeTeste: null, status: "sem_assinatura", cancelAtPeriodEnd: false, currentPeriodEnd: null,
    };
  }

  const t = agora.getTime();
  const contratado: Plano = ehPlano(sub.plan) ? sub.plan : "BASICO";
  const emTeste = sub.trialEndsAt != null && sub.trialEndsAt.getTime() > t;
  const dentroDoPeriodoPago = sub.currentPeriodEnd != null && sub.currentPeriodEnd.getTime() > t;

  return {
    // Durante o teste o lojista experimenta o Pro inteiro.
    plano: emTeste ? "PRO" : contratado,
    planoContratado: contratado,
    liberada: emTeste || sub.status === "active" || dentroDoPeriodoPago,
    emTeste,
    diasDeTeste: emTeste
      ? Math.max(0, Math.ceil((sub.trialEndsAt!.getTime() - t) / 86_400_000))
      : null,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodEnd: sub.currentPeriodEnd,
  };
}
