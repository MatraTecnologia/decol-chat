import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { prisma } from '@/lib/prisma.js'
import { getAccountById } from '@/lib/whatsapp/connection.js'

import {
  GraphApiError,
  sendTemplateMessage,
  sendTextMessage,
} from '@/lib/whatsapp/graph-client.js'

import { canSendMessages, findScopedConversation } from './guards.js'
import { isWithinWindow } from './messaging-window.js'
import { messageSchema, messageSelect } from './messages.js'

// ── Schemas ────────────────────────────────────────────

const conversationParamsSchema = z.object({ id: z.string() })

const sendTextBodySchema = z.object({
  text: z.string().min(1).max(4096),
})

const sendTemplateBodySchema = z.object({
  templateName: z.string().min(1),
  languageCode: z.string().default('pt_BR'),
})

const WINDOW_CLOSED =
  'A janela de 24 horas desta conversa expirou. Fora dela o WhatsApp só aceita mensagens de modelo (template).'

const NO_ACCOUNT =
  'A conexão WhatsApp desta conversa não está ativa. Revise as credenciais na página de Conexão.'

// ── Helpers ────────────────────────────────────────────

/**
 * Preâmbulo comum das rotas de envio: responde e devolve `null` quando o
 * envio não pode prosseguir. Fora do escopo é 404 antes de avaliar a
 * permissão — um 403 revelaria que a conversa de outro existe.
 */
const prepareSend = async (
  request: FastifyRequest,
  reply: FastifyReply,
  conversationId: string,
) => {
  const { conversation, session, role } = await findScopedConversation(
    request,
    conversationId,
  )

  if (!conversation) {
    reply.notFound(request.t('NOT_FOUND'))
    return null
  }

  if (!canSendMessages(role)) {
    reply.forbidden(request.t('FORBIDDEN'))
    return null
  }

  return { conversation, session }
}

/**
 * A mensagem já está gravada em PENDING — aqui ela vira SENT ou FAILED.
 * Falha da Meta não vira erro HTTP: o cliente precisa da bolha no estado de
 * falha para oferecer reenvio, e um 4xx faria ele descartá-la.
 */
const finalizeSend = async (
  messageId: string,
  send: () => Promise<{ messages: { id: string }[] }>,
) => {
  try {
    const result = await send()

    return await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', waMessageId: result.messages[0]?.id ?? null },
      select: messageSelect,
    })
  } catch (error) {
    const graphError = error instanceof GraphApiError ? error : null

    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        errorCode: graphError
          ? String(graphError.code ?? graphError.status)
          : null,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      select: messageSelect,
    })

    // Só a falha da Graph API é esperada; qualquer outra é bug e deve estourar
    // (a mensagem já ficou registrada como FAILED, não some da conversa).
    if (!graphError) throw error

    return message
  }
}

type SentMessage = Awaited<ReturnType<typeof finalizeSend>>

/** Preview desnormalizado + evento com corpo, para a thread aberta dar append. */
const publish = async (
  app: FastifyInstance,
  conversationId: string,
  message: SentMessage,
  preview: string,
) => {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: message.createdAt, lastMessageText: preview },
  })

  app.emitRealtimeEvent({
    entity: 'message',
    action: 'created',
    entityId: message.id,
    payload: message,
  })
}

const sendRoutes: FastifyPluginAsyncZod = async app => {
  // POST /conversations/:id/messages
  app.post(
    '/:id/messages',
    {
      schema: {
        operationId: 'sendMessage',
        tags: ['Messages'],
        summary: 'Envia uma mensagem de texto na conversa',
        params: conversationParamsSchema,
        body: sendTextBodySchema,
        response: { 200: messageSchema },
      },
    },
    async (request, reply) => {
      const prepared = await prepareSend(request, reply, request.params.id)
      if (!prepared) return reply

      const { conversation, session } = prepared

      // Recalculado aqui: o `canSendFreeText` do GET pode ter expirado desde
      // que a tela foi carregada.
      if (!isWithinWindow(conversation.lastInboundAt)) {
        return reply.unprocessableEntity(WINDOW_CLOSED)
      }

      const account = await getAccountById(conversation.whatsAppAccountId)
      if (!account) return reply.serviceUnavailable(NO_ACCOUNT)

      const { text } = request.body

      const pending = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: session.user.id,
          direction: 'OUTBOUND',
          type: 'TEXT',
          status: 'PENDING',
          content: text,
        },
        select: { id: true },
      })

      const message = await finalizeSend(pending.id, () =>
        sendTextMessage(
          account.accessToken,
          account.phoneNumberId,
          conversation.contact.waId,
          text,
        ),
      )

      await publish(app, conversation.id, message, text)

      return message
    },
  )

  // POST /conversations/:id/messages/template
  app.post(
    '/:id/messages/template',
    {
      schema: {
        operationId: 'sendTemplateMessage',
        tags: ['Messages'],
        summary: 'Envia uma mensagem de modelo (válida fora da janela de 24h)',
        params: conversationParamsSchema,
        body: sendTemplateBodySchema,
        response: { 200: messageSchema },
      },
    },
    async (request, reply) => {
      const prepared = await prepareSend(request, reply, request.params.id)
      if (!prepared) return reply

      const { conversation, session } = prepared

      const account = await getAccountById(conversation.whatsAppAccountId)
      if (!account) return reply.serviceUnavailable(NO_ACCOUNT)

      const { templateName, languageCode } = request.body

      const pending = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: session.user.id,
          direction: 'OUTBOUND',
          type: 'TEMPLATE',
          status: 'PENDING',
          templateName,
        },
        select: { id: true },
      })

      const message = await finalizeSend(pending.id, () =>
        sendTemplateMessage(
          account.accessToken,
          account.phoneNumberId,
          conversation.contact.waId,
          templateName,
          languageCode,
        ),
      )

      await publish(app, conversation.id, message, `Modelo: ${templateName}`)

      return message
    },
  )
}

export default sendRoutes
