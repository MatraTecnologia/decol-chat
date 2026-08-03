import type { FastifyInstance } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { requireRole } from '@/lib/auth-guard.js'

import {
  deleteConnection,
  getConnection,
  maskSecret,
  resolveWebhookUrl,
  updateConnectionMeta,
  upsertConnection,
  type DecryptedConnection,
} from '@/lib/whatsapp/connection.js'

import { isEncryptionConfigured } from '@/lib/whatsapp/crypto.js'

import {
  GraphApiError,
  getPhoneNumberInfo,
  listPhoneNumbers,
  sendTemplateMessage,
  sendTextMessage,
  subscribeApp,
} from '@/lib/whatsapp/graph-client.js'

import { runReadinessChecks } from '@/lib/whatsapp/readiness.js'

import { listWebhookLogs, pushWebhookLog } from '@/lib/whatsapp/webhook-log.js'

import embeddedSignupRoutes from './embedded-signup.js'
import templatesRoutes from './templates.js'

const LOCAL_HOSTS = ['localhost', '127.0.0.1']

const MISSING_ENCRYPTION_KEY =
  'WHATSAPP_ENCRYPTION_KEY não configurada — defina a chave no .env da API'

// ── Schemas ────────────────────────────────────────────

const connectionSchema = z.object({
  accessToken: z.string(),
  phoneNumberId: z.string(),
  wabaId: z.string(),
  appId: z.string().nullable(),
  webhookBaseUrl: z.string().nullable(),
  displayPhoneNumber: z.string().nullable(),
  verifiedName: z.string().nullable(),
  qualityRating: z.string().nullable(),
  lastCheckedAt: z.date().nullable(),
})

const statusSchema = z.object({
  configured: z.boolean(),
  connection: connectionSchema.nullable(),
  webhookUrl: z.string(),
  encryptionConfigured: z.boolean(),
  webhookBaseIsLocal: z.boolean(),
})

const connectionBodySchema = z.object({
  accessToken: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  appId: z.string().optional(),
  webhookBaseUrl: z.string().optional(),
})

const phoneNumberInfoSchema = z.object({
  id: z.string(),
  displayPhoneNumber: z.string().nullable(),
  verifiedName: z.string().nullable(),
  qualityRating: z.string().nullable(),
  messagingLimitTier: z.string().nullable(),
  checkedAt: z.date(),
})

const readinessCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['ok', 'pending', 'error', 'skipped']),
  detail: z.string(),
  action: z.enum(['subscribe_app', 'select_number']).nullable(),
})

const phoneNumberEntrySchema = z.object({
  id: z.string(),
  displayPhoneNumber: z.string().nullable(),
  verifiedName: z.string().nullable(),
  qualityRating: z.string().nullable(),
  platformType: z.string().nullable(),
  codeVerificationStatus: z.string().nullable(),
})

const webhookLogEntrySchema = z.object({
  id: z.string(),
  receivedAt: z.string(),
  direction: z.string(),
  signatureValid: z.boolean().optional(),
  summary: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  payload: z.unknown().optional(),
})

// ── Helpers ────────────────────────────────────────────

/**
 * Erros da Graph API são propagados com o texto original da Meta — numa bancada
 * de testes, mascarar a mensagem real destrói o valor da ferramenta.
 */
const toGraphError = (error: unknown) => {
  if (!(error instanceof GraphApiError)) return null

  return {
    isClient: error.status < 500,
    message: error.code
      ? `${error.message} (código ${error.code})`
      : error.message,
  }
}

const toMaskedConnection = (connection: DecryptedConnection) => ({
  accessToken: maskSecret(connection.accessToken),
  phoneNumberId: connection.phoneNumberId,
  wabaId: connection.wabaId,
  appId: connection.appId,
  webhookBaseUrl: connection.webhookBaseUrl,
  displayPhoneNumber: connection.displayPhoneNumber,
  verifiedName: connection.verifiedName,
  qualityRating: connection.qualityRating,
  lastCheckedAt: connection.lastCheckedAt,
})

