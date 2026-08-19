import { NextResponse } from "next/server";
import { cleanupExpiredSessions, currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { limparTentativasAntigas } from "@/lib/rateLimit";
import { syncAccount, syncAll } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/sync — porta do agendador.
 *
 * O Vercel Cron chama a rota com **GET** (nunca POST) e manda o `CRON_SECRET`
 * no `authorization`. Sem este handler o agendamento configurado em
 * `vercel.json` bateria em 405 a cada disparo, e ninguém perceberia: o cron
 * não avisa que falhou, os pedidos é que simplesmente parariam de entrar.
 *
 * Aqui não há sessão nenhuma: ou vem o segredo certo, ou é 401. Se
 * `CRON_SECRET` não estiver definido, a rota fecha em vez de abrir.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = janela(url.searchParams.get("days"));

  // Faxina junto: sessão vencida e contador de login velho não valem um
  // agendamento só para eles, e sem isso as duas tabelas só crescem.
  await Promise.all([cleanupExpiredSessions(), limparTentativasAntigas()]);

  const results = await syncAll(days, null);
  const failed = results.filter((r) => !r.ok).length;
  return NextResponse.json(
    { days, ok: results.length - failed, failed, results },
    // 207 quando alguma loja falhou: o log da Vercel destaca o disparo,
    // em vez de mostrar tudo verde com contas quebradas dentro.
    { status: failed > 0 ? 207 : 200 },
  );
}

/** Janela de dias aceita, com padrão de 30. */
function janela(bruto: string | null): number {
  return Math.min(365, Math.max(1, Number(bruto ?? 30) || 30));
}

/**
 * POST /api/sync              -> sincroniza as lojas de quem chamou
 * POST /api/sync?account=<id> -> sincroniza uma loja
 * POST /api/sync?days=60      -> janela de dias (padrão 30)
 *
 * Chamadas sem sessão (cron) precisam do header:
 *   authorization: Bearer <CRON_SECRET>
 * e aí rodam sobre a base inteira.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  /** Quando preenchido, limita a sincronização às lojas deste cliente. */
  let scopeClientId: string | null = null;

  if (secret && auth === `Bearer ${secret}`) {
    // Chamada de cron: roda sobre todas as lojas, sem sessão. Aproveita a
    // passagem para a faxina — sessão vencida e contador de login velho não
    // valem um agendamento só para eles, e sem isso as duas tabelas só crescem.
    await Promise.all([cleanupExpiredSessions(), limparTentativasAntigas()]);
  } else {
    const user = await currentUser();
    if (!user?.clientId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    // o lojista só dispara o sync das próprias lojas
    scopeClientId = user.clientId;
  }

  const days = janela(url.searchParams.get("days"));
  const accountId = url.searchParams.get("account");

  if (accountId) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    if (scopeClientId && account.clientId !== scopeClientId) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }
    const result = await syncAccount(account, days);
    return NextResponse.json({ results: [result] }, { status: result.ok ? 200 : 207 });
  }

  const results = await syncAll(days, scopeClientId);
  return NextResponse.json({
    results,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
