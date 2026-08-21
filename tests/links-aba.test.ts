import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Link para aba errada não quebra nada — cai na aba padrão em silêncio.
 *
 * Foi o que aconteceu com `/atacado?aba=novo`: a chave real é `novo-pedido`,
 * então o botão "Criar o primeiro pedido" levava de volta à lista de pedidos,
 * que é exatamente a tela de onde a pessoa veio. Nenhum erro, nenhum aviso.
 */

const APP = path.join(process.cwd(), "src", "app");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx$/.test(p) ? [p] : [];
  });
}

/** Chaves de aba declaradas numa página, lidas do `const ABAS`. */
function abasDe(rota: string): string[] {
  const arq = path.join(APP, "(app)", rota, "page.tsx");
  const src = readFileSync(arq, "utf8");
  const bloco = src.slice(src.indexOf("const ABAS"));
  const fim = bloco.indexOf("];");
  // `key` no atacado/financeiro, `slug` no gerenciamento
  return [...bloco.slice(0, fim).matchAll(/(?:key|slug):\s*"([^"]+)"/g)].map((m) => m[1]);
}

const ROTAS = ["atacado", "financeiro", "gerenciamento"];
const VALIDAS = new Map(ROTAS.map((r) => [r, abasDe(r)]));

describe("links de aba", () => {
  it("cada página declara suas abas", () => {
    for (const r of ROTAS) expect(VALIDAS.get(r)!.length, r).toBeGreaterThan(1);
  });

  it("todo href com ?aba= aponta para uma aba que existe", () => {
    const quebrados: string[] = [];
    for (const f of arquivos(APP)) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/href=["'`]\/([a-z-]+)\?aba=([a-z-]+)/g)) {
        const [, rota, aba] = m;
        const validas = VALIDAS.get(rota);
        if (!validas) continue; // rota sem abas declaradas
        if (!validas.includes(aba)) {
          quebrados.push(`${path.relative(APP, f)}: /${rota}?aba=${aba} (existe: ${validas.join(", ")})`);
        }
      }
    }
    expect(quebrados).toEqual([]);
  });
});
