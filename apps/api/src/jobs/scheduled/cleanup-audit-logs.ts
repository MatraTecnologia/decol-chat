/**
 * Scheduled job: Cleanup old audit logs.
 * Runs daily at 3:30 AM — removes audit entries older than the retention window.
 */
import type { FastifyInstance } from 'fastify'

import { prisma } from '@/lib/prisma.js'
import { createQueue, createWorker } from '@/lib/queue.js'

const RETENTION_DAYS = 90

// ── Queue + Worker ─────────────────────────────────────

const cleanupAuditLogsQueue = createQueue('cleanup-audit-logs')

export function registerCleanupAuditLogsJob(app: FastifyInstance) {
  // Schedule the repeatable job (idempotent — BullMQ deduplicates by repeat key)
  cleanupAuditLogsQueue.add(
    'cleanup-audit-logs',
    {},
    {
      repeat: { pattern: '30 3 * * *' }, // 3:30am daily
    },
  )

  const worker = createWorker('cleanup-audit-logs', async job => {
    await job.updateProgress(0)
    await job.log(`Removendo audit logs com mais de ${RETENTION_DAYS} dias...`)

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    await job.log(`${result.count} audit log(s) removido(s)`)
    await job.updateProgress(100)
  })

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err }, 'Cleanup audit logs job failed')
  })

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await worker.close()
    await cleanupAuditLogsQueue.close()
  })
}
