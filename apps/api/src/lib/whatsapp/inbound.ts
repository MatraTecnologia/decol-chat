/**
 * Ingestão dos eventos que a Meta entrega no webhook.
 *
 * Vive fora de `jobs/` de propósito: o arquivo do job abre a conexão do BullMQ
 * no import, e quem só quer processar um payload (worker, teste) não precisa
 * dela. O worker é uma casca fina em volta de `processInboundPayload`.
 */
import type { FastifyInstance } from 'fastify'

import type {
  MessageStatus,
  MessageType,
  Prisma as PrismaTypes,
} from '@/generated/prisma/client.js'

import { Prisma } from '@/generated/prisma/client.js'
import { prisma } from '@/lib/prisma.js'
import { messageSelect } from '@/routes/conversations/messages.js'

import { getAccountByPhoneNumberId } from './connection.js'
import { phoneKey, toSendFormat } from './phone.js'

/** Só o que o processamento consome do Fastify — o resto atrapalharia testar. */
export type InboundContext = Pick<FastifyInstance, 'log' | 'emitRealtimeEvent'>

// ── Payload da Meta ────────────────────────────────────
//
// Tipagem mínima e toda opcional: a Meta acrescenta campos sem aviso e o
// processamento precisa sobreviver a um formato que não reconhece.

