import { Prisma } from '@/generated/prisma/client.js'

import { prisma } from '@/lib/prisma.js'

import { type MessageMatch, toLikePattern } from './search.js'

interface MatchRow {
  conversationId: string
  id: string
  content: string
  createdAt: Date
  total: number
}

/**
 * Resolve, em uma única consulta, a mensagem mais recente que casou com o termo
 * em cada conversa da página e quantas casaram no total.
 *
 * O escopo de RBAC já foi aplicado na listagem: aqui só entram os ids que o
 * solicitante pode ver.
 */
export const findMessageMatches = async (
  conversationIds: string[],
  term: string,
): Promise<Map<string, MessageMatch>> => {
  if (conversationIds.length === 0) return new Map()

  const rows = await prisma.$queryRaw<MatchRow[]>`
    SELECT sub."conversationId", sub."id", sub."content", sub."createdAt", sub."total"
    FROM (
      SELECT
        m."conversationId",
        m."id",
        m."content",
        m."createdAt",
        COUNT(*) OVER (PARTITION BY m."conversationId")::int AS "total",
        ROW_NUMBER() OVER (
          PARTITION BY m."conversationId"
          ORDER BY m."createdAt" DESC, m."id" DESC
        ) AS "rn"
      FROM "message" m
      WHERE m."conversationId" IN (${Prisma.join(conversationIds)})
        AND m."content" ILIKE ${toLikePattern(term)}
    ) sub
    WHERE sub."rn" = 1
  `

  return new Map(
    rows.map(row => [
      row.conversationId,
      {
        id: row.id,
        content: row.content,
        createdAt: row.createdAt,
        count: Number(row.total),
      },
    ]),
  )
}
