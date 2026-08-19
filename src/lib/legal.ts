/**
 * Dados da empresa que aparecem nos documentos legais.
 *
 * ATENÇÃO: os campos marcados com PENDENTE precisam ser preenchidos antes de
 * abrir o cadastro ao público. Um termo de uso sem a identificação de quem o
 * emite não vincula ninguém, e a política de privacidade sem controlador
 * nomeado não cumpre o art. 9º da LGPD.
 *
 * Os textos abaixo cobrem o que a LGPD exige e servem para operar em fase de
 * teste, mas NÃO substituem revisão de advogado antes de cobrar do público.
 */

export const EMPRESA = {
  razaoSocial: "PENDENTE — razão social",
  cnpj: "PENDENTE — CNPJ",
  endereco: "PENDENTE — endereço completo",
  /** Canal do titular para exercer direitos da LGPD (art. 18). */
  emailContato: "jtech@gmail.com",
  emailEncarregado: "jtech@gmail.com",
} as const;

/** Data da última revisão dos documentos. */
export const ATUALIZADO_EM = "18 de agosto de 2026";

export function faltaPreencher(): boolean {
  return Object.values(EMPRESA).some((v) => v.startsWith("PENDENTE"));
}
