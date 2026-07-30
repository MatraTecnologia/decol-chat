import type { Prisma } from '@/generated/prisma/client.js'
import { prisma } from './prisma.js'

interface AuditInput {
  event: string
  userId?: string | null
  ip?: string | null
  userAgent?: string | null
  metadata?: Prisma.InputJsonValue
}

/**
 * Record an audit log entry. Failures are swallowed so auditing never breaks
 * the auth flow (same graceful-fallback posture as the cache helper).
 */
export const recordAudit = async (input: AuditInput) => {
  try {
    await prisma.auditLog.create({
      data: {
        event: input.event,
        userId: input.userId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata,
      },
    })
  } catch {
    // Audit logging is best-effort — must not interrupt authentication.
  }
}
