import { timingSafeEqual } from 'node:crypto'

import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import { env } from '@/env.js'
import { getRegisteredQueues } from '@/lib/queue.js'

const BOARD_PATH = '/admin/queues'

export const bullBoardPlugin = fp(async (app: FastifyInstance) => {
  // Fail closed: without Basic Auth credentials the dashboard would be
  // publicly exposed, so skip registration entirely.
  if (!env.BULL_BOARD_USER || !env.BULL_BOARD_PASSWORD) {
    app.log.warn(
      'Bull Board disabled: set BULL_BOARD_USER and BULL_BOARD_PASSWORD to enable it',
    )
    return
  }

  const expected = Buffer.from(
    'Basic ' +
      Buffer.from(`${env.BULL_BOARD_USER}:${env.BULL_BOARD_PASSWORD}`).toString(
        'base64',
      ),
  )

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith(BOARD_PATH)) return

    const provided = Buffer.from(request.headers.authorization ?? '')

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      reply.header('WWW-Authenticate', 'Basic realm="Bull Board"')
      return reply.code(401).send({ error: 'Invalid credentials' })
    }
  })

  const serverAdapter = new FastifyAdapter()
  serverAdapter.setBasePath(BOARD_PATH)

  createBullBoard({
    queues: getRegisteredQueues().map(q => new BullMQAdapter(q)),
    serverAdapter,
  })

  await app.register(serverAdapter.registerPlugin(), {
    prefix: BOARD_PATH,
  })

  app.log.info(`Bull Board UI available at ${BOARD_PATH}`)
})
