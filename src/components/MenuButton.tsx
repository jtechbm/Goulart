"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./SidebarContext";

export function MenuButton() {
  const { toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Abrir menu"
      className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-ink-2 transition-colors hover:text-ink lg:hidden"
    >
      <Menu size={17} />
    </button>
  );
}
