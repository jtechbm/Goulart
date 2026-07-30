/**
 * Esqueleto de carregamento.
 *
 * Existe para a navegação responder na hora: sem um `loading.tsx`, o Next
 * segura o clique e o navegador fica parado na tela anterior até o servidor
 * terminar — parece travamento. Com ele, o contorno da página aparece
 * imediatamente e o conteúdo entra por cima quando chega.
 */

/**
 * `--surface-2` é quase idêntico a `--surface` (#1d1830 contra #16121f): o
 * esqueleto ficava tecnicamente presente e visualmente invisível. Usamos
 * `--surface-3` com um brilho deslizante — movimento chama mais atenção que
 * variação de opacidade num tema escuro.
 */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} aria-hidden />;
}

export function SkeletonStat() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <SkeletonBar className="mb-4 size-10 rounded-xl" />
      <SkeletonBar className="h-2.5 w-24" />
      <SkeletonBar className="mt-3 h-7 w-32" />
    </div>
  );
}

/** Contorno genérico de página interna: título, cartões de número e um bloco. */
export function PageSkeleton({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <main className="flex-1 px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>

      <div className="mb-6">
        <SkeletonBar className="h-8 w-52" />
        <SkeletonBar className="mt-2 h-3.5 w-80 max-w-full" />
      </div>

      {stats > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <SkeletonBar className="h-4 w-40" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <SkeletonBar className="h-4 flex-1" />
              <SkeletonBar className="h-4 w-20 shrink-0" />
              <SkeletonBar className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

/** Barra de topo em esqueleto — mesma altura da real, para não haver salto. */
export function TopbarSkeleton() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
      <SkeletonBar className="h-4 w-28" />
      <div className="flex items-center gap-3">
        <SkeletonBar className="size-9 rounded-full" />
        <SkeletonBar className="size-9 rounded-full" />
      </div>
    </header>
  );
}
