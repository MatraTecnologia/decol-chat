import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import type { Prisma } from '@/generated/prisma/client.js'

import {
  MessageDirectionSchema,
  MessageStatusSchema,
  MessageTypeSchema,
} from '@/generated/zod/schemas.js'

import { prisma } from '@/lib/prisma.js'

import { findScopedConversation, scopeMessages } from './guards.js'

// ── Schemas ────────────────────────────────────────────

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string().nullable(),
  direction: MessageDirectionSchema,
  type: MessageTypeSchema,
  status: MessageStatusSchema,
  waMessageId: z.string().nullable(),
  waTimestamp: z.date().nullable(),
  content: z.string().nullable(),
  mediaId: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  mediaMimeType: z.string().nullable(),
  templateName: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  deliveredAt: z.date().nullable(),
  readAt: z.date().nullable(),
  failedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  sender: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.email(),
      image: z.string().nullable(),
    })
    .nullable(),
})

// `payload` (JSON cru da Meta) fica de fora de propósito — serve para depurar,
// não para o cliente.
export const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  direction: true,
  type: true,
  status: true,
  waMessageId: true,
  waTimestamp: true,
  content: true,
  mediaId: true,
  mediaUrl: true,
  mediaMimeType: true,
  templateName: true,
  errorCode: true,
  errorMessage: true,
  deliveredAt: true,
  readAt: true,
  failedAt: true,
  createdAt: true,
  updatedAt: true,
  sender: { select: { id: true, name: true, email: true, image: true } },
} satisfies Prisma.MessageSelect

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const conversationParamsSchema = z.object({ id: z.string() })

// ── Cursor ─────────────────────────────────────────────
//
// Opaco para o cliente: base64url de `<createdAt ISO>|<id>`. O `id` desempata
// mensagens gravadas no mesmo milissegundo (rajada de webhook), garantindo
// ordem total — offset repetiria/pularia itens numa lista que cresce pelo topo.

interface MessageCursor {
  createdAt: Date
  id: string
}

const encodeCursor = ({ createdAt, id }: MessageCursor) =>
  Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url')

const decodeCursor = (raw: string): MessageCursor | null => {
  const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|')

  if (!iso || !id) return null

  const createdAt = new Date(iso)
  if (Number.isNaN(createdAt.getTime())) return null

  return { createdAt, id }
}

const cursorFilter = ({
  createdAt,
  id,
}: MessageCursor): Prisma.MessageWhereInput => ({
  OR: [
    { createdAt: { lt: createdAt } },
    { AND: [{ createdAt }, { id: { lt: id } }] },
  ],
})

const messagesRoutes: FastifyPluginAsyncZod = async app => {
  // GET /conversations/:id/messages
  app.get(
    '/:id/messages',
    {
      schema: {
        operationId: 'listMessages',
        tags: ['Messages'],
        summary: 'Lista as mensagens de uma conversa (paginação por cursor)',
        params: conversationParamsSchema,
        querystring: listQuerySchema,
        response: {
          200: z.object({
            data: z.array(messageSchema),
            nextCursor: z.string().nullable(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { conversation, session, role } = await findScopedConversation(
        request,
        request.params.id,
      )

      if (!conversation) return reply.notFound(request.t('NOT_FOUND'))

      const { cursor, limit } = request.query

      const decoded = cursor ? decodeCursor(cursor) : null
      if (cursor && !decoded) return reply.badRequest('Cursor inválido')

      const messages = await prisma.message.findMany({
        where: {
          AND: [
            { conversationId: conversation.id },
            scopeMessages(role, session.user.id),
            ...(decoded ? [cursorFilter(decoded)] : []),
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: messageSelect,
      })

      const hasNext = messages.length > limit
      const data = hasNext ? messages.slice(0, limit) : messages
      const last = data.at(-1)

      return {
        data,
        nextCursor: hasNext && last ? encodeCursor(last) : null,
      }
    },
  )
}

export default messagesRoutes
