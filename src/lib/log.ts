/**
 * Log estruturado.
 *
 * Sai em JSON numa linha só porque é assim que a Vercel (e qualquer coletor
 * depois dela) consegue filtrar: `evento:"sync.falhou"` vira busca, enquanto
 * uma frase solta em português vira leitura manual de 40 mil linhas.
 *
 * Não há dependência de serviço externo aqui de propósito. Ligar um Sentry da
 * vida depois é acrescentar o envio dentro de `emitir`, sem tocar em nenhuma
 * das chamadas espalhadas pelo código.
 */

export type Nivel = "info" | "aviso" | "erro";

/**
 * Campos que nunca podem sair no log. Token de marketplace em log é token
 * vazado: quem tem acesso ao painel de logs passa a ter acesso à loja do
 * cliente, e log costuma ser guardado por muito mais tempo que sessão.
 */
const PROIBIDOS = /token|senha|password|secret|authorization|cookie|refresh|key|cipher/i;

function limpar(dados: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (PROIBIDOS.test(k)) {
      saida[k] = "[oculto]";
    } else if (v instanceof Error) {
      saida[k] = { nome: v.name, mensagem: v.message };
    } else if (v instanceof Date) {
      saida[k] = v.toISOString();
    } else {
      saida[k] = v;
    }
  }
  return saida;
}

function emitir(nivel: Nivel, evento: string, dados: Record<string, unknown>) {
  const linha = JSON.stringify({
    nivel,
    evento,
    em: new Date().toISOString(),
    ...limpar(dados),
  });
  // `console.error` para erro garante que vá ao stderr e apareça destacado.
  if (nivel === "erro") console.error(linha);
  else console.log(linha);
}

export const log = {
  info: (evento: string, dados: Record<string, unknown> = {}) => emitir("info", evento, dados),
  aviso: (evento: string, dados: Record<string, unknown> = {}) => emitir("aviso", evento, dados),
  erro: (evento: string, dados: Record<string, unknown> = {}) => emitir("erro", evento, dados),
};

/** Mensagem legível de um erro desconhecido, sem deixar vazar o stack. */
export function mensagemDoErro(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
