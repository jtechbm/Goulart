import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { pkcePair, randomState } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { adapterBySlug } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * GET /api/oauth/{mercadolivre|shopee|tiktok}/start
 * Gera o state (e o par PKCE, no caso do ML), persiste e manda o lojista
 * para a tela de autorização da plataforma.
 *
 * O cliente vem sempre da sessão, nunca da URL: o lojista conecta na própria
 * conta e não há como plugar uma loja no cadastro de outro.
 */
export async function GET(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform: slug } = await ctx.params;
  const adapter = adapterBySlug(slug);

  if (!adapter) {
    return NextResponse.json({ error: `Plataforma desconhecida: ${slug}` }, { status: 404 });
  }
  if (!adapter.isConfigured()) {
    return NextResponse.json(
      { error: `Credenciais de ${adapter.platform} não configuradas no .env` },
      { status: 400 },
    );
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!user.clientId) {
    return NextResponse.json({ error: "Sessão sem loja associada." }, { status: 400 });
  }

  const state = randomState();
  const pkce = adapter.platform === "MERCADO_LIVRE" ? pkcePair() : null;

  await prisma.oAuthState.create({
    data: {
      state,
      platform: adapter.platform,
      clientId: user.clientId,
      verifier: pkce?.verifier ?? null,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  try {
    return NextResponse.redirect(adapter.buildAuthUrl({ state, challenge: pkce?.challenge }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
