import type { Server as SocketIOServer } from 'socket.io'

import type { RealtimeEvent } from '@/lib/realtime-events.js'

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer | null
    emitRealtimeEvent: (event: RealtimeEvent) => void
  }

  interface FastifyRequest {
    locale: string
    t: (key: string, fallback?: string) => string
    /**
     * Corpo cru da requisição, preenchido apenas pelo content type parser
     * escopado do webhook do WhatsApp — o HMAC da Meta é calculado sobre os
     * bytes originais, e o JSON reserializado nunca bate.
     */
    rawBody?: Buffer
  }
}
