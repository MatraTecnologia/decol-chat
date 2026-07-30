import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { getConnection } from '@/lib/whatsapp/connection.js'
import { verifySignature } from '@/lib/whatsapp/signature.js'
import { pushWebhookLog } from '@/lib/whatsapp/webhook-log.js'

const SIGNATURE_HEADER = 'x-hub-signature-256'

// ── Schemas ────────────────────────────────────────────

const verifyQuerySchema = z.object({
  'hub.mode': z.string().optional(),
  'hub.verify_token': z.string().optional(),
  'hub.challenge': z.string().optional(),
})

// ── Helpers ────────────────────────────────────────────

interface MetaWebhookPayload {
  entry?: {
    changes?: {
      field?: string
      value?: {
        statuses?: { id?: string; status?: string; recipient_id?: string }[]
        messages?: { id?: string; from?: string; type?: string }[]
      }
    }[]
  }[]
}

/** Linha curta para o console ficar legível sem expandir o JSON. */
const summarizePayload = (payload: unknown) => {
  const change = (payload as MetaWebhookPayload)?.entry?.[0]?.changes?.[0]
  const value = change?.value

  const status = value?.statuses?.[0]
  if (status) {
    return `status=${status.status ?? '-'} wamid=${status.id ?? '-'}`
  }

  const message = value?.messages?.[0]
  if (message) {
    return `message from=${message.from ?? '-'} type=${message.type ?? '-'}`
  }

  return `evento field=${change?.field ?? '-'}`
}

const headerValue = (request: FastifyRequest, name: string) => {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

/** Headers relevantes para depuração — nunca credenciais. */
const loggableHeaders = (request: FastifyRequest) => ({
  [SIGNATURE_HEADER]: headerValue(request, SIGNATURE_HEADER) ?? '',
  'user-agent': headerValue(request, 'user-agent') ?? '',
  'content-type': headerValue(request, 'content-type') ?? '',
})

/** Log é best-effort: Redis fora do ar não pode mudar a resposta à Meta. */
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

/**
 * A leitura da conexão decifra os segredos e pode lançar quando a
 * WHATSAPP_ENCRYPTION_KEY não está configurada — sem conexão não há como
 * verificar nada, mas isso nunca pode virar 500 para a Meta.
 */
const safeGetConnection = async (app: FastifyInstance) => {
  try {
    return await getConnection()
  } catch (error) {
    app.log.error({ err: error }, 'Falha ao ler a conexão do WhatsApp')
    return null
  }
}

// ── Routes ─────────────────────────────────────────────

const whatsappWebhook: FastifyPluginAsyncZod = async app => {
  // O HMAC da Meta é calculado sobre os bytes originais: o JSON reserializado
  // nunca bate. Este parser é escopado a este plugin (encapsulamento do
  // autoload), então só afeta as rotas deste arquivo.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (request, body, done) => {
      const raw = body as Buffer
      request.rawBody = raw

      if (raw.length === 0) return done(null, {})

      try {
        done(null, JSON.parse(raw.toString('utf8')))
      } catch {
        // Corpo inválido não pode virar 400 — a assinatura decide a resposta
        done(null, {})
      }
    },
  )

  // GET /webhooks/whatsapp — handshake de verificação
  app.get(
    '/whatsapp',
    {
      // A Meta reenvia em erro e pode desativar a assinatura após falhas
      config: { rateLimit: false },
      // O challenge volta cru, em text/plain — o serializer global do Zod
      // devolveria a string entre aspas (JSON)
      serializerCompiler: () => (data: unknown) => String(data),
      schema: {
        operationId: 'verifyWhatsappWebhook',
        tags: ['Webhooks'],
        summary: 'Handshake de verificação do webhook do WhatsApp',
        querystring: verifyQuerySchema,
        response: { 200: z.string() },
      },
    },
    async (request, reply) => {
      const mode = request.query['hub.mode']
      const token = request.query['hub.verify_token']
      const challenge = request.query['hub.challenge'] ?? ''

      const connection = await safeGetConnection(app)

      const valid =
        mode === 'subscribe' &&
        Boolean(token) &&
        Boolean(connection) &&
        token === connection?.verifyToken

      await safePushWebhookLog(app, {
        direction: 'inbound_verify',
        signatureValid: valid,
        summary: `verify mode=${mode ?? '-'} ${valid ? 'ok' : 'token divergente'}`,
        headers: loggableHeaders(request),
        payload: request.query,
      })

      if (!valid) return reply.forbidden('hub.verify_token inválido')

      return reply.type('text/plain').send(challenge)
    },
  )

  // POST /webhooks/whatsapp — ingestão de eventos
  app.post(
    '/whatsapp',
    {
      config: { rateLimit: false },
      schema: {
        operationId: 'receiveWhatsappWebhook',
        tags: ['Webhooks'],
        summary: 'Ingestão de eventos do webhook do WhatsApp',
        // Sem schema de body de propósito: qualquer payload da Meta precisa
        // chegar ao handler, que responde 200 mesmo sem reconhecê-lo
        response: { 200: z.object({ received: z.boolean() }) },
      },
    },
    async (request, reply) => {
      const connection = await safeGetConnection(app)
      const rawBody = request.rawBody

      // Sem raw body não há HMAC possível — nunca recalcular sobre o body
      // parseado, isso seria um bypass silencioso da autenticação
      const valid =
        Boolean(connection) &&
        Boolean(rawBody) &&
        verifySignature(
          rawBody as Buffer,
          headerValue(request, SIGNATURE_HEADER),
          connection?.appSecret ?? '',
        )

      if (!valid) {
        await safePushWebhookLog(app, {
          direction: 'inbound_event',
          signatureValid: false,
          summary: 'assinatura inválida',
          headers: loggableHeaders(request),
          payload: request.body,
        })

        return reply.unauthorized('Assinatura inválida')
      }

      await safePushWebhookLog(app, {
        direction: 'inbound_event',
        signatureValid: true,
        summary: summarizePayload(request.body),
        headers: loggableHeaders(request),
        payload: request.body,
      })

      return { received: true }
    },
  )
}

export default whatsappWebhook
