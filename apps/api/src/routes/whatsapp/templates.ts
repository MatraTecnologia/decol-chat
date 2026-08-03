import { templateDefinitionSchema } from '@workspace/shared/whatsapp-templates'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import type { Prisma } from '@/generated/prisma/client.js'

import { prisma } from '@/lib/prisma.js'
import { requireRole } from '@/lib/auth-guard.js'

import {
  findTemplate,
  templateInclude,
} from '@/lib/whatsapp/templates/repository.js'
import type { TemplateWithRevisions } from '@/lib/whatsapp/templates/repository.js'

import {
  createDraft,
  deleteDraft,
  duplicateTemplate,
  updateDraft,
} from '@/lib/whatsapp/templates/service.js'

import {
  paginate,
  paginatedResponseSchema,
  paginationQuerySchema,
  type PaginationParams,
} from '@/utils/pagination.js'

import templateAssetsRoutes from './template-assets.js'

import {
  auditTemplate,
  findActiveTemplateAccount,
  replyTemplateFailure,
  requireTemplateAccount,
} from './template-guards.js'

import {
  revisionSchema,
  templateDetailSchema,
  templateNameSchema,
  templateSummarySchema,
  toRevisionDetail,
  toTemplateDetail,
  toTemplateSummary,
} from './template-schemas.js'

import templatesSubmissionRoutes from './templates-submission.js'
import { TEMPLATE_READ_ROLES } from './templates-policy.js'

// ── Schemas ────────────────────────────────────────────

const listQuerySchema = z
  .object({
    q: z.string().optional(),
    category: z.string().optional(),
    status: z.string().optional(),
    language: z.string().optional(),
  })
  .extend(paginationQuerySchema.shape)

const templateParamsSchema = z.object({ id: z.string() })

const createDraftBodySchema = z.object({
  name: templateNameSchema,
  definition: templateDefinitionSchema,
})

const updateDraftBodySchema = z.object({
  expectedLockVersion: z.number().int().positive(),
  definition: templateDefinitionSchema,
})

const duplicateBodySchema = z.object({ name: templateNameSchema })

// ── Helpers ────────────────────────────────────────────

const emptyPage = (params: PaginationParams) => ({
  data: [],
  meta: {
    total: 0,
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    totalPages: 0,
    hasNext: false,
  },
})

