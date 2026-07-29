"use client";

import { Plug } from "lucide-react";
import { useState } from "react";

type PlatformOption = { slug: string; label: string; configured: boolean };

/**
 * Escolhe o cliente da agência e dispara o OAuth da plataforma.
 * A navegação é full-page (não fetch) porque o destino é o domínio do marketplace.
 */
export function ConnectStore({
  clients,
  platforms,
}: {
  clients: Array<{ id: string; name: string }>;
  platforms: PlatformOption[];
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");

  if (clients.length === 0) {
    return (
      <p className="px-5 py-5 text-sm text-ink-muted">
        Cadastre um cliente antes de conectar uma loja.
      </p>
    );
  }

  return (
    <div className="px-5 py-5">
      <label className="block max-w-sm">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
          Conectar loja para o cliente
        </span>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        {platforms.map((p) => (
          <a
            key={p.slug}
            href={p.configured ? `/api/oauth/${p.slug}/start?client=${clientId}` : undefined}
            aria-disabled={!p.configured}
            title={p.configured ? undefined : "Preencha as credenciais desta plataforma no .env"}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              p.configured
                ? "bg-brand text-brand-ink hover:bg-brand-hover"
                : "cursor-not-allowed border border-line bg-surface-2 text-ink-muted"
            }`}
            onClick={(e) => {
              if (!p.configured) e.preventDefault();
            }}
          >
            <Plug size={15} /> {p.label}
          </a>
        ))}
      </div>
    </div>
  );
}
