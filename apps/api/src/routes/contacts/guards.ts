import type { FastifyRequest } from 'fastify'

import type { Prisma } from '@/generated/prisma/client.js'

import { requireRole } from '@/lib/auth-guard.js'
import { prisma } from '@/lib/prisma.js'

/** Roles que enxergam todos os contatos; as demais só os das próprias conversas. */
const GLOBAL_READERS = ['admin', 'manager']

/** Roles que podem ler a agenda de contatos. */
export const CONTACT_READERS = ['admin', 'manager', 'agent', 'viewer'] as const

/** Roles que podem editar/bloquear um contato — escrita não é escopada por dono. */
export const CONTACT_WRITERS = ['admin', 'manager'] as const

export const isGlobalReader = (role: string) => GLOBAL_READERS.includes(role)

/**
 * Fragmento `where` obrigatório em TODA leitura de contato.
 * O escopo deriva do de conversas: quem não é global reader só enxerga o
 * contato se tiver ao menos uma conversa dele atribuída a si.
 */
export const scopeContacts = (
  role: string,
  userId: string,
): Prisma.ContactWhereInput =>
  GLOBAL_READERS.includes(role)
    ? {}
    : { conversations: { some: { assignedToId: userId } } }

/** Campos do contato devolvidos ao cliente — `metadata` (JSON cru da Meta) fica de fora. */
export const contactSelect = {
  id: true,
  whatsAppAccountId: true,
  waId: true,
  phoneNumber: true,
  name: true,
  profileName: true,
  email: true,
  notes: true,
  isBlocked: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactSelect

/**
 * Carrega o contato já dentro do escopo do solicitante.
 * Fora do escopo devolve `null` — o handler responde 404, não 403: um vendedor
 * não deve conseguir descobrir que o contato de um colega existe.
 */
export const findScopedContact = async (
  request: FastifyRequest,
  contactId: string,
) => {
  const { session, role } = await requireRole(request, [...CONTACT_READERS])

  const contact = await prisma.contact.findFirst({
    where: {
      AND: [{ id: contactId }, scopeContacts(role, session.user.id)],
    },
    select: contactSelect,
  })

  return { contact, session, role }
}
