import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda arquitetural.
 *
 * Server action é um POST comum: o layout do grupo `(app)` não roda nela. Quem
 * usasse `requireClient` numa action deixava passar assinatura vencida — o
 * bloqueio valia só para abrir a tela, e o lojista continuava podendo escrever
 * chamando a action direto. A falha é invisível em teste manual, porque a
 * interface some do mesmo jeito.
 *
 * Este teste lê o código-fonte em vez de executá-lo, de propósito: é a única
 * forma de afirmar algo sobre TODAS as actions, inclusive as que ainda não
 * existem.
 */

const RAIZ = path.join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = path.join(dir, nome);
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

/**
 * Onde `requireClient` continua correto, com o motivo. Acesso a estes precisa
 * sobreviver à assinatura vencida — reter dado atrás de paywall contraria o
 * art. 18 da LGPD.
 */
const ISENTOS: Record<string, string> = {
  "app/conta/page.tsx": "exportar e excluir dados não podem depender de assinatura em dia",
  "app/api/conta/exportar/route.ts": "idem — portabilidade de dados",
  "app/assinatura/page.tsx": "é o destino de quem está bloqueado; exigir assinatura aqui seria laço",
  "lib/planGuard.ts": "é quem implementa a guarda",
};

const comAction = arquivos(RAIZ).filter((f) => readFileSync(f, "utf8").includes('"use server"'));

describe("guardas das server actions", () => {
  it("encontra os arquivos de server action", () => {
    expect(comAction.length).toBeGreaterThan(5);
  });

  it.each(comAction.map((f) => [path.relative(RAIZ, f).split(path.sep).join("/"), f]))(
    "%s não usa requireClient numa action",
    (rel, f) => {
      if (ISENTOS[rel as string]) return;
      const src = readFileSync(f as string, "utf8");
      expect(src, `${rel}: troque por requireClientAtivo (ou requireRecurso)`).not.toMatch(
        /await\s+requireClient\(\)/,
      );
    },
  );

  it("toda action autentica de alguma forma", () => {
    const rel = (f: string) => path.relative(RAIZ, f).split(path.sep).join("/");
    const semAuth = comAction.filter((f) => {
      const src = readFileSync(f, "utf8");
      // Login e cadastro criam a sessão — não há quem autenticar ainda.
      // `actions.ts` é o logout, que precisa funcionar em qualquer estado.
      if (["app/login/page.tsx", "app/cadastro/page.tsx", "lib/actions.ts"].includes(rel(f))) {
        return false;
      }
      return !/require(ClientAtivo|Recurso|Assinatura|Client|User)\(/.test(src);
    });
    expect(semAuth.map(rel)).toEqual([]);
  });
});
