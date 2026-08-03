'use client'

import { BarChart3, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@workspace/ui/components/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import type { SeriesKey } from '../lib/chart-palette'
import { SERIES_COLOR, SERIES_LABEL } from '../lib/chart-palette'
import { formatAxisDate, formatTooltipDate } from '../lib/format-duration'
import { formatCount, niceCeiling } from '../lib/report-metrics'
import type { OverviewSeriesPoint } from '../lib/report-types'
import { useElementWidth } from '../lib/use-element-width'
import {
  PanelEmpty,
  PanelError,
  PanelSkeleton,
  ReportPanel,
} from './report-panel'

const PLOT = { left: 40, right: 14, top: 10, bottom: 20 }
const HEIGHT = 148

interface PanelProps {
  points: OverviewSeriesPoint[]
  keys: SeriesKey[]
  caption: string
  hovered: number | null
  onHover: (index: number | null) => void
}

const LinePanel = ({ points, keys, caption, hovered, onHover }: PanelProps) => {
  const [ref, width] = useElementWidth<HTMLDivElement>()

  const inner = Math.max(0, width - PLOT.left - PLOT.right)
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom
  const step = points.length > 1 ? inner / (points.length - 1) : 0
  const max = niceCeiling(
    Math.max(...points.flatMap(point => keys.map(key => point[key])), 0),
  )

  const x = (index: number) =>
    points.length > 1 ? PLOT.left + index * step : PLOT.left + inner / 2
  const y = (value: number) =>
    PLOT.top + plotHeight - (value / max) * plotHeight

  const totals = keys.map(key => ({
    key,
    total: points.reduce((sum, point) => sum + point[key], 0),
  }))

  const labelEvery = Math.max(1, Math.ceil(points.length / 7))
  const active = hovered !== null ? points[hovered] : undefined

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
          {caption}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {totals.map(item => (
            <span key={item.key} className="flex items-center gap-1.5 text-xs">
              <span
                aria-hidden
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: SERIES_COLOR[item.key] }}
              />
              <span className="text-muted-foreground">
                {SERIES_LABEL[item.key]}
              </span>
              <span className="font-medium tabular-nums">
                {formatCount(item.total)}
              </span>
            </span>
          ))}
        </span>
      </figcaption>

      <div ref={ref} className="relative" style={{ height: HEIGHT }}>
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${caption}: ${totals
              .map(item => `${SERIES_LABEL[item.key]} ${item.total}`)
              .join(', ')}`}
            onPointerLeave={() => onHover(null)}
            onPointerMove={event => {
              const bounds = event.currentTarget.getBoundingClientRect()
              const offset = event.clientX - bounds.left - PLOT.left
              const index =
                step > 0 ? Math.round(offset / step) : offset >= 0 ? 0 : -1
              onHover(index >= 0 && index < points.length ? index : null)
            }}
          >
            {[0, 0.5, 1].map(ratio => {
              const lineY = PLOT.top + plotHeight * ratio
              return (
                <g key={ratio}>
                  <line
                    x1={PLOT.left}
                    x2={width - PLOT.right}
                    y1={lineY}
                    y2={lineY}
                    className="stroke-border"
                    strokeWidth={1}
                  />
                  <text
                    x={PLOT.left - 8}
                    y={lineY + 3}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {formatCount(Math.round(max * (1 - ratio)))}
                  </text>
                </g>
              )
            })}

            {points.map((point, index) =>
              index % labelEvery === 0 || index === points.length - 1 ? (
                <text
                  key={point.date}
                  x={x(index)}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {formatAxisDate(point.date)}
                </text>
              ) : null,
            )}

            {hovered !== null ? (
              <line
                x1={x(hovered)}
                x2={x(hovered)}
                y1={PLOT.top}
                y2={PLOT.top + plotHeight}
                className="stroke-foreground/30"
                strokeWidth={1}
              />
            ) : null}

            {keys.map(key => {
              const single = points.length === 1
              const first = points[0]
              const line = points
                .map(
                  (point, index) =>
                    `${index === 0 ? 'M' : 'L'}${x(index)} ${y(point[key])}`,
                )
                .join(' ')
              const base = PLOT.top + plotHeight
              const area = single
                ? ''
                : `${line} L${x(points.length - 1)} ${base} L${x(0)} ${base} Z`

              return (
                <g key={key}>
                  {area ? (
                    <path d={area} fill={SERIES_COLOR[key]} fillOpacity={0.1} />
                  ) : null}
                  {single && first ? (
                    <circle
                      cx={x(0)}
                      cy={y(first[key])}
                      r={5}
                      fill={SERIES_COLOR[key]}
                      className="stroke-card"
                      strokeWidth={2}
                    />
                  ) : (
                    <path
                      d={line}
                      fill="none"
                      stroke={SERIES_COLOR[key]}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {!single && active && hovered !== null ? (
                    <circle
                      cx={x(hovered)}
                      cy={y(active[key])}
                      r={4}
                      fill={SERIES_COLOR[key]}
                      className="stroke-card"
                      strokeWidth={2}
                    />
                  ) : null}
                </g>
              )
            })}
          </svg>
        ) : null}

        {active ? (
          <div
            className="bg-popover ring-foreground/10 pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg px-2.5 py-1.5 text-xs shadow-lg ring-1"
            style={{
              left: Math.min(
                Math.max(x(hovered ?? 0), 76),
                Math.max(width - 76, 76),
              ),
              transform: 'translateX(-50%)',
            }}
          >
            <p className="mb-1 font-medium">{formatTooltipDate(active.date)}</p>
            {keys.map(key => (
              <p key={key} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 rounded-[2px]"
                    style={{ backgroundColor: SERIES_COLOR[key] }}
                  />
                  {SERIES_LABEL[key]}
                </span>
                <span className="font-medium tabular-nums">
                  {formatCount(active[key])}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </figure>
  )
}

const SERIES_COLUMNS: SeriesKey[] = ['inbound', 'outbound', 'started', 'closed']

const VolumeTable = ({ points }: { points: OverviewSeriesPoint[] }) => (
  <div className="ring-foreground/10 max-h-80 overflow-auto rounded-lg ring-1">
    <Table>
      <TableHeader className="bg-card sticky top-0">
        <TableRow>
          <TableHead>Dia</TableHead>
          {SERIES_COLUMNS.map(key => (
            <TableHead key={key} className="text-right">
              {SERIES_LABEL[key]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {points.map(point => (
          <TableRow key={point.date}>
            <TableCell className="font-medium">
              {formatTooltipDate(point.date)}
            </TableCell>
            {SERIES_COLUMNS.map(key => (
              <TableCell key={key} className="text-right tabular-nums">
                {formatCount(point[key])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)

export interface ConversationVolumeChartProps {
  series: OverviewSeriesPoint[]
  isLoading?: boolean
  error?: string | null
  className?: string
}

export const ConversationVolumeChart = ({
  series,
  isLoading = false,
  error = null,
  className,
}: ConversationVolumeChartProps) => {
  const [hovered, setHovered] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)

  const points = useMemo(
    () => [...series].sort((a, b) => a.date.localeCompare(b.date)),
    [series],
  )

  const hasData = points.some(
    point => point.inbound + point.outbound + point.started + point.closed > 0,
  )

  return (
    <ReportPanel
      eyebrow="Movimento diário"
      title="Volume de mensagens e conversas"
      description="Escalas separadas: mensagem e conversa não se comparam no mesmo eixo."
      className={className}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAsTable(value => !value)}
          aria-pressed={asTable}
        >
          {asTable ? (
            <BarChart3 className="size-4" aria-hidden />
          ) : (
            <Table2 className="size-4" aria-hidden />
          )}
          {asTable ? 'Ver gráfico' : 'Ver tabela'}
        </Button>
      }
      contentClassName="space-y-5"
    >
      {isLoading ? (
        <PanelSkeleton className="h-80" />
      ) : error ? (
        <PanelError description={error} />
      ) : !hasData ? (
        <PanelEmpty description="Nenhuma mensagem trocada no período selecionado." />
      ) : asTable ? (
        <VolumeTable points={points} />
      ) : (
        <>
          <LinePanel
            caption="Mensagens"
            points={points}
            keys={['inbound', 'outbound']}
            hovered={hovered}
            onHover={setHovered}
          />
          <LinePanel
            caption="Conversas"
            points={points}
            keys={['started', 'closed']}
            hovered={hovered}
            onHover={setHovered}
          />
        </>
      )}
    </ReportPanel>
  )
}
