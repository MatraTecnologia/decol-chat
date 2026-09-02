/**
 * Parse puro do webhook `history` (coexistence).
 *
 * Sem import de runtime de propósito: roda nos testes com `node --test`, que
 * não resolve o alias `@/` nem o `.js` dos imports internos.
 *
 * Formato observado em produção (2026-09-02):
 *
 *   value.history[] = { metadata: { phase, chunk_order, progress }, threads?: [
 *     { id: '5543...', context: { wa_id, user_id }, messages: [
 *       { id, from, timestamp, type, text?, history_context: { status, from_me? } }
 *     ] }
 *   ] }
 *
 * `from_me` só aparece em mensagem enviada pela empresa; a recebida traz
 * apenas `status: 'pending'`. Tipos observados: text, media_placeholder
 * (mídia sem download), errors (não suportada), edit, contacts.
 */

export type HistoryDirection = 'INBOUND' | 'OUTBOUND'

export type HistoryMessageType =
  'TEXT' | 'CONTACTS' | 'REACTION' | 'LOCATION' | 'UNSUPPORTED'

export type HistoryMessageStatus = 'SENT' | 'DELIVERED' | 'READ'

export interface HistoryContext {
  status?: string
  from_me?: boolean
}

export interface RawHistoryMessage {
  id?: string
  from?: string
  to?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  contacts?: { name?: { formatted_name?: string } }[]
  reaction?: { emoji?: string }
  location?: { name?: string; address?: string }
  history_context?: HistoryContext
}

export interface RawHistoryThread {
  id?: string
  context?: { wa_id?: string }
  messages?: RawHistoryMessage[]
}

export interface HistoryProgress {
  phase: number | null
  chunkOrder: number | null
  progress: number | null
}

export interface ParsedHistoryMessage {
  waMessageId: string
  direction: HistoryDirection
  type: HistoryMessageType
  status: HistoryMessageStatus
  content: string | null
  timestamp: Date
  raw: RawHistoryMessage
}

export interface ParsedHistoryThread {
  /** MSISDN do contato, como a Meta manda (`context.wa_id`). */
  waId: string
  messages: ParsedHistoryMessage[]
}

interface RawHistoryValue {
  metadata?: { display_phone_number?: string }
  history?: {
    metadata?: { phase?: number; chunk_order?: number; progress?: number }
    threads?: RawHistoryThread[]
  }[]
}

const MEDIA_PLACEHOLDER_TEXT = 'Mídia do celular não sincronizada'

const digits = (value: string) => value.replace(/\D/g, '')

const toDate = (timestamp?: string) => {
  const seconds = Number(timestamp)

  return !timestamp || Number.isNaN(seconds)
    ? new Date()
    : new Date(seconds * 1000)
}

/**
 * `from_me` é a fonte primária. Só quando a Meta o omite é que o MSISDN da
 * empresa desempata — daí `getPhoneNumberInfo` ser bloqueante no onboarding.
 */
export const classifyHistoryMessage = (
  message: RawHistoryMessage,
  businessPhone: string | null,
): HistoryDirection => {
  const fromMe = message.history_context?.from_me

  if (fromMe === true) return 'OUTBOUND'
  if (fromMe === false) return 'INBOUND'
  if (message.to) return 'OUTBOUND'

  if (businessPhone && message.from) {
    return digits(message.from) === digits(businessPhone)
      ? 'OUTBOUND'
      : 'INBOUND'
  }

  return 'INBOUND'
}

const OUTBOUND_STATUS: Record<string, HistoryMessageStatus> = {
  read: 'READ',
  played: 'READ',
  delivered: 'DELIVERED',
}

/** Recebida já está entregue (está no celular); enviada segue o `status`. */
export const historyStatus = (
  direction: HistoryDirection,
  context?: HistoryContext,
): HistoryMessageStatus =>
  direction === 'INBOUND'
    ? 'DELIVERED'
    : (OUTBOUND_STATUS[context?.status ?? ''] ?? 'SENT')

