import { PieChart } from 'lucide-react'

import { cn } from '@workspace/ui/lib/utils'

import { STATUS_COLOR } from '../lib/chart-palette'
import { formatCount, formatPercent, statusShares } from '../lib/report-metrics'
import type {
  ConversationStatus,
  OverviewStatusSlice,
} from '../lib/report-types'
import { STATUS_LABELS } from '../lib/report-types'
import {
  PanelEmpty,
  PanelError,
  PanelSkeleton,
  ReportPanel,
} from './report-panel'

const SIZE = 168
const RADIUS = 66
const THICKNESS = 18
const GAP = 4
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const STATUS_HINTS: Record<ConversationStatus, string> = {
  OPEN: 'Alguém está tocando agora',
  PENDING: 'Cliente falou e ninguém voltou',
  CLOSED: 'Encerradas no período',
}

export interface StatusDonutProps {
  statusBreakdown: OverviewStatusSlice[]
  isLoading?: boolean
  error?: string | null
  className?: string
}

export const StatusDonut = ({
  statusBreakdown,
  isLoading = false,
  error = null,
  className,
}: StatusDonutProps) => {
  const shares = statusShares(statusBreakdown)
  const total = shares.reduce((sum, share) => sum + share.count, 0)
  const filled = shares.filter(share => share.count > 0)
  const gap = filled.length > 1 ? GAP : 0

  const segments = filled.map((share, index) => {
    const before = filled
      .slice(0, index)
      .reduce((sum, item) => sum + item.percent, 0)
    const length = (share.percent / 100) * CIRCUMFERENCE

    return {
      status: share.status,
      drawn: Math.max(length - gap, 1),
      offset: -(before / 100) * CIRCUMFERENCE - gap / 2,
    }
  })

  return (
    <ReportPanel
      eyebrow="Carteira atual"
      title="Conversas por status"
      description="Onde o volume do período parou."
      className={className}
    >
      {isLoading ? (
        <PanelSkeleton className="h-52" />
      ) : error ? (
        <PanelError description={error} />
      ) : total === 0 ? (
        <PanelEmpty
          icon={PieChart}
          description="Nenhuma conversa registrada no período."
        />
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div
            className="relative shrink-0"
            style={{ width: SIZE, height: SIZE }}
          >
            <svg
              width={SIZE}
              height={SIZE}
              role="img"
              aria-label={shares
                .map(
                  share =>
                    `${STATUS_LABELS[share.status]}: ${share.count} (${formatPercent(share.percent)})`,
                )
                .join(', ')}
            >
              <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={THICKNESS}
                  className="stroke-muted"
                />
                {segments.map(segment => (
                  <circle
                    key={segment.status}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    strokeWidth={THICKNESS}
                    stroke={STATUS_COLOR[segment.status]}
                    strokeDasharray={`${segment.drawn} ${CIRCUMFERENCE - segment.drawn}`}
                    strokeDashoffset={segment.offset}
                    strokeLinecap="butt"
                  />
                ))}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl leading-none font-semibold">
                {formatCount(total)}
              </span>
              <span className="text-muted-foreground text-xs">conversas</span>
            </div>
          </div>

          <ul className="w-full min-w-0 space-y-3">
            {shares.map(share => (
              <li key={share.status} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1 size-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: STATUS_COLOR[share.status] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {STATUS_LABELS[share.status]}
                    </span>
                    <span
                      className={cn(
                        'text-sm tabular-nums',
                        share.count === 0 && 'text-muted-foreground',
                      )}
                    >
                      {formatCount(share.count)}
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        {formatPercent(share.percent)}
                      </span>
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {STATUS_HINTS[share.status]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ReportPanel>
  )
}
