import Image from "next/image";
import { APP_NAME, larguraPara, LOGO_ALTURA_MENU, LOGO_SRC } from "@/lib/brand";

/**
 * Símbolo da marca.
 *
 * O arquivo não tem transparência: é o "J" sobre um quadrado claro sólido. Solto
 * sobre o fundo escuro do sistema isso vira um retângulo branco no meio da tela,
 * então arredondamos o próprio bitmap — o resultado lê como ícone de aplicativo,
 * que é o formato natural de um símbolo quadrado, e funciona nos dois temas.
 *
 * O raio acompanha a altura (~25%) para o canto ficar igual em qualquer tamanho.
 */
export function Logo({
  altura = LOGO_ALTURA_MENU,
  priority = false,
}: {
  altura?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt=""
      width={larguraPara(altura)}
      height={altura}
      priority={priority}
      style={{ width: altura, height: altura, borderRadius: Math.round(altura * 0.25) }}
      className="shrink-0 object-contain"
    />
  );
}

/**
 * Símbolo + nome. O símbolo é decorativo e o nome é texto de verdade, então
 * leitor de tela lê "JtechERP" uma vez só e o nome continua selecionável.
 */
export function Marca({
  altura = LOGO_ALTURA_MENU,
  priority = false,
  className = "",
  tamanhoNome = "text-lg",
}: {
  altura?: number;
  priority?: boolean;
  className?: string;
  tamanhoNome?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Logo altura={altura} priority={priority} />
      <span className={`font-bold tracking-tight text-ink ${tamanhoNome}`}>{APP_NAME}</span>
    </span>
  );
}
