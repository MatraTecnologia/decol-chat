import type { FastifyInstance } from 'fastify'

import { redis } from '@/lib/redis.js'
import { generateId } from '@/utils/generate-id.js'

export const WEBHOOK_LOG_EVENT = 'whatsapp:webhook'

const LOG_KEY = 'whatsapp:webhook:logs'
const MAX_ENTRIES = 200
const TTL_SECONDS = 86_400
const REDACTED_HEADERS = ['authorization', 'cookie', 'proxy-authorization']

export type WebhookLogDirection =
  | 'inbound_verify'
  | 'inbound_event'
  | 'outbound'

export interface WebhookLogEntry {
  id: string
  receivedAt: string
  direction: WebhookLogDirection
  signatureValid?: boolean
  summary: string
  headers?: Record<string, string>
  payload: unknown
}

const sanitizeHeaders = (headers?: Record<string, string>) => {
  if (!headers) return undefined

  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !REDACTED_HEADERS.includes(key.toLowerCase()),
    ),
  )
}

export const pushWebhookLog = async (
  app: FastifyInstance,
  entry: Omit<WebhookLogEntry, 'id' | 'receivedAt'>,
) => {
  const logEntry: WebhookLogEntry = {
    ...entry,
    headers: sanitizeHeaders(entry.headers),
    id: generateId(),
    receivedAt: new Date().toISOString(),
  }

  try {
    await redis
      .multi()
      .lpush(LOG_KEY, JSON.stringify(logEntry))
      .ltrim(LOG_KEY, 0, MAX_ENTRIES - 1)
      .expire(LOG_KEY, TTL_SECONDS)
      .exec()
  } catch {
    // Histórico é best-effort — o webhook precisa responder 200 mesmo sem Redis.
  }

  // Fora do try: uma falha do Redis custa o histórico, não o console ao vivo.
  app.io?.emit(WEBHOOK_LOG_EVENT, logEntry)

  return logEntry
}

export const listWebhookLogs = async (limit = MAX_ENTRIES) => {
  try {
    const raw = await redis.lrange(LOG_KEY, 0, limit - 1)

    return raw.reduce<WebhookLogEntry[]>((entries, item) => {
      try {
        entries.push(JSON.parse(item) as WebhookLogEntry)
      } catch {
        // Entrada corrompida — descartada silenciosamente.
      }
      return entries
    }, [])
  } catch {
    return []
  }
}
