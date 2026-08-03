'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar'
import { Skeleton } from '@workspace/ui/components/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { cn } from '@workspace/ui/lib/utils'

import { LEVEL_COLOR, SERIES_COLOR } from '../lib/chart-palette'
import { formatDurationCompact, formatElapsed } from '../lib/format-duration'
import type { AgentSortKey, SortDirection } from '../lib/report-metrics'
import { formatCount, rankAgents, sortAgents } from '../lib/report-metrics'
import type { AgentRow } from '../lib/report-types'
import { PanelEmpty, PanelError, ReportPanel } from './report-panel'

const COLUMNS: Array<{ key: AgentSortKey; label: string }> = [
  { key: 'assigned', label: 'Atribuídas' },
  { key: 'closed', label: 'Fechadas' },
  { key: 'open', label: 'Em aberto' },
  { key: 'messagesSent', label: 'Enviadas' },
  { key: 'firstResponseSeconds', label: '1ª resposta' },
  { key: 'resolutionSeconds', label: 'Resolução' },
  { key: 'lastActivityAt', label: 'Última atividade' },
]

type SortState = 'none' | 'asc' | 'desc'

const SortIndicator = ({ state }: { state: SortState }) => {
  if (state === 'none') {
    return <ChevronsUpDown className="size-3.5" aria-hidden />
  }

  return state === 'desc' ? (
    <ArrowDown className="size-3.5" aria-hidden />
  ) : (
    <ArrowUp className="size-3.5" aria-hidden />
  )
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')

export interface AgentPerformanceTableProps {
  agents: AgentRow[]
  /** Ids conectados agora, vindos da presença do Socket.io. */
  onlineUserIds?: ReadonlySet<string>
  onSelectAgent?: (userId: string) => void
  isLoading?: boolean
  error?: string | null
  className?: string
}

export const AgentPerformanceTable = ({
  agents,
  onlineUserIds,
  onSelectAgent,
  isLoading = false,
  error = null,
  className,
}: AgentPerformanceTableProps) => {
  const [sort, setSort] = useState<{
    key: AgentSortKey
    direction: SortDirection
  } | null>(null)

  const rows = useMemo(
    () =>
      sort ? sortAgents(agents, sort.key, sort.direction) : rankAgents(agents),
    [agents, sort],
  )

  const maxMessages = Math.max(...agents.map(agent => agent.messagesSent), 1)

  const toggle = (key: AgentSortKey) =>
    setSort(current => {
      if (current?.key !== key) {
        return { key, direction: key === 'name' ? 'asc' : 'desc' }
      }
      if (current.direction === 'desc') return { key, direction: 'asc' }
      return null
    })

  const sortState = (key: AgentSortKey): SortState =>
    sort?.key === key ? sort.direction : 'none'

  return (
    <ReportPanel
      eyebrow="Time comercial"
      title="Desempenho por vendedor"
      description={
        sort
          ? 'Ordenado pela coluna escolhida. Clique de novo para voltar ao ranking.'
          : 'Ordenado por conversas fechadas, desempatando pela primeira resposta.'
      }
      className={className}
      contentClassName="px-0"
    >
      {isLoading ? (
        <div className="space-y-2 px-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="px-4">
          <PanelError description={error} />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4">
          <PanelEmpty
            icon={Users}
            description="Nenhum vendedor com atendimento registrado no período."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggle('name')}
                    className="hover:text-foreground focus-visible:ring-ring flex items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Vendedor
                    <SortIndicator state={sortState('name')} />
                  </button>
                </TableHead>
                {COLUMNS.map(column => (
                  <TableHead key={column.key} className="text-right">
                    <button
                      type="button"
                      onClick={() => toggle(column.key)}
                      className="hover:text-foreground focus-visible:ring-ring ml-auto flex items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {column.label}
                      <SortIndicator state={sortState(column.key)} />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((agent, index) => {
                const online = onlineUserIds?.has(agent.userId) ?? false

                return (
                  <TableRow
                    key={agent.userId}
                    onClick={
                      onSelectAgent
                        ? () => onSelectAgent(agent.userId)
                        : undefined
                    }
                    className={cn(onSelectAgent && 'cursor-pointer')}
                  >
                    <TableCell className="text-muted-foreground text-center text-xs tabular-nums">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar>
                            <AvatarImage
                              src={agent.image ?? undefined}
                              alt={agent.name}
                            />
                            <AvatarFallback className="text-xs">
                              {initials(agent.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              'ring-card absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2',
                              !online && 'bg-muted-foreground/40',
                            )}
                            style={
                              online
                                ? { backgroundColor: LEVEL_COLOR.good }
                                : undefined
                            }
                          />
                          <span className="sr-only">
                            {online ? 'Online agora' : 'Offline'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {agent.name}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {agent.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(agent.assigned)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCount(agent.closed)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(agent.open)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="ml-auto flex w-16 flex-col items-end gap-1">
                        <span className="tabular-nums">
                          {formatCount(agent.messagesSent)}
                        </span>
                        <span className="bg-muted h-[3px] w-full overflow-hidden rounded-full">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${(agent.messagesSent / maxMessages) * 100}%`,
                              backgroundColor: SERIES_COLOR.outbound,
                            }}
                          />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDurationCompact(agent.firstResponseSeconds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDurationCompact(agent.resolutionSeconds)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {formatElapsed(agent.lastActivityAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportPanel>
  )
}
