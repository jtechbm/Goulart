/**
 * Permissões dentro da área da agência.
 *
 * `User.role` diz em qual das duas áreas a pessoa entra (ADMIN ou CLIENT).
 * `User.staffRole` diz o que ela enxerga *dentro* da área da agência — é a
 * função cadastrada em Equipe. Quem é do financeiro não vê suporte, e vice-versa.
 *
 * Este arquivo é a fonte única da verdade: mudar um mapa aqui muda o menu, os
 * guards das páginas e as server actions de uma vez.
 */

export const PERMISSIONS = [
  "painel",
  "clientes",
  "contas",
  "estoque",
  "analise",
  "relatorios",
  "financeiro",
  "mensalidades",
  "suporte",
  "equipe",
  "configuracoes",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type StaffRole = "diretor" | "analista" | "financeiro" | "suporte";

type RoleDef = {
  label: string;
  /** Frase curta mostrada no cadastro, para o Kadu saber o que está liberando. */
  summary: string;
  permissions: readonly Permission[];
};

export const STAFF_ROLES: Record<StaffRole, RoleDef> = {
  diretor: {
    label: "Diretor",
    summary: "Acesso total, incluindo equipe e integrações.",
    permissions: PERMISSIONS,
  },
  analista: {
    label: "Analista de marketplace",
    summary: "Contas, estoque, análises e relatórios. Não vê financeiro nem mensalidades.",
    permissions: ["painel", "clientes", "contas", "estoque", "analise", "relatorios"],
  },
  financeiro: {
    label: "Financeiro",
    summary: "Financeiro e mensalidades. Não vê operação de marketplace nem suporte.",
    permissions: ["clientes", "financeiro", "mensalidades"],
  },
  suporte: {
    label: "Suporte / Atendimento",
    summary: "Atendimento aos clientes. Não vê financeiro nem mensalidades.",
    permissions: ["clientes", "suporte"],
  },
};

export const STAFF_ROLE_KEYS = Object.keys(STAFF_ROLES) as StaffRole[];

export function isStaffRole(value: string): value is StaffRole {
  return STAFF_ROLE_KEYS.includes(value as StaffRole);
}

/**
 * Função efetiva de um usuário. Um ADMIN sem função gravada cai em `diretor`
 * — só acontece com contas criadas antes das permissões existirem.
 */
export function staffRoleOf(user: { role: string; staffRole?: string | null }): StaffRole {
  if (user.role !== "ADMIN") return "suporte";
  const value = user.staffRole ?? "";
  return isStaffRole(value) ? value : "diretor";
}

export function permissionsOf(role: StaffRole): readonly Permission[] {
  return STAFF_ROLES[role].permissions;
}

export function can(role: StaffRole, permission: Permission): boolean {
  return STAFF_ROLES[role].permissions.includes(permission);
}

/** Para onde mandar a pessoa depois do login e quando ela cai numa tela proibida. */
const LANDING: Record<Permission, string> = {
  painel: "/",
  clientes: "/clientes",
  contas: "/contas",
  estoque: "/estoque",
  analise: "/analise",
  relatorios: "/relatorios",
  financeiro: "/financeiro",
  mensalidades: "/mensalidades",
  suporte: "/suporte",
  equipe: "/equipe",
  configuracoes: "/configuracoes",
};

export function landingFor(role: StaffRole): string {
  const first = permissionsOf(role)[0];
  return first ? LANDING[first] : "/";
}
