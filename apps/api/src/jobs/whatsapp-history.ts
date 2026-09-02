/**
 * Fila dedicada ao backfill de histórico (coexistence).
 *
 * Separada da `whatsapp-inbound` por dois motivos: um chunk leva segundos e
 * atrasaria mensagens vivas, e `concurrency: 1` evita chunks do mesmo contato
 * disputando o advisory lock.
 */
import type { FastifyInstance } from 'fastify'

import { createQueue, createWorker } from '@/lib/queue.js'
import { processInboundPayload } from '@/lib/whatsapp/inbound/index.js'

export interface WhatsappHistoryJobData {
  /** Corpo cru do webhook, exatamente como a Meta mandou. */
  payload: unknown
}

export const whatsappHistoryQueue =
  createQueue<WhatsappHistoryJobData>('whatsapp-history')

export const registerWhatsappHistoryJob = (app: FastifyInstance) => {
  const worker = createWorker<WhatsappHistoryJobData>(
    'whatsapp-history',
    async job => {
      await processInboundPayload(app, job.data.payload)
    },
    1,
  )

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err }, 'Job whatsapp-history falhou')
  })

  app.addHook('onClose', async () => {
    await worker.close()
    await whatsappHistoryQueue.close()
  })
}
