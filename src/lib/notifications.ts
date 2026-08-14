import { prisma } from "./db";
import { LOW_STOCK } from "./inventory";

export type Notification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "CRITICO" | "ATENCAO" | "INFO";
};

const RANK = { CRITICO: 0, ATENCAO: 1, INFO: 2 } as const;

/**
 * Alimenta o sino. Tudo é escopado pelo `clientId` de quem está olhando — o
 * aviso sempre leva a uma tela que a pessoa pode abrir.
 */
export async function notificationsFor(clientId: string): Promise<Notification[]> {
  const items: Notification[] = [];

  // As duas contagens são independentes: em paralelo viram uma ida ao banco.
  const [semEstoque, baixo, lojasComProblema] = await Promise.all([
    prisma.product.count({ where: { account: { clientId }, stock: 0 } }),
    prisma.product.count({ where: { account: { clientId }, stock: { gt: 0, lte: LOW_STOCK } } }),
    prisma.account.findMany({
      where: { clientId, status: { in: ["EXPIRED", "ERROR"] } },
      select: { id: true, shopName: true, statusNote: true },
      take: 20,
    }),
  ]);

  for (const loja of lojasComProblema) {
    items.push({
      id: `conta-${loja.id}`,
      title: `${loja.shopName} precisa reconectar`,
      detail: loja.statusNote ?? "A autorização com o marketplace caiu.",
      href: "/integracoes",
      severity: "CRITICO",
    });
  }

  if (semEstoque > 0) {
    items.push({
      id: "estoque-zerado",
      title: `${semEstoque} produto(s) esgotado(s)`,
      detail: "Sem estoque para vender.",
      href: "/estoque?filtro=zerado",
      severity: "CRITICO",
    });
  }
  if (baixo > 0) {
    items.push({
      id: "estoque-baixo",
      title: `${baixo} produto(s) com estoque baixo`,
      detail: `Restam ${LOW_STOCK} unidades ou menos.`,
      href: "/estoque?filtro=baixo",
      severity: "ATENCAO",
    });
  }

  return items.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
