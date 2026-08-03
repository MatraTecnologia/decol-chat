import { CalendarClock } from 'lucide-react'

import { cn } from '@workspace/ui/lib/utils'

import { HEAT_STEPS } from '../lib/chart-palette'
import { buildHeatmapScale, formatCount } from '../lib/report-metrics'
import type { OverviewHeatmapCell } from '../lib/report-types'
import { WEEKDAY_LABELS } from '../lib/report-types'
import {
  PanelEmpty,
  PanelError,
  PanelSkeleton,
  ReportPanel,
} from './report-panel'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const WEEKDAYS = Array.from({ length: 7 }, (_, weekday) => weekday)
const HOUR_MARKS = [0, 3, 6, 9, 12, 15, 18, 21]

const FULL_WEEKDAYS = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
]

const gridTemplate = 'grid-cols-[2rem_repeat(24,minmax(0,1fr))_2.75rem]'

export interface ActivityHeatmapProps {
  heatmap: OverviewHeatmapCell[]
  isLoading?: boolean
  error?: string | null
  className?: string
}

export const ActivityHeatmap = ({
  heatmap,
  isLoading = false,
  error = null,
  className,
}: ActivityHeatmapProps) => {
  const scale = buildHeatmapScale(heatmap)
  const peak = scale.peak

  return (
    <ReportPanel
      eyebrow="Quando o cliente procura"
      title="Volume por dia e hora"
      description={
        peak
          ? `Pico na ${FULL_WEEKDAYS[peak.weekday]} às ${String(peak.hour).padStart(2, '0')}h, com ${formatCount(peak.count)} mensagens.`
          : 'Distribuição das mensagens ao longo da semana.'
      }
      className={className}
      contentClassName="space-y-4"
    >
      {isLoading ? (
        <PanelSkeleton className="h-48" />
      ) : error ? (
        <PanelError description={error} />
      ) : scale.total === 0 ? (
        <PanelEmpty
          icon={CalendarClock}
          description="Sem mensagens no período para montar o mapa."
        />
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="min-w-[560px] space-y-1">
              <div className={cn('grid gap-[2px]', gridTemplate)} aria-hidden>
                <span />
                {HOURS.map(hour =>
                  HOUR_MARKS.includes(hour) ? (
                    <span
                      key={hour}
                      className="text-muted-foreground col-span-3 text-[10px] tabular-nums"
                    >
                      {String(hour).padStart(2, '0')}h
                    </span>
                  ) : null,
                )}
                <span className="text-muted-foreground pl-2 text-right text-[10px] tracking-wide uppercase">
                  total
                </span>
              </div>

              {WEEKDAYS.map(weekday => (
                <div
                  key={weekday}
                  className={cn('grid items-center gap-[2px]', gridTemplate)}
                >
                  <span className="text-muted-foreground pr-2 text-right text-[10px]">
                    {WEEKDAY_LABELS[weekday]}
                  </span>
                  {HOURS.map(hour => {
                    const count = scale.at(weekday, hour)
                    const bucket = scale.bucketAt(weekday, hour)

                    return (
                      <div
                        key={hour}
                        title={`${FULL_WEEKDAYS[weekday]}, ${String(hour).padStart(2, '0')}h — ${formatCount(count)}`}
                        aria-label={`${FULL_WEEKDAYS[weekday]} às ${hour} horas: ${formatCount(count)} mensagens`}
                        className={cn(
                          'h-5 rounded-[3px] transition-[outline-color]',
                          'hover:outline-foreground/30 outline-2 outline-offset-1 outline-transparent',
                          bucket === 0 && 'bg-muted',
                        )}
                        style={
                          bucket > 0
                            ? { backgroundColor: HEAT_STEPS[bucket - 1] }
                            : undefined
                        }
                      />
                    )
                  })}
                  <span className="pl-2 text-right text-[11px] tabular-nums">
                    {formatCount(
                      HOURS.reduce(
                        (sum, hour) => sum + scale.at(weekday, hour),
                        0,
                      ),
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>{formatCount(scale.total)} mensagens no período</span>
            <span className="flex items-center gap-1.5">
              menos
              <span className="flex items-center gap-[2px]">
                <span className="bg-muted size-3 rounded-[3px]" />
                {HEAT_STEPS.map(step => (
                  <span
                    key={step}
                    className="size-3 rounded-[3px]"
                    style={{ backgroundColor: step }}
                  />
                ))}
              </span>
              mais
              <span className="tabular-nums">
                (até {formatCount(scale.max)})
              </span>
            </span>
          </div>
        </>
      )}
    </ReportPanel>
  )
}
