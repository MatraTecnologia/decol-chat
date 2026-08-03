import { CircleCheck, CircleDashed, Clock, TriangleAlert } from 'lucide-react'

import { cn } from '@workspace/ui/lib/utils'

import type { PerformanceLevel } from '../lib/chart-palette'
import { LEVEL_COLOR, LEVEL_LABEL } from '../lib/chart-palette'
import { formatDuration } from '../lib/format-duration'
import type { OverviewAverages } from '../lib/report-types'
import {
  PanelEmpty,
  PanelError,
  PanelSkeleton,
  ReportPanel,
} from './report-panel'

export type ResponseMetric =
  'firstResponseSeconds' | 'replySeconds' | 'resolutionSeconds'

export interface ResponseThreshold {
  /** Até aqui é rápido. */
  good: number
  /** Acima daqui é lento. */
  warning: number
}

const DEFAULT_THRESHOLDS: Record<ResponseMetric, ResponseThreshold> = {
  firstResponseSeconds: { good: 300, warning: 1800 },
  replySeconds: { good: 600, warning: 3600 },
  resolutionSeconds: { good: 14_400, warning: 86_400 },
}

const METRICS: Array<{
  key: ResponseMetric
  label: string
  description: string
}> = [
  {
    key: 'firstResponseSeconds',
    label: 'Primeira resposta',
    description: 'Do primeiro "oi" do cliente até o vendedor responder',
  },
  {
    key: 'replySeconds',
    label: 'Resposta ao longo da conversa',
    description: 'Intervalo médio entre mensagem do cliente e retorno',
  },
  {
    key: 'resolutionSeconds',
    label: 'Resolução',
    description: 'Da abertura até a conversa ser fechada',
  },
]

const LEVEL_ICON: Record<PerformanceLevel, typeof CircleCheck> = {
  good: CircleCheck,
  warning: Clock,
  critical: TriangleAlert,
}

export const levelFor = (
  seconds: number,
  threshold: ResponseThreshold,
): PerformanceLevel => {
  if (seconds <= threshold.good) return 'good'
  if (seconds <= threshold.warning) return 'warning'
  return 'critical'
}

const soft = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`

interface TrackProps {
  seconds: number | null
  threshold: ResponseThreshold
  label: string
}

const Track = ({ seconds, threshold, label }: TrackProps) => {
  const scale = threshold.warning * 2
  const goodWidth = (threshold.good / scale) * 100
  const warningWidth = ((threshold.warning - threshold.good) / scale) * 100
  const position = seconds === null ? 0 : Math.min((seconds / scale) * 100, 100)
  const overflow = seconds !== null && seconds > scale

  return (
    <div className="space-y-1.5">
      <div
        className="relative h-2.5 overflow-hidden rounded-full"
        role="img"
        aria-label={
          seconds === null
            ? `${label}: sem medição`
            : `${label}: ${formatDuration(seconds)}, meta de ${formatDuration(threshold.good)}`
        }
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${goodWidth}%`,
            backgroundColor: soft(LEVEL_COLOR.good, 22),
          }}
        />
        <div
          className="absolute inset-y-0"
          style={{
            left: `${goodWidth}%`,
            width: `${warningWidth}%`,
            backgroundColor: soft(LEVEL_COLOR.warning, 22),
          }}
        />
        <div
          className="absolute inset-y-0 right-0"
          style={{
            left: `${goodWidth + warningWidth}%`,
            backgroundColor: soft(LEVEL_COLOR.critical, 22),
          }}
        />
        {seconds !== null ? (
          <div
            className="bg-foreground absolute inset-y-0 w-0.5 rounded-full"
            style={{
              left: `calc(${position}% - 1px)`,
            }}
          />
        ) : null}
      </div>
      <div className="text-muted-foreground flex justify-between text-[10px] tabular-nums">
        <span>0</span>
        <span>
          meta {formatDuration(threshold.good)}
          {overflow ? ' · fora da escala' : ''}
        </span>
        <span>{formatDuration(scale)}</span>
      </div>
    </div>
  )
}

export interface ResponseTimePanelProps {
  averages: OverviewAverages
  /** Metas de atendimento; sobrescreve só o que for informado. */
  thresholds?: Partial<Record<ResponseMetric, ResponseThreshold>>
  isLoading?: boolean
  error?: string | null
  className?: string
}

export const ResponseTimePanel = ({
  averages,
  thresholds,
  isLoading = false,
  error = null,
  className,
}: ResponseTimePanelProps) => {
  const measured = METRICS.some(metric => averages[metric.key] !== null)

  return (
    <ReportPanel
      eyebrow="Ritmo do atendimento"
      title="Tempos médios de resposta"
      description="Cada faixa mostra onde a média caiu entre rápido, aceitável e lento."
      className={className}
      contentClassName="space-y-5"
    >
      {isLoading ? (
        <PanelSkeleton className="h-60" />
      ) : error ? (
        <PanelError description={error} />
      ) : !measured ? (
        <PanelEmpty
          icon={CircleDashed}
          description="Nenhuma conversa teve resposta medida no período."
        />
      ) : (
        METRICS.map(metric => {
          const seconds = averages[metric.key]
          const threshold =
            thresholds?.[metric.key] ?? DEFAULT_THRESHOLDS[metric.key]
          const level = seconds === null ? null : levelFor(seconds, threshold)
          const Icon = level ? LEVEL_ICON[level] : CircleDashed

          return (
            <div
              key={metric.key}
              className="space-y-2 border-b pb-5 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{metric.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {metric.description}
                  </p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl leading-none font-semibold">
                    {formatDuration(seconds)}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium',
                      !level && 'text-muted-foreground',
                    )}
                    style={level ? { color: LEVEL_COLOR[level] } : undefined}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {level ? LEVEL_LABEL[level] : 'Sem medição'}
                  </span>
                </div>
              </div>
              <Track
                seconds={seconds}
                threshold={threshold}
                label={metric.label}
              />
            </div>
          )
        })
      )}
    </ReportPanel>
  )
}
