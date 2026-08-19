import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";
import { requireAssinatura } from "@/lib/planGuard";
import { totalNaoLidas } from "@/lib/chat";

/**
 * Shell do sistema.
 *
 * `requireAssinatura` faz duas garantias: existe um clientId na sessão — e
 * todas as consultas daqui para dentro filtram por ele, então um lojista nunca
 * alcança dado de outro — e a assinatura está em dia. Quem está fora vai para
 * `/assinatura`, que mora fora deste grupo justamente para não cair aqui de novo.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, estado } = await requireAssinatura();
  const naoLidas = await totalNaoLidas(user.clientId);

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh">
        <Sidebar
          subtitle={user.clientName ?? "Minha conta"}
          plano={estado.plano}
          diasDeTeste={estado.diasDeTeste}
          chatNaoLidas={naoLidas}
        />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </SidebarProvider>
  );
}
