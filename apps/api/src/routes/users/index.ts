import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { Prisma } from '@/generated/prisma/client.js'

import { requireRole } from '@/lib/auth-guard.js'
import { prisma } from '@/lib/prisma.js'
import { ROLES, type RoleType } from '@workspace/shared/roles'

import {
  paginate,
  paginatedResponseSchema,
  paginationQuerySchema,
  type PaginationParams,
} from '@/utils/pagination.js'

// `user` é o papel legado sem acesso ao painel — todo o resto é perfil interno.
// Derivar de ROLES garante que um papel novo entre no filtro de staff sozinho.
const NON_STAFF_ROLES: RoleType[] = ['user']
const STAFF_ROLES = ROLES.filter(role => !NON_STAFF_ROLES.includes(role))

const userResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  banned: z.boolean().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.date(),
  phone: z.string().nullable(),
})

const usersRoutes: FastifyPluginAsyncZod = async app => {
  app.get(
    '/',
    {
      schema: {
        operationId: 'listUsers',
        tags: ['Users'],
        summary: 'List users',
        querystring: z
          .object({
            search: z.string().optional(),
            role: z.enum(ROLES).optional(),
            banned: z.coerce.boolean().optional(),
            isStaff: z
              .string()
              .optional()
              .transform(v =>
                v === undefined ? undefined : v !== 'false' && v !== '0',
              ),
          })
          .extend(paginationQuerySchema.shape),
        response: {
          200: paginatedResponseSchema(userResponseSchema),
        },
      },
    },
    async request => {
      await requireRole(request, ['admin'])

      const { search, role, banned, isStaff } = request.query

      const where: Prisma.UserWhereInput = {
        ...(isStaff === true && {
          role: { in: STAFF_ROLES },
        }),
        ...(isStaff === false && { role: { in: NON_STAFF_ROLES } }),
        ...(isStaff === undefined && role && { role }),
        ...(banned !== undefined && { banned }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      }

      const result = await paginate<z.infer<typeof userResponseSchema>>(
        prisma.user,
        request.query as PaginationParams,
        {
          where,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            banned: true,
            emailVerified: true,
            createdAt: true,
            phone: true,
          },
        },
      )

      return result
    },
  )

  // app.get(
  //   '/update-avatars',
  //   {
  //     schema: {
  //       operationId: 'updateUserAvatars',
  //       tags: ['Users'],
  //       summary: 'Update all user avatars from Gravatar (dev only)',
  //       response: {
  //         200: z.object({
  //           updated: z.number(),
  //         }),
  //       },
  //     },
  //   },
  //   async (request, reply) => {
  //     if (env.NODE_ENV !== 'development') {
  //       return reply.forbidden('Only available in development')
  //     }

  //     // await requireRole(request, ['admin'])

  //     const users = await prisma.user.findMany({
  //       select: { id: true, email: true },
  //     })

  //     await prisma.$transaction(
  //       users.map(user =>
  //         prisma.user.update({
  //           where: { id: user.id },
  //           data: { image: getUserAvatar(user.email) },
  //         }),
  //       ),
  //     )

  //     return { updated: users.length }
  //   },
  // )
}

export default usersRoutes
