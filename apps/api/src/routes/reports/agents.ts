import { prisma } from '@/lib/prisma.js'

import type { ReportRange } from './reports-shaping.js'
import type { AgentPerformanceReport } from './schemas.js'

export interface AgentReportFilters extends ReportRange {
  accountId: string
}

interface AssignmentRow {
  userId: string
  assigned: number
  open: number
}

/**
 * Atribuições recebidas no período, pelo histórico — `Conversation.assignedAt`
 * só guarda a última, então quem passou a conversa adiante sumiria da conta.
 * `open` é o quanto dessas atribuições ainda está aberto com ele.
 */
const queryAssignments = ({ accountId, from, to }: AgentReportFilters) =>
  prisma.$queryRaw<AssignmentRow[]>`
    SELECT h."toUserId" AS "userId",
           COUNT(DISTINCT h."conversationId")::int AS assigned,
           COUNT(DISTINCT h."conversationId") FILTER (
             WHERE c.status = 'OPEN' AND c."assignedToId" = h."toUserId"
           )::int AS open
    FROM "conversation_assignment_history" h
    JOIN "conversation" c ON c.id = h."conversationId"
    WHERE c."whatsAppAccountId" = ${accountId}
      AND h."toUserId" IS NOT NULL
      AND h."createdAt" >= ${from}
      AND h."createdAt" <= ${to}
    GROUP BY 1`

interface ClosedRow {
  userId: string
  closed: number
  resolutionSeconds: number | null
}

const queryClosed = ({ accountId, from, to }: AgentReportFilters) =>
  prisma.$queryRaw<ClosedRow[]>`
    SELECT c."closedById" AS "userId",
           COUNT(*)::int AS closed,
           AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."createdAt")))::float8 AS "resolutionSeconds"
    FROM "conversation" c
    WHERE c."whatsAppAccountId" = ${accountId}
      AND c."closedById" IS NOT NULL
      AND c."closedAt" >= ${from}
      AND c."closedAt" <= ${to}
    GROUP BY 1`

interface ActivityRow {
  userId: string
  messagesSent: number
  lastActivityAt: Date | null
}

const queryActivity = ({ accountId, from, to }: AgentReportFilters) =>
  prisma.$queryRaw<ActivityRow[]>`
    SELECT m."senderId" AS "userId",
           COUNT(*)::int AS "messagesSent",
           MAX(m."createdAt") AS "lastActivityAt"
    FROM "message" m
    JOIN "conversation" c ON c.id = m."conversationId"
    WHERE c."whatsAppAccountId" = ${accountId}
      AND m.direction = 'OUTBOUND'
      AND m."senderId" IS NOT NULL
      AND m."createdAt" >= ${from}
      AND m."createdAt" <= ${to}
    GROUP BY 1`

interface FirstResponseRow {
  userId: string
  firstResponseSeconds: number | null
}

/** Primeira resposta do próprio responsável, não da equipe. */
const queryFirstResponse = ({ accountId, from, to }: AgentReportFilters) =>
  prisma.$queryRaw<FirstResponseRow[]>`
    SELECT c."assignedToId" AS "userId",
           AVG(EXTRACT(EPOCH FROM (reply.ts - first_inbound.ts)))::float8 AS "firstResponseSeconds"
    FROM "conversation" c
    JOIN LATERAL (
      SELECT m."createdAt" AS ts
      FROM "message" m
      WHERE m."conversationId" = c.id AND m.direction = 'INBOUND'
      ORDER BY m."createdAt" ASC
      LIMIT 1
    ) first_inbound ON TRUE
    JOIN LATERAL (
      SELECT m."createdAt" AS ts
      FROM "message" m
      WHERE m."conversationId" = c.id
        AND m.direction = 'OUTBOUND'
        AND m."senderId" = c."assignedToId"
        AND m."createdAt" > first_inbound.ts
      ORDER BY m."createdAt" ASC
      LIMIT 1
    ) reply ON TRUE
    WHERE c."whatsAppAccountId" = ${accountId}
      AND c."assignedToId" IS NOT NULL
      AND c."createdAt" >= ${from}
      AND c."createdAt" <= ${to}
    GROUP BY 1`

/** Todo o staff aparece, mesmo sem atividade — a lista é a equipe, não o log. */
const queryRoster = () =>
  prisma.user.findMany({
    where: { role: { not: 'user' } },
    select: { id: true, name: true, email: true, image: true, role: true },
    orderBy: { name: 'asc' },
  })

export const emptyAgentPerformance = (): AgentPerformanceReport => ({
  data: [],
})

export const buildAgentPerformance = async (
  filters: AgentReportFilters,
): Promise<AgentPerformanceReport> => {
  const [roster, assignments, closed, activity, firstResponse] =
    await Promise.all([
      queryRoster(),
      queryAssignments(filters),
      queryClosed(filters),
      queryActivity(filters),
      queryFirstResponse(filters),
    ])

  const assignmentsByUser = new Map(assignments.map(row => [row.userId, row]))
  const closedByUser = new Map(closed.map(row => [row.userId, row]))
  const activityByUser = new Map(activity.map(row => [row.userId, row]))
  const firstResponseByUser = new Map(
    firstResponse.map(row => [row.userId, row]),
  )

  const data = roster.map(user => ({
    userId: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role ?? 'user',
    assigned: assignmentsByUser.get(user.id)?.assigned ?? 0,
    closed: closedByUser.get(user.id)?.closed ?? 0,
    open: assignmentsByUser.get(user.id)?.open ?? 0,
    messagesSent: activityByUser.get(user.id)?.messagesSent ?? 0,
    firstResponseSeconds:
      firstResponseByUser.get(user.id)?.firstResponseSeconds ?? null,
    resolutionSeconds: closedByUser.get(user.id)?.resolutionSeconds ?? null,
    lastActivityAt:
      activityByUser.get(user.id)?.lastActivityAt?.toISOString() ?? null,
  }))

  data.sort(
    (a, b) => b.messagesSent - a.messagesSent || a.name.localeCompare(b.name),
  )

  return { data }
}
