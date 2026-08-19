import Link from "next/link";
import { Marca } from "@/components/Logo";

export default function NaoEncontrado() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-[420px] text-center">
        <div className="flex justify-center">
          <Marca />
        </div>
        <h1 className="mt-8 text-xl font-bold text-ink">Esta página não existe</h1>
        <p className="mt-2 text-sm text-ink-2">
          O endereço pode ter mudado, ou o link estar incompleto.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
        >
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