const templatesRoutes: FastifyPluginAsyncZod = async app => {
  // GET /whatsapp/templates
  app.get(
    '/',
    {
      schema: {
        operationId: 'listWhatsappTemplates',
        tags: ['WhatsAppTemplates'],
        summary: 'Lista os modelos da conta ativa com filtros e paginação',
        querystring: listQuerySchema,
        response: { 200: paginatedResponseSchema(templateSummarySchema) },
      },
    },
    async request => {
      await requireRole(request, TEMPLATE_READ_ROLES)

      const account = await findActiveTemplateAccount()
      if (!account) return emptyPage(request.query)

      const { q, category, status, language } = request.query

      const where: Prisma.WhatsAppTemplateWhereInput = {
        whatsAppAccountId: account.id,
        ...(category ? { category } : {}),
        ...(status ? { remoteStatus: status } : {}),
        ...(language ? { language } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      }

      const page = await paginate<TemplateWithRevisions>(
        prisma.whatsAppTemplate,
        request.query as PaginationParams,
        {
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          include: templateInclude,
        },
      )

      return { data: page.data.map(toTemplateSummary), meta: page.meta }
    },
  )

  // GET /whatsapp/templates/:id
  app.get(
    '/:id',
    {
      schema: {
        operationId: 'getWhatsappTemplate',
        tags: ['WhatsAppTemplates'],
        summary: 'Detalha um modelo com a definição mais recente',
        params: templateParamsSchema,
        response: { 200: templateDetailSchema },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'read')
      if (!context) return reply

      const template = await findTemplate(context.account.id, request.params.id)
      if (!template) return reply.notFound(request.t('NOT_FOUND'))

      return toTemplateDetail(template)
    },
  )

  // GET /whatsapp/templates/:id/revisions
  app.get(
    '/:id/revisions',
    {
      schema: {
        operationId: 'listWhatsappTemplateRevisions',
        tags: ['WhatsAppTemplates'],
        summary: 'Histórico de revisões do modelo, da mais nova para a antiga',
        params: templateParamsSchema,
        response: { 200: z.object({ data: z.array(revisionSchema) }) },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'read')
      if (!context) return reply

      const template = await findTemplate(context.account.id, request.params.id)
      if (!template) return reply.notFound(request.t('NOT_FOUND'))

      return { data: template.revisions.map(toRevisionDetail) }
    },
  )

  // POST /whatsapp/templates
  app.post(
    '/',
    {
      schema: {
        operationId: 'createWhatsappTemplateDraft',
        tags: ['WhatsAppTemplates'],
        summary: 'Cria um modelo com a primeira revisão em rascunho',
        body: createDraftBodySchema,
        response: { 201: templateDetailSchema },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'manage')
      if (!context) return reply

      const result = await createDraft({
        accountId: context.account.id,
        name: request.body.name,
        definition: request.body.definition,
        actorId: context.actorId,
      })

      if (result.status !== 'ok') {
        return replyTemplateFailure(request, reply, result)
      }

      const template = result.data

      app.emitRealtimeEvent({
        entity: 'whatsapp-template',
        action: 'created',
        entityId: template.id,
      })

      await auditTemplate(request, context.actorId, 'template.created', {
        templateId: template.id,
        name: template.name,
        language: template.language,
      })

      return reply.code(201).send(toTemplateDetail(template))
    },
  )

  // PUT /whatsapp/templates/:id
  app.put(
    '/:id',
    {
      schema: {
        operationId: 'updateWhatsappTemplateDraft',
        tags: ['WhatsAppTemplates'],
        summary: 'Edita o rascunho com trava otimista de versão',
        params: templateParamsSchema,
        body: updateDraftBodySchema,
        response: { 200: templateDetailSchema },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'manage')
      if (!context) return reply

      const result = await updateDraft({
        accountId: context.account.id,
        templateId: request.params.id,
        expectedLockVersion: request.body.expectedLockVersion,
        definition: request.body.definition,
        actorId: context.actorId,
      })

      if (result.status !== 'ok') {
        return replyTemplateFailure(request, reply, result)
      }

      const template = result.data

      app.emitRealtimeEvent({
        entity: 'whatsapp-template',
        action: 'updated',
        entityId: template.id,
      })

      await auditTemplate(request, context.actorId, 'template.updated', {
        templateId: template.id,
        expectedLockVersion: request.body.expectedLockVersion,
      })

      return toTemplateDetail(template)
    },
  )

  // POST /whatsapp/templates/:id/duplicate
  app.post(
    '/:id/duplicate',
    {
      schema: {
        operationId: 'duplicateWhatsappTemplate',
        tags: ['WhatsAppTemplates'],
        summary: 'Duplica o modelo em um novo rascunho com outro nome',
        params: templateParamsSchema,
        body: duplicateBodySchema,
        response: { 201: templateDetailSchema },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'manage')
      if (!context) return reply

      const result = await duplicateTemplate({
        accountId: context.account.id,
        templateId: request.params.id,
        name: request.body.name,
        actorId: context.actorId,
      })

      if (result.status !== 'ok') {
        return replyTemplateFailure(request, reply, result)
      }

      const template = result.data

      app.emitRealtimeEvent({
        entity: 'whatsapp-template',
        action: 'created',
        entityId: template.id,
      })

      await auditTemplate(request, context.actorId, 'template.created', {
        templateId: template.id,
        name: template.name,
        duplicatedFrom: request.params.id,
      })

      return reply.code(201).send(toTemplateDetail(template))
    },
  )

  // DELETE /whatsapp/templates/:id
  app.delete(
    '/:id',
    {
      schema: {
        operationId: 'deleteWhatsappTemplateDraft',
        tags: ['WhatsAppTemplates'],
        summary: 'Apaga o rascunho (e o modelo, quando nunca foi enviado)',
        params: templateParamsSchema,
        response: { 200: z.object({ removedTemplate: z.boolean() }) },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'manage')
      if (!context) return reply

      const result = await deleteDraft(
        context.account.id,
        request.params.id,
        context.actorId,
      )

      if (result.status !== 'ok') {
        return replyTemplateFailure(request, reply, result)
      }

      const { removedTemplate } = result.data

      // O modelo continua na lista quando só o rascunho saiu — o evento precisa
      // dizer qual dos dois aconteceu.
      app.emitRealtimeEvent({
        entity: 'whatsapp-template',
        action: removedTemplate ? 'deleted' : 'updated',
        entityId: request.params.id,
      })

      await auditTemplate(request, context.actorId, 'template.deleted', {
        templateId: request.params.id,
        removedTemplate,
      })

      return { removedTemplate }
    },
  )

  // Sub-recursos: validação/envio/sincronização e mídia dos modelos.
  await app.register(templatesSubmissionRoutes)
  await app.register(templateAssetsRoutes)
}

export default templatesRoutes
