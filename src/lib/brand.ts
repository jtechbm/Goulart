/**
 * Identidade do produto em um só lugar.
 *
 * Trocar a marca é mexer neste arquivo e substituir `public/logo.png`
 * (e `src/app/icon.png`, que é o favicon).
 */

export const APP_NAME = "ArtSul Decorações";

/** Linha de apoio sob a logo, no login. */
export const APP_TAGLINE = "Gestão multi-marketplace";

export const LOGO_SRC = "/logo.png";

/**
 * Tamanho real do arquivo. O `next/image` exige width/height, e passar a
 * proporção errada esmaga a logo — esta é um wordmark deitado (1,67:1), não
 * um ícone quadrado.
 */
export const LOGO_W = 1619;
export const LOGO_H = 971;

/**
 * A logo já traz o nome escrito. Repetir "ArtSul Decorações" em texto ao lado
 * dela seria dizer a mesma coisa duas vezes, então as telas mostram só a
 * imagem — e usam `APP_NAME` no `alt`, para quem usa leitor de tela.
 */
export const LOGO_ALT = APP_NAME;

/** Altura de exibição em cada lugar, com a largura saindo da proporção. */
export const LOGO_ALTURA_MENU = 44;
export const LOGO_ALTURA_LOGIN = 76;

export function larguraPara(altura: number): number {
  return Math.round((LOGO_W / LOGO_H) * altura);
}
