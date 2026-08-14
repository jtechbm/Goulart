import { headers } from "next/headers";
import { prisma } from "./db";

/**
 * Rate limit das tentativas de login.
 *
 * Conta no banco, não em memória: em serverless cada requisição pode cair numa
 * instância diferente e um contador em RAM zera no cold start.
 *
 * Duas chaves por tentativa, com limites diferentes de propósito:
 *
 * - **IP** é a defesa principal (limite baixo). É o que segura força bruta,
 *   porque o atacante varre muitas senhas do mesmo lugar.
 * - **E-mail** é rede de proteção para atacante com muitos IPs, e o limite é
 *   folgado justamente porque bloquear por e-mail é uma faca de dois gumes:
 *   um terceiro poderia trancar a conta de alguém de fora só errando a senha.
 *   Com 30 numa janela de 15 minutos, o incômodo é raro e a varredura
 *   distribuída ainda esbarra.
 */

const JANELA_MS = 15 * 60 * 1000;
const BLOQUEIO_MS = 15 * 60 * 1000;

const LIMITE_IP = 10;
const LIMITE_EMAIL = 30;

/**
 * IP de quem chamou. Atrás da Vercel o socket é sempre do proxy, então o
 * endereço real vem no `x-forwarded-for` — e é o **primeiro** da lista, os
 * seguintes são os proxies do caminho.
 */
async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "desconhecido";
}

export type Veredito = { permitido: true } | { permitido: false; segundos: number };

/** Consulta sem contar nada — chamada antes de conferir a senha. */
export async function checarLimite(email: string): Promise<Veredito> {
  const agora = new Date();
  const chaves = [`ip:${await ipDaRequisicao()}`, `email:${email}`];

  const linhas = await prisma.loginAttempt.findMany({
    where: { key: { in: chaves }, blockedUntil: { gt: agora } },
    orderBy: { blockedUntil: "desc" },
    take: 1,
  });

  const bloqueio = linhas[0]?.blockedUntil;
  if (!bloqueio) return { permitido: true };
  return { permitido: false, segundos: Math.ceil((bloqueio.getTime() - agora.getTime()) / 1000) };
}

/** Registra uma falha nas duas chaves e bloqueia quem passou do limite. */
export async function registrarFalha(email: string): Promise<void> {
  const agora = new Date();
  const alvos: Array<[string, number]> = [
    [`ip:${await ipDaRequisicao()}`, LIMITE_IP],
    [`email:${email}`, LIMITE_EMAIL],
  ];

  await Promise.all(
    alvos.map(async ([key, limite]) => {
      const atual = await prisma.loginAttempt.findUnique({ where: { key } });

      // Janela vencida (ou primeira falha): recomeça a contagem do zero.
      if (!atual || agora.getTime() - atual.windowAt.getTime() > JANELA_MS) {
        await prisma.loginAttempt.upsert({
          where: { key },
          create: { key, attempts: 1, windowAt: agora },
          update: { attempts: 1, windowAt: agora, blockedUntil: null },
        });
        return;
      }

      const attempts = atual.attempts + 1;
      await prisma.loginAttempt.update({
        where: { key },
        data: {
          attempts,
          blockedUntil: attempts >= limite ? new Date(agora.getTime() + BLOQUEIO_MS) : atual.blockedUntil,
        },
      });
    }),
  );
}

/** Login deu certo: zera as duas chaves para não punir quem só errou a senha antes. */
export async function limparFalhas(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({
    where: { key: { in: [`ip:${await ipDaRequisicao()}`, `email:${email}`] } },
  });
}

/** Higiene: some com janelas vencidas que ninguém vai mais consultar. */
export async function limparTentativasAntigas(): Promise<number> {
  const { count } = await prisma.loginAttempt.deleteMany({
    where: {
      windowAt: { lt: new Date(Date.now() - JANELA_MS - BLOQUEIO_MS) },
      OR: [{ blockedUntil: null }, { blockedUntil: { lt: new Date() } }],
    },
  });
  return count;
}
