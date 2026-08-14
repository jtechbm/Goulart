import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";
import { requireClient } from "@/lib/auth";
import { totalNaoLidas } from "@/lib/chat";

/**
 * Shell do sistema. `requireClient` garante que existe um clientId na sessão;
 * todas as consultas daqui para dentro filtram por ele, então um lojista nunca
 * alcança dado de outro.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireClient();
  const naoLidas = await totalNaoLidas(user.clientId);

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh">
        <Sidebar subtitle={user.clientName ?? "Minha conta"} chatNaoLidas={naoLidas} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </SidebarProvider>
  );
}
