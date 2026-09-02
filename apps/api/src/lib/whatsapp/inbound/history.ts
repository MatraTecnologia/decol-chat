import type { Prisma as PrismaTypes } from '@/generated/prisma/client.js'

import { prisma } from '@/lib/prisma.js'

import { phoneKey } from '../phone.js'
import { recordHistoryChunk } from '../sync-progress.js'
import {
  parseHistory,
  summarizeThread,
  type ParsedHistoryThread,
} from './history-parse.js'
import { PREVIEW_LENGTH, resolveContact } from './shared.js'
import type { InboundContext } from './shared.js'

const laterOf = (a: Date | null, b: Date | null) =>
  !a ? b : !b ? a : a > b ? a : b

/**
 * Backfill de um thread: um lock e uma transação por contato, `createMany`
 * com `skipDuplicates` — reprocessar um chunk é barato e idempotente.
 *
 * Diferente do caminho vivo, não mexe em `unreadCount`: histórico importado
 * não é mensagem nova para ninguém.
 */
const importThread = async (accountId: string, thread: ParsedHistoryThread) => {
  const key = phoneKey(thread.waId)
  const summary = summarizeThread(thread.messages)

  if (!summary) return { created: false, messages: 0, conversationId: null }

  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${accountId}:${key}`}))`

    const { contact } = await resolveContact(
      tx,
      accountId,
      thread.waId,
      key,
      null,
    )

    // Chunks do mesmo contato chegam separados: o histórico sempre entra na
    // conversa mais recente dele, seja qual for o status.
    const existing = await tx.conversation.findFirst({
      where: { contactId: contact.id },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }],
      select: {
        id: true,
        status: true,
        lastMessageAt: true,
        lastInboundAt: true,
        closedAt: true,
      },
    })

    const conversation =
      existing ??
      (await tx.conversation.create({
        data: {
          whatsAppAccountId: accountId,
          contactId: contact.id,
          status: summary.status,
          assignedToId: null,
          unreadCount: 0,
          ...(summary.status === 'CLOSED' && {
            closedAt: summary.lastMessageAt,
          }),
        },
        select: {
          id: true,
          status: true,
          lastMessageAt: true,
          lastInboundAt: true,
          closedAt: true,
        },
      }))

    const { count } = await tx.message.createMany({
      data: thread.messages.map(message => ({
        conversationId: conversation.id,
        senderId: null,
        direction: message.direction,
        origin: message.direction === 'OUTBOUND' ? 'WHATSAPP_APP' : null,
        type: message.type,
        status: message.status,
        waMessageId: message.waMessageId,
        waTimestamp: message.timestamp,
        content: message.content,
        payload: message.raw as PrismaTypes.InputJsonValue,
      })),
      skipDuplicates: true,
    })

    // Os agregados só avançam: um chunk antigo chegando depois não pode
    // rebaixar `lastMessageAt` de uma conversa que já tem coisa mais nova.
    const isNewer =
      !conversation.lastMessageAt ||
      summary.lastMessageAt > conversation.lastMessageAt

    const reopen =
      conversation.status === 'CLOSED' &&
      summary.status === 'OPEN' &&
      (!conversation.closedAt || summary.lastMessageAt > conversation.closedAt)

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        ...(isNewer && {
          lastMessageAt: summary.lastMessageAt,
          lastMessageText:
            summary.lastMessageText?.slice(0, PREVIEW_LENGTH) ?? null,
        }),
        lastInboundAt: laterOf(
          conversation.lastInboundAt,
          summary.lastInboundAt,
        ),
        ...(reopen && { status: 'OPEN', closedAt: null, closedById: null }),
      },
    })

    return {
      created: !existing,
      messages: count,
      conversationId: conversation.id,
    }
  })
}

export const handleHistory = async (
  app: InboundContext,
  accountId: string,
  value: unknown,
) => {
  const { progress, threads } = parseHistory(value)

  let messages = 0
  const createdIds: string[] = []

  for (const thread of threads) {
    const result = await importThread(accountId, thread)

    messages += result.messages

    if (result.created && result.conversationId) {
      createdIds.push(result.conversationId)
    }
  }

  const state = await recordHistoryChunk(accountId, {
    phase: progress.phase,
    progress: progress.progress,
    threads: threads.length,
    messages,
    conversationsCreated: createdIds.length,
  })

  app.log.info(
    { accountId, ...progress, threads: threads.length, messages },
    'Chunk de histórico do WhatsApp importado',
  )

  // Um evento por conversa criada, nunca por mensagem: um chunk pode trazer
  // milhares e afogaria o socket.
  for (const id of createdIds) {
    app.emitRealtimeEvent({
      entity: 'conversation',
      action: 'created',
      entityId: id,
    })
  }

  if (!createdIds.length && messages > 0) {
    app.emitRealtimeEvent({
      entity: 'conversation',
      action: 'updated',
      entityId: accountId,
    })
  }

  return state
}
