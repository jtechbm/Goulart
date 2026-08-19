/**
 * Identidade do produto em um só lugar.
 *
 * Trocar a marca é mexer neste arquivo e substituir `public/logo.png`
 * (e `src/app/icon.png`, que é o favicon).
 */

export const APP_NAME = "JtechERP";

/** Linha de apoio sob a logo, no login. */
export const APP_TAGLINE = "Gestão multi-marketplace";

export const LOGO_SRC = "/logo.png";

/**
 * Tamanho real do arquivo. O `next/image` exige width/height, e passar a
 * proporção errada esmaga a logo — esta é um símbolo quadrado (o "J"), então
 * altura e largura andam juntas.
 */
export const LOGO_W = 640;
export const LOGO_H = 640;

/**
 * O símbolo NÃO traz o nome escrito, ao contrário do wordmark antigo. Por isso
 * as telas passaram a escrever "JtechERP" ao lado dele — e a imagem entra como
 * decorativa (`alt=""`), senão um leitor de tela anunciaria o nome duas vezes.
 * Quem precisa do nome no `alt` (favicon, contextos sem texto) usa `LOGO_ALT`.
 */
export const LOGO_ALT = APP_NAME;

/** Altura de exibição em cada lugar. Como é quadrado, é também a largura. */
export const LOGO_ALTURA_MENU = 36;
export const LOGO_ALTURA_LOGIN = 56;

export function larguraPara(altura: number): number {
  return Math.round((LOGO_W / LOGO_H) * altura);
}
