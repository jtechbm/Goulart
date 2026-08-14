import { KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/lib/actions";
import { currentUser } from "@/lib/auth";
import { MenuButton } from "./MenuButton";
import { NotificationsFallback, NotificationsSlot } from "./NotificationsSlot";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./ui";

/** Nome da empresa, a não ser que ele apenas repita o nome de quem entrou. */
function segundaLinha(nome: string, empresa: string | null, email: string): string {
  if (!empresa) return email;
  const normal = (s: string) => s.trim().toLowerCase();
  return normal(empresa).startsWith(normal(nome)) ? email : empresa;
}

export async function Topbar({ crumb }: { crumb: string }) {
  // O layout do grupo (app) já garantiu a sessão antes de chegar aqui.
  // `currentUser` está em cache: aqui não custa consulta nova.
  const user = await currentUser();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MenuButton />
        <p className="truncate text-sm font-medium text-ink-2">{crumb}</p>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        {/* O sino busca no banco; atrás do Suspense ele não segura a página. */}
        <Suspense fallback={<NotificationsFallback />}>
          <NotificationsSlot />
        </Suspense>

        <div className="flex items-center gap-2.5 border-l border-line pl-3">
          <Avatar name={user.name} />
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold text-ink">{user.name}</span>
            {/* Quando o nome de quem entrou já é o da empresa, repetir "ArtSul"
                sobre "ArtSul Decorações" não informa nada — o e-mail sim, que
                diz em qual acesso você está. */}
            <span className="block text-xs text-ink-muted">
              {segundaLinha(user.name, user.clientName, user.email)}
            </span>
          </span>

          <Link
            href="/trocar-senha"
            aria-label="Trocar senha"
            title="Trocar senha"
            className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-ink-2 transition-colors hover:text-ink"
          >
            <KeyRound size={15} />
          </Link>

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
