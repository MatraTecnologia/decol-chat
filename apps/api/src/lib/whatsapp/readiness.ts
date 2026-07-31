import {
  getConnection,
  resolveWebhookUrl,
  type DecryptedConnection,
} from './connection.js'
import { isEncryptionConfigured } from './crypto.js'
import {
  GraphApiError,
  getAppSubscriptions,
  getPhoneNumberInfo,
  listPhoneNumbers,
  listSubscribedApps,
  type PhoneNumberEntry,
} from './graph-client.js'
import { listWebhookLogs } from './webhook-log.js'

export type ReadinessStatus = 'ok' | 'pending' | 'error' | 'skipped'

export type ReadinessAction =
  'register_number' | 'subscribe_app' | 'select_number' | null

export interface ReadinessCheck {
  id: string
  label: string
  status: ReadinessStatus
  detail: string
  action: ReadinessAction
}

const LABELS = {
  encryption: 'Chave de criptografia',
  credentials: 'Credenciais salvas',
  token: 'Token válido',
  phone_number: 'Phone Number ID confere',
  phone_registered: 'Número na Cloud API',
  app_subscribed: 'App inscrito no WABA',
  messages_field: 'Campo messages assinado',
  webhook_verified: 'Handshake do webhook',
  webhook_receiving: 'Eventos chegando',
} as const

type CheckId = keyof typeof LABELS

const CHECK_ORDER = Object.keys(LABELS) as CheckId[]

const check = (
  id: CheckId,
  status: ReadinessStatus,
  detail: string,
  action: ReadinessAction = null,
): ReadinessCheck => ({ id, label: LABELS[id], status, detail, action })

const skipFrom = (id: CheckId, detail: string) =>
  CHECK_ORDER.slice(CHECK_ORDER.indexOf(id)).map(next =>
    check(next, 'skipped', detail),
  )

// A mensagem crua da Meta (com o código) é o dado mais útil para quem depura.
const describeError = (error: unknown) => {
  if (error instanceof GraphApiError) {
    return error.code
      ? `${error.message} (código ${error.code})`
      : error.message
  }

  return error instanceof Error ? error.message : String(error)
}

