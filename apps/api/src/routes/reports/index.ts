import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { requireRole } from '@/lib/auth-guard.js'
import { cache } from '@/lib/cache.js'
import { getConnection } from '@/lib/whatsapp/connection.js'

import { buildAgentPerformance, emptyAgentPerformance } from './agents.js'
import { buildOverview, emptyOverview } from './overview.js'

import {
  REPORT_GLOBAL_ROLES,
  REPORT_READERS,
  parseReportRange,
  resolveReportScope,
  type ReportRange,
} from './reports-shaping.js'

import {
  agentPerformanceResponseSchema,
  overviewQuerySchema,
  overviewResponseSchema,
  rangeQuerySchema,
  type AgentPerformanceReport,
  type OverviewReport,
} from './schemas.js'

/** Relatório é agregação cara e tolera atraso: 60s cobre o refresh do realtime. */
const CACHE_TTL_SECONDS = 60

const cacheKey = (
  report: string,
  accountId: string,
  { from, to }: ReportRange,
  scope: string | null,
) =>
  `reports:${report}:${accountId}:${from.toISOString()}:${to.toISOString()}:${scope ?? 'all'}`

const reportsRoutes: FastifyPluginAsyncZod = async app => {
  // GET /reports/overview
  app.get(
    '/overview',
    {
      schema: {
        operationId: 'getReportsOverview',
        tags: ['Reports'],
        summary: 'Resumo do atendimento no período',
        description:
          'Totais, médias e séries da conta ativa. A coorte de conversas é a criada no período — `conversationsOpen/Pending/Closed` e `statusBreakdown` são a mesma contagem por status atual, e somam `conversationsStarted`. `resolutionSeconds` é a exceção: usa as conversas fechadas dentro do período. As séries cobrem todos os dias do intervalo e o heatmap todas as 168 células, no fuso America/Sao_Paulo; `heatmap.count` soma mensagens recebidas e enviadas. Vendedor e somente-leitura são sempre restritos às próprias conversas.',
        querystring: overviewQuerySchema,
        response: { 200: overviewResponseSchema },
      },
    },
    async (request, reply) => {
      const { session, role } = await requireRole(request, REPORT_READERS)

      const parsed = parseReportRange(request.query.from, request.query.to)
      if (!parsed.ok) return reply.badRequest(parsed.error)

      const assigneeId = resolveReportScope(
        role,
        session.user.id,
        request.query.assigneeId,
      )

      const connection = await getConnection()
      if (!connection) return emptyOverview(parsed.range)

      // A chave usa o escopo já resolvido — a do parâmetro serviria o payload
      // de um vendedor para outro.
      const key = cacheKey('overview', connection.id, parsed.range, assigneeId)
      const cached = await cache.get<OverviewReport>(key)
      if (cached) return cached

      const report = await buildOverview({
        ...parsed.range,
        accountId: connection.id,
        assigneeId,
      })

      await cache.set(key, report, CACHE_TTL_SECONDS)

      return report
    },
  )

  // GET /reports/agents
  app.get(
    '/agents',
    {
      schema: {
        operationId: 'listAgentPerformance',
        tags: ['Reports'],
        summary: 'Desempenho por atendente no período',
        description:
          'Uma linha por membro da equipe (todo papel diferente de `user`), inclusive quem não teve atividade. `assigned` conta as conversas atribuídas no período pelo histórico e `open` quantas delas seguem abertas com ele; `closed` e `resolutionSeconds` usam as conversas que ele fechou no período; `firstResponseSeconds` mede a primeira resposta dele à primeira mensagem do contato. Restrito a admin e gestor.',
        querystring: rangeQuerySchema,
        response: { 200: agentPerformanceResponseSchema },
      },
    },
    async (request, reply) => {
      await requireRole(request, REPORT_GLOBAL_ROLES)

      const parsed = parseReportRange(request.query.from, request.query.to)
      if (!parsed.ok) return reply.badRequest(parsed.error)

      const connection = await getConnection()
      if (!connection) return emptyAgentPerformance()

      const key = cacheKey('agents', connection.id, parsed.range, null)
      const cached = await cache.get<AgentPerformanceReport>(key)
      if (cached) return cached

      const report = await buildAgentPerformance({
        ...parsed.range,
        accountId: connection.id,
      })

      await cache.set(key, report, CACHE_TTL_SECONDS)

      return report
    },
  )
}

export default reportsRoutes
