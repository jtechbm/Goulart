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

/**
 * Guarda padrão de **server action**.
 *
 * Devolve o mesmo formato de `requireClient`, então a troca no call site é
 * mecânica — mas exige assinatura em dia.
 *
 * Por que ela precisa existir: `requireAssinatura` roda no layout do grupo
 * `(app)`, e layout só executa em renderização de página. Server action é um
 * POST comum: o layout não passa por ela. Enquanto as actions usavam
 * `requireClient`, quem tinha assinatura vencida era expulso de todas as telas
 * e mesmo assim continuava podendo **escrever** — lançar no financeiro, mexer
 * em estoque, registrar pedido — chamando a action direto. A trava existia só
 * na parte visual.
 *
 * Use `requireClient` apenas onde o acesso deve sobreviver à assinatura
 * vencida, e diga por quê no call site. Hoje há dois casos: `/conta`, porque
 * reter dado atrás de paywall contraria o art. 18 da LGPD, e a troca de senha.
 */
export async function requireClientAtivo() {
  const { user } = await requireAssinatura();
  return user;
}
