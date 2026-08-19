import { redirect } from "next/navigation";
import { requireClient } from "./auth";
import { lerEstado, planoInclui, type EstadoAssinatura, type Recurso } from "./plans";
import { estadoAssinatura } from "./subscription";

/**
 * Porta de entrada de uma tela paga.
 *
 * Mora fora de `plans.ts` porque `redirect()` só existe do lado do servidor, e
 * `plans.ts` precisa continuar importável pelos testes sem arrastar o Next.
 *
 * `/assinatura` vive FORA do grupo `(app)` de propósito: se estivesse dentro,
 * o layout do grupo bloquearia o próprio destino do redirecionamento e o
 * navegador ficaria girando em laço — o mesmo tropeço que `requireClient` já
 * teve com `/`.
 */
export async function requireAssinatura(): Promise<{
  user: Awaited<ReturnType<typeof requireClient>>;
  estado: EstadoAssinatura;
}> {
  const user = await requireClient();
  /**
   * O caminho normal não toca no banco: a assinatura já veio junto com a
   * sessão. Só quem ainda não tem registro paga uma consulta, e uma vez só —
   * `estadoAssinatura` cria o teste grátis e a partir daí o join a traz.
   */
  const estado = user.subscription
    ? lerEstado(user.subscription)
    : await estadoAssinatura(user.clientId);
  if (!estado.liberada) redirect("/assinatura");
  return { user, estado };
}

/** Idem, exigindo também que o plano vigente inclua o recurso. */
export async function requireRecurso(recurso: Recurso) {
  const { user, estado } = await requireAssinatura();
  if (!planoInclui(estado.plano, recurso)) {
    redirect(`/assinatura?recurso=${encodeURIComponent(recurso)}`);
  }
  return { user, estado };
}
