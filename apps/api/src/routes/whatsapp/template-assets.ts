/**
 * Upload da mídia de exemplo dos modelos.
 *
 * O navegador só recebe URL assinada de curta duração — a chave do bucket
 * privado nunca aparece na resposta. Na definição do modelo fica apenas o
 * `assetId`.
 */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import {
  confirmAssetUpload,
  ensureMetaUploadHandle,
  getAssetPreviewUrl,
  prepareAssetUpload,
} from '@/lib/whatsapp/templates/assets.js'

import {
  auditTemplate,
  replyTemplateFailure,
  requireTemplateAccount,
} from './template-guards.js'

// ── Schemas ────────────────────────────────────────────

const assetParamsSchema = z.object({ assetId: z.string() })

const prepareBodySchema = z.object({
  revisionId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive(),
})

const preparedSchema = z.object({
  assetId: z.string(),
  kind: z.string(),
  uploadUrl: z.string(),
  expiresIn: z.number(),
})

const confirmedSchema = z.object({
  assetId: z.string(),
  kind: z.string(),
  mimeType: z.string(),
  byteSize: z.number(),
  metaHandle: z.string(),
  reusedMetaHandle: z.boolean(),
})

const previewSchema = z.object({
  url: z.string(),
  expiresIn: z.number(),
})

const templateAssetsRoutes: FastifyPluginAsyncZod = async app => {
  // POST /whatsapp/templates/assets/prepare
  app.post(
    '/assets/prepare',
    {
      schema: {
        operationId: 'prepareWhatsappTemplateAssetUpload',
        tags: ['WhatsAppTemplates'],
        summary: 'Abre um upload assinado no bucket privado para a mídia',
        body: prepareBodySchema,
        response: { 200: preparedSchema },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'manage')
      if (!context) return reply

      const result = await prepareAssetUpload({
        accountId: context.account.id,
        revisionId: request.body.revisionId,
        fileName: request.body.fileName,
        mimeType: request.body.mimeType,
        byteSize: request.body.byteSize,
      })

      if (result.status !== 'ok') {
        return replyTemplateFailure(request, reply, result)
      }

      return result.data
    },
  )

  // POST /whatsapp/templates/assets/:assetId/confirm
  app.post(
    '/assets/:assetId/confirm',
    {
      schema: {
        operationId: 'confirmWhatsappTemplateAssetUpload',
        tags: ['WhatsAppTemplates'],
        summary: 'Confere o arquivo enviado e gera o handle de upload da Meta',
        params: assetParamsSchema,
        response: { 200: confirmedSchema },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'manage')
      if (!context) return reply

      const confirmed = await confirmAssetUpload(
        context.account.id,
        request.params.assetId,
      )

      if (confirmed.status !== 'ok') {
        return replyTemplateFailure(request, reply, confirmed)
      }

      // Sem `appId` na conta a conversão devolve 422 acionável — é aqui que a
      // página descobre que falta completar a conexão.
      const handle = await ensureMetaUploadHandle(
        context.account,
        request.params.assetId,
      )

      if (handle.status !== 'ok') {
        return replyTemplateFailure(request, reply, handle)
      }

      await auditTemplate(request, context.actorId, 'template.asset_uploaded', {
        assetId: confirmed.data.assetId,
        kind: confirmed.data.kind,
        byteSize: confirmed.data.byteSize,
      })

      return {
        ...confirmed.data,
        metaHandle: handle.data.metaHandle,
        reusedMetaHandle: handle.data.reused,
      }
    },
  )

  // GET /whatsapp/templates/assets/:assetId/preview
  app.get(
    '/assets/:assetId/preview',
    {
      schema: {
        operationId: 'getWhatsappTemplateAssetPreview',
        tags: ['WhatsAppTemplates'],
        summary: 'Devolve uma URL assinada curta para pré-visualizar a mídia',
        params: assetParamsSchema,
        response: { 200: previewSchema },
      },
    },
    async (request, reply) => {
      const context = await requireTemplateAccount(request, reply, 'read')
      if (!context) return reply

      const result = await getAssetPreviewUrl(
        context.account.id,
        request.params.assetId,
      )

      if (result.status !== 'ok') {
        return replyTemplateFailure(request, reply, result)
      }

      return result.data
    },
  )
}

export default templateAssetsRoutes
