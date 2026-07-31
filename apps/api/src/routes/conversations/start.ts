import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { requireRole } from '@/lib/auth-guard.js'
import { prisma } from '@/lib/prisma.js'
import { getConnection } from '@/lib/whatsapp/connection.js'

import {
  GraphApiError,
  sendTemplateMessage,
} from '@/lib/whatsapp/graph-client.js'

import { isValidPhone, phoneKey, toSendFormat } from '@/lib/whatsapp/phone.js'

import {
  CONVERSATION_READERS,
  canSendMessages,
  conversationRelationsInclude,
} from './guards.js'

import { messageSelect } from './messages.js'
import { assigneeSummarySchema, conversationSchema } from './schemas.js'

// ── Schemas ────────────────────────────────────────────

const startBodySchema = z.object({
  phone: z.string().min(1),
  templateName: z.string().min(1),
  languageCode: z.string().default('pt_BR'),
  name: z.string().min(1).optional(),
})

const startResponseSchema = z.object({
  conversation: conversationSchema,
  /** `true` quando a conversa foi criada agora; `false` reaproveita a aberta. */
  created: z.boolean(),
  /**
   * Último atendente que já falou com esse contato, quando não é o próprio
   * solicitante. O histórico dele continua fora do alcance de quem não o
   * enxerga — isto é só o aviso "Fulano já conversou com essa pessoa".
   */
  previousAssignee: assigneeSummarySchema.nullable(),
})

const INVALID_PHONE =
  'Telefone inválido. Informe DDI + DDD + número, por exemplo 55 43 99914-0409.'

const NO_ACCOUNT =
  'Nenhuma conexão WhatsApp ativa. Configure as credenciais na página de Conexão.'

const PERSIST_FAILED =
  'A mensagem foi enviada ao WhatsApp, mas o registro da conversa falhou. Verifique antes de tentar de novo.'

/** Conversas ainda em atendimento — reaproveitadas em vez de duplicadas. */
const ONGOING = ['OPEN', 'PENDING'] as const

// ── Helpers ────────────────────────────────────────────

/** Mesma tradução de erro da Graph usada nas rotas de /whatsapp. */
const toGraphError = (error: unknown) => {
  if (!(error instanceof GraphApiError)) return null

  return {
    isClient: error.status < 500,
    message: error.code
      ? `${error.message} (código ${error.code})`
      : error.message,
  }
}

/**
 * O contato é procurado pelas duas chaves: `phoneKey` é a canônica, mas uma
 * linha antiga pode ter só o `waId` preenchido — e a criação cega colidiria
 * com o `@@unique([whatsAppAccountId, waId])`.
 */
const contactFilter = (key: string, waId: string) => ({
  OR: [{ phoneKey: key }, { waId }],
})

