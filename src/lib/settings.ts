import { cache } from "react";
import { prisma } from "./db";
import { LOW_STOCK } from "./inventory";
import { TAX_RATE } from "./queries";

/**
 * Configurações da loja. `TAX_RATE`/`LOW_STOCK` continuam existindo como
 * fallback — nunca criamos a linha de `Settings` implicitamente, então uma
 * loja recém-cadastrada lê os mesmos padrões de sempre até salvar algo em
 * /configuracoes.
 */
export type Configuracoes = {
  companyName: string;
  document: string;
  phone: string;
  address: string;
  taxRate: number;
  defaultExtraCost: number;
  lowStockThreshold: number;
  notifyLowStock: boolean;
  notifyFinance: boolean;
};

const DEFAULTS: Configuracoes = {
  companyName: "",
  document: "",
  phone: "",
  address: "",
  taxRate: TAX_RATE,
  defaultExtraCost: 0,
  lowStockThreshold: LOW_STOCK,
  notifyLowStock: true,
  notifyFinance: true,
};

export const configuracoes = cache(async function configuracoes(clientId: string): Promise<Configuracoes> {
  const row = await prisma.settings.findUnique({ where: { clientId } });
  if (!row) return { ...DEFAULTS };
  return {
    companyName: row.companyName ?? "",
    document: row.document ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    taxRate: row.taxRate,
    defaultExtraCost: row.defaultExtraCost,
    lowStockThreshold: row.lowStockThreshold,
    notifyLowStock: row.notifyLowStock,
    notifyFinance: row.notifyFinance,
  };
});

export async function salvarConfiguracoes(
  clientId: string,
  input: Partial<Configuracoes>,
): Promise<{ ok: boolean; message?: string }> {
  if (input.taxRate !== undefined && (!Number.isFinite(input.taxRate) || input.taxRate < 0 || input.taxRate > 1)) {
    return { ok: false, message: "Alíquota inválida — informe um valor entre 0 e 100%." };
  }
  if (input.defaultExtraCost !== undefined && (!Number.isFinite(input.defaultExtraCost) || input.defaultExtraCost < 0)) {
    return { ok: false, message: "Custo extra padrão inválido." };
  }
  if (
    input.lowStockThreshold !== undefined &&
    (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0)
  ) {
    return { ok: false, message: "Limite de estoque baixo inválido." };
  }

  await prisma.settings.upsert({
    where: { clientId },
    create: { clientId, ...DEFAULTS, ...input },
    update: { ...input },
  });

  return { ok: true };
}
