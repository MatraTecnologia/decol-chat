import type { LucideIcon } from 'lucide-react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'

import { LEVEL_COLOR, RP_SCOPE, SERIES_COLOR } from '../lib/chart-palette'
import { formatCompactCount, formatPercent } from '../lib/report-metrics'
import { ReportPalette } from './report-panel'

export type KpiTone = 'default' | 'accent' | 'warning' | 'critical'

export interface KpiDelta {
  /** Variação percentual contra o período anterior. */
  value: number
  label: string
  /** Falso quando subir é ruim (falhas, fila sem responsável). */
  positiveIsGood?: boolean
}

export interface KpiCardProps {
  label: string
  value: number | string
  icon?: LucideIcon
  hint?: string
  delta?: KpiDelta | null
  tone?: KpiTone
  /** Série curta do período, desenhada como sparkline no rodapé. */
  trend?: number[]
  /** Cartão de abertura: valor maior e fundo levemente destacado. */
  emphasis?: boolean
  isLoading?: boolean
  className?: string
}

const soft = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`

const toneChip: Record<KpiTone, { className: string; color?: string }> = {
  default: { className: 'bg-muted text-muted-foreground' },
  accent: { className: 'bg-primary/10 text-foreground' },
  warning: { className: '', color: LEVEL_COLOR.warning },
  critical: { className: '', color: LEVEL_COLOR.critical },
}

const Sparkline = ({ points }: { points: number[] }) => {
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const span = max - min || 1
  const step = points.length > 1 ? 100 / (points.length - 1) : 100

  const coords = points.map((point, index) => ({
    x: index * step,
    y: 24 - ((point - min) / span) * 22 - 1,
  }))

  const path = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ')

  const tail = coords.slice(-2)
  const tailPath = tail
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ')

  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className="h-6 w-full"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="text-muted-foreground/40"
      />
      <path
        d={tailPath}
        fill="none"
        stroke={SERIES_COLOR.inbound}
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

const DeltaBadge = ({ delta }: { delta: KpiDelta }) => {
  const positiveIsGood = delta.positiveIsGood ?? true
  const flat = Math.abs(delta.value) < 0.5
  const isGood = flat || delta.value > 0 === positiveIsGood
  const Icon = flat ? Minus : delta.value > 0 ? TrendingUp : TrendingDown

  return (
    <p
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        flat && 'text-muted-foreground',
      )}
      style={
        flat
          ? undefined
          : { color: isGood ? LEVEL_COLOR.good : LEVEL_COLOR.critical }
      }
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="tabular-nums">
        {delta.value > 0 && !flat ? '+' : ''}
        {formatPercent(delta.value, 1)}
      </span>
      <span className="text-muted-foreground font-normal">{delta.label}</span>
    </p>
  )
}

export const KpiCard = ({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  tone = 'default',
  trend,
  emphasis = false,
  isLoading = false,
  className,
}: KpiCardProps) => {
  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1',
          className,
        )}
      >
        <Skeleton className="h-3 w-24" />
        <Skeleton className={cn('h-8 w-20', emphasis && 'h-10 w-28')} />
        <Skeleton className="h-3 w-32" />
      </div>
    )
  }

  const display = typeof value === 'number' ? formatCompactCount(value) : value

  return (
    <div
      className={cn(
        RP_SCOPE,
        'bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1 transition-colors',
        emphasis && 'bg-muted/40',
        className,
      )}
    >
      <ReportPalette />
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg',
              toneChip[tone].className,
            )}
            style={
              toneChip[tone].color
                ? {
                    backgroundColor: soft(toneChip[tone].color, 14),
                    color: toneChip[tone].color,
                  }
                : undefined
            }
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          'leading-none font-semibold',
          emphasis ? 'text-4xl' : 'text-2xl',
        )}
      >
        {display}
      </p>

      {delta ? <DeltaBadge delta={delta} /> : null}

      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}

      {trend && trend.length > 1 ? <Sparkline points={trend} /> : null}
    </div>
  )
}
