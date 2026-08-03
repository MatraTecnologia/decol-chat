'use client'

import { useQuery } from '@tanstack/react-query'
import { ChartNoAxesCombined } from 'lucide-react'
import { motion } from 'motion/react'
import { parseAsString, useQueryState } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'

import {
  getReportsOverviewOptions,
  listAgentPerformanceOptions,
} from '@workspace/api-client/react-query'

import {
  ActivityHeatmap,
  AgentLeaderboard,
  AgentPerformanceTable,
  ConversationVolumeChart,
  KpiGrid,
  ResponseTimePanel,
  StatusDonut,
} from '@/features/reports'

import { useOnlineUsers, useUserRole } from '@/hooks'

import { AssigneeFilter } from './assignee-filter'
import { EMPTY_AVERAGES, EMPTY_TOTALS, errorText } from './report-fallbacks'
import { PeriodFilter } from './period-filter'

import {
  dayEndIso,
  dayStartIso,
  DEFAULT_PRESET,
  normalizeRange,
  parseDayKey,
  presetRange,
  type DayRange,
} from './period-range'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
  },
}

export const Client = () => {
  const { hasRole } = useUserRole()
  const onlineUserIds = useOnlineUsers()

  const [from, setFrom] = useQueryState('from', parseAsString)
  const [to, setTo] = useQueryState('to', parseAsString)
  const [assigneeId, setAssigneeId] = useQueryState('assigneeId', parseAsString)

  // `new Date()` no servidor resolveria um dia diferente do navegador, então o
  // período padrão só nasce depois da montagem — até lá os painéis ficam em
  // carregamento e o HTML bate na hidratação.
  const [today, setToday] = useState<Date | null>(null)

  useEffect(() => setToday(new Date()), [])

  const canManage = hasRole('admin', 'manager')

  const range = useMemo<DayRange | null>(() => {
    if (parseDayKey(from) && parseDayKey(to)) {
      return normalizeRange(from as string, to as string)
    }

    return today ? presetRange(DEFAULT_PRESET, today) : null
  }, [from, to, today])

  const rangeQuery = range
    ? { from: dayStartIso(range.from), to: dayEndIso(range.to) }
    : { from: '', to: '' }

  const overview = useQuery({
    ...getReportsOverviewOptions({
      query: { ...rangeQuery, assigneeId: assigneeId ?? undefined },
    }),
    enabled: !!range,
  })

  const agents = useQuery({
    ...listAgentPerformanceOptions({ query: rangeQuery }),
    enabled: !!range && canManage,
  })

  const totals = overview.data?.totals ?? EMPTY_TOTALS
  const averages = overview.data?.averages ?? EMPTY_AVERAGES
  const series = overview.data?.series ?? []
  const heatmap = overview.data?.heatmap ?? []
  const statusBreakdown = overview.data?.statusBreakdown ?? []
  const agentRows = agents.data?.data ?? []

  // `keepPreviousData` é o padrão do QueryProvider: ao trocar o período os
  // números antigos seguem na tela enquanto o novo intervalo carrega, então o
  // skeleton só aparece na primeira carga e nada salta de lugar.
  const isLoading = !range || overview.isPending
  const overviewError = overview.isError ? errorText(overview.error) : null

  const isAgentsLoading = !range || agents.isPending
  const agentsError = agents.isError ? errorText(agents.error) : null

  const applyRange = (next: DayRange) => {
    setFrom(next.from)
    setTo(next.to)
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        variants={containerVariants}
        initial={false}
        animate="visible"
        className="space-y-6"
      >
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <ChartNoAxesCombined className="text-primary size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {canManage ? 'Acompanhamento' : 'Meu atendimento'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {canManage
                  ? 'Volume, tempo de resposta e desempenho do time no WhatsApp.'
                  : 'Volume e tempo de resposta das conversas atribuídas a você.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <PeriodFilter range={range} today={today} onChange={applyRange} />
            {canManage && (
              <AssigneeFilter value={assigneeId} onChange={setAssigneeId} />
            )}
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <KpiGrid
            totals={totals}
            averages={averages}
            series={series}
            isLoading={isLoading}
            error={overviewError}
          />
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="grid gap-4 xl:grid-cols-3"
        >
          <ResponseTimePanel
            averages={averages}
            isLoading={isLoading}
            error={overviewError}
            className="xl:col-span-2"
          />
          <StatusDonut
            statusBreakdown={statusBreakdown}
            isLoading={isLoading}
            error={overviewError}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <ConversationVolumeChart
            series={series}
            isLoading={isLoading}
            error={overviewError}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <ActivityHeatmap
            heatmap={heatmap}
            isLoading={isLoading}
            error={overviewError}
          />
        </motion.div>

        {canManage && (
          <>
            <motion.div variants={itemVariants}>
              <AgentLeaderboard
                agents={agentRows}
                onlineUserIds={onlineUserIds}
                isLoading={isAgentsLoading}
                error={agentsError}
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <AgentPerformanceTable
                agents={agentRows}
                onlineUserIds={onlineUserIds}
                onSelectAgent={setAssigneeId}
                isLoading={isAgentsLoading}
                error={agentsError}
              />
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  )
}
