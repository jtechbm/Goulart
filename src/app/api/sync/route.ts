import { NextResponse } from "next/server";
import { cleanupExpiredSessions, currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { limparTentativasAntigas } from "@/lib/rateLimit";
import { syncAccount, syncAll } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? 30)));
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
