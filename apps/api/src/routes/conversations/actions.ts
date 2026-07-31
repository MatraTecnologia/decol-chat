import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { ConversationPrioritySchema } from '@/generated/zod/schemas.js'
import { requireRole } from '@/lib/auth-guard.js'
import { prisma } from '@/lib/prisma.js'

import {
  canAssignConversation,
  canChangePriority,
  canChangeStatus,
  isEligibleAssignee,
} from './action-policy.js'
import {
  conversationRelationsInclude,
  findScopedConversation,
} from './guards.js'
import { conversationSchema } from './schemas.js'

const paramsSchema = z.object({ id: z.string() })
const updateBodySchema = z.object({ priority: ConversationPrioritySchema })
const assignBodySchema = z.object({
  userId: z.string(),
  expectedAssigneeId: z.string().nullable(),
})
const unassignBodySchema = z.object({
  expectedAssigneeId: z.string().nullable(),
})

const ASSIGNMENT_ROLES = ['admin', 'manager'] as const
const ASSIGNMENT_CONFLICT =
  'O responsável pela conversa mudou. Atualize a lista e tente novamente.'
const INVALID_ASSIGNEE = 'Selecione um atendente ativo para a atribuição.'

const actionsRoutes: FastifyPluginAsyncZod = async app => {
  app.patch(
    '/:id',
    {
      schema: {
        operationId: 'updateConversation',
        tags: ['Conversations'],
        summary: 'Altera a prioridade da conversa',
        params: paramsSchema,
        body: updateBodySchema,
        response: { 200: conversationSchema },
      },
    },
    async (request, reply) => {
      const { role } = await requireRole(request, [...ASSIGNMENT_ROLES])
      if (!canChangePriority(role)) {
        return reply.forbidden(request.t('FORBIDDEN'))
      }

      const exists = await prisma.conversation.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      })
      if (!exists) return reply.notFound(request.t('NOT_FOUND'))

      const updated = await prisma.conversation.update({
        where: { id: exists.id },
        data: { priority: request.body.priority },
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

  app.post(
    '/:id/assign',
    {
      schema: {
        operationId: 'assignConversation',
        tags: ['Conversations'],
        summary: 'Atribui a conversa a um atendente',
        params: paramsSchema,
        body: assignBodySchema,
        response: { 200: conversationSchema },
      },
    },
    async (request, reply) => {
      const { role, session } = await requireRole(request, [
        ...ASSIGNMENT_ROLES,
      ])
      if (!canAssignConversation(role)) {
        return reply.forbidden(request.t('FORBIDDEN'))
      }

      const target = await prisma.user.findUnique({
        where: { id: request.body.userId },
        select: { id: true, role: true, banned: true },
      })
      if (!target || !isEligibleAssignee(target, session.user.id)) {
        return reply.badRequest(INVALID_ASSIGNEE)
      }

      const result = await prisma.conversation.updateMany({
        where: {
          id: request.params.id,
          assignedToId: request.body.expectedAssigneeId,
        },
        data: {
          assignedToId: request.body.userId,
          assignedAt: new Date(),
        },
      })

      if (result.count === 0) {
        const exists = await prisma.conversation.findUnique({
          where: { id: request.params.id },
          select: { id: true },
        })
        if (!exists) return reply.notFound(request.t('NOT_FOUND'))
        return reply.conflict(ASSIGNMENT_CONFLICT)
      }

      const updated = await prisma.conversation.findUniqueOrThrow({
        where: { id: request.params.id },
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

  app.post(
    '/:id/unassign',
    {
      schema: {
        operationId: 'unassignConversation',
        tags: ['Conversations'],
        summary: 'Remove o responsável da conversa',
        params: paramsSchema,
        body: unassignBodySchema,
        response: { 200: conversationSchema },
      },
    },
    async (request, reply) => {
      const { role } = await requireRole(request, [...ASSIGNMENT_ROLES])
      if (!canAssignConversation(role)) {
        return reply.forbidden(request.t('FORBIDDEN'))
      }

      const result = await prisma.conversation.updateMany({
        where: {
          id: request.params.id,
          assignedToId: request.body.expectedAssigneeId,
        },
        data: { assignedToId: null, assignedAt: null },
      })

      if (result.count === 0) {
        const exists = await prisma.conversation.findUnique({
          where: { id: request.params.id },
          select: { id: true },
        })
        if (!exists) return reply.notFound(request.t('NOT_FOUND'))
        return reply.conflict(ASSIGNMENT_CONFLICT)
      }

      const updated = await prisma.conversation.findUniqueOrThrow({
        where: { id: request.params.id },
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

  app.post(
    '/:id/close',
    {
      schema: {
        operationId: 'closeConversation',
        tags: ['Conversations'],
        summary: 'Encerra uma conversa',
        params: paramsSchema,
        response: { 200: conversationSchema },
      },
    },
    async (request, reply) => {
      const { conversation, session, role } = await findScopedConversation(
        request,
        request.params.id,
      )
      if (!conversation) return reply.notFound(request.t('NOT_FOUND'))
      if (!canChangeStatus(role)) {
        return reply.forbidden(request.t('FORBIDDEN'))
      }

      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedById: session.user.id,
        },
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

  app.post(
    '/:id/reopen',
    {
      schema: {
        operationId: 'reopenConversation',
        tags: ['Conversations'],
        summary: 'Reabre uma conversa encerrada',
        params: paramsSchema,
        response: { 200: conversationSchema },
      },
    },
    async (request, reply) => {
      const { conversation, role } = await findScopedConversation(
        request,
        request.params.id,
      )
      if (!conversation) return reply.notFound(request.t('NOT_FOUND'))
      if (!canChangeStatus(role)) {
        return reply.forbidden(request.t('FORBIDDEN'))
      }

      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: 'OPEN', closedAt: null, closedById: null },
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
}

export default actionsRoutes
