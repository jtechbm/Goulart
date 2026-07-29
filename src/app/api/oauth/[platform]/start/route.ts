import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { pkcePair, randomState } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { adapterBySlug } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * GET /api/oauth/{mercadolivre|shopee|tiktok}/start[?client=<clientId>]
 * Gera o state (e o par PKCE, no caso do ML), persiste e manda o lojista
 * para a tela de autorização da plataforma.
 *
 * O ?client só é aceito de um ADMIN. Um lojista logado conecta sempre na
 * própria conta — senão bastaria trocar o id na URL para plugar uma loja
 * no cadastro de outro cliente.
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

  // do lado da agência, conectar loja é atribuição de quem cuida das integrações
  if (user.role === "ADMIN" && !user.permissions.includes("configuracoes")) {
    return NextResponse.json({ error: "Sua função não permite conectar lojas." }, { status: 403 });
  }

  const requested = new URL(req.url).searchParams.get("client");
  const clientId = user.role === "ADMIN" ? requested : user.clientId;

  if (!clientId) {
    return NextResponse.json(
      { error: user.role === "ADMIN" ? "Informe ?client=<id do cliente>" : "Sessão sem cliente associado." },
      { status: 400 },
    );
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const state = randomState();
  const pkce = adapter.platform === "MERCADO_LIVRE" ? pkcePair() : null;

  await prisma.oAuthState.create({
    data: {
      state,
      platform: adapter.platform,
      clientId,
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
