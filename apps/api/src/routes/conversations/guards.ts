import type { FastifyRequest } from 'fastify'

import type { Prisma } from '@/generated/prisma/client.js'

import { requireRole } from '@/lib/auth-guard.js'
import { prisma } from '@/lib/prisma.js'

/** Roles que enxergam todas as conversas; as demais só as próprias. */
const GLOBAL_READERS = ['admin', 'manager']

/** Roles que podem ler o módulo de atendimento. */
export const CONVERSATION_READERS = [
  'admin',
  'manager',
  'agent',
  'viewer',
] as const

/** Roles que podem enviar mensagem — `viewer` tem leitura, não escrita. */
const SENDERS = ['admin', 'manager', 'agent']

export const isGlobalReader = (role: string) => GLOBAL_READERS.includes(role)

export const canSendMessages = (role: string) => SENDERS.includes(role)

/** Fragmento `where` obrigatório em TODA leitura de conversa. */
export const scopeConversations = (
  role: string,
  userId: string,
): Prisma.ConversationWhereInput =>
  GLOBAL_READERS.includes(role) ? {} : { assignedToId: userId }

/** Idem para mensagens — o filtro atravessa a relação. */
export const scopeMessages = (
  role: string,
  userId: string,
): Prisma.MessageWhereInput =>
  GLOBAL_READERS.includes(role)
    ? {}
    : { conversation: { assignedToId: userId } }

/** Campos do contato e do responsável devolvidos junto da conversa. */
export const conversationRelationsInclude = {
  contact: {
    select: {
      id: true,
      waId: true,
      phoneNumber: true,
      name: true,
      profileName: true,
      isBlocked: true,
    },
  },
  assignedTo: {
    select: { id: true, name: true, email: true, image: true },
  },
} satisfies Prisma.ConversationInclude

/**
 * Carrega a conversa já dentro do escopo do solicitante.
 * Fora do escopo devolve `null` — o handler responde 404, não 403: um vendedor
 * não deve conseguir descobrir que a conversa de outro existe.
 */
export const findScopedConversation = async (
  request: FastifyRequest,
  conversationId: string,
) => {
  const { session, role } = await requireRole(request, [
    ...CONVERSATION_READERS,
  ])

  const conversation = await prisma.conversation.findFirst({
    where: {
      AND: [{ id: conversationId }, scopeConversations(role, session.user.id)],
    },
    include: conversationRelationsInclude,
  })

  return { conversation, session, role }
}
