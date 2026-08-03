/**
 * Fila de ingestão do webhook do WhatsApp.
 *
 * O handler HTTP só valida o HMAC e enfileira o payload cru — todo o trabalho
 * de persistência acontece aqui, onde pode ser retentado sem devolver erro à
 * Meta. A lógica mora em `lib/whatsapp/inbound/`.
 */
import type { FastifyInstance } from 'fastify'

import { createQueue, createWorker } from '@/lib/queue.js'
import { processInboundPayload } from '@/lib/whatsapp/inbound/index.js'

// ── Types ──────────────────────────────────────────────

export interface WhatsappInboundJobData {
  /** Corpo cru do webhook, exatamente como a Meta mandou. */
  payload: unknown
}

// ── Queue + Worker ─────────────────────────────────────

export const whatsappInboundQueue =
  createQueue<WhatsappInboundJobData>('whatsapp-inbound')

export function registerWhatsappInboundJob(app: FastifyInstance) {
  const worker = createWorker<WhatsappInboundJobData>(
    'whatsapp-inbound',
    async job => {
      await processInboundPayload(app, job.data.payload)
    },
  )

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err }, 'Job whatsapp-inbound falhou')
  })

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await worker.close()
    await whatsappInboundQueue.close()
  })
}
