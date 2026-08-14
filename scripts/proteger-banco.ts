/**
 * Fecha o banco para as chaves públicas do Supabase.
 *
 *   npm run db:secure
 *
 * O PROBLEMA
 * O Supabase expõe um PostgREST em `https://<ref>.supabase.co/rest/v1/` e, por
 * padrão, concede a `anon` e `authenticated` todos os privilégios nas tabelas
 * do schema `public`. A chave `anon` é pública por projeto — é feita para ir no
 * navegador. Sem RLS, qualquer um com essa chave lê `Session` (e vira qualquer
 * usuário), lê `User` (hashes de senha), lê `Account` (tokens dos marketplaces)
 * e pode dar TRUNCATE em tudo.
 *
 * A SOLUÇÃO AQUI
 * Esta aplicação não usa a API do Supabase: fala Postgres direto, com o papel
 * `postgres`, que tem `rolbypassrls`. Então a proteção mais forte também é a
 * mais simples — ligar RLS **sem nenhuma policy**. PostgREST passa a negar
 * tudo para `anon`/`authenticated`, e a aplicação não sente nada.
 *
 * Sem FORCE ROW LEVEL SECURITY de propósito: não é necessário (o dono é quem
 * roda a aplicação) e um dia trancaria a própria aplicação para fora.
 *
 * POR QUE ISTO RODA SEMPRE APÓS O db:push
 * `prisma db push` cria tabela nova sem RLS, e os privilégios padrão do
 * Supabase entregam essa tabela a `anon` de novo. Por isso o `db:push` do
 * package.json chama este script no fim, e por isso ele também mexe em
 * ALTER DEFAULT PRIVILEGES — para a próxima tabela já nascer fechada.
 *
 * É idempotente: pode rodar quantas vezes quiser.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Papéis cuja chave é pública ou semipública. `service_role` fica de fora: a chave dele é secreta. */
const PAPEIS_PUBLICOS = ["anon", "authenticated"];

async function main() {
  const tabelas = await prisma.$queryRaw<Array<{ nome: string }>>`
    select c.relname as nome
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `;

  if (tabelas.length === 0) throw new Error("Nenhuma tabela em `public` — o schema já foi aplicado?");

  for (const { nome } of tabelas) {
    await prisma.$executeRawUnsafe(`alter table public."${nome}" enable row level security`);
    for (const papel of PAPEIS_PUBLICOS) {
      await prisma.$executeRawUnsafe(`revoke all on public."${nome}" from ${papel}`);
    }
  }

  // Tabela criada daqui em diante já nasce sem privilégio para os papéis públicos.
  for (const papel of PAPEIS_PUBLICOS) {
    await prisma.$executeRawUnsafe(
      `alter default privileges in schema public revoke all on tables from ${papel}`,
    );
    await prisma.$executeRawUnsafe(
      `alter default privileges in schema public revoke all on sequences from ${papel}`,
    );
  }

  // Confere o resultado em vez de confiar que os comandos passaram.
  const abertas = await prisma.$queryRaw<Array<{ nome: string }>>`
    select c.relname as nome
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  `;
  const grants = await prisma.$queryRaw<Array<{ grantee: string; table_name: string }>>`
    select grantee, table_name from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
  `;

  console.log(`${tabelas.length} tabela(s) com RLS ligado, privilégios de anon/authenticated revogados.`);
  if (abertas.length) console.error("AINDA SEM RLS:", abertas.map((t) => t.nome).join(", "));
  if (grants.length) console.error("AINDA COM GRANT:", grants.map((g) => `${g.grantee}:${g.table_name}`).join(", "));
  if (abertas.length || grants.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
