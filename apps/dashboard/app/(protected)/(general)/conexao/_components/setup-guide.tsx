'use client'

import { TriangleAlert } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@workspace/ui/components/accordion'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/alert'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import { Separator } from '@workspace/ui/components/separator'

import { cn } from '@workspace/ui/lib/utils'

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
    {children}
  </code>
)

const Cmd = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <pre
    className={cn(
      'bg-muted text-foreground overflow-x-auto rounded-md px-3 py-2 font-mono text-xs',
      className,
    )}
  >
    {children}
  </pre>
)

const DocLink = ({ href, children }: { href: string; children: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="underline underline-offset-4"
  >
    {children}
  </a>
)

interface Step {
  value: string
  title: string
  content: React.ReactNode
}

const steps: Step[] = [
  {
    value: 'app',
    title: '1. Criar o app na Meta e adicionar o produto WhatsApp',
    content: (
      <>
        <p>
          Em{' '}
          <DocLink href="https://developers.facebook.com/apps">
            developers.facebook.com/apps
          </DocLink>{' '}
          crie um app do tipo <strong>Business</strong> (Negócios). Os outros
          tipos não oferecem o produto WhatsApp. Durante a criação, vincule o app
          a um <strong>Meta Business Account</strong> — sem essa vinculação o
          token de system user não consegue acessar a WABA depois.
        </p>
        <p>
          Com o app criado, na tela de produtos escolha <strong>WhatsApp</strong>{' '}
          → <em>Configurar</em>. A Meta provisiona automaticamente uma WhatsApp
          Business Account de teste e um número de teste, suficientes para toda a
          validação desta página.
        </p>
        <p className="text-muted-foreground">
          Referência:{' '}
          <DocLink href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started">
            Cloud API — Get Started
          </DocLink>
        </p>
      </>
    ),
  },
  {
    value: 'ids',
    title: '2. Obter o Phone Number ID e o WABA ID',
    content: (
      <>
        <p>
          No painel do app, vá em <strong>WhatsApp → Configuração da API</strong>
          . O bloco &quot;Enviar e receber mensagens&quot; mostra os dois
          identificadores:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Identificação do número de telefone</strong> — é o{' '}
            <Code>phone_number_id</Code>. É esse valor (não o número em si) que
            entra em todas as chamadas de envio.
          </li>
          <li>
            <strong>Identificação da conta do WhatsApp Business</strong> — é o{' '}
            <Code>waba_id</Code>, usado para gerenciar templates e assinaturas de
            webhook.
          </li>
        </ul>
        <p>
          Ambos são numéricos e longos. Não confunda com o{' '}
          <strong>App ID</strong>, que aparece no topo do painel e não serve
          aqui.
        </p>
      </>
    ),
  },
  {
    value: 'token',
    title: '3. Gerar um System User Token permanente',
    content: (
      <>
        <p>
          O token exibido na tela de configuração da API expira em{' '}
          <strong>24 horas</strong> — serve só para o primeiro teste. Para um
          token permanente, use um system user.
        </p>
        <p>
          Em{' '}
          <DocLink href="https://business.facebook.com/settings/system-users">
            Configurações do negócio → Usuários do sistema
          </DocLink>
          :
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            Crie um system user com função <strong>Administrador</strong>.
          </li>
          <li>
            Em <strong>Adicionar ativos</strong>, conceda a ele o{' '}
            <strong>app</strong> e a <strong>WhatsApp Business Account</strong>{' '}
            com controle total. Sem os dois ativos, o token autentica mas retorna{' '}
            <Code>(#200) permissions error</Code>.
          </li>
          <li>
            Clique em <strong>Gerar token</strong>, selecione o app e marque as
            permissões <Code>whatsapp_business_messaging</Code> e{' '}
            <Code>whatsapp_business_management</Code>. Escolha expiração{' '}
            <strong>Nunca</strong>.
          </li>
        </ul>
        <p>
          O token só é exibido uma vez — copie-o direto para o campo de
          credenciais desta página.
        </p>
        <p className="text-muted-foreground">
          Referência:{' '}
          <DocLink href="https://developers.facebook.com/docs/whatsapp/business-management-api/get-started">
            Business Management API — Get Started
          </DocLink>
        </p>
      </>
    ),
  },
  {
    value: 'secret',
    title: '4. Copiar o App Secret',
    content: (
      <>
        <p>
          No painel do app, <strong>Configurações → Básico</strong>, campo{' '}
          <strong>Chave secreta do app</strong> → <em>Mostrar</em>.
        </p>
        <p>
          O app secret não é usado para enviar mensagens: ele é a chave do HMAC{' '}
          <Code>X-Hub-Signature-256</Code> que valida cada evento recebido no
          webhook. Sem ele, todo evento entrante é rejeitado com 401 — a
          assinatura é a única autenticação do webhook, já que a Meta não envia
          cookie de sessão.
        </p>
        <p className="text-muted-foreground">
          Referência:{' '}
          <DocLink href="https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads">
            Validando payloads de webhook
          </DocLink>
        </p>
      </>
    ),
  },
  {
    value: 'tunnel',
    title: '5. Expor a API por HTTPS público (obrigatório em desenvolvimento)',
    content: (
      <>
        <p>
          A Meta faz a requisição de fora da sua rede. <Code>localhost:3333</Code>{' '}
          é inalcançável para ela, então sem um túnel nada funciona: nem o
          handshake de verificação, nem a ingestão de eventos, nem o status de
          entrega da mensagem de teste.
        </p>
        <p>Suba um dos dois, com a API já rodando na porta 3333:</p>
        <Cmd>ngrok http 3333</Cmd>
        <Cmd>cloudflared tunnel --url http://localhost:3333</Cmd>
        <p>
          Copie a origem HTTPS gerada (ex.:{' '}
          <Code>https://a1b2c3d4.ngrok-free.app</Code>) e cole no campo{' '}
          <strong>Webhook Base URL</strong>, no formulário de{' '}
          <strong>Credenciais</strong> desta página. A URL final do callback vira{' '}
          <Code>&lt;origem&gt;/webhooks/whatsapp</Code>.
        </p>
        <p>
          A URL do ngrok gratuito muda a cada reinício do túnel — por isso o
          override existe na página em vez de exigir edição do{' '}
          <Code>.env</Code> e restart da API. Ao trocar de túnel, atualize o
          campo <strong>e</strong> a Callback URL no App Dashboard da Meta.
        </p>
        <p className="text-muted-foreground">
          Documentação:{' '}
          <DocLink href="https://ngrok.com/docs/getting-started/">ngrok</DocLink>{' '}
          ·{' '}
          <DocLink href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/">
            cloudflared (TryCloudflare)
          </DocLink>
        </p>
      </>
    ),
  },
  {
    value: 'webhook',
    title: '6. Configurar o webhook no App Dashboard',
    content: (
      <>
        <p>
          No painel do app, <strong>WhatsApp → Configuração</strong>, bloco
          Webhook → <strong>Editar</strong>. Preencha com os valores exibidos na
          seção Webhook desta página:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>URL de callback</strong> — a URL completa terminada em{' '}
            <Code>/webhooks/whatsapp</Code>.
          </li>
          <li>
            <strong>Token de verificação</strong> — exatamente o verify token
            mostrado na página. Qualquer divergência resulta em 403 e a Meta
            recusa salvar.
          </li>
        </ul>
        <p>
          Ao clicar em <strong>Verificar e salvar</strong>, a Meta faz um{' '}
          <Code>GET</Code> com <Code>hub.challenge</Code>. O handshake aparece no
          console como <Code>inbound_verify</Code> — se não aparecer, o problema é
          o túnel, não as credenciais.
        </p>
        <p>
          Com o webhook salvo, clique em <strong>Gerenciar</strong> e assine o
          campo <Code>messages</Code>. É ele que entrega tanto as mensagens
          recebidas quanto os status de entrega (<Code>sent</Code>,{' '}
          <Code>delivered</Code>, <Code>read</Code>). Sem essa assinatura o
          webhook fica verificado, porém mudo.
        </p>
        <p className="text-muted-foreground">
          Referência:{' '}
          <DocLink href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks">
            Cloud API — Set up Webhooks
          </DocLink>
        </p>
      </>
    ),
  },
  {
    value: 'test',
    title: '7. Provar o ciclo completo',
    content: (
      <>
        <p>
          Salve as credenciais e confira o status: nome exibido, número e
          qualidade devem aparecer. Em seguida use{' '}
          <strong>Mensagem de teste</strong> para enviar um texto ao seu número.
        </p>
        <p>
          Fora de uma janela de atendimento de 24 horas a Meta só entrega{' '}
          <strong>templates aprovados</strong>. Para o primeiro teste, mande uma
          mensagem qualquer do seu celular para o número do WhatsApp Business —
          isso abre a janela e libera o envio de texto livre.
        </p>
        <p>No console você deve ver, em ordem:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <Code>outbound</Code> — nossa chamada à Graph API, com o{' '}
            <Code>wamid</Code> retornado.
          </li>
          <li>
            <Code>inbound_event</Code> — status <Code>sent</Code>, depois{' '}
            <Code>delivered</Code> e <Code>read</Code>, com o mesmo{' '}
            <Code>wamid</Code>.
          </li>
        </ul>
        <p>
          Ver as duas pontas do mesmo <Code>wamid</Code> é o que prova a
          integração. Para confirmar que a validação de assinatura está de fato
          ligada, adultere o app secret e envie outro evento: ele precisa
          aparecer com <Code>signatureValid: false</Code> e a rota responder 401.
        </p>
        <p className="text-muted-foreground">
          Referência:{' '}
          <DocLink href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages">
            Cloud API — Send Messages
          </DocLink>
        </p>
      </>
    ),
  },
]

const troubleshooting: Step[] = [
  {
    value: 'err-133010',
    title: '(#133010) Account not registered',
    content: (
      <>
        <p>
          O número existe na WABA mas nunca foi vinculado à Cloud API. Confirme
          listando os números da conta e olhando o campo{' '}
          <Code>platform_type</Code> — se vier <Code>NOT_APPLICABLE</Code>, é
          exatamente isso:
        </p>
        <Cmd>{`GET https://graph.facebook.com/v25.0/<WABA_ID>/phone_numbers?access_token=<TOKEN>`}</Cmd>
        <p>
          A correção é registrar o número na Cloud API. O <Code>pin</Code> são 6
          dígitos e, se o número nunca teve PIN de verificação em duas etapas,
          esta chamada <strong>define</strong> esse PIN — anote o valor usado:
        </p>
        <Cmd>{`POST https://graph.facebook.com/v25.0/<PHONE_NUMBER_ID>/register
{ "messaging_product": "whatsapp", "pin": "123456" }`}</Cmd>
        <p>
          Exige token com a permissão <Code>whatsapp_business_management</Code>{' '}
          (passo 3). Depois do registro, <Code>platform_type</Code> passa a{' '}
          <Code>CLOUD_API</Code> e o envio funciona.
        </p>
      </>
    ),
  },
  {
    value: 'err-131030',
    title: '(#131030) Recipient phone number not in allowed list',
    content: (
      <>
        <p>
          Acontece somente com <strong>número de teste</strong>, que envia apenas
          para destinatários pré-autorizados — no máximo <strong>5</strong>. Se o
          erro aparece, você ainda está no número de teste provisionado pela
          Meta.
        </p>
        <p>
          Adicione o destinatário em{' '}
          <strong>WhatsApp → Configuração da API</strong>, campo{' '}
          <strong>Para</strong> →{' '}
          <strong>Gerenciar lista de números de telefone</strong>. A Meta envia um
          código de confirmação por WhatsApp para o número adicionado; sem
          confirmar esse código ele não entra na lista.
        </p>
      </>
    ),
  },
  {
    value: 'err-131047',
    title: '(#131047) API respondeu 200 com wamid e a mensagem nunca chegou',
    content: (
      <>
        <p>
          O caso mais traiçoeiro: o envio retorna <Code>200</Code> com um{' '}
          <Code>wamid</Code>, o console registra <Code>outbound</Code> e nada
          chega ao destinatário.
        </p>
        <p>
          Motivo: <strong>texto livre só é aceito dentro da janela de 24h</strong>{' '}
          aberta pelo destinatário (passo 7). Se ele nunca escreveu para o seu
          número, a janela está fechada e a mensagem é descartada depois de
          aceita.
        </p>
        <p>Duas saídas:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            Peça ao destinatário que mande qualquer mensagem para o seu número —
            isso abre a janela por 24h e libera texto livre.
          </li>
          <li>
            Envie um <strong>template aprovado</strong>. O{' '}
            <Code>hello_world</Code> em <Code>en_US</Code> já existe em toda
            conta, e o formulário de <strong>Mensagem de teste</strong> desta
            página tem um modo Template para isso.
          </li>
        </ul>
      </>
    ),
  },
  {
    value: 'webhook-mudo',
    title: 'Webhook verificado, mas só os eventos do botão Testar chegam',
    content: (
      <>
        <p>
          Handshake OK, o botão <strong>Testar</strong> do App Dashboard entrega
          eventos no console e mesmo assim nenhum evento real aparece: o app não
          está inscrito no campo <Code>messages</Code> da WABA.
        </p>
        <p>Confira a inscrição:</p>
        <Cmd>{`GET https://graph.facebook.com/v25.0/<WABA_ID>/subscribed_apps?access_token=<TOKEN>`}</Cmd>
        <p>
          Se a resposta vier com <Code>data: []</Code>, inscreva o app:
        </p>
        <Cmd>{`POST https://graph.facebook.com/v25.0/<WABA_ID>/subscribed_apps`}</Cmd>
        <p>
          E marque o checkbox do campo <Code>messages</Code> em{' '}
          <strong>WhatsApp → Configuração → Webhook → Gerenciar</strong> (passo
          6). É esse campo que entrega tanto as mensagens recebidas quanto os
          status de entrega — vêm os dois ou não vem nenhum.
        </p>
      </>
    ),
  },
  {
    value: 'status-entrega',
    title: 'wamid não é confirmação de entrega',
    content: (
      <>
        <p>
          A resposta do envio devolve um <Code>wamid</Code>, o que significa
          apenas <strong>aceito para processamento</strong>. Não é entrega.
        </p>
        <p>
          O status real — <Code>sent</Code>, <Code>delivered</Code>,{' '}
          <Code>read</Code>, <Code>failed</Code> — chega exclusivamente pelo
          webhook.{' '}
          <strong>
            Não existe endpoint para consultar o status de uma mensagem
          </strong>
          : sem o campo <Code>messages</Code> assinado, você fica sem qualquer
          visibilidade de entrega.
        </p>
      </>
    ),
  },
  {
    value: 'nono-digito',
    title: 'Números brasileiros: o nono dígito some na resposta',
    content: (
      <>
        <p>
          A Meta normaliza números brasileiros. Um envio para{' '}
          <Code>5543998414904</Code> retorna <Code>wa_id</Code>{' '}
          <Code>554398414904</Code>, <strong>sem o nono dígito</strong>.
        </p>
        <p>
          Ao correlacionar mensagens por número, guarde o <Code>wa_id</Code>{' '}
          devolvido pela API, nunca o número que você enviou — senão o{' '}
          <Code>wa_id</Code> que volta no webhook nunca bate com o registro
          local.
        </p>
      </>
    ),
  },
]

export const SetupGuide = () => {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Manual de configuração</CardTitle>
        <CardDescription>
          Passo a passo para conectar um número da WhatsApp Cloud API a esta
          instalação, do app na Meta até o status de entrega chegando no console
          — mais os erros que aparecem no caminho.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Túnel HTTPS obrigatório em dev</AlertTitle>
          <AlertDescription>
            <p>
              A Meta precisa alcançar o webhook por HTTPS público.{' '}
              <Code>localhost</Code> e <Code>127.0.0.1</Code> não funcionam — sem
              túnel, nem o handshake de verificação passa.
            </p>
            <Cmd className="w-full">ngrok http 3333</Cmd>
            <Cmd className="w-full">
              cloudflared tunnel --url http://localhost:3333
            </Cmd>
            <p>
              Cole a origem HTTPS gerada no campo <strong>Webhook Base URL</strong>
              , no formulário de Credenciais acima. Detalhes no passo 5.
            </p>
          </AlertDescription>
        </Alert>

        <Accordion type="multiple" defaultValue={['app']} className="w-full">
          {steps.map(step => (
            <AccordionItem key={step.value} value={step.value}>
              <AccordionTrigger>{step.title}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
                {step.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Separator />

        <div className="space-y-1">
          <h3 className="text-base font-semibold">Solução de problemas</h3>
          <p className="text-muted-foreground text-sm">
            Erros da Meta encontrados na configuração real, com o diagnóstico e a
            chamada que resolveu cada um.
          </p>
        </div>

        <Accordion type="multiple" className="w-full">
          {troubleshooting.map(item => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger>{item.title}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
                {item.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
