import type { Prisma } from '@/generated/prisma/client.js'

/**
 * Abaixo de 3 caracteres o `ILIKE '%termo%'` não extrai trigramas e o índice GIN
 * de `message.content` deixa de ser usado — nesses casos a busca fica só no contato.
 */
export const MESSAGE_SEARCH_MIN_LENGTH = 3

/** Tamanho do trecho devolvido para a lista, sem contar as reticências. */
const SNIPPET_LENGTH = 120

const ELLIPSIS = '…'

interface ContactSummary {
  name: string | null
  profileName: string | null
  phoneNumber: string
  waId: string
}

export interface MessageMatch {
  id: string
  content: string
  createdAt: Date
  count: number
}

export interface ConversationMatch {
  field: 'contact' | 'message'
  snippet: string
  messageId: string | null
  messageAt: Date | null
  count: number
}

/**
 * Colapsa espaços e remove os curingas do LIKE. O Prisma interpola `contains`
 * direto em `'%' || $1 || '%'` sem escapar nada, então tirar `% _ \` evita que o
 * usuário injete curinga e mantém o filtro e o recorte do trecho falando do
 * mesmo termo.
 */
export const normalizeSearchTerm = (raw?: string) =>
  (raw ?? '')
    .replace(/[%_\\]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()

export const canSearchMessages = (term: string) =>
  term.length >= MESSAGE_SEARCH_MIN_LENGTH

export const toLikePattern = (term: string) => `%${term}%`

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

const singleLine = (value: string) => value.replace(/\s+/gu, ' ').trim()

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

/** Recorta ~120 caracteres ao redor da ocorrência, com reticências nas pontas. */
export const buildSnippet = (content: string, term: string) => {
  const text = singleLine(content)

  if (!text) return null

  const found = term ? new RegExp(escapeRegExp(term), 'iu').exec(text) : null

  if (!found) {
    return text.length > SNIPPET_LENGTH
      ? `${text.slice(0, SNIPPET_LENGTH)}${ELLIPSIS}`
      : text
  }

  const padding = Math.max(0, Math.floor((SNIPPET_LENGTH - found[0].length) / 2))

  let start = Math.max(0, found.index - padding)
  let end = Math.min(text.length, start + SNIPPET_LENGTH)

  start = Math.max(0, Math.min(start, end - SNIPPET_LENGTH))

  if (start > 0 && isLowSurrogate(text.charCodeAt(start))) start -= 1
  if (end < text.length && isLowSurrogate(text.charCodeAt(end))) end += 1

  const body = text.slice(start, end)

  return `${start > 0 ? ELLIPSIS : ''}${body}${end < text.length ? ELLIPSIS : ''}`
}

/** Campo do contato que casou com o termo — espelha `contactSearchFilter`. */
export const buildContactSnippet = (contact: ContactSummary, term: string) => {
  const lowered = term.toLowerCase()

  const named = [contact.name, contact.profileName].find(value =>
    value?.toLowerCase().includes(lowered),
  )

  if (named) return named

  const digits = term.replace(/\D/gu, '')

  if (!digits) return null

  return (
    [contact.phoneNumber, contact.waId].find(value => value.includes(digits)) ??
    null
  )
}

/**
 * Monta o `match` da conversa. Mensagem tem prioridade sobre contato; sem trecho
 * legível o campo volta `null` inteiro — nunca parcialmente preenchido.
 */
export const buildConversationMatch = (
  contact: ContactSummary,
  term: string,
  message?: MessageMatch,
): ConversationMatch | null => {
  if (message) {
    const snippet = buildSnippet(message.content, term)

    if (snippet) {
      return {
        field: 'message',
        snippet,
        messageId: message.id,
        messageAt: message.createdAt,
        count: message.count,
      }
    }
  }

  const snippet = buildContactSnippet(contact, term)

  if (!snippet) return null

  return {
    field: 'contact',
    snippet,
    messageId: null,
    messageAt: null,
    count: 0,
  }
}

export const isInvertedRange = (from?: Date, to?: Date) =>
  Boolean(from && to && from.getTime() > to.getTime())

/** Janela de atividade: `lastMessageAt`, caindo para `createdAt` quando nulo. */
export const activityRangeFilter = (
  from?: Date,
  to?: Date,
): Prisma.ConversationWhereInput | null => {
  if (!from && !to) return null

  const bounds = {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  }

  return {
    OR: [
      { lastMessageAt: bounds },
      { lastMessageAt: null, createdAt: bounds },
    ],
  }
}
