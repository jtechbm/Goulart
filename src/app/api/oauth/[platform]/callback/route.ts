import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adapterBySlug } from "@/lib/integrations";
import { persistTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/** Devolve cada papel para a tela de integração da própria área. */
function back(message: string, ok = false, role: "ADMIN" | "CLIENT" = "ADMIN") {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const path = role === "CLIENT" ? "/portal/integracoes" : "/configuracoes";
  const qs = new URLSearchParams({ [ok ? "ok" : "erro"]: message });
  return NextResponse.redirect(`${base}${path}?${qs.toString()}`);
}

/**
 * GET /api/oauth/{platform}/callback
 * Valida o state, troca o code por tokens e cria/atualiza a Account.
 */
export async function GET(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform: slug } = await ctx.params;
  const user = await currentUser();
  const role = user?.role ?? "ADMIN";

  const adapter = adapterBySlug(slug);
  if (!adapter) return back(`Plataforma desconhecida: ${slug}`, false, role);

  const params = new URL(req.url).searchParams;

  if (params.get("error")) {
    return back(`Autorização negada: ${params.get("error_description") ?? params.get("error")}`, false, role);
  }

  const state = params.get("state");
  if (!state) return back("Callback sem `state`.", false, role);

  const saved = await prisma.oAuthState.findUnique({ where: { state } });
  if (!saved) return back("State inválido ou já utilizado.", false, role);

  // consome o state em qualquer desfecho — protege contra replay
  await prisma.oAuthState.delete({ where: { id: saved.id } });

  if (saved.expiresAt < new Date()) return back("Autorização expirou. Tente novamente.", false, role);
  if (saved.platform !== adapter.platform) return back("State não corresponde à plataforma.", false, role);
  if (!saved.clientId) return back("State sem cliente associado.", false, role);
  // um lojista não pode concluir um fluxo iniciado para outro cliente
  if (user?.role === "CLIENT" && saved.clientId !== user.clientId) {
    return back("Esta autorização pertence a outra conta.", false, role);
  }

  try {
    const tokens = await adapter.exchangeCode({ params, verifier: saved.verifier });

    const account = await prisma.account.upsert({
      where: { platform_externalId: { platform: adapter.platform, externalId: tokens.externalId } },
      create: {
        clientId: saved.clientId,
        platform: adapter.platform,
        externalId: tokens.externalId,
        shopName: tokens.shopName ?? `Loja ${tokens.externalId}`,
        region: tokens.region,
        status: "PENDING",
      },
      update: {
        clientId: saved.clientId,
        shopName: tokens.shopName ?? undefined,
        region: tokens.region ?? undefined,
      },
    });

    await persistTokens(account.id, tokens);
    return back(`${account.shopName} conectada com sucesso.`, true, role);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return back(message.slice(0, 300), false, role);
  }
}
