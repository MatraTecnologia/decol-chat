export const GRAPH_API_VERSION = 'v23.0'

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

export const sendTextMessage = (
  token: string,
  phoneNumberId: string,
  to: string,
  text: string,
) =>
  request<{ messages: { id: string }[] }>(`/${phoneNumberId}/messages`, {
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
