"use client";

import { Bell, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Notification } from "@/lib/notifications";

const STYLE = {
  CRITICO: { color: "var(--critical)", Icon: CircleAlert },
  ATENCAO: { color: "var(--warning)", Icon: TriangleAlert },
  INFO: { color: "var(--good)", Icon: CircleCheck },
} as const;

export function NotificationsBell({ items }: { items: Notification[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // fecha ao clicar fora ou apertar Esc — comportamento esperado de um popover
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const count = items.length;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count ? `Notificações: ${count} pendente(s)` : "Notificações: nenhuma pendência"}
        className="relative grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-ink-2 transition-colors hover:text-ink"
      >
        <Bell size={16} />
        {count > 0 && (
          <span
            className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full text-[10px] font-bold text-white tabular"
            style={{ background: "var(--critical)" }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 top-11 z-20 w-[340px] overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notificações</p>
            <p className="text-[12px] text-ink-muted">
              {count === 0 ? "Nada pendente por aqui." : `${count} item(ns) precisando de atenção`}
            </p>
          </div>

          {count === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-muted">Tudo em dia.</p>
          ) : (
            <ul className="max-h-[380px] divide-y divide-[var(--border)] overflow-y-auto">
              {items.map((n) => {
                const s = STYLE[n.severity];
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                    >
                      <span
                        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full"
                        style={{
                          color: s.color,
                          backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)`,
                        }}
                      >
                        <s.Icon size={14} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink">{n.title}</span>
                        <span className="block text-[12px] text-ink-muted">{n.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
