import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions";
import { currentUser } from "@/lib/auth";
import { notificationsFor } from "@/lib/notifications";
import { STAFF_ROLES } from "@/lib/permissions";
import { MenuButton } from "./MenuButton";
import { NotificationsBell } from "./NotificationsBell";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./ui";

export async function Topbar({ crumb }: { crumb: string }) {
  // Os layouts de (admin)/(portal) já garantiram a sessão antes de chegar aqui.
  const user = await currentUser();
  if (!user) return null;

  // A lista já vem filtrada pela permissão de quem está olhando.
  const notifications = await notificationsFor(user);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MenuButton />
        <p className="truncate text-sm font-medium text-ink-2">{crumb}</p>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationsBell items={notifications} />

        <div className="flex items-center gap-2.5 border-l border-line pl-3">
          <Avatar name={user.name} />
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold text-ink">{user.name}</span>
            <span className="block text-xs text-ink-muted">
              {user.role === "CLIENT" ? (user.clientName ?? "Cliente") : STAFF_ROLES[user.staffRole].label}
            </span>
          </span>

          <form action={logout}>
            <button
              type="submit"
              aria-label="Sair"
              title="Sair"
              className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-ink-2 transition-colors hover:text-ink"
            >
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
