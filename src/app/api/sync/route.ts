import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncAccount, syncAll } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/sync              -> sincroniza todas as contas conectadas
 * POST /api/sync?account=<id> -> sincroniza uma conta
 * POST /api/sync?days=60      -> janela de dias (padrão 30)
 *
 * Chamadas sem sessão (cron) precisam do header:
 *   authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  /** Quando preenchido, limita a sincronização às lojas deste cliente. */
  let scopeClientId: string | null = null;

  if (secret && auth === `Bearer ${secret}`) {
    // chamada de cron — roda sobre a carteira toda, sem sessão
  } else {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    if (user.role === "ADMIN") {
      if (!user.permissions.includes("contas")) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
      }
    } else {
      // o lojista só dispara o sync das próprias lojas
      if (!user.clientId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
      scopeClientId = user.clientId;
    }
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
