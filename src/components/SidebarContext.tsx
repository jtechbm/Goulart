"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Estado de abertura da sidebar no mobile. Compartilhado entre o botão de
 * menu (no Topbar, renderizado por página) e a própria Sidebar (no layout),
 * que não têm relação direta de pai/filho.
 */
const SidebarCtx = createContext<{ open: boolean; toggle: () => void; close: () => void } | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SidebarCtx.Provider value={{ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) }}>
      {children}
    </SidebarCtx.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error("useSidebar precisa estar dentro de um SidebarProvider");
  return ctx;
}
