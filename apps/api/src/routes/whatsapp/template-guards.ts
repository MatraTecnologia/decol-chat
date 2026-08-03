/**
 * Preâmbulo comum das rotas de modelo: papel exigido, conta ativa e tradução
 * do resultado do domínio para HTTP.
 *
 * A conta ativa é resolvida aqui porque todo registro é escopado por
 * `whatsAppAccountId` — sem ela nenhuma rota tem o que responder.
 */
import type { FastifyReply, FastifyRequest } from 'fastify'

import type { Prisma } from '@/generated/prisma/client.js'

import { recordAudit } from '@/lib/audit.js'
import { requireRole } from '@/lib/auth-guard.js'

import { getConnection } from '@/lib/whatsapp/connection.js'
import { isEncryptionConfigured } from '@/lib/whatsapp/crypto.js'

import type { TemplateFailure } from '@/lib/whatsapp/templates/results.js'

import {
  TEMPLATE_MANAGE_ROLES,
  TEMPLATE_READ_ROLES,
  type TemplateRouteCapabilities,
} from './templates-policy.js'

export const NO_ACCOUNT =
  'Nenhuma conta do WhatsApp está conectada. Configure a conexão antes de gerenciar modelos.'

/** Sem chave de criptografia a conta não é decifrável — vale como "sem conta". */
export const findActiveTemplateAccount = async () =>
  isEncryptionConfigured() ? getConnection() : null

/**
 * Responde e devolve `null` quando não há conta ativa: leitura vira 404 (não
 * existe catálogo) e mutação vira 422 acionável.
 */
export const requireTemplateAccount = async (
  request: FastifyRequest,
  reply: FastifyReply,
  capability: keyof TemplateRouteCapabilities,
) => {
  const { session } = await requireRole(
    request,
    capability === 'manage' ? TEMPLATE_MANAGE_ROLES : TEMPLATE_READ_ROLES,
  )

  const account = await findActiveTemplateAccount()

  if (!account) {
    if (capability === 'manage') reply.unprocessableEntity(NO_ACCOUNT)
    else reply.notFound(NO_ACCOUNT)

    return null
  }

  return { session, account, actorId: session.user.id }
}

/**
 * 404 nunca carrega a mensagem do domínio: um modelo de outra conta responde
 * igual a um inexistente.
 */
export const replyTemplateFailure = (
  request: FastifyRequest,
  reply: FastifyReply,
  failure: TemplateFailure,
) => {
  switch (failure.status) {
    case 'not_found':
      return reply.notFound(request.t('NOT_FOUND'))
    case 'conflict':
    case 'duplicate':
      return reply.conflict(failure.message)
    case 'invalid':
      return reply.unprocessableEntity(failure.message)
    case 'remote_error':
      return failure.httpStatus < 500
        ? reply.badRequest(failure.message)
        : reply.badGateway(failure.message)
  }
}

export const auditTemplate = (
  request: FastifyRequest,
  actorId: string,
  event: string,
  metadata: Prisma.InputJsonValue,
) =>
  recordAudit({
    event,
    userId: actorId,
    ip: request.ip,
    userAgent: request.headers['user-agent'] ?? null,
    metadata,
  })
