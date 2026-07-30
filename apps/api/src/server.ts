import autoLoad from '@fastify/autoload'
import compress from '@fastify/compress'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import etag from '@fastify/etag'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import underPressure from '@fastify/under-pressure'
import Fastify, { type FastifyServerOptions } from 'fastify'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import { env } from './env.js'
import { origins } from './lib/cors.js'
import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'
import { authPlugin } from './plugins/auth.js'
import { bullBoardPlugin } from './plugins/bull-board.js'
import { localePluginExport } from './plugins/locale.js'
import { queuePlugin } from './plugins/queue.js'
import { socketPlugin } from './plugins/socket.js'
import { swaggerPlugin } from './plugins/swagger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const envToLogger: Record<string, FastifyServerOptions['logger']> = {
  development: {
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true,
      },
    },
  },
  production: {
    level: 'info',
  },
  test: false,
}

export const buildApp = async () => {
  const app = Fastify({
    logger: envToLogger[env.NODE_ENV] ?? true,
    // Trust 1 proxy hop (Traefik/EasyPanel) so request.ip resolves the real
    // client IP from X-Forwarded-For — spoof-safe behind a single edge proxy
    trustProxy: 1,
    // Accept X-Request-Id from upstream (load balancer/proxy), fallback to UUID
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Propagate request ID in every response header
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id)
  })

  // Sensible defaults (httpErrors, reply decorators, etc.)
  await app.register(sensible)

  // Cookies (used by Better Auth sessions + locale detection)
  await app.register(cookie)

  // Locale detection (cookie → Accept-Language → pt-BR fallback)
  await app.register(localePluginExport)

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })

  // CORS
  await app.register(cors, {
    origin: [...origins, ...env.TRUSTED_ORIGINS],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400,
  })

  // Rate limit — default keyGenerator uses request.ip, which resolves the real
  // client IP via trustProxy (no manual X-Forwarded-For parsing, no spoofing)
  await app.register(rateLimit, {
    max: 500,
    timeWindow: '1 minute',
  })

  // Response compression (gzip/deflate, threshold 1kb)
  await app.register(compress, {
    threshold: 1024,
  })

  // ETag for conditional caching (304 Not Modified)
  await app.register(etag)

  // Under pressure — real health checks + graceful degradation (503 when overloaded)
  if (env.UNDER_PRESSURE_ENABLED) {
    await app.register(underPressure, {
      maxEventLoopDelay: 2000,
      maxHeapUsedBytes: 2_000_000_000,
      maxRssBytes: 2_500_000_000,
      pressureHandler: (_request, _reply, type, value) => {
        app.log.warn(`Under pressure: ${type} = ${value}`)
      },
      healthCheck: async () => {
        await prisma.$queryRaw`SELECT 1`
        if (redis) await redis.ping()
        return true
      },
      healthCheckInterval: 5000,
      exposeStatusRoute: {
        routeOpts: {
          // under-pressure injects a plain JSON Schema response, which the
          // global Zod serializer rejects — serialize this route with JSON.
          serializerCompiler: () => (data: unknown) => JSON.stringify(data),
          schema: {
            tags: ['Health'],
            summary: 'Under pressure status',
            hide: true,
          },
        },
        url: '/health/pressure',
      },
    })
  } else {
    app.log.info(
      'Under pressure plugin disabled via UNDER_PRESSURE_ENABLED=false',
    )
  }

  // Swagger docs
  await app.register(swaggerPlugin)

  // Better Auth
  await app.register(authPlugin)

  // Socket.io
  await app.register(socketPlugin)

  // Background job queues (BullMQ)
  await app.register(queuePlugin)

  // Bull Board dashboard (must come after queuePlugin so queues are registered)
  await app.register(bullBoardPlugin)

  // Routes (autoload)
  await app.register(autoLoad, {
    dir: path.join(__dirname, 'routes'),
    dirNameRoutePrefix: true,
  })

  // Connect Redis (lazy) — skip if already connected (e.g. by under-pressure healthCheck)
  if (redis && redis.status === 'wait') {
    await redis.connect()
  }
  if (redis) {
    app.log.info('Redis connected')
  }

  // Graceful shutdown
  const gracefulShutdown = async () => {
    app.log.info('Shutting down gracefully...')
    await app.close()
    await redis.quit()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGTERM', gracefulShutdown)
  process.on('SIGINT', gracefulShutdown)

  return app
}
