import type { Metadata } from "next";
import { Documento, Secao } from "@/components/Documento";
import { APP_NAME } from "@/lib/brand";
import { EMPRESA } from "@/lib/legal";
import { PLANOS } from "@/lib/plans";
import { brl } from "@/lib/format";

export const metadata: Metadata = { title: `Termos de uso — ${APP_NAME}` };

export default function TermosPage() {
  return (
    <Documento titulo="Termos de uso">
      <Secao titulo="1. Quem somos">
        <p>
          O {APP_NAME} é operado por {EMPRESA.razaoSocial}, inscrita no CNPJ {EMPRESA.cnpj},
          com sede em {EMPRESA.endereco}. Contato: {EMPRESA.emailContato}.
        </p>
      </Secao>

      <Secao titulo="2. O que o serviço faz">
        <p>
          O {APP_NAME} conecta as lojas que você mantém em marketplaces (hoje o Mercado
          Livre) e reúne pedidos, faturamento, estoque e cálculo de lucro em um só lugar.
          Nós lemos e escrevemos dados nesses marketplaces em seu nome, a partir da
          autorização que você concede.
        </p>
        <p>
          Não somos afiliados a nenhum marketplace. Se a plataforma mudar a API, ficar
          fora do ar ou revogar a autorização, funcionalidades podem parar até que a
          conexão seja restabelecida.
        </p>
      </Secao>

      <Secao titulo="3. Sua conta">
        <p>
          Você é responsável por manter a senha em sigilo e por tudo que for feito na
          sua conta. Avise-nos imediatamente se suspeitar de acesso indevido.
        </p>
        <p>
          Cada assinatura corresponde a uma empresa. Os dados de cada empresa ficam
          isolados: nenhum cliente enxerga informação de outro.
        </p>
      </Secao>

      <Secao titulo="4. Planos, teste e pagamento">
        <p>
          O período de teste é gratuito e não exige cartão. Depois dele, os planos são{" "}
          {PLANOS.BASICO.nome} ({brl(PLANOS.BASICO.preco)}/mês) e {PLANOS.PRO.nome} (
          {brl(PLANOS.PRO.preco)}/mês), cobrados mensalmente e de forma recorrente.
        </p>
        <p>
          Você pode cancelar quando quiser. O cancelamento vale para o ciclo seguinte:
          o acesso continua até o fim do período já pago, sem devolução proporcional.
          Se a cobrança falhar, avisamos e mantemos o acesso até o fim do período pago.
        </p>
        <p>
          Alterações de preço serão comunicadas com pelo menos 30 dias de antecedência
          e só valem para os ciclos seguintes.
        </p>
      </Secao>

      <Secao titulo="5. Precisão dos números">
        <p>
          Os cálculos de lucro e margem dependem de informações que só você tem, como o
          custo de cada produto. Enquanto o custo não estiver preenchido, o sistema
          sinaliza o dado como incompleto — mas a conferência final é sua. O {APP_NAME}
          é ferramenta de apoio e não substitui contabilidade.
        </p>
      </Secao>

      <Secao titulo="6. Uso aceitável">
        <p>
          É vedado usar o serviço para atividade ilícita, tentar acessar dados de outro
          cliente, sobrecarregar a infraestrutura de forma deliberada ou fazer engenharia
          reversa do sistema. Podemos suspender contas que violem estas regras.
        </p>
      </Secao>

      <Secao titulo="7. Disponibilidade e responsabilidade">
        <p>
          Trabalhamos para manter o serviço no ar, mas não garantimos operação
          ininterrupta — dependemos de terceiros como marketplaces e provedores de
          nuvem. Nossa responsabilidade fica limitada ao valor pago por você nos 12
          meses anteriores ao evento.
        </p>
        <p>
          Mantemos cópias de segurança, mas recomendamos que você exporte seus dados
          periodicamente pela tela de conta.
        </p>
      </Secao>

      <Secao titulo="8. Encerramento">
        <p>
          Você pode encerrar a conta a qualquer momento pela tela de conta; a exclusão
          é definitiva. Podemos encerrar contas com aviso prévio de 30 dias, ou
          imediatamente em caso de violação destes termos.
        </p>
      </Secao>

      <Secao titulo="9. Lei aplicável">
        <p>
          Aplica-se a lei brasileira. Fica eleito o foro do domicílio do consumidor
          para dirimir controvérsias.
        </p>
      </Secao>
    </Documento>
  );
}
