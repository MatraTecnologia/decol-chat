import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { prisma } from '@/lib/prisma.js'
import { redis } from '@/lib/redis.js'

// ── Shared schemas ─────────────────────────────────────

const statusResponse = z.object({
  status: z.string(),
  db: z.string().optional(),
  redis: z.string().optional(),
})

/** Run dependency checks (DB + Redis). */
async function checkDependencies() {
  const checks: Record<string, string> = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.db = 'ok'
  } catch {
    checks.db = 'error'
  }

  try {
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  const healthy = checks.db === 'ok'
  return { healthy, checks }
}

// ── Routes ─────────────────────────────────────────────

const health: FastifyPluginAsyncZod = async app => {
  // General health check (backwards-compatible)
  app.get(
    '/health',
    {
      schema: {
        operationId: 'healthCheck',
        tags: ['Health'],
        summary: 'Health check',
        response: { 200: statusResponse, 503: statusResponse },
      },
    },
    async (_request, reply) => {
      const { healthy, checks } = await checkDependencies()
      return reply.code(healthy ? 200 : 503).send({
        status: healthy ? 'ok' : 'degraded',
        ...checks,
      })
    },
  )

  // Liveness probe — process is alive and responsive
  app.get(
    '/health/live',
    {
      schema: {
        operationId: 'livenessProbe',
        tags: ['Health'],
        summary: 'Liveness probe (process alive)',
        response: {
          200: z.object({ status: z.string() }),
        },
      },
    },
    async (_request, reply) => {
      return reply.send({ status: 'alive' })
    },
  )

  // Readiness probe — dependencies healthy, ready to accept traffic
  app.get(
    '/health/ready',
    {
      schema: {
        operationId: 'readinessProbe',
        tags: ['Health'],
        summary: 'Readiness probe (dependencies healthy)',
        response: { 200: statusResponse, 503: statusResponse },
      },
    },
    async (_request, reply) => {
      const { healthy, checks } = await checkDependencies()
      return reply.code(healthy ? 200 : 503).send({
        status: healthy ? 'ready' : 'not_ready',
        ...checks,
      })
    },
  )
}

export default health
