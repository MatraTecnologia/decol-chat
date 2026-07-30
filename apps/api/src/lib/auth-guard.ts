import type { FastifyRequest } from 'fastify'

import type { RoleType } from '@workspace/shared/roles'
import { auth } from './auth.js'

function toHeaders(request: FastifyRequest): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  return headers
}

export async function requireAuth(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: toHeaders(request),
  })

  if (!session) {
    const error = new Error(request.t('UNAUTHORIZED')) as Error & {
      statusCode: number
    }
    error.statusCode = 401
    throw error
  }

  return session
}

export async function requireRole(
  request: FastifyRequest,
  allowedRoles: RoleType[],
) {
  const session = await requireAuth(request)

  const role = (session.user.role as RoleType | null) ?? 'user'

  if (!allowedRoles.includes(role)) {
    const error = new Error(request.t('ROLE_NOT_AUTHORIZED')) as Error & {
      statusCode: number
    }
    error.statusCode = 403
    throw error
  }

  return { session, role }
}

export async function requirePermission(
  request: FastifyRequest,
  permissions: Record<string, string[]>,
) {
  const session = await requireAuth(request)

  const result = await auth.api.userHasPermission({
    body: {
      userId: session.user.id,
      permissions,
    },
  })

  if (!result?.success) {
    const error = new Error(request.t('PERMISSION_DENIED')) as Error & {
      statusCode: number
    }
    error.statusCode = 403
    throw error
  }

  return session
}
