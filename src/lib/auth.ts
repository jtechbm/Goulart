import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
export { hashPassword, verifyPassword } from "./password";

/**
 * Autenticação própria: senha com scrypt e sessão opaca em cookie httpOnly.
 * Sem dependência externa — o token no cookie não carrega dado nenhum, é só
 * uma chave para a linha em `Session`, então revogar acesso é deletar a linha.
 *
 * O sistema tem um único tipo de usuário: o lojista. Todo acesso precisa de um
 * `clientId`, que é o escopo de tudo que a pessoa enxerga.
 */

const COOKIE = "jtech_session";
const SESSION_DAYS = 30;

/* -------------------------------------------------------------------------- */
/* Sessão                                                                      */
/* -------------------------------------------------------------------------- */

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  jar.delete(COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  clientId: string | null;
  clientName: string | null;
  /**
   * Assinatura do cliente, crua. Vem no MESMO join da sessão de propósito: o
   * layout precisa dela em toda navegação, e buscá-la à parte custava uma
   * segunda ida ao banco por página — de São Paulo é barato, mas cada ida a
   * mais é uma trave de latência empilhada antes de a tela começar a montar.
   */
  subscription: {
    plan: string;
    status: string;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

/**
 * Envolvido em `cache()` do React: numa mesma renderização o layout, o guard da
 * página e o Topbar chamam isto de forma independente. Sem o cache eram três
 * consultas idênticas de sessão por page view — três idas ao banco em fila.
 * O cache vale só para a requisição atual, então não corre risco de servir
 * sessão de outra pessoa.
 */
export const currentUser = cache(async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    // JOIN em vez de três queries em fila (session → user → client). É a
    // consulta mais quente do sistema: roda em toda navegação.
    relationLoadStrategy: "join",
    where: { token },
    include: {
      user: {
        include: {
          client: {
            select: {
              name: true,
              subscription: {
                select: {
                  plan: true,
                  status: true,
                  trialEndsAt: true,
                  currentPeriodEnd: true,
                  cancelAtPeriodEnd: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) return null;

  const u = session.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    clientId: u.clientId,
    clientName: u.client?.name ?? null,
    subscription: u.client?.subscription ?? null,
  };
});

/* -------------------------------------------------------------------------- */
/* Guardas de rota                                                             */
/* -------------------------------------------------------------------------- */

/** Existe uma porta de entrada só. Mantido como função para não espalhar "/". */
export function homeFor(): string {
  return "/";
}

/**
 * Monta um redirect com mensagem. O `encodeURIComponent` não é opcional:
 * acento cru na query chega no navegador como `nÃ£o confere`.
 */
export function comAviso(path: string, chave: "ok" | "erro", mensagem: string): string {
  return `${path}?${chave}=${encodeURIComponent(mensagem)}`;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Guard de toda tela do sistema: exige sessão e devolve o `clientId`, por onde
 * cada consulta filtra — é o que impede um lojista de alcançar dado de outro.
 *
 * Um usuário sem `clientId` (sobra do tempo em que existia a área da agência)
 * não tem para onde ir aqui dentro. Em vez de mandá-lo para uma tela que
 * também exige cliente — o que daria um laço infinito de redirect —, a sessão
 * é encerrada e ele volta ao login com a explicação.
 */
export async function requireClient(): Promise<SessionUser & { clientId: string }> {
  const user = await requireUser();
  if (!user.clientId) {
    await destroySession();
    redirect(comAviso("/login", "erro", "Este acesso não está vinculado a nenhuma loja."));
  }
  return user as SessionUser & { clientId: string };
}

export async function cleanupExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
