import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { env } from '@/env.js'
import { whatsappInboundQueue } from '@/jobs/whatsapp-inbound.js'

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
        metadata?: { phone_number_id?: string }
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
 * Teto para o enfileiramento.
 *
 * Com o Redis fora, o `add` do BullMQ **não rejeita**: o ioredis bufferiza o
 * comando em memória e a promise fica pendurada até reconectar (verificado
 * contra uma porta morta — 5s sem resolver nem rejeitar). Sem este teto o
 * handler seguraria a resposta até a Meta desistir, que é justamente o que o
 * 200 incondicional existe para evitar.
 */
const ENQUEUE_TIMEOUT_MS = 3_000

const enqueueInbound = (payload: unknown) =>
  Promise.race([
    whatsappInboundQueue.add('inbound', { payload }),
    new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(new Error(`enfileiramento excedeu ${ENQUEUE_TIMEOUT_MS}ms`)),
        ENQUEUE_TIMEOUT_MS,
      ).unref()
    }),
  ])

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

      const expected = env.META_WEBHOOK_VERIFY_TOKEN

      const valid =
        mode === 'subscribe' && Boolean(token) && Boolean(expected) && token === expected

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
      const rawBody = request.rawBody

      const appSecret = env.META_APP_SECRET

      // Sem raw body não há HMAC possível — nunca recalcular sobre o body
      // parseado, isso seria um bypass silencioso da autenticação
      const valid =
        Boolean(appSecret) &&
        Boolean(rawBody) &&
        verifySignature(
          rawBody as Buffer,
          headerValue(request, SIGNATURE_HEADER),
          appSecret as string,
        )

      if (!valid) {
        const signatureHeader = headerValue(request, SIGNATURE_HEADER)

        const reason = !appSecret
          ? 'META_APP_SECRET não configurada'
          : !rawBody
            ? 'raw body ausente'
            : !signatureHeader
              ? 'header de assinatura ausente'
              : 'assinatura não confere'

        await safePushWebhookLog(app, {
          direction: 'inbound_event',
          signatureValid: false,
          summary: `assinatura inválida (${reason})`,
          headers: loggableHeaders(request),
          payload: {
            reason,
            signatureHeader: signatureHeader ?? null,
            rawBody: rawBody?.toString('utf8') ?? null,
            parsedBody: request.body ?? null,
          },
        })

        return reply.unauthorized('Assinatura inválida')
      }

      // Daqui pra baixo a assinatura já foi aceita e a resposta é sempre 200:
      // a Meta reenvia em erro e desativa a assinatura após falhas repetidas.
      // Um payload em formato inesperado não pode derrubar a ingestão nem,
      // pior, sumir com o registro que explicaria o que chegou.
      await safePushWebhookLog(app, {
        direction: 'inbound_event',
        signatureValid: true,
        summary: summarizePayload(request.body),
        headers: loggableHeaders(request),
        payload: request.body,
      })

      // Nada de processamento síncrono: a persistência é do worker, que pode
      // ser retentado sem que a Meta veja um erro.
      try {
        await enqueueInbound(request.body)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        app.log.error(
          { err: error },
          'Falha ao enfileirar evento do WhatsApp — evento perdido',
        )

        // Trade-off consciente: com o Redis fora, este evento se perde. Devolver
        // erro faria a Meta reenviar, mas falhas repetidas desativam a
        // assinatura inteira — perder um evento é menos grave que perder a
        // integração. O registro abaixo é o que permite saber o que se perdeu.
        await safePushWebhookLog(app, {
          direction: 'inbound_event',
          signatureValid: true,
          summary: `EVENTO PERDIDO: falha ao enfileirar (${message})`,
          headers: loggableHeaders(request),
          payload: {
            error: message,
            // rawBody entra porque request.body pode estar vazio quando o
            // problema foi no parse — é o único registro do que a Meta mandou
            rawBody: rawBody?.toString('utf8') ?? null,
            parsedBody: request.body ?? null,
          },
        })
      }

      return { received: true }
    },
  )
}

export default whatsappWebhook
