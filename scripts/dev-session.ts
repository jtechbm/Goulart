/**
 * Utilitário de desenvolvimento: confere o hash das senhas do seed e emite
 * tokens de sessão válidos para testar as rotas com curl.
 *
 *   npx tsx scripts/dev-session.ts
 *
 * Não use em produção — cria sessão sem passar pelo login.
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const client = await prisma.user.findFirst({ where: { role: "CLIENT" }, include: { client: true } });
  if (!admin || !client) throw new Error("Rode `npm run db:seed` antes.");

  console.log("senha admin correta :", verifyPassword("kadu@2026", admin.passwordHash));
  console.log("senha admin errada  :", verifyPassword("errada", admin.passwordHash));
  console.log("senha cliente ok    :", verifyPassword("cliente@2026", client.passwordHash));

  const mint = async (userId: string) => {
    const token = crypto.randomBytes(32).toString("base64url");
    await prisma.session.create({ data: { token, userId, expiresAt: new Date(Date.now() + 86400000) } });
    return token;
  };

  console.log("ADMIN_TOKEN=" + (await mint(admin.id)));
  console.log("CLIENT_TOKEN=" + (await mint(client.id)));
  console.log("CLIENT_NAME=" + client.client?.name);
}

main().finally(() => prisma.$disconnect());