const isLocalUrl = (url: string) => LOCAL_HOSTS.some(host => url.includes(host))

const buildStatus = (connection: DecryptedConnection | null) => {
  const webhookUrl = resolveWebhookUrl(connection)

  return {
    configured: Boolean(connection),
    connection: connection ? toMaskedConnection(connection) : null,
    webhookUrl,
    encryptionConfigured: isEncryptionConfigured(),
    webhookBaseIsLocal: isLocalUrl(webhookUrl),
  }
}

/** Log é best-effort: Redis fora do ar não pode derrubar a resposta. */
const safePushWebhookLog = async (
  app: FastifyInstance,
  entry: Parameters<typeof pushWebhookLog>[1],
) => {
  try {
    await pushWebhookLog(app, entry)
  } catch (error) {
    app.log.warn({ err: error }, 'Falha ao registrar log de webhook')
  }
}

// ── Routes ─────────────────────────────────────────────

const whatsappRoutes: FastifyPluginAsyncZod = async app => {
  // GET /whatsapp
  app.get(
    '/',
    {
      schema: {
        operationId: 'getWhatsappConnection',
        tags: ['WhatsApp'],
        summary: 'Estado da conexão WhatsApp (segredos mascarados)',
        response: { 200: statusSchema },
      },
    },
    async request => {
      await requireRole(request, ['admin'])

      // Sem a chave de criptografia não dá para decifrar a conexão, mas a
      // página precisa renderizar o alerta explicando o que falta.
      if (!isEncryptionConfigured()) return buildStatus(null)

      return buildStatus(await getConnection())
    },
  )

  // PUT /whatsapp
  app.put(
    '/',
    {
      schema: {
        operationId: 'updateWhatsappConnection',
        tags: ['WhatsApp'],
        summary: 'Salva as credenciais (valida na Graph API antes de gravar)',
        body: connectionBodySchema,
        response: { 200: statusSchema },
      },
    },
    async (request, reply) => {
      await requireRole(request, ['admin'])

      if (!isEncryptionConfigured()) {
        return reply.serviceUnavailable(MISSING_ENCRYPTION_KEY)
      }

      const body = request.body

      try {
        // Valida com as credenciais recebidas, nunca com as já gravadas
        const info = await getPhoneNumberInfo(
          body.accessToken,
          body.phoneNumberId,
        )

        await upsertConnection({
          accessToken: body.accessToken,
          phoneNumberId: body.phoneNumberId,
          wabaId: body.wabaId,
          appId: body.appId,
          webhookBaseUrl: body.webhookBaseUrl,
        })

        await updateConnectionMeta({
          displayPhoneNumber: info.display_phone_number,
          verifiedName: info.verified_name,
          qualityRating: info.quality_rating,
          lastCheckedAt: new Date(),
        })

        app.emitRealtimeEvent({
          entity: 'whatsappConnection',
          action: 'updated',
          entityId: 'singleton',
        })

        return buildStatus(await getConnection())
      } catch (error) {
        const graphError = toGraphError(error)
        if (!graphError) throw error

        return graphError.isClient
          ? reply.badRequest(graphError.message)
          : reply.badGateway(graphError.message)
      }
    },
  )

  // DELETE /whatsapp
  app.delete(
    '/',
    {
      schema: {
        operationId: 'deleteWhatsappConnection',
        tags: ['WhatsApp'],
        summary: 'Remove a conexão WhatsApp',
        response: { 200: z.object({ deleted: z.boolean() }) },
      },
    },
    async request => {
      await requireRole(request, ['admin'])

      await deleteConnection()

      app.emitRealtimeEvent({
        entity: 'whatsappConnection',
        action: 'deleted',
        entityId: 'singleton',
      })

      return { deleted: true }
    },
  )

  // GET /whatsapp/health
  app.get(
    '/health',
    {
      schema: {
        operationId: 'checkWhatsappHealth',
        tags: ['WhatsApp'],
        summary: 'Consulta o número na Graph API (nome, qualidade e tier)',
        response: { 200: phoneNumberInfoSchema },
      },
    },
    async (request, reply) => {
      await requireRole(request, ['admin'])

      if (!isEncryptionConfigured()) {
        return reply.serviceUnavailable(MISSING_ENCRYPTION_KEY)
      }

      const connection = await getConnection()
      if (!connection) return reply.notFound(request.t('NOT_FOUND'))

      try {
        const info = await getPhoneNumberInfo(
          connection.accessToken,
          connection.phoneNumberId,
        )

        const checkedAt = new Date()

        await updateConnectionMeta({
          displayPhoneNumber: info.display_phone_number,
          verifiedName: info.verified_name,
          qualityRating: info.quality_rating,
          lastCheckedAt: checkedAt,
        })

        await safePushWebhookLog(app, {
          direction: 'outbound',
          summary: `health phone_number_id=${connection.phoneNumberId} quality=${info.quality_rating ?? '-'}`,
          payload: info,
        })

        // A consulta é GET, mas grava qualidade e `lastCheckedAt` — os outros
        // admins veem o cartão de conexão desatualizado sem este evento.
        app.emitRealtimeEvent({
          entity: 'whatsappConnection',
          action: 'updated',
          entityId: 'singleton',
        })

        return {
          id: info.id,
          displayPhoneNumber: info.display_phone_number ?? null,
          verifiedName: info.verified_name ?? null,
          qualityRating: info.quality_rating ?? null,
          messagingLimitTier: info.messaging_limit_tier ?? null,
          checkedAt,
        }
      } catch (error) {
        const graphError = toGraphError(error)
        if (!graphError) throw error

        return graphError.isClient
          ? reply.badRequest(graphError.message)
          : reply.badGateway(graphError.message)
      }
    },
  )

  // GET /whatsapp/readiness
  app.get(
    '/readiness',
    {
      schema: {
        operationId: 'getWhatsappReadiness',
        tags: ['WhatsApp'],
        summary: 'Diagnóstico completo do setup (roda todas as verificações)',
        response: {
          200: z.object({ checks: z.array(readinessCheckSchema) }),
        },
      },
    },
    async request => {
      await requireRole(request, ['admin'])

      // Sem guardas de criptografia ou conexão: o diagnóstico existe justamente
      // para explicar o que falta quando nada está configurado.
      return { checks: await runReadinessChecks() }
    },
  )

  // GET /whatsapp/phone-numbers
  app.get(
    '/phone-numbers',
    {
      schema: {
        operationId: 'listWhatsappPhoneNumbers',
        tags: ['WhatsApp'],
        summary: 'Lista os números do WABA na Cloud API',
        response: { 200: z.object({ data: z.array(phoneNumberEntrySchema) }) },
      },
    },
    async (request, reply) => {
      await requireRole(request, ['admin'])

      if (!isEncryptionConfigured()) {
        return reply.serviceUnavailable(MISSING_ENCRYPTION_KEY)
      }

      const connection = await getConnection()
      if (!connection) return reply.notFound(request.t('NOT_FOUND'))

      try {
        const result = await listPhoneNumbers(
          connection.accessToken,
          connection.wabaId,
        )

        return {
          data: result.data.map(entry => ({
            id: entry.id,
            displayPhoneNumber: entry.display_phone_number ?? null,
            verifiedName: entry.verified_name ?? null,
            qualityRating: entry.quality_rating ?? null,
            platformType: entry.platform_type ?? null,
            codeVerificationStatus: entry.code_verification_status ?? null,
          })),
        }
      } catch (error) {
        const graphError = toGraphError(error)
        if (!graphError) throw error

        return graphError.isClient
          ? reply.badRequest(graphError.message)
          : reply.badGateway(graphError.message)
      }
    },
  )

  // POST /whatsapp/subscribe-app
  app.post(
    '/subscribe-app',
    {
      schema: {
        operationId: 'subscribeWhatsappApp',
        tags: ['WhatsApp'],
        summary: 'Inscreve o app no WABA para receber os webhooks',
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (request, reply) => {
      await requireRole(request, ['admin'])

      if (!isEncryptionConfigured()) {
        return reply.serviceUnavailable(MISSING_ENCRYPTION_KEY)
      }

      const connection = await getConnection()
      if (!connection) return reply.notFound(request.t('NOT_FOUND'))

      try {
        const result = await subscribeApp(
          connection.accessToken,
          connection.wabaId,
        )

        await safePushWebhookLog(app, {
          direction: 'outbound',
          summary: `subscribe_app waba_id=${connection.wabaId} success=${result.success}`,
          payload: result,
        })

        app.emitRealtimeEvent({
          entity: 'whatsappConnection',
          action: 'updated',
          entityId: 'singleton',
        })

        return { success: result.success }
      } catch (error) {
        const graphError = toGraphError(error)
        if (!graphError) throw error

        return graphError.isClient
          ? reply.badRequest(graphError.message)
          : reply.badGateway(graphError.message)
      }
    },
  )

  // POST /whatsapp/test-message
  app.post(
    '/test-message',
    {
      schema: {
        operationId: 'sendWhatsappTestMessage',
        tags: ['WhatsApp'],
        summary: 'Envia uma mensagem de teste (texto livre ou template)',
        body: z.object({
          to: z.string().min(1),
          kind: z.enum(['text', 'template']).default('text'),
          text: z.string().optional(),
          templateName: z.string().optional(),
          languageCode: z.string().default('en_US'),
        }),
        response: { 200: z.object({ messageId: z.string() }) },
      },
    },
    async (request, reply) => {
      await requireRole(request, ['admin'])

      if (!isEncryptionConfigured()) {
        return reply.serviceUnavailable(MISSING_ENCRYPTION_KEY)
      }

      const connection = await getConnection()
      if (!connection) return reply.notFound(request.t('NOT_FOUND'))

      const { to, kind, text, templateName, languageCode } = request.body

      if (kind === 'text' && !text) {
        return reply.badRequest('Informe o texto da mensagem')
      }
      if (kind === 'template' && !templateName) {
        return reply.badRequest('Informe o nome do template')
      }

      try {
        const result =
          kind === 'template'
            ? await sendTemplateMessage(
                connection.accessToken,
                connection.phoneNumberId,
                to,
                templateName as string,
                languageCode,
              )
            : await sendTextMessage(
                connection.accessToken,
                connection.phoneNumberId,
                to,
                text as string,
              )

        const messageId = result.messages[0]?.id ?? ''

        await safePushWebhookLog(app, {
          direction: 'outbound',
          summary: `${kind} to=${to} wamid=${messageId || '-'}`,
          payload: { to, kind, text, templateName, languageCode, result },
        })

        return { messageId }
      } catch (error) {
        const graphError = toGraphError(error)
        if (!graphError) throw error

        return graphError.isClient
          ? reply.badRequest(graphError.message)
          : reply.badGateway(graphError.message)
      }
    },
  )

  // GET /whatsapp/logs
  app.get(
    '/logs',
    {
      schema: {
        operationId: 'listWhatsappLogs',
        tags: ['WhatsApp'],
        summary: 'Histórico do console de webhooks (seed do stream)',
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(200),
        }),
        response: { 200: z.object({ data: z.array(webhookLogEntrySchema) }) },
      },
    },
    async request => {
      await requireRole(request, ['admin'])

      const data = await listWebhookLogs(request.query.limit)

      return { data }
    },
  )

  // Catálogo de modelos: /whatsapp/templates/...
  await app.register(templatesRoutes, { prefix: '/templates' })

  // Conclusão do Embedded Signup: /whatsapp/connection/embedded-signup
  await app.register(embeddedSignupRoutes)
}

export default whatsappRoutes
