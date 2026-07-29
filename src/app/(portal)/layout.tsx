import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";
import { requireClient } from "@/lib/auth";

/**
 * Portal do lojista. `requireClient` garante que existe um clientId na sessão;
 * todas as consultas do grupo filtram por ele, então um cliente nunca alcança
 * dado de outro.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireClient();

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh">
        <Sidebar variant="portal" subtitle={user.clientName ?? "Minha conta"} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </SidebarProvider>
  );
}
