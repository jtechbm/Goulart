"use server";

import { revalidatePath } from "next/cache";
import { requireClientAtivo } from "./planGuard";
import { enviarMensagem, marcarComoLida, responderAutomaticamente } from "./chat";

export async function enviarMensagemAction(conversationId: string, body: string): Promise<{ ok: boolean; mensagem?: string }> {
  const user = await requireClientAtivo();
  try {
    await enviarMensagem(user.clientId, conversationId, body);
    revalidatePath("/chat");
    return { ok: true };
  } catch (err) {
    return { ok: false, mensagem: err instanceof Error ? err.message : String(err) };
  }
}

/** Chamada ~1.8s depois do envio, pelo client, pra simular o cliente respondendo. */
export async function dispararRespostaAction(conversationId: string): Promise<void> {
  const user = await requireClientAtivo();
  await responderAutomaticamente(user.clientId, conversationId);
  revalidatePath("/chat");
}

export async function marcarComoLidaAction(conversationId: string): Promise<void> {
  const user = await requireClientAtivo();
  await marcarComoLida(user.clientId, conversationId);
  revalidatePath("/chat");
}
