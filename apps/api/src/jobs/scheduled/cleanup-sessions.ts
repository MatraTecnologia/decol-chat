/**
 * Scheduled job: Cleanup expired sessions.
 * Runs daily at 3:00 AM — removes sessions past their expiresAt date.
 */
import type { FastifyInstance } from 'fastify'

import { prisma } from '@/lib/prisma.js'
import { createQueue, createWorker } from '@/lib/queue.js'

// ── Queue + Worker ─────────────────────────────────────

const cleanupSessionsQueue = createQueue('cleanup-sessions')

export function registerCleanupSessionsJob(app: FastifyInstance) {
  // Schedule the repeatable job (idempotent — BullMQ deduplicates by repeat key)
  cleanupSessionsQueue.add(
    'cleanup-sessions',
    {},
    {
      repeat: { pattern: '0 3 * * *' }, // 3am daily
    },
  )

  const worker = createWorker('cleanup-sessions', async job => {
    await job.updateProgress(0)
    await job.log('Buscando sessões expiradas...')

    const result = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })

    await job.log(`${result.count} sessão(ões) expirada(s) removida(s)`)
    await job.updateProgress(100)
  })

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err }, 'Cleanup sessions job failed')
  })

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await worker.close()
    await cleanupSessionsQueue.close()
  })
}
