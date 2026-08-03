import type { FastifyInstance } from 'fastify'

import type {
  MessageStatus,
  MessageType,
  Prisma as PrismaTypes,
} from '@/generated/prisma/client.js'

import { Prisma } from '@/generated/prisma/client.js'

import { toSendFormat } from '../phone.js'

/** Só o que o processamento consome do Fastify — o resto atrapalharia testar. */
export type InboundContext = Pick<FastifyInstance, 'log' | 'emitRealtimeEvent'>

// ── Payload da Meta ────────────────────────────────────
//
// Tipagem mínima e toda opcional: a Meta acrescenta campos sem aviso e o
// processamento precisa sobreviver a um formato que não reconhece.

export interface MetaMedia {
  id?: string
  caption?: string
  mime_type?: string
}

export interface MetaMessage {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  image?: MetaMedia
  video?: MetaMedia
  audio?: MetaMedia
  document?: MetaMedia
  sticker?: MetaMedia
  button?: { text?: string }
}

export interface MetaStatus {
  id?: string
  status?: string
  errors?: { code?: number | string; title?: string; message?: string }[]
}

export interface MetaContact {
  wa_id?: string
  profile?: { name?: string }
}

// ── Mapeamentos ────────────────────────────────────────

const TYPE_MAP: Record<string, MessageType> = {
  text: 'TEXT',
  image: 'IMAGE',
  audio: 'AUDIO',
  video: 'VIDEO',
  document: 'DOCUMENT',
  sticker: 'STICKER',
  location: 'LOCATION',
  contacts: 'CONTACTS',
  template: 'TEMPLATE',
  interactive: 'INTERACTIVE',
  // resposta a botão de template é interação, não uma mensagem à parte
  button: 'INTERACTIVE',
  reaction: 'REACTION',
  system: 'SYSTEM',
}

export const STATUS_MAP: Record<string, MessageStatus> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
}

/**
 * Estados que cada status recebido pode sobrescrever. A Meta entrega
 * `statuses[]` fora de ordem e um `delivered` atrasado não pode rebaixar uma
 * mensagem já lida. `FAILED` sai terminal de graça: não aparece em lista
 * nenhuma.
 */
export const LOWER_THAN: Record<MessageStatus, MessageStatus[]> = {
  PENDING: [],
  SENT: ['PENDING'],
  DELIVERED: ['PENDING', 'SENT'],
  READ: ['PENDING', 'SENT', 'DELIVERED'],
  FAILED: ['PENDING', 'SENT'],
}

export const PREVIEW_LENGTH = 280

// ── Helpers ────────────────────────────────────────────

export const mapType = (type?: string): MessageType =>
  // Tipo desconhecido não pode quebrar a ingestão — a Meta lança tipos novos
  // sem aviso e o enum estrito derrubaria o worker em produção.
  TYPE_MAP[type ?? ''] ?? 'UNSUPPORTED'

export const mediaOf = (message: MetaMessage): MetaMedia | undefined =>
  message.image ??
  message.video ??
  message.audio ??
  message.document ??
  message.sticker

export const extractText = (message: MetaMessage) =>
  message.text?.body ??
  message.image?.caption ??
  message.video?.caption ??
  message.document?.caption ??
  message.button?.text ??
  null

/** `timestamp` vem em segundos, como string. Ausente/inválido cai no agora. */
export const toWaTimestamp = (timestamp?: string) => {
  const seconds = Number(timestamp)

  if (!timestamp || Number.isNaN(seconds)) return new Date()

  return new Date(seconds * 1000)
}

/**
 * Reentrega da Meta bate no `@unique` do wamid — não é erro.
 *
 * A conferência do alvo não é decoração: um P2002 em outra constraint (a do
 * contato, por exemplo) precisa subir para o BullMQ retentar, e tratar todo
 * P2002 como duplicata engoliria a mensagem em silêncio.
 *
 * O adaptador do Prisma 7 devolve o alvo em
 * `meta.driverAdapterError.cause.constraint.fields` (com aspas no nome, daí o
 * `includes`); `meta.target` é a forma das versões anteriores.
 */
export const isDuplicateMessage = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2002') return false

  const meta = error.meta as
    | {
        target?: unknown
        driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } }
      }
    | undefined

  const fields = [
    ...(Array.isArray(meta?.target) ? meta.target : [meta?.target]),
    ...(meta?.driverAdapterError?.cause?.constraint?.fields ?? []),
  ]

  return fields.some(field => String(field).includes('waMessageId'))
}

// ── Contato ────────────────────────────────────────────

/**
 * O contato é procurado pelas três formas que podem tê-lo gravado: o `waId`
 * que a Meta manda agora, o mesmo número com o nono dígito (é assim que o
 * envio grava, §2.3.1) e a chave canônica de dedupe.
 *
 * `upsert` no alvo `phoneKey` não serve: estoura P2002 na outra unique quando
 * existe linha com o mesmo `waId` e `phoneKey` diferente.
 */
export const resolveContact = async (
  tx: PrismaTypes.TransactionClient,
  accountId: string,
  from: string,
  key: string,
  profileName: string | null,
) => {
  const candidates = await tx.contact.findMany({
    where: {
      whatsAppAccountId: accountId,
      OR: [{ waId: from }, { waId: toSendFormat(from) }, { phoneKey: key }],
    },
    select: { id: true, waId: true, phoneKey: true, profileName: true },
  })

  // O `waId` exato é a identidade que a Meta usa; a canônica só desempata.
  const existing = candidates.find(c => c.waId === from) ?? candidates[0]

  if (!existing) {
    const created = await tx.contact.create({
      data: {
        whatsAppAccountId: accountId,
        waId: from,
        phoneNumber: toSendFormat(from),
        phoneKey: key,
        profileName,
      },
      select: { id: true },
    })

    return { contact: created, action: 'created' as const }
  }

  // `phoneKey` entrou nullable na migração: a linha antiga é completada agora
  // para o próximo webhook casar pela canônica. Só quando ninguém mais no
  // account já ocupa a chave — senão a unique estouraria aqui.
  const fillKey =
    !existing.phoneKey && !candidates.some(c => c.phoneKey === key)

  const renamed = Boolean(profileName) && profileName !== existing.profileName

  const contact = await tx.contact.update({
    where: { id: existing.id },
    data: {
      ...(profileName ? { profileName } : {}),
      ...(fillKey ? { phoneKey: key } : {}),
    },
    select: { id: true },
  })

  // A Meta manda `profile.name` em quase toda mensagem: sem comparar o valor,
  // cada inbound invalidaria a lista de contatos à toa.
  return { contact, action: renamed || fillKey ? ('updated' as const) : null }
}
