import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import type { Server as SocketIOServer } from 'socket.io'

import { prisma } from '@/lib/prisma.js'
import { setRealtimeEmitter } from '@/lib/realtime.js'
import { createSocketServer } from '@/lib/socket.js'

import {
  ENTITY_INVALIDATION_TAGS,
  GLOBAL_READERS_ROOM,
  REALTIME_EVENT,
  type RealtimeEvent,
  userRoom,
} from '@/lib/realtime-events.js'

/** Emit the entity event. Add secondary events here if needed. */
export const emitWithAuditLog = (
  app: FastifyInstance,
  event: RealtimeEvent,
) => {
  app.emitRealtimeEvent(event)
}

/** Responsável pela conversa do payload; `null` quando não dá para saber. */
const findPayloadAssigneeId = async (payload: unknown) => {
  const conversationId =
    typeof payload === 'object' &&
    payload !== null &&
    'conversationId' in payload &&
    typeof payload.conversationId === 'string'
      ? payload.conversationId
      : null

  if (!conversationId) return null

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { assignedToId: true },
  })

  return conversation?.assignedToId ?? null
}

/**
 * O corpo da entidade (conteúdo de mensagem) só vai para quem o REST deixaria
 * ler: leitores globais e o responsável pela conversa. Os demais recebem o
 * evento sem `payload` e recarregam pelo REST, que aplica o escopo.
 */
const deliver = async (io: SocketIOServer, event: RealtimeEvent) => {
  const { payload, ...rest } = event
  const base = {
    ...rest,
    invalidateTags:
      event.invalidateTags ?? ENTITY_INVALIDATION_TAGS[event.entity],
  }

  if (payload === undefined) {
    io.emit(REALTIME_EVENT, base)
    return
  }

  const assigneeId = await findPayloadAssigneeId(payload)
  const readers = assigneeId
    ? [GLOBAL_READERS_ROOM, userRoom(assigneeId)]
    : [GLOBAL_READERS_ROOM]

  io.to(readers).emit(REALTIME_EVENT, { ...base, payload })
  io.except(readers).emit(REALTIME_EVENT, base)
}

export const socketPlugin = fp(async (app: FastifyInstance) => {
  let io: SocketIOServer | null = null
  // Fila única: a busca do responsável é assíncrona, e sem ela um `updated`
  // poderia chegar antes do `created` da mesma mensagem
  let queue = Promise.resolve()

  // A emissão é efeito colateral de uma mutação já commitada: falhar aqui não
  // pode derrubar a resposta (mesma postura de `cache.ts` e `recordAudit()`).
  const emit = (event: RealtimeEvent) => {
    const server = io
    if (!server) return

    queue = queue
      .then(() => deliver(server, event))
      .catch(error => {
        app.log.warn(
          { err: error, entity: event.entity, action: event.action },
          'Falha ao emitir evento de realtime',
        )
      })
  }

  // Decorate early so routes can call app.emitRealtimeEvent during handling
  app.decorate('io', null)
  app.decorate('emitRealtimeEvent', emit)

  // Caminhos sem acesso ao `app` (hooks do Better Auth) usam o mesmo emissor.
  setRealtimeEmitter(emit)

  // Ensure the underlying HTTP server is available after listen
  app.addHook('onReady', async () => {
    io = createSocketServer(app.server)

    // Cleanup on close
    app.addHook('onClose', async () => {
      io?.close()
    })
  })
})