export const runReadinessChecks = async (): Promise<ReadinessCheck[]> => {
  if (!isEncryptionConfigured()) {
    return [
      check(
        'encryption',
        'error',
        'WHATSAPP_ENCRYPTION_KEY ausente — gere 32 bytes em base64, defina a env e reinicie a API.',
      ),
      ...skipFrom(
        'credentials',
        'Depende da WHATSAPP_ENCRYPTION_KEY estar configurada.',
      ),
    ]
  }

  const checks = [
    check('encryption', 'ok', 'WHATSAPP_ENCRYPTION_KEY configurada.'),
  ]

  let connection: DecryptedConnection | null

  try {
    connection = await getConnection()
  } catch (error) {
    // Chave rotacionada: os segredos existem mas não decifram mais.
    return [
      ...checks,
      check('credentials', 'error', describeError(error)),
      ...skipFrom('token', 'Depende de ler as credenciais salvas.'),
    ]
  }

  if (!connection) {
    return [
      ...checks,
      check(
        'credentials',
        'pending',
        'Nenhuma conexão salva — preencha token, app secret, Phone Number ID e WABA ID no formulário e salve.',
      ),
      ...skipFrom('token', 'Depende das credenciais salvas.'),
    ]
  }

  const { accessToken, appSecret, appId, phoneNumberId, wabaId } = connection

  checks.push(
    check(
      'credentials',
      'ok',
      `Conexão salva para o Phone Number ID ${phoneNumberId} no WABA ${wabaId}.`,
    ),
  )

  try {
    const info = await getPhoneNumberInfo(accessToken, phoneNumberId)

    checks.push(
      check(
        'token',
        'ok',
        `Token aceito pela Graph API — ${info.verified_name ?? 'número'} (${info.display_phone_number ?? phoneNumberId}).`,
      ),
    )
  } catch (error) {
    checks.push(
      check(
        'token',
        'error',
        `A Graph API recusou a consulta ao número: ${describeError(error)}`,
      ),
    )
  }

  let entry: PhoneNumberEntry | undefined

  try {
    const { data } = await listPhoneNumbers(accessToken, wabaId)

    entry = data.find(item => item.id === phoneNumberId)

    if (entry) {
      checks.push(
        check(
          'phone_number',
          'ok',
          `O Phone Number ID salvo é o número ${entry.display_phone_number ?? 'sem display'} do WABA ${wabaId}.`,
        ),
      )
    } else if (data.length) {
      const available = data
        .map(
          item => `${item.id} (${item.display_phone_number ?? 'sem display'})`,
        )
        .join(', ')

      checks.push(
        check(
          'phone_number',
          'error',
          `O Phone Number ID salvo não existe no WABA ${wabaId} — confirme que não colou o WABA ID no lugar. Números do WABA: ${available}.`,
          'select_number',
        ),
      )
    } else {
      checks.push(
        check(
          'phone_number',
          'error',
          `O WABA ${wabaId} não tem nenhum número — confirme o WABA ID em WhatsApp → API Setup no App Dashboard.`,
        ),
      )
    }
  } catch (error) {
    checks.push(
      check(
        'phone_number',
        'error',
        `Não foi possível listar os números do WABA ${wabaId}: ${describeError(error)}`,
      ),
    )
  }

  if (!entry) {
    checks.push(
      check(
        'phone_registered',
        'skipped',
        'Depende de localizar o Phone Number ID na lista de números do WABA.',
      ),
    )
  } else if (entry.platform_type === 'CLOUD_API') {
    checks.push(
      check(
        'phone_registered',
        'ok',
        'Número registrado na Cloud API (platform_type CLOUD_API).',
      ),
    )
  } else {
    checks.push(
      check(
        'phone_registered',
        'error',
        `platform_type é ${entry.platform_type ?? 'desconhecido'} — o número ainda não foi registrado na Cloud API e todo envio falha com 133010. Registre-o com um PIN de 6 dígitos.`,
        'register_number',
      ),
    )
  }

  try {
    const { data } = await listSubscribedApps(accessToken, wabaId)

    if (data.length) {
      const apps = data
        .map(
          item =>
            item.whatsapp_business_api_data?.name ??
            item.whatsapp_business_api_data?.id ??
            'app sem nome',
        )
        .join(', ')

      checks.push(check('app_subscribed', 'ok', `WABA assinado por: ${apps}.`))
    } else {
      checks.push(
        check(
          'app_subscribed',
          'error',
          `Nenhum app inscrito no WABA ${wabaId} — o webhook pode estar verificado e mesmo assim nenhum evento chega. Assine o app neste WABA.`,
          'subscribe_app',
        ),
      )
    }
  } catch (error) {
    checks.push(
      check(
        'app_subscribed',
        'error',
        `Não foi possível ler os apps inscritos no WABA ${wabaId}: ${describeError(error)}`,
      ),
    )
  }

  if (!appId) {
    checks.push(
      check(
        'messages_field',
        'skipped',
        'Depende do App ID — salve-o nas credenciais para conferir os campos assinados pelo app.',
      ),
    )
  } else {
    try {
      const { data } = await getAppSubscriptions(appId, appSecret)

      const waba = data.find(
        item => item.object === 'whatsapp_business_account',
      )
      const fields = waba?.fields?.map(field => field.name) ?? []

      if (fields.includes('messages')) {
        checks.push(
          check(
            'messages_field',
            'ok',
            'Campo messages assinado no objeto whatsapp_business_account.',
          ),
        )
      } else if (waba) {
        checks.push(
          check(
            'messages_field',
            'error',
            `O app assina whatsapp_business_account sem o campo messages${fields.length ? ` (assinados: ${fields.join(', ')})` : ''} — marque messages em Webhooks no App Dashboard.`,
          ),
        )
      } else {
        checks.push(
          check(
            'messages_field',
            'error',
            'O app não assina o objeto whatsapp_business_account — configure o webhook em Webhooks → WhatsApp Business Account no App Dashboard.',
          ),
        )
      }
    } catch (error) {
      checks.push(
        check(
          'messages_field',
          'error',
          `Não foi possível ler as assinaturas do app ${appId}: ${describeError(error)}`,
        ),
      )
    }
  }

  const logs = await listWebhookLogs()
  const hasLog = (direction: 'inbound_verify' | 'inbound_event') =>
    logs.some(log => log.direction === direction && log.signatureValid === true)

  checks.push(
    hasLog('inbound_verify')
      ? check(
          'webhook_verified',
          'ok',
          'Handshake de verificação recebido da Meta.',
        )
      : check(
          'webhook_verified',
          'pending',
          `Nenhum handshake registrado nas últimas 24h — cadastre ${resolveWebhookUrl(connection)} com o verify token salvo em Webhooks no App Dashboard.`,
        ),
  )

  checks.push(
    hasLog('inbound_event')
      ? check(
          'webhook_receiving',
          'ok',
          'Eventos da Meta chegando com assinatura válida.',
        )
      : check(
          'webhook_receiving',
          'pending',
          'Nenhum evento recebido nas últimas 24h — envie a mensagem de teste ou responda do celular e acompanhe o console.',
        ),
  )

  return checks
}
