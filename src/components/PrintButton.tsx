"use client";

import { Printer } from "lucide-react";

/**
 * "Salvar como PDF" é a impressão do navegador — no diálogo, o destino
 * "Salvar como PDF" já existe em Chrome, Edge, Firefox e Safari. Uma
 * biblioteca de PDF pesaria centenas de KB para reproduzir pior o que o
 * navegador já faz, e ainda perderia o texto selecionável.
 */
export function PrintButton({ label = "Salvar como PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink print:hidden"
    >
      <Printer size={14} aria-hidden />
      {label}
    </button>
  );
}
