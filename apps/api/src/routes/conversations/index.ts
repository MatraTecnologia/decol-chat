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
import { canMarkConversationRead } from './action-policy.js'
import { findMessageMatches } from './message-search.js'
import { isWithinWindow, windowExpiresAt } from './messaging-window.js'
import messagesRoutes from './messages.js'
import {
  conversationListItemSchema,
  conversationSchema,
} from './schemas.js'
import {
  activityRangeFilter,
  buildConversationMatch,
  canSearchMessages,
  isInvertedRange,
  type MessageMatch,
  normalizeSearchTerm,
} from './search.js'
import sendRoutes from './send.js'
import startRoutes from './start.js'

// ── Schemas ────────────────────────────────────────────

const conversationDetailSchema = conversationSchema.extend({
  canSendFreeText: z.boolean(),
  windowExpiresAt: z.date().nullable(),
})

/** Data ISO vinda da querystring — `z.coerce.date()` sairia sem tipo no OpenAPI. */
const dateQueryParam = z
  .string()
  .transform(value => new Date(value))
  .refine(value => !Number.isNaN(value.getTime()), 'Data inválida')

const listQuerySchema = z
  .object({
    status: ConversationStatusSchema.optional(),
    priority: ConversationPrioritySchema.optional(),
    assignedToId: z.string().optional(),
    teamId: z.string().optional(),
    q: z.string().optional(),
    from: dateQueryParam.optional(),
    to: dateQueryParam.optional(),
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

/** Filtro do parâmetro `assignedToId` — `unassigned` significa "sem responsável". */
const assigneeFilter = (
  assignedToId: string,
): Prisma.ConversationWhereInput =>
  assignedToId === 'unassigned' ? { assignedToId: null } : { assignedToId }

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

/**
 * Contato **ou** conteúdo das mensagens. O ramo das mensagens vira um `EXISTS`
 * com `ILIKE '%termo%'`, servido pelo índice GIN de trigramas de `message.content`.
 */
const searchFilter = (term: string): Prisma.ConversationWhereInput => ({
  OR: [
    contactSearchFilter(term),
    ...(canSearchMessages(term)
      ? [
          {
            messages: {
              some: { content: { contains: term, mode: 'insensitive' as const } },
            },
          },
        ]
      : []),
  ],
})

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
        response: { 200: paginatedResponseSchema(conversationListItemSchema) },
      },
    },
    async (request, reply) => {
      const { session, role } = await requireRole(request, [
        ...CONVERSATION_READERS,
      ])

      const { status, priority, assignedToId, teamId, q, from, to, scope } =
        request.query

      if (isInvertedRange(from, to)) {
        return reply.badRequest(
          'Intervalo inválido: `from` deve ser anterior a `to`.',
        )
      }

      const userId = session.user.id
      const globalReader = isGlobalReader(role)
      const term = normalizeSearchTerm(q)
      const activityRange = activityRangeFilter(from, to)

      // Vendedor/somente-leitura não escolhe escopo nem responsável: o
      // fragmento de RBAC é a única fonte de verdade para eles.
      const where: Prisma.ConversationWhereInput = {
        AND: [
          scopeConversations(role, userId),
          ...(globalReader ? [scopeFilter(scope, userId)] : []),
          ...(globalReader && assignedToId
            ? [assigneeFilter(assignedToId)]
            : []),
          ...(status ? [{ status }] : []),
          ...(priority ? [{ priority }] : []),
          ...(teamId ? [{ teamId }] : []),
          ...(term ? [searchFilter(term)] : []),
          ...(activityRange ? [activityRange] : []),
        ],
      }

      const result = await paginate<z.infer<typeof conversationSchema>>(
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

      // Uma consulta agregada por página resolve os trechos de todas as conversas.
      const matches: Map<string, MessageMatch> =
        term && canSearchMessages(term)
          ? await findMessageMatches(
              result.data.map(conversation => conversation.id),
              term,
            )
          : new Map()

      return {
        ...result,
        data: result.data.map(conversation => ({
          ...conversation,
          match: term
            ? buildConversationMatch(
                conversation.contact,
                term,
                matches.get(conversation.id),
              )
            : null,
        })),
      }
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
      const { conversation, role } = await findScopedConversation(
        request,
        request.params.id,
      )

      if (!conversation) return reply.notFound(request.t('NOT_FOUND'))
      if (!canMarkConversationRead(role)) {
        return reply.forbidden(request.t('FORBIDDEN'))
      }

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
