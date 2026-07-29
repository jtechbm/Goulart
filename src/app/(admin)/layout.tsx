import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";
import { requireAdmin } from "@/lib/auth";
import { landingFor, STAFF_ROLES } from "@/lib/permissions";

/**
 * Área da agência. O guard de área roda aqui — um cliente logado é devolvido
 * ao portal. O guard *por função* fica em cada página (`requirePermission`),
 * porque o layout não conhece a rota atual.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh">
        <Sidebar
          variant="admin"
          subtitle={STAFF_ROLES[user.staffRole].label}
          permissions={user.permissions}
          home={landingFor(user.staffRole)}
        />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </SidebarProvider>
  );
}
