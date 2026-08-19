import type { Metadata } from "next";
import Link from "next/link";
import { Documento, Secao } from "@/components/Documento";
import { APP_NAME } from "@/lib/brand";
import { EMPRESA } from "@/lib/legal";

export const metadata: Metadata = { title: `Política de privacidade — ${APP_NAME}` };

export default function PrivacidadePage() {
  return (
    <Documento titulo="Política de privacidade">
      <Secao titulo="1. Controlador e encarregado">
        <p>
          O controlador dos dados é {EMPRESA.razaoSocial} (CNPJ {EMPRESA.cnpj}). Para
          exercer qualquer direito previsto na LGPD, escreva para{" "}
          {EMPRESA.emailEncarregado} — respondemos em até 15 dias.
        </p>
      </Secao>

      <Secao titulo="2. Que dados tratamos">
        <p>
          <strong className="text-ink">Da sua conta:</strong> nome, e-mail, telefone,
          CNPJ ou CPF e senha. A senha é guardada apenas como hash (scrypt com sal
          aleatório) — não temos como lê-la, nem para suporte.
        </p>
        <p>
          <strong className="text-ink">Das suas lojas:</strong> pedidos, valores,
          taxas do marketplace, produtos, estoque e uma referência do comprador
          fornecida pela plataforma. Não coletamos dados de pagamento dos seus
          compradores.
        </p>
        <p>
          <strong className="text-ink">De acesso:</strong> data do último login e
          registro de tentativas de entrada, usados para bloquear ataque de força bruta.
        </p>
        <p>
          <strong className="text-ink">De autorização:</strong> os tokens que os
          marketplaces emitem em seu nome, guardados cifrados em AES-256-GCM.
        </p>
      </Secao>

      <Secao titulo="3. Por que tratamos">
        <p>
          Para executar o contrato com você (art. 7º, V da LGPD): sem esses dados o
          sistema não tem o que mostrar. O registro de tentativas de login se apoia no
          legítimo interesse em manter a segurança das contas (art. 7º, IX).
        </p>
        <p>Não vendemos dados, não fazemos perfilamento e não usamos publicidade.</p>
      </Secao>

      <Secao titulo="4. Com quem compartilhamos">
        <p>
          Somente com quem é necessário para o serviço funcionar: provedor de nuvem e
          banco de dados, processador de pagamentos (que recebe seus dados de cobrança
          diretamente — nós não guardamos número de cartão) e os marketplaces que você
          autorizou. Todos atuam como operadores, seguindo nossas instruções.
        </p>
      </Secao>

      <Secao titulo="5. Por quanto tempo">
        <p>
          Enquanto sua conta existir. Ao excluí-la, apagamos os dados de forma
          definitiva, salvo o que a lei nos obrigue a reter — registros fiscais de
          cobrança, por exemplo. Registros de tentativa de login são descartados
          automaticamente após o período de bloqueio.
        </p>
      </Secao>

      <Secao titulo="6. Seus direitos">
        <p>
          Você pode confirmar a existência de tratamento, acessar, corrigir, portar,
          eliminar seus dados e revogar consentimento. Duas dessas coisas você faz
          sozinho e na hora, sem pedir a ninguém, na{" "}
          <Link href="/conta" className="font-semibold text-brand hover:underline">
            tela de conta
          </Link>
          : baixar tudo o que temos sobre você e excluir a conta.
        </p>
      </Secao>

      <Secao titulo="7. Segurança">
        <p>
          O acesso ao banco é restrito por Row Level Security, e nenhuma chave pública
          tem permissão de leitura sobre as tabelas. Tokens de marketplace ficam
          cifrados. O tráfego é sempre por HTTPS. Em caso de incidente que traga risco
          relevante, comunicaremos você e a ANPD, como manda o art. 48.
        </p>
      </Secao>

      <Secao titulo="8. Cookies">
        <p>
          Usamos um único cookie, o de sessão, necessário para manter você conectado.
          Não há cookie de publicidade nem de análise de terceiros — por isso não
          exibimos banner de consentimento: não há o que consentir além do essencial.
        </p>
      </Secao>
    </Documento>
  );
}
