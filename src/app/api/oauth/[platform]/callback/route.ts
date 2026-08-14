import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adapterBySlug } from "@/lib/integrations";
import { appUrl } from "@/lib/integrations/types";
import { persistTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * Volta para a tela de Integrações com o recado. `appUrl()` é a mesma função
 * que monta o redirect_uri registrado na plataforma — se ela não estiver
 * configurada, caímos na origem da própria requisição em vez de quebrar.
 */
function back(req: Request, message: string, ok = false) {
  let base: string;
  try {
    base = appUrl();
  } catch {
    base = new URL(req.url).origin;
  }
  const qs = new URLSearchParams({ [ok ? "ok" : "erro"]: message });
  return NextResponse.redirect(`${base}/integracoes?${qs.toString()}`);
}

/**
 * GET /api/oauth/{platform}/callback
 * Valida o state, troca o code por tokens e cria/atualiza a Account.
 */
export async function GET(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform: slug } = await ctx.params;
  const user = await currentUser();

  const adapter = adapterBySlug(slug);
  if (!adapter) return back(req, `Plataforma desconhecida: ${slug}`);

  const params = new URL(req.url).searchParams;

  if (params.get("error")) {
    return back(req, `Autorização negada: ${params.get("error_description") ?? params.get("error")}`);
  }

  const state = params.get("state");
  if (!state) return back(req, "Callback sem `state`.");

  const saved = await prisma.oAuthState.findUnique({ where: { state } });
  if (!saved) return back(req, "State inválido ou já utilizado.");

  // consome o state em qualquer desfecho — protege contra replay
  await prisma.oAuthState.delete({ where: { id: saved.id } });

  if (saved.expiresAt < new Date()) return back(req, "Autorização expirou. Tente novamente.");
  if (saved.platform !== adapter.platform) return back(req, "State não corresponde à plataforma.");
  if (!saved.clientId) return back(req, "State sem loja associada.");
  // um lojista não pode concluir um fluxo iniciado por outro
  if (saved.clientId !== user?.clientId) {
    return back(req, "Esta autorização pertence a outra conta.");
  }

  try {
    const tokens = await adapter.exchangeCode({ params, verifier: saved.verifier });

    /**
     * Antes: o upsert reatribuía `clientId` silenciosamente. Reconectar uma
     * loja com o cliente errado selecionado a transferia de dono — e como
     * pedidos, métricas e produtos penduram em `accountId`, o histórico inteiro
     * ia junto. O portal do novo dono passaria a exibir o faturamento do
     * anterior, sem erro e sem aviso.
     *
     * Agora a troca de dono exige ação explícita: aqui a reconexão só renova os
     * tokens da loja onde ela já está.
     */
    const existente = await prisma.account.findUnique({
      where: { platform_externalId: { platform: adapter.platform, externalId: tokens.externalId } },
    });

    if (existente && existente.clientId !== saved.clientId) {
      return back(
        req,
        "Esta loja já está conectada em outra conta deste sistema. Desconecte-a de lá antes " +
          "de conectá-la aqui — a transferência levaria junto todo o histórico de pedidos e " +
          "faturamento.",
      );
    }

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
        // `clientId` fora de propósito: reconectar renova credencial, não muda dono.
        shopName: tokens.shopName ?? undefined,
        region: tokens.region ?? undefined,
      },
    });

    await persistTokens(account.id, tokens);
    return back(req, `${account.shopName} conectada com sucesso.`, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return back(req, message.slice(0, 300));
  }
}
