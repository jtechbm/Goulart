import { prisma } from "./db";

export const CUSTOMER_KINDS = ["CLIENTE", "FORNECEDOR"] as const;
export type CustomerKind = (typeof CUSTOMER_KINDS)[number];

export type CustomerRow = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  uf: string | null;
  active: boolean;
  pedidos: number;
  totalComprado: number;
  ultimoPedido: Date | null;
};

/**
 * Clientes e fornecedores, com pedidos/total/último pedido agregados dos
 * pedidos de atacado. Fornecedor não tem pedido vinculado — os três campos
 * ficam zerados de propósito, não é bug.
 */
export async function listarCustomers(clientId: string, kind: CustomerKind): Promise<CustomerRow[]> {
  const customers = await prisma.customer.findMany({
    where: { clientId, kind },
    orderBy: { name: "asc" },
  });

  const byCustomer = new Map<string, { pedidos: number; total: number; ultimo: Date | null }>();
  if (kind === "CLIENTE" && customers.length > 0) {
    const orders = await prisma.order.findMany({
      where: { customerId: { in: customers.map((c) => c.id) } },
      select: { customerId: true, gross: true, placedAt: true },
    });
    for (const o of orders) {
      if (!o.customerId) continue;
      const atual = byCustomer.get(o.customerId) ?? { pedidos: 0, total: 0, ultimo: null };
      atual.pedidos += 1;
      atual.total += o.gross;
      if (!atual.ultimo || o.placedAt > atual.ultimo) atual.ultimo = o.placedAt;
      byCustomer.set(o.customerId, atual);
    }
  }

  return customers.map((c) => {
    const agg = byCustomer.get(c.id);
    return {
      id: c.id,
      name: c.name,
      document: c.document,
      email: c.email,
      phone: c.phone,
      city: c.city,
      uf: c.uf,
      active: c.active,
      pedidos: agg?.pedidos ?? 0,
      totalComprado: agg?.total ?? 0,
      ultimoPedido: agg?.ultimo ?? null,
    };
  });
}

/** Só os clientes (kind CLIENTE) — usado no seletor de "Novo pedido" do atacado. */
export async function listarClientesAtivos(clientId: string) {
  return prisma.customer.findMany({
    where: { clientId, kind: "CLIENTE", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, uf: true },
  });
}

export async function criarCustomer(input: {
  clientId: string;
  kind: CustomerKind;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  uf?: string | null;
  notes?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Nome é obrigatório.");

  return prisma.customer.create({
    data: {
      clientId: input.clientId,
      kind: input.kind,
      name,
      document: input.document?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      city: input.city?.trim() || null,
      uf: input.uf?.trim().toUpperCase() || null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function alternarAtivoCustomer(id: string, clientId: string) {
  const atual = await prisma.customer.findFirst({ where: { id, clientId } });
  if (!atual) throw new Error("Registro não encontrado.");
  return prisma.customer.update({ where: { id }, data: { active: !atual.active } });
}

/**
 * Confere que o cliente/fornecedor pertence mesmo a esta loja.
 *
 * Existe porque `customerId` chega de um campo de formulário, e formulário é
 * texto que o navegador manda — dá para trocar o id por um de outro lojista
 * antes de enviar. Sem esta checagem o vínculo era aceito, e a tela depois
 * exibia o NOME do cliente alheio junto do lançamento.
 */
export async function garantirCustomerDoCliente(
  customerId: string | null | undefined,
  clientId: string,
): Promise<string | null> {
  const id = customerId?.trim();
  if (!id) return null;
  const dono = await prisma.customer.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!dono) throw new Error("Cliente não encontrado.");
  return dono.id;
}
