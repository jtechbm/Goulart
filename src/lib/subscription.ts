import { prisma } from "./db";
import { DIAS_DE_TESTE, lerEstado, type EstadoAssinatura } from "./plans";

/** Acesso ao banco para assinatura. Separado de `plans.ts`, que é puro. */

/**
 * Estado da assinatura do cliente, criando o registro de teste na primeira vez.
 *
 * A criação preguiçosa existe para quem já usava o sistema antes de haver
 * cobrança: sem ela, esses clientes cairiam em "sem assinatura" e perderiam o
 * acesso de uma hora para a outra por causa de um deploy.
 */
export async function estadoAssinatura(clientId: string): Promise<EstadoAssinatura> {
  const existente = await prisma.subscription.findUnique({ where: { clientId } });
  if (existente) return lerEstado(existente);

  const trialEndsAt = new Date(Date.now() + DIAS_DE_TESTE * 86_400_000);
  const criada = await prisma.subscription.upsert({
    where: { clientId },
    // Corrida entre duas abas: se a outra criou primeiro, fica com a dela.
    update: {},
    create: { clientId, plan: "BASICO", status: "trialing", trialEndsAt },
  });
  return lerEstado(criada);
}
