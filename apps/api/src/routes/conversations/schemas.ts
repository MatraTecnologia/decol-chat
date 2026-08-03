import { z } from 'zod'

import {
  ConversationChannelSchema,
  ConversationPrioritySchema,
  ConversationStatusSchema,
} from '@/generated/zod/schemas.js'

// Espelha `conversationRelationsInclude` (guards.ts). Vive fora do index para
// que os arquivos irmãos registrados por ele possam reusar a mesma forma sem
// import circular.

const contactSummarySchema = z.object({
  id: z.string(),
  waId: z.string(),
  phoneNumber: z.string(),
  name: z.string().nullable(),
  profileName: z.string().nullable(),
  isBlocked: z.boolean(),
})

export const assigneeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
})

export const conversationSchema = z.object({
  id: z.string(),
  whatsAppAccountId: z.string(),
  contactId: z.string(),
  assignedToId: z.string().nullable(),
  teamId: z.string().nullable(),
  status: ConversationStatusSchema,
  priority: ConversationPrioritySchema,
  channel: ConversationChannelSchema,
  subject: z.string().nullable(),
  lastMessageAt: z.date().nullable(),
  lastMessageText: z.string().nullable(),
  lastInboundAt: z.date().nullable(),
  unreadCount: z.number(),
  assignedAt: z.date().nullable(),
  closedAt: z.date().nullable(),
  closedById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  contact: contactSummarySchema,
  assignedTo: assigneeSummarySchema.nullable(),
})

/** Onde o termo de busca casou — o front só destaca, quem recorta é o backend. */
export const conversationMatchSchema = z.object({
  field: z.enum(['contact', 'message']),
  snippet: z.string(),
  messageId: z.string().nullable(),
  messageAt: z.date().nullable(),
  count: z.number(),
})

export const conversationListItemSchema = conversationSchema.extend({
  match: conversationMatchSchema.nullable(),
})