interface MetaMedia {
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

interface MetaValue {
  metadata?: { phone_number_id?: string }
  contacts?: MetaContact[]
  messages?: MetaMessage[]
  statuses?: MetaStatus[]
}

interface MetaWebhookPayload {
  entry?: { changes?: { value?: MetaValue }[] }[]
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

const STATUS_MAP: Record<string, MessageStatus> = {
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
const LOWER_THAN: Record<MessageStatus, MessageStatus[]> = {
  PENDING: [],
  SENT: ['PENDING'],
  DELIVERED: ['PENDING', 'SENT'],
  READ: ['PENDING', 'SENT', 'DELIVERED'],
  FAILED: ['PENDING', 'SENT'],
}

const PREVIEW_LENGTH = 280

// ── Helpers ────────────────────────────────────────────

const mapType = (type?: string): MessageType =>
  // Tipo desconhecido não pode quebrar a ingestão — a Meta lança tipos novos
  // sem aviso e o enum estrito derrubaria o worker em produção.
  TYPE_MAP[type ?? ''] ?? 'UNSUPPORTED'

const mediaOf = (message: MetaMessage): MetaMedia | undefined =>
  message.image ??
  message.video ??
  message.audio ??
  message.document ??
  message.sticker

const extractText = (message: MetaMessage) =>
  message.text?.body ??
  message.image?.caption ??
  message.video?.caption ??
  message.document?.caption ??
  message.button?.text ??
  null

/** `timestamp` vem em segundos, como string. Ausente/inválido cai no agora. */
const toWaTimestamp = (timestamp?: string) => {
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
const isDuplicateMessage = (error: unknown) => {
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
const resolveContact = async (
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
    select: { id: true, waId: true, phoneKey: true },
  })

  // O `waId` exato é a identidade que a Meta usa; a canônica só desempata.
  const existing = candidates.find(c => c.waId === from) ?? candidates[0]

  if (!existing) {
    return tx.contact.create({
      data: {
        whatsAppAccountId: accountId,
        waId: from,
        phoneNumber: toSendFormat(from),
        phoneKey: key,
        profileName,
      },
      select: { id: true },
    })
  }

  // `phoneKey` entrou nullable na migração: a linha antiga é completada agora
  // para o próximo webhook casar pela canônica. Só quando ninguém mais no
  // account já ocupa a chave — senão a unique estouraria aqui.
  const fillKey =
    !existing.phoneKey && !candidates.some(c => c.phoneKey === key)

  return tx.contact.update({
    where: { id: existing.id },
    data: {
      ...(profileName ? { profileName } : {}),
      ...(fillKey ? { phoneKey: key } : {}),
    },
    select: { id: true },
  })
}

// ── Status de mensagens enviadas ───────────────────────

const applyStatus = async (app: InboundContext, status: MetaStatus) => {
  const waMessageId = status.id
  const incoming = STATUS_MAP[status.status ?? '']

  // Status desconhecido ou sem wamid não tem para onde ir.
  if (!waMessageId || !incoming) return

  const error = status.errors?.[0]

  // O guard mora no `where`, não numa leitura anterior: dois webhooks em voo
  // leem o mesmo valor e o último a escrever venceria. `count === 0` é sempre
  // benigno — mensagem ainda não persistida, regressão, ou já terminal.
  const result = await prisma.message.updateMany({
    where: { waMessageId, status: { in: LOWER_THAN[incoming] } },
    data: {
      status: incoming,
      ...(incoming === 'DELIVERED' && { deliveredAt: new Date() }),
      ...(incoming === 'READ' && { readAt: new Date() }),
      ...(incoming === 'FAILED' && {
        failedAt: new Date(),
        errorCode: error?.code != null ? String(error.code) : null,
        errorMessage: error?.title ?? error?.message ?? null,
      }),
    },
  })

  if (result.count === 0) return

  const message = await prisma.message.findUnique({
    where: { waMessageId },
    select: { id: true },
  })

  if (!message) return

  app.emitRealtimeEvent({
    entity: 'message',
    action: 'updated',
    entityId: message.id,
  })
}

// ── Mensagens recebidas ────────────────────────────────

const ingestMessage = async (
  app: InboundContext,
  accountId: string,
  contacts: MetaContact[],
  waMessage: MetaMessage,
) => {
  const from = waMessage.from
  const waMessageId = waMessage.id

  if (!from || !waMessageId) {
    app.log.warn({ waMessage }, 'Mensagem do WhatsApp sem `from` ou `id`')
    return
  }

  const key = phoneKey(from)
  const profileName =
    contacts.find(c => c.wa_id === from)?.profile?.name ?? null

  const content = extractText(waMessage)
  const media = mediaOf(waMessage)
  const waTimestamp = toWaTimestamp(waMessage.timestamp)

  let persisted

  try {
    persisted = await prisma.$transaction(async tx => {
      // Serializa a ingestão por contato até o commit. Sem isso, duas
      // mensagens quase simultâneas do mesmo cliente criam DUAS conversas —
      // são wamids diferentes, o unique de `waMessageId` não vê nada.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${accountId}:${key}`}))`

      const contact = await resolveContact(
        tx,
        accountId,
        from,
        key,
        profileName,
      )

      const conversation =
        (await tx.conversation.findFirst({
          where: { contactId: contact.id, status: { in: ['OPEN', 'PENDING'] } },
          orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }],
          select: { id: true },
        })) ??
        // Nasce sem responsável: a atribuição automática é outra etapa.
        (await tx.conversation.create({
          data: {
            whatsAppAccountId: accountId,
            contactId: contact.id,
            status: 'OPEN',
            assignedToId: null,
          },
          select: { id: true },
        }))

      // Reentrega da Meta aborta a transação aqui, no unique do wamid.
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          type: mapType(waMessage.type),
          status: 'DELIVERED',
          waMessageId,
          waTimestamp,
          content,
          mediaId: media?.id ?? null,
          mediaMimeType: media?.mime_type ?? null,
          payload: waMessage as PrismaTypes.InputJsonValue,
        },
        select: messageSelect,
      })

      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: waTimestamp,
          lastMessageText: content?.slice(0, PREVIEW_LENGTH) ?? null,
          // É `lastInboundAt` que abre a janela de 24h — sem ele o composer
          // do atendente nunca destrava.
          lastInboundAt: waTimestamp,
          unreadCount: { increment: 1 },
        },
      })

      return { conversation, message }
    })
  } catch (error) {
    if (!isDuplicateMessage(error)) throw error

    app.log.info({ waMessageId }, 'Mensagem já ingerida — reentrega da Meta')
    return
  }

  const { conversation, message } = persisted

  // Fora da transação: emitir antes do commit anunciaria um id que ainda pode
  // desaparecer. O `payload` tem a forma do item de `listMessages` para o
  // front conseguir dar append no cache sem refetch.
  app.emitRealtimeEvent({
    entity: 'message',
    action: 'created',
    entityId: message.id,
    payload: message,
  })

  app.emitRealtimeEvent({
    entity: 'conversation',
    action: 'updated',
    entityId: conversation.id,
  })
}

// ── Entrada ────────────────────────────────────────────

export const processInboundPayload = async (
  app: InboundContext,
  payload: unknown,
) => {
  const entries = (payload as MetaWebhookPayload)?.entry ?? []

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId = value?.metadata?.phone_number_id

      if (!value || !phoneNumberId) continue

      const account = await getAccountByPhoneNumberId(phoneNumberId)

      // Número que não é desta instalação não é erro retentável.
      if (!account) {
        app.log.warn(
          { phoneNumberId },
          'Evento do WhatsApp para número desconhecido — descartado',
        )
        continue
      }

      for (const status of value.statuses ?? []) {
        await applyStatus(app, status)
      }

      for (const message of value.messages ?? []) {
        await ingestMessage(app, account.id, value.contacts ?? [], message)
      }
    }
  }
}
