import {
  AlarmClock,
  CircleUserRound,
  Clock3,
  FileBadge,
  MessageSquareDot,
  MessageSquareText,
  MessagesSquare,
  SendHorizontal,
  TriangleAlert,
} from 'lucide-react'

import { cn } from '@workspace/ui/lib/utils'

import { LEVEL_COLOR, RP_SCOPE } from '../lib/chart-palette'
import { formatDuration } from '../lib/format-duration'
import {
  closureRate,
  formatCount,
  formatPercent,
  responseRate,
} from '../lib/report-metrics'
import type {
  OverviewAverages,
  OverviewSeriesPoint,
  OverviewTotals,
} from '../lib/report-types'
import { KpiCard } from './kpi-card'
import { PanelError, ReportPalette } from './report-panel'

export interface KpiGridProps {
  totals: OverviewTotals
  averages: OverviewAverages
  /** Alimenta o sparkline do cartão de abertura. */
  series?: OverviewSeriesPoint[]
  isLoading?: boolean
  error?: string | null
  className?: string
}

interface AlertItem {
  icon: typeof TriangleAlert
  label: string
  hint: string
  value: number
  color: string
}

const AlertStrip = ({ items }: { items: AlertItem[] }) => (
  <div
    className={cn(
      RP_SCOPE,
      'bg-border ring-foreground/10 grid gap-px overflow-hidden rounded-xl ring-1 sm:grid-cols-3',
    )}
  >
    <ReportPalette />
    {items.map(item => {
      const active = item.value > 0
      const Icon = item.icon

      return (
        <div
          key={item.label}
          className="bg-card flex items-center gap-3 px-4 py-3"
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: active
                ? `color-mix(in oklab, ${item.color} 14%, transparent)`
                : undefined,
              color: active ? item.color : undefined,
            }}
          >
            <Icon
              className={cn('size-4', !active && 'text-muted-foreground')}
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-tight font-medium">
              <span className="tabular-nums">{formatCount(item.value)}</span>{' '}
              {item.label}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {item.hint}
            </p>
          </div>
        </div>
      )
    })}
  </div>
)

export const KpiGrid = ({
  totals,
  averages,
  series,
  isLoading = false,
  error = null,
  className,
}: KpiGridProps) => {
  if (error) {
    return (
      <PanelError
        title="Não foi possível carregar os indicadores"
        description={error}
        className={className}
      />
    )
  }

  const trend = series?.map(point => point.started) ?? []
  const closed = closureRate(totals)
  const replies = responseRate(totals)

  const alerts: AlertItem[] = [
    {
      icon: CircleUserRound,
      label: 'sem responsável',
      hint: 'Conversas esperando alguém assumir',
      value: totals.unassigned,
      color: LEVEL_COLOR.warning,
    },
    {
      icon: AlarmClock,
      label: 'fora da janela',
      hint: 'Só dá para responder com modelo aprovado',
      value: totals.outsideWindow,
      color: LEVEL_COLOR.warning,
    },
    {
      icon: TriangleAlert,
      label: 'falhas de envio',
      hint: 'Mensagens recusadas pela Meta',
      value: totals.failedMessages,
      color: LEVEL_COLOR.critical,
    },
  ]

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Conversas iniciadas"
          value={totals.conversationsStarted}
          icon={MessagesSquare}
          tone="accent"
          emphasis
          trend={trend}
          hint={`${formatPercent(closed)} já foram fechadas no período`}
          isLoading={isLoading}
        />
        <KpiCard
          label="Em aberto"
          value={totals.conversationsOpen}
          icon={MessageSquareDot}
          hint="Em atendimento agora"
          isLoading={isLoading}
        />
        <KpiCard
          label="Aguardando"
          value={totals.conversationsPending}
          icon={Clock3}
          tone={totals.conversationsPending > 0 ? 'warning' : 'default'}
          hint="Esperando resposta do vendedor"
          isLoading={isLoading}
        />
        <KpiCard
          label="Fechadas"
          value={totals.conversationsClosed}
          icon={MessageSquareText}
          hint="Encerradas no período"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Mensagens recebidas"
          value={totals.messagesInbound}
          icon={MessagesSquare}
          hint={`${formatPercent(replies)} de retorno em mensagens enviadas`}
          isLoading={isLoading}
        />
        <KpiCard
          label="Mensagens enviadas"
          value={totals.messagesOutbound}
          icon={SendHorizontal}
          hint="Somando digitadas e automáticas"
          isLoading={isLoading}
        />
        <KpiCard
          label="Modelos enviados"
          value={totals.templatesSent}
          icon={FileBadge}
          hint="Disparos com template aprovado"
          isLoading={isLoading}
        />
        <KpiCard
          label="1ª resposta média"
          value={formatDuration(averages.firstResponseSeconds)}
          icon={Clock3}
          hint={`Resposta geral em ${formatDuration(averages.replySeconds)}`}
          isLoading={isLoading}
        />
      </div>

      {isLoading ? null : <AlertStrip items={alerts} />}
    </div>
  )
}
