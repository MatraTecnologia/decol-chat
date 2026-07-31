import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import type { Prisma } from '@/generated/prisma/client.js'

import {
  ConversationPrioritySchema,
  ConversationStatusSchema,
} from '@/generated/zod/schemas.js'

import { requireRole } from '@/lib/auth-guard.js'
import { prisma } from '@/lib/prisma.js'

import {
  paginate,
  paginatedResponseSchema,
  paginationQuerySchema,
  type PaginationParams,
} from '@/utils/pagination.js'

import {
  CONVERSATION_READERS,
  conversationRelationsInclude,
  findScopedConversation,
  isGlobalReader,
  scopeConversations,
} from './guards.js'

import actionsRoutes from './actions.js'
import { isWithinWindow, windowExpiresAt } from './messaging-window.js'
import messagesRoutes from './messages.js'
import { conversationSchema } from './schemas.js'
import sendRoutes from './send.js'
import startRoutes from './start.js'

// ── Schemas ────────────────────────────────────────────

const conversationDetailSchema = conversationSchema.extend({
  canSendFreeText: z.boolean(),
  windowExpiresAt: z.date().nullable(),
})

const listQuerySchema = z
  .object({
    status: ConversationStatusSchema.optional(),
    priority: ConversationPrioritySchema.optional(),
    assignedToId: z.string().optional(),
    teamId: z.string().optional(),
    q: z.string().optional(),
    scope: z.enum(['mine', 'unassigned', 'all']).default('mine'),
  })
  .extend(paginationQuerySchema.shape)

const conversationParamsSchema = z.object({ id: z.string() })

// ── Helpers ────────────────────────────────────────────

/** Filtro do parâmetro `scope` — só global readers podem ampliar o próprio escopo. */
const scopeFilter = (
  scope: 'mine' | 'unassigned' | 'all',
  userId: string,
): Prisma.ConversationWhereInput => {
  if (scope === 'unassigned') return { assignedToId: null }
  if (scope === 'mine') return { assignedToId: userId }
  return {}
}

/** Busca textual por nome ou telefone do contato. */
const contactSearchFilter = (q: string): Prisma.ConversationWhereInput => {
  const digits = q.replace(/\D/gu, '')

  return {
    contact: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { profileName: { contains: q, mode: 'insensitive' } },
        ...(digits
          ? [
              { phoneNumber: { contains: digits } },
              { waId: { contains: digits } },
            ]
          : []),
      ],
    },
  }
}

const conversationsRoutes: FastifyPluginAsyncZod = async app => {
  // GET /conversations
  app.get(
    '/',
    {
      schema: {
        operationId: 'listConversations',
        tags: ['Conversations'],
        summary: 'Lista conversas visíveis para o solicitante',
        querystring: listQuerySchema,
        response: { 200: paginatedResponseSchema(conversationSchema) },
      },
    },
    async request => {
      const { session, role } = await requireRole(request, [
        ...CONVERSATION_READERS,
      ])

      const { status, priority, assignedToId, teamId, q, scope } = request.query
      const userId = session.user.id
      const globalReader = isGlobalReader(role)

      // Vendedor/somente-leitura não escolhe escopo nem responsável: o
      // fragmento de RBAC é a única fonte de verdade para eles.
      const where: Prisma.ConversationWhereInput = {
        AND: [
          scopeConversations(role, userId),
          ...(globalReader ? [scopeFilter(scope, userId)] : []),
          ...(globalReader && assignedToId ? [{ assignedToId }] : []),
          ...(status ? [{ status }] : []),
          ...(priority ? [{ priority }] : []),
          ...(teamId ? [{ teamId }] : []),
          ...(q ? [contactSearchFilter(q)] : []),
        ],
      }

      return paginate<z.infer<typeof conversationSchema>>(
        prisma.conversation,
        request.query as PaginationParams,
        {
          where,
          orderBy: [
            { lastMessageAt: { sort: 'desc', nulls: 'last' } },
            { id: 'desc' },
          ],
          include: conversationRelationsInclude,
        },
      )
    },
  )

  // GET /conversations/:id
  app.get(
    '/:id',
    {
      schema: {
        operationId: 'getConversation',
        tags: ['Conversations'],
        summary: 'Detalha uma conversa com a janela de 24h calculada',
        params: conversationParamsSchema,
        response: { 200: conversationDetailSchema },
      },
    },
    async (request, reply) => {
      const { conversation } = await findScopedConversation(
        request,
        request.params.id,
      )

      if (!conversation) return reply.notFound(request.t('NOT_FOUND'))

      return {
        ...conversation,
        canSendFreeText: isWithinWindow(conversation.lastInboundAt),
        windowExpiresAt: windowExpiresAt(conversation.lastInboundAt),
      }
    },
  )

  // POST /conversations/:id/read
  app.post(
    '/:id/read',
    {
      schema: {
        operationId: 'markConversationRead',
        tags: ['Conversations'],
        summary: 'Zera o contador de mensagens não lidas da conversa',
        params: conversationParamsSchema,
        response: { 200: conversationSchema },
      },
    },
    async (request, reply) => {
      const { conversation } = await findScopedConversation(
        request,
        request.params.id,
      )

      if (!conversation) return reply.notFound(request.t('NOT_FOUND'))

      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { unreadCount: 0 },
        include: conversationRelationsInclude,
      })

      app.emitRealtimeEvent({
        entity: 'conversation',
        action: 'updated',
        entityId: updated.id,
      })

      return updated
    },
  )

  // Sub-recursos: ações, mensagens e início de conversa.
  await app.register(actionsRoutes)
  await app.register(messagesRoutes)
  await app.register(sendRoutes)
  await app.register(startRoutes)
}

export default conversationsRoutes
