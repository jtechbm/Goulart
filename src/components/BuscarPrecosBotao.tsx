"use client";

import { RefreshCw, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { buscarPrecosConcorrentes } from "@/lib/marketActions";

/**
 * A busca leva ~26 segundos. Sem um estado de espera explícito a tela pareceria
 * travada — por isso o botão comunica que está buscando e avisa da demora.
 */
export function BuscarPrecosBotao({
  productId,
  jaTemResultado,
}: {
  productId: string;
  jaTemResultado: boolean;
}) {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function buscar() {
    setErro(null);
    startTransition(async () => {
      const r = await buscarPrecosConcorrentes(productId);
      if (!r.ok) setErro(r.mensagem);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={buscar}
        disabled={pendente}
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-70"
      >
        {pendente ? (
          <>
            <RefreshCw size={15} className="animate-spin" /> Buscando…
          </>
        ) : (
          <>
            {jaTemResultado ? <RefreshCw size={15} /> : <Search size={15} />}
            {jaTemResultado ? "Buscar de novo" : "Buscar preços"}
          </>
        )}
      </button>

      <span className="text-[13px] text-ink-muted">
        {pendente ? "Leva cerca de 30 segundos — pode deixar aberto." : "A busca leva cerca de 30 segundos."}
      </span>

      {erro && (
        <span role="alert" className="text-[13px]" style={{ color: "var(--critical)" }}>
          {erro}
        </span>
      )}
    </div>
  );
}
