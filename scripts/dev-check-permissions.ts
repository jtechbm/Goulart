/**
 * Verificação de desenvolvimento das permissões por função.
 *
 * Cria uma sessão para cada pessoa da equipe, abre todas as rotas da agência e
 * mostra quem passou (200) e quem foi barrado (307 para a própria área).
 *
 *   npx tsx scripts/dev-check-permissions.ts   (servidor precisa estar no ar)
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { permissionsOf, staffRoleOf, STAFF_ROLES, type StaffRole } from "../src/lib/permissions";

const prisma = new PrismaClient();
const BASE = process.env.APP_URL ?? "http://localhost:3000";

const ROUTES: Array<[string, string]> = [
  ["/", "painel"],
  ["/clientes", "clientes"],
  ["/contas", "contas"],
  ["/estoque", "estoque"],
  ["/analise", "analise"],
  ["/relatorios", "relatorios"],
  ["/financeiro", "financeiro"],
  ["/mensalidades", "mensalidades"],
  ["/suporte", "suporte"],
  ["/equipe", "equipe"],
  ["/configuracoes", "configuracoes"],
];

async function main() {
  const users = await prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (users.length === 0) throw new Error("Rode `npm run db:seed` antes.");

  let falhas = 0;

  for (const user of users) {
    const role = staffRoleOf(user) as StaffRole;
    const permitidas = permissionsOf(role);

    const token = crypto.randomBytes(32).toString("base64url");
    await prisma.session.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3600000) } });

    console.log(`\n${user.name} — ${STAFF_ROLES[role].label}`);

    for (const [path, permission] of ROUTES) {
      const res = await fetch(BASE + path, {
        headers: { cookie: `jtech_session=${token}` },
        redirect: "manual",
      });

      const deveriaPassar = permitidas.includes(permission as never);
      const passou = res.status === 200;
      const ok = passou === deveriaPassar;
      if (!ok) falhas++;

      const marca = ok ? "  " : "!!";
      const situacao = passou ? "acessa" : `bloqueado -> ${res.headers.get("location") ?? "?"}`;
      console.log(`  ${marca} ${path.padEnd(16)} ${situacao}`);
    }

    await prisma.session.deleteMany({ where: { token } });
  }

  console.log(falhas === 0 ? "\nTodas as rotas respeitaram a função." : `\n${falhas} divergência(s)!`);
  if (falhas > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
