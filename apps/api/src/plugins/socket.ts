import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import type { Server as SocketIOServer } from 'socket.io'

import { createSocketServer } from '@/lib/socket.js'

import {
  ENTITY_INVALIDATION_TAGS,
  REALTIME_EVENT,
  type RealtimeEvent,
} from '@/lib/realtime-events.js'

/** Emit the entity event. Add secondary events here if needed. */
export const emitWithAuditLog = (
  app: FastifyInstance,
  event: RealtimeEvent,
) => {
  app.emitRealtimeEvent(event)
}

export const socketPlugin = fp(async (app: FastifyInstance) => {
  let io: SocketIOServer | null = null

  // Decorate early so routes can call app.emitRealtimeEvent during handling
  app.decorate('io', null)
  app.decorate('emitRealtimeEvent', (event: RealtimeEvent) => {
    if (!io) return
    io.emit(REALTIME_EVENT, {
      ...event,
      invalidateTags:
        event.invalidateTags ?? ENTITY_INVALIDATION_TAGS[event.entity],
    })
  })

  // Ensure the underlying HTTP server is available after listen
  app.addHook('onReady', async () => {
    io = createSocketServer(app.server)

    // Cleanup on close
    app.addHook('onClose', async () => {
      io?.close()
    })
  })
})
