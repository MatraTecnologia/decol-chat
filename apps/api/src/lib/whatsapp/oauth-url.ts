// Sem imports de valor de outro `.ts` de propósito: o runner de teste
// (`node --test`) roda em type stripping nativo e não remapeia um import
// `.js` para o `.ts` companheiro, então este módulo precisa se bastar
// sozinho para ser testável isoladamente. Por isso a versão da Graph API é
// duplicada aqui em vez de importada de `graph-client.ts`.
const GRAPH_API_VERSION = 'v25.0'

export interface TokenExchangeParams {
  appId: string
  appSecret: string
  code: string
}

export const buildTokenExchangeUrl = ({
  appId,
  appSecret,
  code,
}: TokenExchangeParams) => {
  const query = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  })

  return `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?${query}`
}
