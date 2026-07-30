/**
 * Example job definition — copy this pattern for new queues.
 *
 * Usage in a route handler:
 *   import { exampleQueue } from '../jobs/example.js'
 *   await exampleQueue.add('my-job', { message: 'hello' })
 */
import type { FastifyInstance } from 'fastify'

import { createQueue, createWorker } from '@/lib/queue.js'

// ── Types ──────────────────────────────────────────────

interface ExampleJobData {
  message: string
}

// ── Queue + Worker ─────────────────────────────────────

export const exampleQueue = createQueue<ExampleJobData>('example')

export function registerExampleJobs(app: FastifyInstance) {
  const worker = createWorker<ExampleJobData>('example', async job => {
    app.log.info({ jobId: job.id, data: job.data }, 'Processing example job')
    // Your job logic here
  })

  worker.on('completed', job => {
    app.log.info({ jobId: job.id }, 'Example job completed')
  })

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err }, 'Example job failed')
  })

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await worker.close()
    await exampleQueue.close()
  })
}
