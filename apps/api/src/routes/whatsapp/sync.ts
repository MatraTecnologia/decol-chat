import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { whatsappHistoryQueue } from '@/jobs/whatsapp-history.js'
import { whatsappInboundQueue } from '@/jobs/whatsapp-inbound.js'
import { requireRole } from '@/lib/auth-guard.js'
import { getConnection } from '@/lib/whatsapp/connection.js'
import { extractChanges } from '@/lib/whatsapp/inbound/payload.js'
import { getHistorySyncProgress } from '@/lib/whatsapp/sync-progress.js'
import { listWebhookLogs } from '@/lib/whatsapp/webhook-log.js'

const syncStatusSchema = z.object({
  status: z.enum(['idle', 'running', 'done']),
  phase: z.number().nullable(),
  progress: z.number().nullable(),
  chunks: z.number(),
  threads: z.number(),
  messages: z.number(),
  conversationsCreated: z.number(),
  updatedAt: z.string().nullable(),
})

const replayResponseSchema = z.object({
  history: z.number(),
  other: z.number(),
})

const REPLAYABLE_FIELDS = new Set([
  'history',
  'smb_app_state_sync',
  'smb_message_echoes',
])

/** Sem chunk novo há mais de 2 min, o backfill terminou (ou a Meta parou). */
const RUNNING_WINDOW_MS = 2 * 60 * 1000

const syncRoutes: FastifyPluginAsyncZod = async app => {
  app.get(
    '/connection/sync-status',
    {
      schema: {
        operationId: 'getWhatsappSyncStatus',
        tags: ['WhatsApp'],
        summary: 'Progresso do backfill de histórico do app do celular',
        response: { 200: syncStatusSchema },
      },
    },
    async request => {
      await requireRole(request, ['admin'])

      const connection = await getConnection()
      const progress = connection
        ? await getHistorySyncProgress(connection.id)
        : null

      if (!progress) {
        return {
          status: 'idle' as const,
          phase: null,
          progress: null,
          chunks: 0,
          threads: 0,
          messages: 0,
          conversationsCreated: 0,
          updatedAt: null,
        }
      }

      const age = Date.now() - new Date(progress.updatedAt).getTime()
      const finished = progress.phase === 2 && progress.progress === 100

      return {
        ...progress,
        status:
          finished || age > RUNNING_WINDOW_MS
            ? ('done' as const)
            : ('running' as const),
      }
    },
  )

  // Os payloads de coexistence ficam 24h no log do webhook. Reingerir dali
  // evita desconectar o número só para a Meta reenviar o sync, que é one-shot.
  app.post(
    '/connection/replay-logs',
    {
      schema: {
        operationId: 'replayWhatsappLogs',
        tags: ['WhatsApp'],
        summary: 'Reenfileira os eventos de coexistence guardados no log',
        response: { 200: replayResponseSchema },
      },
    },
    async request => {
      await requireRole(request, ['admin'])

      const logs = await listWebhookLogs()
      let history = 0
      let other = 0

      // O log é LIFO: reenfileirar do mais antigo para o mais novo preserva a
      // ordem em que a Meta mandou.
      for (const entry of [...logs].reverse()) {
        if (entry.direction !== 'inbound_event' || !entry.signatureValid) {
          continue
        }

        const fields = extractChanges(entry.payload).map(c => c.field ?? '')

        if (!fields.some(field => REPLAYABLE_FIELDS.has(field))) continue

        if (fields.includes('history')) {
          await whatsappHistoryQueue.add('history', { payload: entry.payload })
          history += 1
        } else {
          await whatsappInboundQueue.add('inbound', { payload: entry.payload })
          other += 1
        }
      }

      return { history, other }
    },
  )
}

export default syncRoutes
