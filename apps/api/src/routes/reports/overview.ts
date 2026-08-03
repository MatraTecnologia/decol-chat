import { Prisma } from '@/generated/prisma/client.js'
import { prisma } from '@/lib/prisma.js'

import {
  REPORTS_TIME_ZONE,
  REPORTS_WINDOW_MS,
  buildHeatmap,
  buildSeries,
  buildStatusBreakdown,
  countStatus,
  enumerateDays,
  type DailyConversationBucket,
  type DailyMessageBucket,
  type HeatmapCell,
  type ReportRange,
  type StatusBucket,
} from './reports-shaping.js'

import type { OverviewReport } from './schemas.js'

export interface ReportFilters extends ReportRange {
  accountId: string
  /** `null` = equipe inteira; só admin/manager chegam aqui com `null`. */
  assigneeId: string | null
}

/**
 * O Postgres guarda `timestamp` sem fuso (UTC puro), então a dupla conversão é
 * obrigatória: um único `AT TIME ZONE` deslocaria todos os buckets em 3h.
 */
const local = (column: Prisma.Sql) =>
  Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${REPORTS_TIME_ZONE}::text)`

const conversationScope = ({ accountId, assigneeId }: ReportFilters) =>
  Prisma.sql`c."whatsAppAccountId" = ${accountId}${
    assigneeId
      ? Prisma.sql` AND c."assignedToId" = ${assigneeId}`
      : Prisma.empty
  }`

// ── Consultas ──────────────────────────────────────────

interface StatusRow extends StatusBucket {
  unassigned: number
  outsideWindow: number
}

/**
 * Coorte do período: conversas criadas dentro dele, agrupadas pelo status atual.
 * `unassigned` e `outsideWindow` saem da mesma varredura — somados no Node.
 */
const queryStatusCohort = (filters: ReportFilters) => {
  const windowStart = new Date(Date.now() - REPORTS_WINDOW_MS)

  return prisma.$queryRaw<StatusRow[]>`
    SELECT c.status::text AS status,
           COUNT(*)::int AS count,
           COUNT(*) FILTER (
             WHERE c.status <> 'CLOSED' AND c."assignedToId" IS NULL
           )::int AS unassigned,
           COUNT(*) FILTER (
             WHERE c.status <> 'CLOSED'
               AND c."lastInboundAt" IS NOT NULL
               AND c."lastInboundAt" < ${windowStart}
           )::int AS "outsideWindow"
    FROM "conversation" c
    WHERE ${conversationScope(filters)}
      AND c."createdAt" >= ${filters.from}
      AND c."createdAt" <= ${filters.to}
    GROUP BY c.status`
}

interface MessageTotalsRow {
  messagesInbound: number
  messagesOutbound: number
  templatesSent: number
  failedMessages: number
}

const queryMessageTotals = (filters: ReportFilters) =>
  prisma.$queryRaw<[MessageTotalsRow]>`
    SELECT COUNT(*) FILTER (WHERE m.direction = 'INBOUND')::int AS "messagesInbound",
           COUNT(*) FILTER (WHERE m.direction = 'OUTBOUND')::int AS "messagesOutbound",
           COUNT(*) FILTER (WHERE m.direction = 'OUTBOUND' AND m.type = 'TEMPLATE')::int AS "templatesSent",
           COUNT(*) FILTER (WHERE m.status = 'FAILED')::int AS "failedMessages"
    FROM "message" m
    JOIN "conversation" c ON c.id = m."conversationId"
    WHERE ${conversationScope(filters)}
      AND m."createdAt" >= ${filters.from}
      AND m."createdAt" <= ${filters.to}`

interface HourlyRow extends HeatmapCell {
  day: string
  inbound: number
  outbound: number
}

/** Um bucket por hora local alimenta a série diária e o heatmap de uma vez só. */
const queryHourlyBuckets = (filters: ReportFilters) =>
  prisma.$queryRaw<HourlyRow[]>`
    SELECT to_char(t.local, 'YYYY-MM-DD') AS day,
           EXTRACT(DOW FROM t.local)::int AS weekday,
           EXTRACT(HOUR FROM t.local)::int AS hour,
           COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE t.direction = 'INBOUND')::int AS inbound,
           COUNT(*) FILTER (WHERE t.direction = 'OUTBOUND')::int AS outbound
    FROM (
      SELECT m.direction, ${local(Prisma.sql`m."createdAt"`)} AS local
      FROM "message" m
      JOIN "conversation" c ON c.id = m."conversationId"
      WHERE ${conversationScope(filters)}
        AND m."createdAt" >= ${filters.from}
        AND m."createdAt" <= ${filters.to}
    ) t
    GROUP BY 1, 2, 3`

/** Abertas e fechadas caem em colunas diferentes — o UNION junta os dois eventos. */
const queryConversationBuckets = (filters: ReportFilters) =>
  prisma.$queryRaw<DailyConversationBucket[]>`
    SELECT to_char(t.local, 'YYYY-MM-DD') AS day,
           SUM(t.started)::int AS started,
           SUM(t.closed)::int AS closed
    FROM (
      SELECT ${local(Prisma.sql`c."createdAt"`)} AS local, 1 AS started, 0 AS closed
      FROM "conversation" c
      WHERE ${conversationScope(filters)}
        AND c."createdAt" >= ${filters.from}
        AND c."createdAt" <= ${filters.to}
      UNION ALL
      SELECT ${local(Prisma.sql`c."closedAt"`)} AS local, 0 AS started, 1 AS closed
      FROM "conversation" c
      WHERE ${conversationScope(filters)}
        AND c."closedAt" >= ${filters.from}
        AND c."closedAt" <= ${filters.to}
    ) t
    GROUP BY 1`

interface AveragesRow {
  firstResponseSeconds: number | null
  resolutionSeconds: number | null
  replySeconds: number | null
}

/**
 * As três médias numa ida só. `firstResponse` usa `JOIN LATERAL` para pegar a
 * primeira inbound e a primeira outbound posterior de cada conversa; `reply`
 * compara cada outbound com a mensagem imediatamente anterior, quando ela veio
 * do contato.
 */
const queryAverages = (filters: ReportFilters) =>
  prisma.$queryRaw<[AveragesRow]>`
    SELECT
      (
        SELECT AVG(EXTRACT(EPOCH FROM (reply.ts - first_inbound.ts)))::float8
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
            AND m."createdAt" > first_inbound.ts
          ORDER BY m."createdAt" ASC
          LIMIT 1
        ) reply ON TRUE
        WHERE ${conversationScope(filters)}
          AND c."createdAt" >= ${filters.from}
          AND c."createdAt" <= ${filters.to}
      ) AS "firstResponseSeconds",
      (
        SELECT AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."createdAt")))::float8
        FROM "conversation" c
        WHERE ${conversationScope(filters)}
          AND c."closedAt" >= ${filters.from}
          AND c."closedAt" <= ${filters.to}
      ) AS "resolutionSeconds",
      (
        SELECT AVG(EXTRACT(EPOCH FROM (t.ts - t.previous_ts)))::float8
        FROM (
          SELECT m.direction,
                 m."createdAt" AS ts,
                 LAG(m."createdAt") OVER w AS previous_ts,
                 LAG(m.direction) OVER w AS previous_direction
          FROM "message" m
          JOIN "conversation" c ON c.id = m."conversationId"
          WHERE ${conversationScope(filters)}
            AND m."createdAt" >= ${filters.from}
            AND m."createdAt" <= ${filters.to}
          WINDOW w AS (PARTITION BY m."conversationId" ORDER BY m."createdAt")
        ) t
        WHERE t.direction = 'OUTBOUND' AND t.previous_direction = 'INBOUND'
      ) AS "replySeconds"`

// ── Montagem ───────────────────────────────────────────

const emptyTotals = {
  conversationsStarted: 0,
  conversationsOpen: 0,
  conversationsPending: 0,
  conversationsClosed: 0,
  messagesInbound: 0,
  messagesOutbound: 0,
  templatesSent: 0,
  unassigned: 0,
  outsideWindow: 0,
  failedMessages: 0,
}

const rangeOf = ({ from, to }: ReportRange) => ({
  from: from.toISOString(),
  to: to.toISOString(),
})

/** Sem conta ativa a dashboard ainda precisa de um payload completo. */
export const emptyOverview = (range: ReportRange): OverviewReport => ({
  range: rangeOf(range),
  totals: emptyTotals,
  averages: {
    firstResponseSeconds: null,
    resolutionSeconds: null,
    replySeconds: null,
  },
  series: buildSeries(enumerateDays(range), [], []),
  heatmap: buildHeatmap([]),
  statusBreakdown: buildStatusBreakdown([]),
})

export const buildOverview = async (
  filters: ReportFilters,
): Promise<OverviewReport> => {
  const [statusRows, [messageTotals], hourly, conversationBuckets, [averages]] =
    await Promise.all([
      queryStatusCohort(filters),
      queryMessageTotals(filters),
      queryHourlyBuckets(filters),
      queryConversationBuckets(filters),
      queryAverages(filters),
    ])

  const dailyMessages = new Map<string, DailyMessageBucket>()

  for (const row of hourly) {
    const bucket = dailyMessages.get(row.day) ?? {
      day: row.day,
      inbound: 0,
      outbound: 0,
    }

    bucket.inbound += row.inbound
    bucket.outbound += row.outbound
    dailyMessages.set(row.day, bucket)
  }

  const sumOf = (field: 'unassigned' | 'outsideWindow') =>
    statusRows.reduce((total, row) => total + row[field], 0)

  return {
    range: rangeOf(filters),
    totals: {
      conversationsStarted: statusRows.reduce(
        (total, row) => total + row.count,
        0,
      ),
      conversationsOpen: countStatus(statusRows, 'OPEN'),
      conversationsPending: countStatus(statusRows, 'PENDING'),
      conversationsClosed: countStatus(statusRows, 'CLOSED'),
      messagesInbound: messageTotals.messagesInbound,
      messagesOutbound: messageTotals.messagesOutbound,
      templatesSent: messageTotals.templatesSent,
      unassigned: sumOf('unassigned'),
      outsideWindow: sumOf('outsideWindow'),
      failedMessages: messageTotals.failedMessages,
    },
    averages: {
      firstResponseSeconds: averages.firstResponseSeconds,
      resolutionSeconds: averages.resolutionSeconds,
      replySeconds: averages.replySeconds,
    },
    series: buildSeries(
      enumerateDays(filters),
      [...dailyMessages.values()],
      conversationBuckets,
    ),
    heatmap: buildHeatmap(hourly),
    statusBreakdown: buildStatusBreakdown(statusRows),
  }
}
