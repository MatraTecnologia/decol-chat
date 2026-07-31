import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import type { Prisma } from '@/generated/prisma/client.js'

import {
  ConversationPrioritySchema,
  ConversationStatusSchema,
} from '@/generated/zod/schemas.js'

import { requireRole } from '@/lib/auth-guard.js'
import { prisma } from '@/lib/prisma.js'

import { scopeConversations } from '@/routes/conversations/guards.js'

import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/utils/pagination.js'

import { findContactActivity, listContactActivityPage } from './activity.js'

import {
  CONTACT_READERS,
  CONTACT_WRITERS,
  contactSelect,
  findScopedContact,
  scopeContacts,
} from './guards.js'

// ── Schemas ────────────────────────────────────────────

const contactSchema = z.object({
  id: z.string(),
  whatsAppAccountId: z.string(),
  waId: z.string(),
  phoneNumber: z.string(),
  name: z.string().nullable(),
  profileName: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  isBlocked: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

const contactActivitySchema = z.object({
  conversationCount: z.number(),
  openConversationCount: z.number(),
  lastInteractionAt: z.date().nullable(),
})

const contactListItemSchema = contactSchema.extend(contactActivitySchema.shape)

const contactConversationSchema = z.object({
  id: z.string(),
  status: ConversationStatusSchema,
  priority: ConversationPrioritySchema,
  subject: z.string().nullable(),
  lastMessageAt: z.date().nullable(),
  assignedTo: z
    .object({
      id: z.string(),
      name: z.string(),
      image: z.string().nullable(),
    })
    .nullable(),
})

const contactDetailSchema = contactListItemSchema.extend({
  conversations: z.array(contactConversationSchema),
})

const listQuerySchema = z
  .object({
    q: z.string().optional(),
    // `z.coerce.boolean()` transforma "false" em `true`; o transform explícito
    // é o mesmo padrão já usado no filtro `isStaff` de /users.
    isBlocked: z
      .string()
      .optional()
      .transform(v =>
        v === undefined ? undefined : v !== 'false' && v !== '0',
      ),
  })
  .extend(paginationQuerySchema.shape)

const contactParamsSchema = z.object({ id: z.string() })

const updateContactBodySchema = z.object({
  name: z.string().trim().min(1).max(120).nullable().optional(),
  email: z.email().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const blockContactBodySchema = z.object({ blocked: z.boolean() })

/** Conversas mostradas na ficha do contato. */
const CONTACT_CONVERSATIONS_LIMIT = 20

const contactConversationSelect = {
  id: true,
  status: true,
  priority: true,
  subject: true,
  lastMessageAt: true,
  assignedTo: { select: { id: true, name: true, image: true } },
} satisfies Prisma.ConversationSelect

const contactsRoutes: FastifyPluginAsyncZod = async app => {
  // GET /contacts
  app.get(
    '/',
    {
      schema: {
        operationId: 'listContacts',
        tags: ['Contacts'],
        summary: 'Lista contatos visíveis para o solicitante',
        querystring: listQuerySchema,
        response: { 200: paginatedResponseSchema(contactListItemSchema) },
      },
    },
    async request => {
      const { session, role } = await requireRole(request, [...CONTACT_READERS])

      const { q, isBlocked, page, limit } = request.query
      const userId = session.user.id

      const { rows, total } = await listContactActivityPage({
        role,
        userId,
        q,
        isBlocked,
        page,
        limit,
      })

      // Hidratação passa de novo pelo fragmento de escopo: mesmo que o espelho
      // SQL da ordenação divirja um dia, nada fora do escopo chega na resposta.
      const contacts = rows.length
        ? await prisma.contact.findMany({
            where: {
              AND: [
                { id: { in: rows.map(row => row.id) } },
                scopeContacts(role, userId),
              ],
            },
            select: contactSelect,
          })
        : []

      const contactsMap = new Map(
        contacts.map(contact => [contact.id, contact]),
      )

      // `findMany` não preserva a ordem do `in` — a ordem canônica é a de `rows`.
      const data = rows.flatMap(row => {
        const contact = contactsMap.get(row.id)
        if (!contact) return []

        return [
          {
            ...contact,
            conversationCount: row.conversationCount,
            openConversationCount: row.openConversationCount,
            lastInteractionAt: row.lastInteractionAt,
          },
        ]
      })

      const totalPages = Math.ceil(total / limit)

      return {
        data,
        meta: { total, page, limit, totalPages, hasNext: page < totalPages },
      }
    },
  )

  // GET /contacts/:id
  app.get(
    '/:id',
    {
      schema: {
        operationId: 'getContact',
        tags: ['Contacts'],
        summary: 'Detalha um contato com as conversas recentes dele',
        params: contactParamsSchema,
        response: { 200: contactDetailSchema },
      },
    },
    async (request, reply) => {
      const { contact, session, role } = await findScopedContact(
        request,
        request.params.id,
      )

      if (!contact) return reply.notFound(request.t('NOT_FOUND'))

      const userId = session.user.id

      const [activity, conversations] = await Promise.all([
        findContactActivity(contact.id, role, userId),
        prisma.conversation.findMany({
          where: {
            AND: [{ contactId: contact.id }, scopeConversations(role, userId)],
          },
          orderBy: [
            { lastMessageAt: { sort: 'desc', nulls: 'last' } },
            { id: 'desc' },
          ],
          take: CONTACT_CONVERSATIONS_LIMIT,
          select: contactConversationSelect,
        }),
      ])

      return { ...contact, ...activity, conversations }
    },
  )

  // PATCH /contacts/:id
  app.patch(
    '/:id',
    {
      schema: {
        operationId: 'updateContact',
        tags: ['Contacts'],
        summary: 'Atualiza os dados editáveis do contato',
        params: contactParamsSchema,
        body: updateContactBodySchema,
        response: { 200: contactListItemSchema },
      },
    },
    async (request, reply) => {
      const { session, role } = await requireRole(request, [...CONTACT_WRITERS])

      const existing = await prisma.contact.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      })

      if (!existing) return reply.notFound(request.t('NOT_FOUND'))

      // `phoneNumber`, `waId` e `whatsAppAccountId` ficam de fora: são a
      // identidade do contato na Meta, não dado editável.
      const { name, email, notes } = request.body
      const data: Prisma.ContactUpdateInput = {}
      if (name !== undefined) data.name = name
      if (email !== undefined) data.email = email
      if (notes !== undefined) data.notes = notes

      const contact = await prisma.contact.update({
        where: { id: existing.id },
        data,
        select: contactSelect,
      })

      app.emitRealtimeEvent({
        entity: 'contact',
        action: 'updated',
        entityId: contact.id,
      })

      // Mesma forma do item da lista para que o cliente possa trocar a linha
      // no cache sem zerar os agregados.
      const activity = await findContactActivity(
        contact.id,
        role,
        session.user.id,
      )

      return { ...contact, ...activity }
    },
  )

  // POST /contacts/:id/block
  app.post(
    '/:id/block',
    {
      schema: {
        operationId: 'blockContact',
        tags: ['Contacts'],
        summary: 'Bloqueia ou desbloqueia o contato',
        params: contactParamsSchema,
        body: blockContactBodySchema,
        response: { 200: contactListItemSchema },
      },
    },
    async (request, reply) => {
      const { session, role } = await requireRole(request, [...CONTACT_WRITERS])

      const existing = await prisma.contact.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      })

      if (!existing) return reply.notFound(request.t('NOT_FOUND'))

      const contact = await prisma.contact.update({
        where: { id: existing.id },
        data: { isBlocked: request.body.blocked },
        select: contactSelect,
      })

      app.emitRealtimeEvent({
        entity: 'contact',
        action: 'updated',
        entityId: contact.id,
      })

      const activity = await findContactActivity(
        contact.id,
        role,
        session.user.id,
      )

      return { ...contact, ...activity }
    },
  )
}

export default contactsRoutes
