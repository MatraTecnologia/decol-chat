import fastifySwagger from '@fastify/swagger'
import scalarFastify from '@scalar/fastify-api-reference'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'

import { auth } from '@/lib/auth.js'
import { env } from '@/env.js'

export const swaggerPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: `${env.APP_NAME} API`,
        description: `REST API for ${env.APP_NAME}`,
        version: '0.0.1',
      },
      servers: [{ url: '/' }],
    },
    transform: jsonSchemaTransform,
  })

  // Better Auth OpenAPI schema endpoint
  app.get(
    '/api/auth/openapi',
    { schema: { hide: true } },
    async (_request, reply) => {
      const schema = await auth.api.generateOpenAPISchema()
      return reply.send(schema)
    },
  )

  await app.register(scalarFastify, {
    routePrefix: '/docs',
    configuration: {
      theme: 'kepler',
      metaData: {
        title: `${env.APP_NAME} API Docs`,
      },
      sources: [
        { url: '/docs/openapi.json', title: 'API' },
        { url: '/api/auth/openapi', title: 'Auth' },
      ],
      agent: {
        disabled: true,
      },
    },
  })
})