const startRoutes: FastifyPluginAsyncZod = async app => {
  // POST /conversations/start
  app.post(
    '/start',
    {
      schema: {
        operationId: 'startConversation',
        tags: ['Conversations'],
        summary: 'Inicia uma conversa com um número novo via modelo (template)',
        body: startBodySchema,
        response: { 200: startResponseSchema },
      },
    },
    async (request, reply) => {
      const { session, role } = await requireRole(request, [
        ...CONVERSATION_READERS,
      ])

      if (!canSendMessages(role)) return reply.forbidden(request.t('FORBIDDEN'))

      const { phone, templateName, languageCode, name } = request.body

      if (!isValidPhone(phone)) return reply.badRequest(INVALID_PHONE)

      const account = await getConnection()
      if (!account) return reply.serviceUnavailable(NO_ACCOUNT)

      const key = phoneKey(phone)
      const to = toSendFormat(phone)

      const sameContact = {
        whatsAppAccountId: account.id,
        contact: contactFilter(key, to),
      }

      // Conversa ATIVA de qualquer atendente bloqueia — deliberadamente sem
      // `scopeConversations`. O cliente não pode receber duas abordagens
      // simultâneas da mesma empresa só porque um vendedor não enxerga a
      // conversa do outro. A checagem vem antes do envio para não gastar um
      // template à toa, e `previousAssignee` diz ao front com quem ele está.
      const ongoing = await prisma.conversation.findFirst({
        where: { AND: [sameContact, { status: { in: [...ONGOING] } }] },
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }],
        include: conversationRelationsInclude,
      })

      if (ongoing) {
        return {
          conversation: ongoing,
          created: false,
          previousAssignee: ongoing.assignedTo ?? null,
        }
      }

      // Nenhuma conversa ativa: recontato é liberado. Este campo avisa quem
      // atendeu da última vez — inclusive em conversa já encerrada, que é o
      // caso comum de cliente antigo voltando.
      const previous = await prisma.conversation.findFirst({
        where: {
          AND: [
            sameContact,
            { assignedToId: { not: null } },
            { assignedToId: { not: session.user.id } },
          ],
        },
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }],
        select: { assignedTo: conversationRelationsInclude.assignedTo },
      })

      const previousAssignee = previous?.assignedTo ?? null

      // ENVIA PRIMEIRO. Número inexistente no WhatsApp, template não aprovado
      // ou destinatário fora da allowed list falham aqui — e nada foi gravado,
      // então não sobra contato órfão nem conversa vazia.
      let result
      try {
        result = await sendTemplateMessage(
          account.accessToken,
          account.phoneNumberId,
          to,
          templateName,
          languageCode,
        )
      } catch (error) {
        const graphError = toGraphError(error)
        if (!graphError) throw error

        return graphError.isClient
          ? reply.badRequest(graphError.message)
          : reply.badGateway(graphError.message)
      }

      // O `wa_id` da resposta é o identificador que vai voltar no webhook —
      // gravar o número digitado no lugar dele quebraria o casamento.
      const waId = result.contacts?.[0]?.wa_id ?? to
      const waMessageId = result.messages[0]?.id ?? null
      const preview = `Modelo: ${templateName}`

      // Só a transação entra no try: um erro na emissão do evento não pode
      // virar "o registro falhou" depois de o commit ter passado.
      let persisted

      try {
        persisted = await prisma.$transaction(async tx => {
          const existing = await tx.contact.findFirst({
            where: {
              whatsAppAccountId: account.id,
              ...contactFilter(key, waId),
            },
            select: { id: true },
          })

          const contact = existing
            ? await tx.contact.update({
                where: { id: existing.id },
                data: {
                  waId,
                  phoneNumber: to,
                  phoneKey: key,
                  // Sem nome no formulário, o nome já cadastrado permanece.
                  ...(name ? { name } : {}),
                },
                select: { id: true },
              })
            : await tx.contact.create({
                data: {
                  whatsAppAccountId: account.id,
                  waId,
                  phoneNumber: to,
                  phoneKey: key,
                  name: name ?? null,
                },
                select: { id: true },
              })

          const created = await tx.conversation.create({
            data: {
              whatsAppAccountId: account.id,
              contactId: contact.id,
              status: 'OPEN',
              assignedToId: session.user.id,
              assignedAt: new Date(),
            },
            select: { id: true },
          })

          await tx.conversationAssignmentHistory.create({
            data: {
              conversationId: created.id,
              toUserId: session.user.id,
              actorId: session.user.id,
              reason: 'MANUAL',
            },
          })

          const message = await tx.message.create({
            data: {
              conversationId: created.id,
              senderId: session.user.id,
              direction: 'OUTBOUND',
              type: 'TEMPLATE',
              status: 'SENT',
              waMessageId,
              templateName,
            },
            select: messageSelect,
          })

          // `lastInboundAt` fica nulo de propósito: não houve inbound, e é ele
          // que abre a janela de 24h de texto livre.
          const conversation = await tx.conversation.update({
            where: { id: created.id },
            data: {
              lastMessageAt: message.createdAt,
              lastMessageText: preview,
            },
            include: conversationRelationsInclude,
          })

          return { conversation, message }
        })
      } catch (error) {
        app.log.error(
          { err: error, to, waId, waMessageId },
          'template enviado, mas o registro da conversa falhou',
        )

        return reply.internalServerError(PERSIST_FAILED)
      }

      const { conversation, message } = persisted

      app.emitRealtimeEvent({
        entity: 'conversation',
        action: 'created',
        entityId: conversation.id,
      })

      app.emitRealtimeEvent({
        entity: 'message',
        action: 'created',
        entityId: message.id,
        payload: message,
      })

      return { conversation, created: true, previousAssignee }
    },
  )
}

export default startRoutes