const contentOf = (message: RawHistoryMessage) => {
  switch (message.type) {
    case 'text':
      return message.text?.body ?? null
    case 'media_placeholder':
      return MEDIA_PLACEHOLDER_TEXT
    case 'contacts':
      return (
        message.contacts
          ?.map(contact => contact.name?.formatted_name)
          .filter(Boolean)
          .join(', ') || null
      )
    case 'reaction':
      return message.reaction?.emoji ?? null
    case 'location':
      return (
        [message.location?.name, message.location?.address]
          .filter(Boolean)
          .join(' — ') || null
      )
    default:
      return null
  }
}

const TYPE_MAP: Record<string, HistoryMessageType> = {
  text: 'TEXT',
  contacts: 'CONTACTS',
  reaction: 'REACTION',
  location: 'LOCATION',
}

/**
 * `edit` é uma versão posterior de um texto já presente no thread — importar
 * criaria uma bolha duplicada. Sem `id` não há chave de idempotência.
 */
const isImportable = (message: RawHistoryMessage) =>
  Boolean(message.id) && message.type !== 'edit'

export const parseHistoryMessage = (
  message: RawHistoryMessage,
  businessPhone: string | null,
): ParsedHistoryMessage | null => {
  if (!isImportable(message)) return null

  const direction = classifyHistoryMessage(message, businessPhone)

  return {
    waMessageId: message.id as string,
    direction,
    type: TYPE_MAP[message.type ?? ''] ?? 'UNSUPPORTED',
    status: historyStatus(direction, message.history_context),
    content: contentOf(message),
    timestamp: toDate(message.timestamp),
    raw: message,
  }
}

export const parseHistory = (value: unknown) => {
  const raw = (value as RawHistoryValue | null) ?? {}
  const businessPhone = raw.metadata?.display_phone_number ?? null
  const chunks = Array.isArray(raw.history) ? raw.history : []

  const progress: HistoryProgress = {
    phase: chunks[0]?.metadata?.phase ?? null,
    chunkOrder: chunks[0]?.metadata?.chunk_order ?? null,
    progress: chunks[0]?.metadata?.progress ?? null,
  }

  // Um contato pode aparecer em mais de um chunk do mesmo payload — agrupar
  // por `waId` é o que garante um lock e uma transação por contato.
  const byContact = new Map<string, ParsedHistoryMessage[]>()

  for (const chunk of chunks) {
    for (const thread of chunk.threads ?? []) {
      const waId = thread.context?.wa_id ?? thread.id

      if (!waId) continue

      const bucket = byContact.get(waId) ?? []

      for (const message of thread.messages ?? []) {
        const parsed = parseHistoryMessage(message, businessPhone)

        if (parsed) bucket.push(parsed)
      }

      byContact.set(waId, bucket)
    }
  }

  const threads: ParsedHistoryThread[] = [...byContact.entries()]
    .filter(([, messages]) => messages.length > 0)
    .map(([waId, messages]) => ({
      waId,
      messages: messages.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      ),
    }))

  return { businessPhone, progress, threads }
}

export const OPEN_WINDOW_MS = 24 * 60 * 60 * 1000

export interface ThreadSummary {
  lastMessageAt: Date
  lastMessageText: string | null
  lastInboundAt: Date | null
  status: 'OPEN' | 'CLOSED'
}

/**
 * Thread com atividade nas últimas 24h nasce `OPEN` (o atendente assume de
 * onde parou); mais antigo nasce `CLOSED` para não entupir a fila.
 * `lastInboundAt` ignora as enviadas: é ele que decide a janela de 24h.
 */
export const summarizeThread = (
  messages: ParsedHistoryMessage[],
  now = new Date(),
): ThreadSummary | null => {
  if (!messages.length) return null

  const last = messages.reduce((a, b) =>
    b.timestamp.getTime() >= a.timestamp.getTime() ? b : a,
  )

  const lastInbound = messages
    .filter(message => message.direction === 'INBOUND')
    .reduce<Date | null>(
      (latest, message) =>
        !latest || message.timestamp > latest ? message.timestamp : latest,
      null,
    )

  return {
    lastMessageAt: last.timestamp,
    lastMessageText: last.content,
    lastInboundAt: lastInbound,
    status:
      now.getTime() - last.timestamp.getTime() <= OPEN_WINDOW_MS
        ? 'OPEN'
        : 'CLOSED',
  }
}
