export const GRAPH_API_VERSION = 'v25.0'

const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`
const REQUEST_TIMEOUT_MS = 15_000

interface GraphApiErrorOptions {
  status: number
  code?: number
  type?: string
  fbtraceId?: string
}

export class GraphApiError extends Error {
  status: number
  code?: number
  type?: string
  fbtraceId?: string

  constructor(message: string, options: GraphApiErrorOptions) {
    super(message)
    this.name = 'GraphApiError'
    this.status = options.status
    this.code = options.code
    this.type = options.type
    this.fbtraceId = options.fbtraceId
  }
}

interface GraphErrorBody {
  error?: {
    message?: string
    code?: number
    type?: string
    fbtrace_id?: string
  }
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response

  try {
    response = await fetch(`${GRAPH_BASE_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new GraphApiError(
      error instanceof Error ? error.message : 'Falha ao contatar a Graph API.',
      { status: 502 },
    )
  }

  if (!response.ok) {
    // Um proxy no caminho pode devolver HTML em vez do JSON de erro da Meta.
    const body = (await response
      .json()
      .catch(() => null)) as GraphErrorBody | null
    const error = body?.error

    throw new GraphApiError(error?.message ?? response.statusText, {
      status: response.status,
      code: error?.code,
      type: error?.type,
      fbtraceId: error?.fbtrace_id,
    })
  }

  return response.json() as Promise<T>
}

interface PhoneNumberInfo {
  id: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
  messaging_limit_tier?: string
}

export const getPhoneNumberInfo = (token: string, phoneNumberId: string) =>
  request<PhoneNumberInfo>(
    `/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`,
    { headers: authHeaders(token) },
  )

export interface PhoneNumberEntry {
  id: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
  platform_type?: string
  code_verification_status?: string
}

export const listPhoneNumbers = (token: string, wabaId: string) =>
  request<{ data: PhoneNumberEntry[] }>(
    `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,platform_type,code_verification_status`,
    { headers: authHeaders(token) },
  )

// Sem o register o número fica com platform_type NOT_APPLICABLE e todo envio falha com 133010.
export const registerPhoneNumber = (
  token: string,
  phoneNumberId: string,
  pin: string,
) =>
  request<{ success: boolean }>(`/${phoneNumberId}/register`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
  })

export const listSubscribedApps = (token: string, wabaId: string) =>
  request<{
    data: { whatsapp_business_api_data?: { id?: string; name?: string } }[]
  }>(`/${wabaId}/subscribed_apps`, { headers: authHeaders(token) })

export const subscribeApp = (token: string, wabaId: string) =>
  request<{ success: boolean }>(`/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: authHeaders(token),
  })

// Este endpoint exige o app access token — o literal `appId|appSecret` como
// query param, não o token de usuário em header Authorization.
export const getAppSubscriptions = (appId: string, appSecret: string) => {
  const query = new URLSearchParams({ access_token: `${appId}|${appSecret}` })

  return request<{
    data: { object: string; active?: boolean; fields?: { name: string }[] }[]
  }>(`/${appId}/subscriptions?${query}`)
}

/**
 * `contacts[].wa_id` é o identificador canônico da Meta para o destinatário —
 * é ele que volta no webhook, e para celular BR costuma vir sem o nono dígito
 * do `input`. Quem cria contato a partir de um envio deve gravar esse valor.
 */
export interface SendMessageResult {
  contacts?: { input?: string; wa_id?: string }[]
  messages: { id: string }[]
}

export const sendTextMessage = (
  token: string,
  phoneNumberId: string,
  to: string,
  text: string,
) =>
  request<SendMessageResult>(`/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    }),
  })

// Texto livre só é aceito dentro da janela de 24h aberta pelo destinatário.
// Fora dela a Meta responde 131047 — template é o único caminho.
export const sendTemplateMessage = (
  token: string,
  phoneNumberId: string,
  to: string,
  templateName: string,
  languageCode: string,
) =>
  request<SendMessageResult>(`/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: { name: templateName, language: { code: languageCode } },
    }),
  })
