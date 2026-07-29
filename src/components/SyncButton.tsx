"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SyncButton({ accountId, label = "Sincronizar" }: { accountId?: string; label?: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const qs = accountId ? `?account=${encodeURIComponent(accountId)}` : "";
      const res = await fetch(`/api/sync${qs}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) {
        throw new Error(json.error ?? `Falha na sincronização (HTTP ${res.status})`);
      }
      const failed = (json.results ?? []).filter((r: { ok: boolean }) => !r.ok);
      if (failed.length) setError(failed[0].message ?? "Uma ou mais contas falharam.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const busy = running || pending;

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink disabled:opacity-60"
      >
        <RefreshCw size={14} className={busy ? "animate-spin" : undefined} aria-hidden />
        {busy ? "Sincronizando..." : label}
      </button>
      {error && (
        <span className="max-w-xs text-right text-[11px]" style={{ color: "var(--critical)" }} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
