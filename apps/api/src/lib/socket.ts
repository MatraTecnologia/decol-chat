import type { Server as HTTPServer } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'

import { env } from '@/env.js'
import {
  SECURE_SESSION_COOKIE,
  SESSION_COOKIE,
} from '@workspace/shared/auth-cookie'
import { auth } from './auth.js'
import { origins } from './cors.js'
import { presence } from './presence.js'

export const createSocketServer = (httpServer: HTTPServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: [...origins, ...env.TRUSTED_ORIGINS],
      credentials: true,
    },
  })

  // Auth middleware — validate session via cookie or token
  io.use(async (socket, next) => {
    try {
      // Try cookie auth first (direct connections)
      const cookieHeader = socket.handshake.headers.cookie
      if (cookieHeader) {
        const session = await auth.api.getSession({
          headers: new Headers({ cookie: cookieHeader }),
        })
        if (session) {
          socket.data.user = session.user
          socket.data.session = session.session
          return next()
        }
      }

      // Fall back to token auth (proxied connections)
      const token = socket.handshake.auth?.token as string | undefined
      if (token) {
        const cookieName =
          env.NODE_ENV === 'production' ? SECURE_SESSION_COOKIE : SESSION_COOKIE

        const session = await auth.api.getSession({
          headers: new Headers({ cookie: `${cookieName}=${token}` }),
        })
        if (session) {
          socket.data.user = session.user
          socket.data.session = session.session
          return next()
        }
      }

      return next(new Error('Authentication required'))
    } catch {
      return next(new Error('Authentication failed'))
    }
  })

  io.on('connection', socket => {
    const userId = socket.data.user.id

    // Track presence and broadcast to all clients
    presence.add(userId, socket.id)
    io.emit('users:presence', { onlineUserIds: presence.getOnlineUserIds() })

    // Respond to individual requests for current presence state (e.g. admin page mount)
    socket.on('users:presence:request', () => {
      socket.emit('users:presence', {
        onlineUserIds: presence.getOnlineUserIds(),
      })
    })

    // Remove presence with 30s grace period to absorb page reloads
    socket.on('disconnect', () => {
      presence.remove(userId, socket.id, () => {
        io.emit('users:presence', {
          onlineUserIds: presence.getOnlineUserIds(),
        })
      })
    })
  })

  io.on('close', () => {
    presence.clear()
  })

  return io
}
