import type { Prisma as PrismaTypes } from '@/generated/prisma/client.js'

import { prisma } from '@/lib/prisma.js'
import { messageSelect } from '@/routes/conversations/messages.js'

import { phoneKey } from '../phone.js'
import {
  extractText,
  isDuplicateMessage,
  LOWER_THAN,
  mapType,
  mediaOf,
  PREVIEW_LENGTH,
  resolveContact,
  STATUS_MAP,
  toWaTimestamp,
} from './shared.js'
import type {
  InboundContext,
  MetaContact,
  MetaMessage,
  MetaStatus,
} from './shared.js'

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
    select: messageSelect,
  })

  if (!message) return

  // O `payload` tem a forma do item de `listMessages`: o ícone da bolha
  // (enviada/entregue/lida/falha) muda sem depender de refetch.
  app.emitRealtimeEvent({
    entity: 'message',
    action: 'updated',
    entityId: message.id,
    payload: message,
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

      const { contact, action: contactAction } = await resolveContact(
        tx,
        accountId,
        from,
        key,
        profileName,
      )

      const ongoing = await tx.conversation.findFirst({
        where: { contactId: contact.id, status: { in: ['OPEN', 'PENDING'] } },
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }],
        select: { id: true },
      })

      const conversation =
        ongoing ??
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

      return {
        contact,
        contactAction,
        conversation,
        conversationCreated: !ongoing,
        message,
      }
    })
  } catch (error) {
    if (!isDuplicateMessage(error)) throw error

    app.log.info({ waMessageId }, 'Mensagem já ingerida — reentrega da Meta')
    return
  }

  const { contact, contactAction, conversation, conversationCreated, message } =
    persisted

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
    action: conversationCreated ? 'created' : 'updated',
    entityId: conversation.id,
  })

  if (contactAction) {
    app.emitRealtimeEvent({
      entity: 'contact',
      action: contactAction,
      entityId: contact.id,
    })
  }
}

// ── Entrada ────────────────────────────────────────────

interface MessagesValue {
  contacts?: MetaContact[]
  messages?: MetaMessage[]
  statuses?: MetaStatus[]
}

/**
 * Ordem preservada do código anterior: os `statuses` são aplicados antes das
 * mensagens novas, porque um status pode se referir a mensagem já persistida
 * num evento anterior.
 */
export const handleMessagesChange = async (
  app: InboundContext,
  accountId: string,
  value: unknown,
) => {
  const { contacts, messages, statuses } = (value ?? {}) as MessagesValue

  for (const status of statuses ?? []) {
    await applyStatus(app, status)
  }

  for (const message of messages ?? []) {
    await ingestMessage(app, accountId, contacts ?? [], message)
  }
}
