import { Bell } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { notificationsFor } from "@/lib/notifications";
import { NotificationsBell } from "./NotificationsBell";

/**
 * O sino sozinho custa uma ida ao banco. Isolado num componente próprio, ele
 * pode ficar atrás de um <Suspense> e o conteúdo da página não espera por ele
 * — o resto do topo aparece na hora e o sino entra quando os dados chegam.
 */
export async function NotificationsSlot() {
  const user = await currentUser();
  if (!user) return null;
  // a lista já vem filtrada pela permissão de quem está olhando
  return <NotificationsBell items={await notificationsFor(user)} />;
}

/** Placeholder do mesmo tamanho, para não haver salto quando o sino chega. */
export function NotificationsFallback() {
  return (
    <span
      className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-ink-muted"
      aria-hidden
    >
      <Bell size={16} />
    </span>
  );
}
