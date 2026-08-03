/**
 * Validação, envio à Meta, sincronização e exclusão remota.
 *
 * Vive separado de `templates.ts` só por tamanho — é o mesmo subplugin, com o
 * mesmo prefixo `/whatsapp/templates`.
 */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { requireRole } from '@/lib/auth-guard.js'

import { parseDefinition } from '@/lib/whatsapp/templates/definitions.js'
import { syncTemplates } from '@/lib/whatsapp/templates/sync.js'

import {
  deleteRemoteTemplate,
  submitRevision,
} from '@/lib/whatsapp/templates/service.js'

import {
  auditTemplate,
  replyTemplateFailure,
  requireTemplateAccount,
} from './template-guards.js'

import {
  templateDetailSchema,
  templateIssueSchema,
  toTemplateDetail,
} from './template-schemas.js'

import { TEMPLATE_MANAGE_ROLES } from './templates-policy.js'

// ── Schemas ────────────────────────────────────────────

const templateParamsSchema = z.object({ id: z.string() })

// A definição chega solta de propósito: validada pelo schema da rota, o corpo
// inválido viraria 400 e a resposta "inválido, veja os problemas" nunca sairia.
const validateBodySchema = z.object({ definition: z.unknown() })

const submitBodySchema = z.object({
  idempotencyKey: z.string().min(1).optional(),
})

const templatesSubmissionRoutes: FastifyPluginAsyncZod = async app => {
  // POST /whatsapp/templates/validate
  app.post(
    '/validate',
    {
      schema: {
        operationId: 'validateWhatsappTemplateRevision',
        tags: ['WhatsAppTemplates'],
        summary: 'Valida uma definição sem gravar nada',
        body: validateBodySchema,
        response: {
          200: z.object({
            valid: z.boolean(),
            issues: z.array(templateIssueSchema),
          }),
        },
      },
    },
    async request => {
      await requireRole(request, TEMPLATE_MANAGE_ROLES)

      const parsed = parseDefinition(request.body.definition)

      if (parsed.success) return { valid: true, issues: [] }

      return {
        valid: false,
        issues: parsed.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }
    },
  )

  // POST /whatsapp/templates/:id/submit
  app.post(
    '/:id/submit',
    {
      schema: {
        operationId: 'submitWhatsappTemplate',
        tags: ['WhatsAppTemplates'],
        summary: 'Envia o rascunho para aprovação da Meta',
        params: templateParamsSchema,
        body: submitBodySchema,
        response: {
          200: z.object({
            template: templateDetailSchema,
            revisionId: z.string(),
            replayed: z.boolean(),
          }),
        },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'manage')
      if (!context) return reply

      const result = await submitRevision({
        accountId: context.account.id,
        templateId: request.params.id,
        actorId: context.actorId,
        idempotencyKey: request.body.idempotencyKey,
      })

      if (result.status !== 'ok') {
        return replyTemplateFailure(request, reply, result)
      }

      const { template, revisionId, replayed } = result.data

      app.emitRealtimeEvent({
        entity: 'whatsapp-template',
        action: 'updated',
        entityId: template.id,
      })

      await auditTemplate(request, context.actorId, 'template.submitted', {
        templateId: template.id,
        revisionId,
        replayed,
        remoteStatus: template.remoteStatus,
      })

      return { template: toTemplateDetail(template), revisionId, replayed }
    },
  )

  // POST /whatsapp/templates/sync
  app.post(
    '/sync',
    {
      schema: {
        operationId: 'syncWhatsappTemplates',
        tags: ['WhatsAppTemplates'],
        summary: 'Espelha o catálogo da Meta sem tocar nos rascunhos locais',
        response: {
          200: z.object({
            imported: z.number(),
            updated: z.number(),
            failed: z.number(),
            nextCursor: z.null(),
          }),
        },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'manage')
      if (!context) return reply

      const result = await syncTemplates({
        actorId: context.actorId,
        account: context.account,
      })

      if (result.status !== 'ok') {
        return replyTemplateFailure(request, reply, result)
      }

      app.emitRealtimeEvent({
        entity: 'whatsapp-template',
        action: 'updated',
        entityId: context.account.id,
      })

      await auditTemplate(request, context.actorId, 'template.synced', {
        accountId: context.account.id,
        ...result.data,
      })

      return result.data
    },
  )

  // DELETE /whatsapp/templates/:id/remote
  app.delete(
    '/:id/remote',
    {
      schema: {
        operationId: 'deleteWhatsappTemplateRemote',
        tags: ['WhatsAppTemplates'],
        summary: 'Apaga o modelo na Meta e zera o espelho remoto local',
        params: templateParamsSchema,
        response: { 200: templateDetailSchema },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'manage')
      if (!context) return reply

      const result = await deleteRemoteTemplate(
        context.account.id,
        request.params.id,
        context.actorId,
      )

      if (result.status !== 'ok') {
        return replyTemplateFailure(request, reply, result)
      }

      const template = result.data

      app.emitRealtimeEvent({
        entity: 'whatsapp-template',
        action: 'updated',
        entityId: template.id,
      })

      await auditTemplate(request, context.actorId, 'template.remote_deleted', {
        templateId: template.id,
      })

      return toTemplateDetail(template)
    },
  )
}

export default templatesSubmissionRoutes
