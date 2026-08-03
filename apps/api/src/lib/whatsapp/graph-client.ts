import type { MetaRecord, MetaTemplatePage } from './template-payload.js'

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

export const listSubscribedApps = (token: string, wabaId: string) =>
  request<{
    data: { whatsapp_business_api_data?: { id?: string; name?: string } }[]
  }>(`/${wabaId}/subscribed_apps`, { headers: authHeaders(token) })

export const subscribeApp = (token: string, wabaId: string) =>
  request<{ success: boolean }>(`/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: authHeaders(token),
  })

export type SmbSyncType = 'smb_app_state_sync' | 'history'

/**
 * Pede à Meta o envio dos dados do app do celular (contatos e histórico). A
 * resposta é só o aceite — os dados chegam depois, pelos webhooks `history` e
 * `smb_app_state_sync`.
 */
export const requestSmbAppData = (
  token: string,
  phoneNumberId: string,
  syncType: SmbSyncType,
) =>
  request<{ success: boolean }>(`/${phoneNumberId}/smb_app_data`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: syncType }),
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
//
// `components` é opcional: template sem variável não manda a chave, e
// `JSON.stringify` a omite quando vem `undefined`.
export const sendTemplateMessage = (
  token: string,
  phoneNumberId: string,
  to: string,
  templateName: string,
  languageCode: string,
  components?: MetaRecord[],
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
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components?.length ? { components } : {}),
      },
    }),
  })

// ── Templates ──────────────────────────────────────────
//
// O token viaja só no header `Authorization`: nada aqui pode cair na query
// string, senão vaza no log do proxy e na mensagem de erro da Meta.

const TEMPLATE_FIELDS = [
  'id',
  'name',
  'language',
  'status',
  'category',
  'quality_score',
  'rejected_reason',
  'components',
  'parameter_format',
  'last_updated_time',
].join(',')

/** Uma página por chamada — quem sincroniza segue o `paging.cursors.after`
 * até ele sumir. */
export const listMessageTemplates = (
  token: string,
  wabaId: string,
  after?: string,
) => {
  const query = new URLSearchParams({
    fields: TEMPLATE_FIELDS,
    limit: '100',
    ...(after ? { after } : {}),
  })

  return request<MetaTemplatePage>(`/${wabaId}/message_templates?${query}`, {
    headers: authHeaders(token),
  })
}

export interface MessageTemplateMutationResult {
  id?: string
  status?: string
  category?: string
  success?: boolean
}

export const createMessageTemplate = (
  token: string,
  wabaId: string,
  payload: MetaRecord,
) =>
  request<MessageTemplateMutationResult>(`/${wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

/** A Meta só aceita editar `components` e `category` — nome e idioma são
 * imutáveis depois de criado. */
export const updateMessageTemplate = (
  token: string,
  metaTemplateId: string,
  payload: MetaRecord,
) =>
  request<MessageTemplateMutationResult>(`/${metaTemplateId}`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

// ── Upload resumable (mídia de exemplo do template) ────
//
// Dois passos: a sessão é aberta no app (`appId`), e só então o binário sobe.
// O envio do binário usa o esquema `OAuth`, não `Bearer` — com `Bearer` a Meta
// responde 401 mesmo com o token certo.

export interface UploadSession {
  id: string
}

export const createUploadSession = (
  token: string,
  appId: string,
  file: { fileName: string; fileLength: number; fileType: string },
) => {
  const query = new URLSearchParams({
    file_name: file.fileName,
    file_length: String(file.fileLength),
    file_type: file.fileType,
  })

  return request<UploadSession>(`/${appId}/uploads?${query}`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

/** `h` é o handle que vai no `header_handle` do componente da mídia. */
export const uploadSessionFile = (
  token: string,
  uploadSessionId: string,
  body: Buffer,
  offset = 0,
) =>
  request<{ h: string }>(`/${uploadSessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${token}`,
      file_offset: String(offset),
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(body),
  })

/** Sem `hsm_id` a Meta apaga o template em todos os idiomas — sempre passe o
 * id do template quando ele for conhecido. */
export const deleteMessageTemplate = (
  token: string,
  wabaId: string,
  name: string,
  metaTemplateId?: string | null,
) => {
  const query = new URLSearchParams({
    name,
    ...(metaTemplateId ? { hsm_id: metaTemplateId } : {}),
  })

  return request<{ success: boolean }>(
    `/${wabaId}/message_templates?${query}`,
    { method: 'DELETE', headers: authHeaders(token) },
  )
}
