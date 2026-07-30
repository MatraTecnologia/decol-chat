import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { requireRole } from '@/lib/auth-guard.js'
import { prisma } from '@/lib/prisma.js'

const userResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.email(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  createdAt: z.date(),
})

const members: FastifyPluginAsyncZod = async app => {
  // GET /members
  app.get(
    '/',
    {
      schema: {
        operationId: 'listMembers',
        tags: ['Members'],
        summary: 'List users',
        response: {
          200: z.array(userResponseSchema),
        },
      },
    },
    async request => {
      await requireRole(request, ['admin'])

      const data = await prisma.user.findMany({
        where: { role: { not: 'user' } },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      return data
    },
  )
}

export default members
