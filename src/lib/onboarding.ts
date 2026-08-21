import { MARKETPLACES } from "./canais";
import { prisma } from "./db";

/**
 * Primeiros passos do lojista.
 *
 * Sem isto, quem termina o cadastro cai num painel com tudo zerado e nenhuma
 * pista do que fazer — o painel parece quebrado quando na verdade só está
 * vazio. Os três passos são exatamente a corrente que faz o sistema dizer a
 * verdade: sem loja não há pedido, sem pedido não há faturamento, e sem custo
 * o lucro sai inflado.
 *
 * Cada passo é derivado do estado real do banco, e não de um campo "já viu o
 * tutorial": se o lojista desconectar a última loja, o passo volta a aparecer.
 */

export type Passo = {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  rotuloAcao: string;
  feito: boolean;
};

export type Progresso = {
  passos: Passo[];
  feitos: number;
  total: number;
  concluido: boolean;
  /** Primeiro passo pendente — é para onde o botão principal aponta. */
  proximo: Passo | null;
};

export async function progressoDoLojista(clientId: string): Promise<Progresso> {
  const [lojas, pedidos, comCusto, produtos] = await Promise.all([
    /**
     * Só marketplace de verdade conta como "loja conectada". O canal ATACADO é
     * interno e nasce sozinho na primeira visita a /atacado — contá-lo marcava
     * o passo 1 como feito para quem nunca autorizou nada.
     */
    prisma.account.count({ where: { clientId, platform: { in: [...MARKETPLACES] } } }),
    prisma.order.count({ where: { account: { clientId } } }),
    prisma.product.count({ where: { account: { clientId }, cost: { gt: 0 } } }),
    prisma.product.count({ where: { account: { clientId } } }),
  ]);

  const passos: Passo[] = [
    {
      id: "loja",
      titulo: "Conecte sua primeira loja",
      descricao:
        "Autorize o Mercado Livre e o sistema passa a puxar seus pedidos sozinho, de hora em hora.",
      href: "/integracoes",
      rotuloAcao: "Conectar loja",
      feito: lojas > 0,
    },
    {
      id: "sync",
      titulo: "Traga seus pedidos",
      descricao:
        "A primeira sincronização importa os últimos 30 dias. Depois disso ela roda sozinha.",
      href: "/lojas",
      rotuloAcao: "Sincronizar agora",
      feito: pedidos > 0,
    },
    {
      id: "custo",
      titulo: "Informe o custo dos produtos",
      descricao:
        // Este é o passo que os lojistas pulam — e é o que decide se o número
        // de lucro é verdade ou ficção.
        "Sem o custo, o sistema não tem como calcular lucro: ele mostraria a venda inteira como ganho.",
      href: "/estoque",
      rotuloAcao: "Preencher custos",
      feito: comCusto > 0,
    },
  ];

  const feitos = passos.filter((p) => p.feito).length;

  return {
    passos,
    feitos,
    total: passos.length,
    // Um catálogo ainda vazio não pode travar o lojista no passo 3 para sempre:
    // sem produto nenhum não há custo a preencher.
    concluido: feitos === passos.length || (lojas > 0 && pedidos > 0 && produtos === 0),
    proximo: passos.find((p) => !p.feito) ?? null,
  };
}
