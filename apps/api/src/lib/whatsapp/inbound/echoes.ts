import type { Prisma as PrismaTypes } from '@/generated/prisma/client.js'

import { prisma } from '@/lib/prisma.js'
import { messageSelect } from '@/routes/conversations/messages.js'

import { phoneKey } from '../phone.js'
import { parseEchoes, type ParsedEcho } from './echoes-parse.js'
import {
  extractText,
  isDuplicateMessage,
  mapType,
  mediaOf,
  PREVIEW_LENGTH,
  resolveContact,
  toWaTimestamp,
} from './shared.js'
import type { InboundContext, MetaMessage } from './shared.js'

/**
 * Mensagem enviada pelo celular: `OUTBOUND` com `origin: WHATSAPP_APP`, sem
 * `senderId` (não há `User` correspondente) e `status: SENT` — a Meta não
 * manda `statuses` para echo, e `DELIVERED` seria mentira.
 *
 * Atualiza só `lastMessageAt`/`lastMessageText`: responder pelo celular não
 * cria não-lida nem reabre a janela de 24h.
 */
const ingestEcho = async (
  app: InboundContext,
  accountId: string,
  echo: ParsedEcho,
) => {
  const waMessage = echo.message as MetaMessage
  const waMessageId = echo.message.id as string
  const to = echo.contactWaId
  const key = phoneKey(to)

  const content = extractText(waMessage)
  const media = mediaOf(waMessage)
  const waTimestamp = toWaTimestamp(echo.message.timestamp)

  let persisted

  try {
    persisted = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${accountId}:${key}`}))`

      const { contact, action: contactAction } = await resolveContact(
        tx,
        accountId,
        to,
        key,
        null,
      )

      const ongoing = await tx.conversation.findFirst({
        where: { contactId: contact.id, status: { in: ['OPEN', 'PENDING'] } },
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }],
        select: { id: true },
      })

      const conversation =
        ongoing ??
        (await tx.conversation.create({
          data: {
            whatsAppAccountId: accountId,
            contactId: contact.id,
            status: 'OPEN',
            assignedToId: null,
          },
          select: { id: true },
        }))

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: null,
          direction: 'OUTBOUND',
          origin: 'WHATSAPP_APP',
          type: mapType(echo.message.type),
          status: 'SENT',
          waMessageId,
          waTimestamp,
          content,
          mediaId: media?.id ?? null,
          mediaMimeType: media?.mime_type ?? null,
          payload: echo.message as PrismaTypes.InputJsonValue,
        },
        select: messageSelect,
      })

      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: waTimestamp,
          lastMessageText: content?.slice(0, PREVIEW_LENGTH) ?? null,
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

    // Também cobre o eco de um envio feito pelo painel: o wamid já existe.
    app.log.info({ waMessageId }, 'Echo já persistido — ignorado')
    return
  }

  const { contact, contactAction, conversation, conversationCreated, message } =
    persisted

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

export const handleEchoes = async (
  app: InboundContext,
  accountId: string,
  value: unknown,
) => {
  for (const echo of parseEchoes(value)) {
    await ingestEcho(app, accountId, echo)
  }
}
