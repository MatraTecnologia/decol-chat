import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Como tratamos dados pessoais na plataforma de atendimento via WhatsApp.',
}

const UPDATED_AT = '3 de agosto de 2026'

const Section = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <section className="space-y-3">
    <h2 className="text-foreground text-xl font-semibold tracking-tight">
      {title}
    </h2>
    <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
      {children}
    </div>
  </section>
)

const PrivacyPage = () => {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="mb-12 space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Política de Privacidade
        </h1>
        <p className="text-muted-foreground text-sm">
          Última atualização: {UPDATED_AT}
        </p>
      </header>

      <div className="space-y-10">
        <Section title="1. Quem é o controlador">
          <p>
            Esta plataforma de atendimento via WhatsApp é operada por{' '}
            <strong className="text-foreground">Matra Tecnologia</strong>,
            inscrita no CNPJ nº [PREENCHER], com sede em [PREENCHER].
          </p>
          <p>
            Para qualquer assunto relacionado a dados pessoais, o contato é{' '}
            <a
              href="mailto:matratecnologia@gmail.com"
              className="text-foreground underline underline-offset-4"
            >
              matratecnologia@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. A que esta política se aplica">
          <p>
            A plataforma centraliza o atendimento de uma empresa aos seus
            clientes pelo WhatsApp. Existem duas categorias de pessoas cujos
            dados são tratados, com papéis distintos:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Usuários do painel</strong> —
              atendentes e administradores da empresa contratante, que acessam o
              sistema com login próprio.
            </li>
            <li>
              <strong className="text-foreground">Contatos atendidos</strong> —
              pessoas que conversam com a empresa pelo WhatsApp. Em relação a
              esses dados, a empresa contratante atua como controladora e a
              Matra Tecnologia como operadora, tratando os dados conforme as
              instruções dela.
            </li>
          </ul>
        </Section>

        <Section title="3. Dados que tratamos">
          <p>
            <strong className="text-foreground">De usuários do painel:</strong>{' '}
            nome, e-mail, senha (armazenada apenas como hash), telefone
            (opcional), imagem de perfil, dados de sessão, e registros de
            auditoria contendo endereço IP e identificação do navegador. Quando
            a verificação em duas etapas está ativa, também guardamos os
            segredos necessários para validá-la.
          </p>
          <p>
            <strong className="text-foreground">De contatos atendidos:</strong>{' '}
            número de telefone, nome de perfil exibido no WhatsApp, conteúdo das
            mensagens trocadas (texto, imagens, áudios, vídeos, documentos e
            figurinhas), data e hora, status de envio, entrega e leitura, além
            de anotações e informações complementares que a equipe de
            atendimento registrar.
          </p>
          <p>
            Guardamos também o registro técnico bruto que a Meta nos envia a
            cada evento. Ele é necessário para investigar falhas de entrega e
            inconsistências de sincronização.
          </p>
          <p>
            Não solicitamos nem utilizamos dados sensíveis. Se o contato enviar
            espontaneamente informações dessa natureza no corpo de uma mensagem,
            elas serão armazenadas como parte do histórico da conversa.
          </p>
        </Section>

        <Section title="4. Integração com o WhatsApp e uso simultâneo no celular">
          <p>
            A plataforma se conecta ao número da empresa por meio da API oficial
            do WhatsApp Business, fornecida pela Meta. A conexão é autorizada
            pelo próprio responsável da empresa através do fluxo de cadastro da
            Meta — em nenhum momento pedimos a senha da conta de WhatsApp.
          </p>
          <p>
            A empresa pode manter o mesmo número em uso no aplicativo WhatsApp
            Business do celular. Nessa modalidade:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              mensagens enviadas ou recebidas pelo celular são espelhadas para a
              plataforma, de modo que o histórico fique completo nos dois lados;
            </li>
            <li>
              ao conectar pela primeira vez, a Meta pode transferir os contatos e
              o histórico de conversas já existentes no aplicativo, de até seis
              meses anteriores;
            </li>
            <li>
              a desconexão é feita pelo próprio aplicativo do celular, em
              Configurações → Conta → Plataforma Business.
            </li>
          </ul>
          <p>
            O tratamento desses dados pela Meta segue as políticas dela, sobre as
            quais não temos controle.
          </p>
        </Section>

        <Section title="5. Por que tratamos esses dados">
          <p>
            Tratamos dados para prestar o serviço de atendimento contratado:
            receber e responder mensagens, organizar conversas entre atendentes,
            manter histórico, e permitir que a empresa acompanhe indicadores do
            próprio atendimento. A base legal é a execução do contrato.
          </p>
          <p>
            Registros de acesso, auditoria e segurança são mantidos com
            fundamento no legítimo interesse de proteger a plataforma contra uso
            indevido e de investigar incidentes, e no cumprimento de obrigação
            legal de guarda de registros de aplicação.
          </p>
          <p>
            Não vendemos dados pessoais, não os cedemos para terceiros com
            finalidade publicitária e não usamos o conteúdo das conversas para
            treinar modelos de inteligência artificial.
          </p>
        </Section>

        <Section title="6. Com quem os dados são compartilhados">
          <p>
            Utilizamos prestadores de serviço que atuam como operadores, apenas
            no necessário para o funcionamento da plataforma:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Meta Platforms</strong> —
              transporte das mensagens pela API do WhatsApp Business.
            </li>
            <li>
              <strong className="text-foreground">Cloudflare</strong> —
              armazenamento dos arquivos de mídia trocados nas conversas.
            </li>
            <li>
              <strong className="text-foreground">Resend</strong> — envio de
              e-mails transacionais, como verificação de conta e redefinição de
              senha.
            </li>
            <li>
              <strong className="text-foreground">
                Provedor de infraestrutura
              </strong>{' '}
              — hospedagem do banco de dados e da aplicação.
            </li>
          </ul>
          <p>
            Também podemos compartilhar dados quando houver ordem judicial ou
            requisição de autoridade competente.
          </p>
        </Section>

        <Section title="7. Segurança e prazo de guarda">
          <p>
            As credenciais de integração são armazenadas cifradas. O acesso ao
            painel exige autenticação, com suporte a verificação em duas etapas,
            e a comunicação trafega por canal criptografado. As requisições
            recebidas do WhatsApp são validadas por assinatura, de modo que
            eventos de origem não confirmada são descartados.
          </p>
          <p>
            Conversas e mensagens são mantidas enquanto durar o contrato de
            atendimento. Registros de auditoria são apagados automaticamente após
            noventa dias, e sessões expiradas são removidas diariamente. Após o
            encerramento do contrato, os dados são eliminados ou devolvidos à
            empresa contratante, salvo o que precisar ser retido por obrigação
            legal.
          </p>
        </Section>

        <Section title="8. Direitos de quem tem os dados tratados">
          <p>
            A legislação brasileira de proteção de dados assegura o direito de
            confirmar a existência de tratamento, acessar os dados, corrigir
            informações incompletas ou desatualizadas, solicitar anonimização,
            bloqueio ou eliminação, pedir portabilidade, obter informação sobre
            compartilhamentos e revogar consentimento.
          </p>
          <p>
            Pedidos podem ser enviados para{' '}
            <a
              href="mailto:matratecnologia@gmail.com"
              className="text-foreground underline underline-offset-4"
            >
              matratecnologia@gmail.com
            </a>
            . Quando a solicitação envolver conversas de atendimento, ela será
            encaminhada à empresa contratante, que é a controladora desses dados.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            Utilizamos cookies estritamente necessários para manter a sessão de
            quem faz login e para lembrar preferências de interface, como o tema
            escolhido. Não usamos cookies de publicidade nem de rastreamento
            entre sites.
          </p>
        </Section>

        <Section title="10. Transferência internacional">
          <p>
            Alguns dos prestadores citados processam dados fora do Brasil. Nesses
            casos, a transferência ocorre com as garantias previstas na
            legislação aplicável, por meio de cláusulas contratuais firmadas com
            cada fornecedor.
          </p>
        </Section>

        <Section title="11. Menores de idade">
          <p>
            A plataforma é destinada ao uso profissional e não se dirige a
            menores de dezoito anos. Não coletamos intencionalmente dados de
            crianças e adolescentes.
          </p>
        </Section>

        <Section title="12. Mudanças nesta política">
          <p>
            Podemos atualizar este documento para refletir alterações no serviço
            ou na legislação. A data de última atualização no topo da página
            indica a versão vigente. Mudanças relevantes serão comunicadas pelos
            canais de contato da empresa contratante.
          </p>
        </Section>

        <Section title="13. Contato">
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
        </Section>
      </div>
    </main>
  )
}

export default PrivacyPage
