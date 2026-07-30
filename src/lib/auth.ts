import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import {
  can,
  landingFor,
  permissionsOf,
  staffRoleOf,
  type Permission,
  type StaffRole,
} from "./permissions";
export { hashPassword, verifyPassword } from "./password";

/**
 * Autenticação própria: senha com scrypt e sessão opaca em cookie httpOnly.
 * Sem dependência externa — o token no cookie não carrega dado nenhum, é só
 * uma chave para a linha em `Session`, então revogar acesso é deletar a linha.
 */

const COOKIE = "jtech_session";
const SESSION_DAYS = 30;

/**
 * Algumas ferramentas são do Kadu, não do cargo "diretor" — se amanhã outra
 * pessoa virar diretora, ela não herda isso automaticamente. Por isso o
 * controle aqui é pelo e-mail da pessoa, não pela função.
 */
const KADU_EMAIL = "kadu@jtech.com.br";

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
  role: "ADMIN" | "CLIENT";
  /** Função dentro da agência — só relevante para role=ADMIN. */
  staffRole: StaffRole;
  permissions: readonly Permission[];
  clientId: string | null;
  clientName: string | null;
  mustChangePassword: boolean;
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
    include: { user: { include: { client: { select: { name: true } } } } },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) return null;

  const u = session.user;
  const staffRole = staffRoleOf(u);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "ADMIN" | "CLIENT",
    staffRole,
    permissions: u.role === "ADMIN" ? permissionsOf(staffRole) : [],
    clientId: u.clientId,
    clientName: u.client?.name ?? null,
    mustChangePassword: u.mustChangePassword,
  };
});

/* -------------------------------------------------------------------------- */
/* Guardas de rota                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Manda cada pessoa para a própria porta de entrada — usado depois do login.
 * Um financeiro não cai no Painel (que ele não pode ver), e sim em /financeiro.
 */
export function homeFor(user: { role: string; staffRole?: string | null }) {
  if (user.role !== "ADMIN") return "/portal";
  return landingFor(staffRoleOf(user));
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/trocar-senha");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  // um cliente que tenta abrir a área da agência volta para o portal dele
  if (user.role !== "ADMIN") redirect("/portal");
  return user;
}

export function isKadu(user: { email: string }): boolean {
  return user.email === KADU_EMAIL;
}

/** Guarda de rota para ferramentas pessoais do Kadu (ex.: comparador de preços). */
export async function requireKadu(): Promise<SessionUser> {
  const user = await requireAdmin();
  if (!isKadu(user)) redirect(homeFor(user));
  return user;
}

/**
 * Exige uma permissão específica. Quem não tem é devolvido para a própria
 * porta de entrada, em vez de ver um 403 sem saída.
 *
 * Toda página e toda server action da área da agência passa por aqui — é o
 * ponto único que impede um suporte de abrir /financeiro pela URL.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireAdmin();
  if (!can(user.staffRole, permission)) redirect(landingFor(user.staffRole));
  return user;
}

/**
 * Exige um cliente logado e devolve o clientId — todo query do portal precisa
 * filtrar por ele. Um ADMIN também passa (para o Kadu conseguir inspecionar),
 * mas nesse caso `clientId` vem null e a tela pede a seleção.
 */
export async function requireClient(): Promise<SessionUser & { clientId: string }> {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.clientId) redirect("/");
  return user as SessionUser & { clientId: string };
}

export async function cleanupExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
