import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

// ── Scheduled (cron) jobs ──────────────────────────────
import { registerCleanupAuditLogsJob } from '@/jobs/scheduled/cleanup-audit-logs.js'
import { registerCleanupSessionsJob } from '@/jobs/scheduled/cleanup-sessions.js'
import { registerWhatsappInboundJob } from '@/jobs/whatsapp-inbound.js'

export const queuePlugin = fp(async (app: FastifyInstance) => {
  // Register job queues + workers here:
  registerWhatsappInboundJob(app)

  // ── Scheduled jobs ────────────────────────────────────
  registerCleanupSessionsJob(app)
  registerCleanupAuditLogsJob(app)

  app.log.info('Queue system ready')
})
