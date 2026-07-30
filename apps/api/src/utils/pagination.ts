/**
 * Reusable pagination utilities for offset-based pagination with Prisma.
 *
 * @example
 * ```ts
 * import { paginationQuerySchema, paginatedResponseSchema, paginate } from '@/utils/pagination.js'
 *
 * app.get('/', {
 *   schema: {
 *     querystring: paginationQuerySchema,
 *   },
 * }, async (request) => {
 *   return paginate(prisma.auditLog, request.query, {
 *     orderBy: { createdAt: 'desc' },
 *   })
 * })
 * // → { data: [...], meta: { total: 150, page: 1, limit: 20, totalPages: 8, hasNext: true } }
 * ```
 */

import { z } from 'zod'

// ── Zod schema for pagination querystring params ──

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ── Response schema fragment for Swagger docs ──

const paginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
})

/** Wrap an item schema to produce a paginated response schema. */
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  })
}

// ── Paginate helper ─────────────────────────────────────

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
  }
}

/**
 * Generic Prisma model delegate — any model with `findMany` + `count`.
 * Uses `any` for Prisma's complex internal types that vary per model.
 */
interface PrismaDelegate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany(args?: any): Promise<any[]>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  count(args?: any): Promise<number>
}

/**
 * Execute a paginated query against any Prisma model.
 *
 * @param model   - Prisma delegate (e.g. `prisma.task`, `prisma.auditLog`)
 * @param params  - Object containing `page` and `limit` (typically from querystring)
 * @param options - Prisma query options (`where`, `orderBy`, `include`, `select`, etc.)
 */
export async function paginate<T>(
  model: PrismaDelegate,
  params: PaginationParams,
  options: Record<string, unknown> = {},
): Promise<PaginatedResult<T>> {
  const page = params.page ?? 1
  const limit = params.limit ?? 20

  const [data, total] = await Promise.all([
    model.findMany({
      ...options,
      skip: (page - 1) * limit,
      take: limit,
    }),
    model.count({ where: options.where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
    },
  }
}
