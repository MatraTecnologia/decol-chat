export * from './components'

export {
  HEAT_STEPS,
  LEVEL_COLOR,
  LEVEL_LABEL,
  paletteCss,
  RP_SCOPE,
  SERIES_COLOR,
  SERIES_LABEL,
  STATUS_COLOR,
  type PerformanceLevel,
  type SeriesKey,
} from './lib/chart-palette'

export {
  formatAxisDate,
  formatDuration,
  formatDurationCompact,
  formatElapsed,
  formatTooltipDate,
} from './lib/format-duration'

export {
  buildHeatmapScale,
  closureRate,
  formatCompactCount,
  formatCount,
  formatPercent,
  niceCeiling,
  percentage,
  rankAgents,
  responseRate,
  sortAgents,
  statusShares,
  topAgents,
  type AgentSortKey,
  type HeatmapScale,
  type RankedAgent,
  type SortDirection,
  type StatusShare,
} from './lib/report-metrics'

export {
  STATUS_LABELS,
  WEEKDAY_LABELS,
  type AgentRow,
  type ConversationStatus,
  type Overview,
  type OverviewAverages,
  type OverviewHeatmapCell,
  type OverviewSeriesPoint,
  type OverviewStatusSlice,
  type OverviewTotals,
} from './lib/report-types'
