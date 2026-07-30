import { toNodeHandler } from 'better-auth/node'
import type { FastifyInstance } from 'fastify'

import { auth } from '@/lib/auth.js'
import { isAllowedOrigin } from '@/lib/cors.js'

export const authPlugin = async (app: FastifyInstance) => {
  const handler = toNodeHandler(auth)

  // Prevent Fastify from consuming the request body so Better Auth can read it
  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', (_request, _payload, done) => {
    done(null)
  })

  app.all('/api/auth/*', { schema: { hide: true } }, async (request, reply) => {
    // Set CORS headers on raw response since reply.hijack() bypasses Fastify's CORS plugin
    const origin = request.headers.origin
    if (origin && isAllowedOrigin(origin)) {
      reply.raw.setHeader('Access-Control-Allow-Origin', origin)
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')
      reply.raw.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      )
      reply.raw.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Cookie',
      )
    }

    // Handle preflight
    if (request.method === 'OPTIONS') {
      reply.raw.writeHead(204)
      reply.raw.end()
      return
    }

    await reply.hijack()
    handler(request.raw, reply.raw)
  })
}
