import type { Metadata } from 'next'

import { LegalPage, LegalSection } from '../_components/legal-section'

export const metadata: Metadata = {
  title: 'Termos de Serviço',
  description: 'Condições de uso da plataforma de atendimento via WhatsApp.',
}

const TermsPage = () => {
  return (
    <LegalPage title="Termos de Serviço" updatedAt="3 de agosto de 2026">
      <LegalSection title="1. Aceitação">
        <p>
          Estes termos regem o uso da plataforma de atendimento via WhatsApp
          fornecida por{' '}
          <strong className="text-foreground">Matra Tecnologia</strong>,
          inscrita no CNPJ nº [PREENCHER] («nós»). Ao criar uma conta ou
          utilizar a plataforma, a empresa contratante e seus usuários («você»)
          concordam com o que está escrito aqui.
        </p>
        <p>
          Se você utiliza a plataforma em nome de uma empresa, declara ter
          poderes para vinculá-la a estes termos.
        </p>
      </LegalSection>

      <LegalSection title="2. O que a plataforma faz">
        <p>
          A plataforma centraliza o atendimento de uma empresa aos seus clientes
          pelo WhatsApp. Ela recebe e envia mensagens através da API oficial do
          WhatsApp Business, organiza conversas entre atendentes, mantém
          histórico e disponibiliza indicadores do atendimento.
        </p>
        <p>
          O número de WhatsApp utilizado pertence à empresa contratante. Quando
          a conexão é feita na modalidade que permite uso simultâneo, o número
          permanece ativo no aplicativo WhatsApp Business do celular, e as
          mensagens são espelhadas entre o aplicativo e a plataforma.
        </p>
      </LegalSection>

      <LegalSection title="3. Conta e credenciais">
        <p>
          Cada usuário deve ter credenciais próprias e é responsável por
          mantê-las em sigilo. Contas compartilhadas comprometem o registro de
          auditoria e a rastreabilidade das ações no atendimento.
        </p>
        <p>
          Você é responsável pelas atividades realizadas com suas credenciais e
          deve nos comunicar assim que suspeitar de acesso não autorizado.
          Recomendamos manter a verificação em duas etapas ativa.
        </p>
      </LegalSection>

      <LegalSection title="4. Regras da Meta se aplicam ao seu uso">
        <p>
          O serviço depende da API do WhatsApp Business. Ao utilizá-lo, você
          também se sujeita às políticas da Meta, especialmente à Política de
          Comércio e à Política de Mensagens do WhatsApp Business.
        </p>
        <p>
          O descumprimento dessas políticas pode levar a Meta a limitar,
          suspender ou banir o número da empresa — consequência aplicada por
          ela, sobre a qual não temos ingerência e que não podemos reverter.
        </p>
        <p>
          Na modalidade de uso simultâneo com o aplicativo do celular, a Meta
          impõe limites técnicos próprios, incluindo restrição de velocidade de
          envio e indisponibilidade de recursos como grupos, listas de
          transmissão, chamadas, mensagens temporárias e catálogo.
        </p>
      </LegalSection>

      <LegalSection title="5. Uso adequado">
        <p>Você concorda em não utilizar a plataforma para:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            enviar mensagens não solicitadas a pessoas que não manifestaram
            interesse em receber contato da empresa;
          </li>
          <li>
            transmitir conteúdo ilícito, fraudulento, discriminatório ou que
            viole direitos de terceiros;
          </li>
          <li>se passar por outra pessoa, empresa ou instituição;</li>
          <li>
            tentar contornar limites técnicos, obter acesso não autorizado a
            outras contas ou interferir no funcionamento do serviço.
          </li>
        </ul>
        <p>
          A obtenção de consentimento válido dos contatos para receber mensagens
          é responsabilidade da empresa contratante, que é quem mantém a relação
          com eles.
        </p>
      </LegalSection>

      <LegalSection title="6. Conteúdo e dados">
        <p>
          As mensagens, contatos e demais dados inseridos na plataforma
          pertencem à empresa contratante. Nós os tratamos apenas para operar o
          serviço, conforme descrito na{' '}
          <a
            href="/privacidade"
            className="text-foreground underline underline-offset-4"
          >
            Política de Privacidade
          </a>
          .
        </p>
        <p>
          Encerrado o contrato, os dados são disponibilizados para exportação
          durante prazo acordado entre as partes e, depois disso, eliminados —
          salvo o que precisar ser mantido por obrigação legal.
        </p>
      </LegalSection>

      <LegalSection title="7. Disponibilidade">
        <p>
          Trabalhamos para manter o serviço disponível, mas ele depende de
          terceiros — notadamente a infraestrutura da Meta — e pode sofrer
          interrupções por manutenção, falha de fornecedor ou evento fora do
          nosso controle.
        </p>
        <p>
          Salvo acordo específico de nível de serviço firmado por escrito, a
          plataforma é fornecida sem garantia de disponibilidade ininterrupta.
        </p>
      </LegalSection>

      <LegalSection title="8. Propriedade intelectual">
        <p>
          O software, a marca, a interface e a documentação são de titularidade
          da Matra Tecnologia. O contrato concede à empresa contratante uma
          licença de uso não exclusiva e intransferível durante sua vigência,
          sem transferir a propriedade de qualquer elemento da plataforma.
        </p>
      </LegalSection>

      <LegalSection title="9. Valores e pagamento">
        <p>
          Os valores, a periodicidade e as condições de reajuste são os
          definidos na proposta comercial ou no contrato firmado com a empresa
          contratante. O atraso no pagamento pode levar à suspensão do acesso,
          após comunicação prévia.
        </p>
        <p>
          Custos cobrados diretamente pela Meta pelo envio de mensagens não
          estão incluídos e são de responsabilidade da empresa contratante.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitação de responsabilidade">
        <p>
          Não respondemos por lucros cessantes, perda de oportunidade comercial
          ou danos indiretos decorrentes do uso da plataforma. Também não
          respondemos por decisões da Meta relativas ao número da empresa, nem
          pelo conteúdo das mensagens trocadas entre a empresa e seus contatos.
        </p>
        <p>
          Nada nestes termos afasta responsabilidades que a legislação aplicável
          considere inafastáveis.
        </p>
      </LegalSection>

      <LegalSection title="11. Vigência e encerramento">
        <p>
          Estes termos vigoram enquanto durar o uso da plataforma. Qualquer das
          partes pode encerrar a relação na forma prevista no contrato. Podemos
          suspender o acesso imediatamente em caso de uso que viole a seção 5,
          que coloque em risco a segurança da plataforma ou que ameace a
          manutenção do número junto à Meta.
        </p>
      </LegalSection>

      <LegalSection title="12. Alterações">
        <p>
          Podemos atualizar estes termos para refletir mudanças no serviço ou na
          legislação. A data no topo indica a versão vigente, e alterações
          relevantes serão comunicadas com antecedência razoável pelos canais de
          contato da empresa contratante.
        </p>
      </LegalSection>

      <LegalSection title="13. Lei aplicável e foro">
        <p>
          Aplica-se a lei brasileira. Fica eleito o foro da comarca de
          [PREENCHER] para dirimir controvérsias, com renúncia a qualquer outro,
          por mais privilegiado que seja.
        </p>
      </LegalSection>

      <LegalSection title="14. Contato">
        <p>
          Matra Tecnologia
          <br />
          E-mail:{' '}
          <a
            href="mailto:matratecnologia@gmail.com"
            className="text-foreground underline underline-offset-4"
          >
            matratecnologia@gmail.com
          </a>
          <br />
          WhatsApp: +55 (43) 99914-0409
          <br />
          Site:{' '}
          <a
            href="https://matratecnologia.com"
            className="text-foreground underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            matratecnologia.com
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  )
}

export default TermsPage
