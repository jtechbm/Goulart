/**
 * Cria o acesso de um lojista.
 *
 * Não existe cadastro aberto no sistema: o login é criado aqui e entregue à
 * pessoa, que troca a senha no primeiro acesso.
 *
 *   npm run criar-acesso -- --loja "Arsul Decorações" --nome "Maria" --email maria@arsul.com.br
 *
 * Opções:
 *   --loja   <nome>   nome da empresa (reutiliza se já existir)
 *   --nome   <nome>   nome da pessoa que vai logar
 *   --email  <email>  e-mail de login
 *   --senha  <senha>  opcional; sem ela, uma é sorteada e impressa
 *
 * A senha definida aqui já é a definitiva — não há tela obrigatória de troca no
 * primeiro acesso. A pessoa troca quando quiser, pelo ícone de chave no topo.
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const loja = arg("loja")?.trim();
  const nome = arg("nome")?.trim();
  const email = arg("email")?.trim().toLowerCase();
  const senhaInformada = arg("senha");

  if (!loja || !nome || !email) {
    throw new Error(
      'Uso: npm run criar-acesso -- --loja "Nome da empresa" --nome "Pessoa" --email pessoa@empresa.com.br',
    );
  }

  const jaExiste = await prisma.user.findUnique({ where: { email } });
  if (jaExiste) throw new Error(`Já existe um acesso com o e-mail ${email}.`);

  // Reaproveita a empresa quando ela já está cadastrada — duas pessoas da mesma
  // loja precisam apontar para o mesmo clientId, senão veem bases separadas.
  const client =
    (await prisma.client.findFirst({ where: { name: loja } })) ??
    (await prisma.client.create({ data: { name: loja, email } }));

  // base64url para a senha caber num e-mail/WhatsApp sem escapar nada
  const senha = senhaInformada ?? crypto.randomBytes(9).toString("base64url");

  const user = await prisma.user.create({
    data: { name: nome, email, passwordHash: hashPassword(senha), clientId: client.id },
  });

  console.log("Acesso criado.");
  console.log("  loja  :", client.name, `(${client.id})`);
  console.log("  nome  :", user.name);
  console.log("  e-mail:", user.email);
  console.log("  senha :", senha);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
