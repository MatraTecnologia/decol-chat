import { env } from '@/env.js'

import { GRAPH_API_VERSION, GraphApiError } from './graph-client.js'

const REQUEST_TIMEOUT_MS = 15_000

interface TokenExchangeParams {
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

interface TokenResponse {
  access_token?: string
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; type?: string }
}

/**
 * O `code` do Embedded Signup é de uso único e curta duração — falhar aqui
 * significa refazer o fluxo no browser, então o erro precisa chegar ao usuário
 * com a mensagem original da Meta.
 */
export const exchangeCodeForToken = async (code: string) => {
  const appId = env.META_APP_ID
  const appSecret = env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new GraphApiError(
      'META_APP_ID e META_APP_SECRET precisam estar configuradas para usar o Embedded Signup.',
      { status: 500 },
    )
  }

  let response: Response

  try {
    response = await fetch(buildTokenExchangeUrl({ appId, appSecret, code }), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new GraphApiError(
      error instanceof Error ? error.message : 'Falha ao contatar a Graph API.',
      { status: 502 },
    )
  }

  const body = (await response.json().catch(() => null)) as
    | (TokenResponse & GraphErrorBody)
    | null

  if (!response.ok) {
    throw new GraphApiError(body?.error?.message ?? response.statusText, {
      status: response.status,
      code: body?.error?.code,
      type: body?.error?.type,
    })
  }

  if (!body?.access_token) {
    throw new GraphApiError(
      'A Meta respondeu sem `access_token` na troca do código.',
      { status: 502 },
    )
  }

  return body.access_token
}
