import type {
  AgentRow,
  ConversationStatus,
  OverviewHeatmapCell,
  OverviewStatusSlice,
  OverviewTotals,
} from './report-types'

/** Ordem de leitura do ciclo de vida da conversa: entra, espera, encerra. */
export const STATUS_ORDER: ConversationStatus[] = ['OPEN', 'PENDING', 'CLOSED']

const count = new Intl.NumberFormat('pt-BR')

const compact = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const formatCount = (value: number): string => count.format(value)

/** Números grandes em cartão de indicador (`12,4 mil`). */
export const formatCompactCount = (value: number): string =>
  Math.abs(value) >= 10_000 ? compact.format(value) : count.format(value)

export const formatPercent = (value: number, fractionDigits = 0): string =>
  `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)}%`

/** Percentual protegido contra divisão por zero. */
export const percentage = (part: number, total: number): number =>
  total > 0 ? (part / total) * 100 : 0

/**
 * Mensagens enviadas por mensagem recebida, em percentual.
 * Pode passar de 100% — a equipe manda mais do que recebe.
 */
export const responseRate = (
  totals: Pick<OverviewTotals, 'messagesInbound' | 'messagesOutbound'>,
): number => percentage(totals.messagesOutbound, totals.messagesInbound)

/** Conversas fechadas sobre conversas iniciadas no período. */
export const closureRate = (
  totals: Pick<OverviewTotals, 'conversationsStarted' | 'conversationsClosed'>,
): number => percentage(totals.conversationsClosed, totals.conversationsStarted)

export interface StatusShare {
  status: ConversationStatus
  count: number
  percent: number
}

/** Ordem fixa (aberta → aguardando → fechada) e status ausente vira zero. */
export const statusShares = (
  breakdown: OverviewStatusSlice[],
): StatusShare[] => {
  const byStatus = new Map(breakdown.map(slice => [slice.status, slice.count]))
  const total = breakdown.reduce((sum, slice) => sum + slice.count, 0)

  return STATUS_ORDER.map(status => {
    const value = byStatus.get(status) ?? 0
    return { status, count: value, percent: percentage(value, total) }
  })
}

const compareResponse = (a: number | null, b: number | null): number => {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a - b
}

export interface RankedAgent extends AgentRow {
  position: number
}

/**
 * Ranking do leaderboard: mais fechadas primeiro; empate resolve pelo menor
 * tempo de primeira resposta (sem medição vai para o fim) e depois por volume.
 */
export const rankAgents = (agents: AgentRow[]): RankedAgent[] =>
  [...agents]
    .sort(
      (a, b) =>
        b.closed - a.closed ||
        compareResponse(a.firstResponseSeconds, b.firstResponseSeconds) ||
        b.messagesSent - a.messagesSent ||
        a.name.localeCompare(b.name, 'pt-BR'),
    )
    .map((agent, index) => ({ ...agent, position: index + 1 }))

export const topAgents = (agents: AgentRow[], size = 3): RankedAgent[] =>
  rankAgents(agents).slice(0, size)

export type AgentSortKey =
  | 'name'
  | 'assigned'
  | 'closed'
  | 'open'
  | 'messagesSent'
  | 'firstResponseSeconds'
  | 'resolutionSeconds'
  | 'lastActivityAt'

export type SortDirection = 'asc' | 'desc'

const timestamp = (value: string | null): number | null => {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Ordenação da tabela. Valores ausentes ficam sempre no fim, independente
 * da direção — linha sem medição não deve liderar o ranking.
 */
export const sortAgents = (
  agents: AgentRow[],
  key: AgentSortKey,
  direction: SortDirection = 'desc',
): AgentRow[] => {
  const factor = direction === 'asc' ? 1 : -1

  return [...agents].sort((a, b) => {
    if (key === 'name') {
      return a.name.localeCompare(b.name, 'pt-BR') * factor
    }

    if (key === 'lastActivityAt') {
      const left = timestamp(a.lastActivityAt)
      const right = timestamp(b.lastActivityAt)
      if (left === null || right === null) return compareResponse(left, right)
      return (left - right) * factor
    }

    if (key === 'firstResponseSeconds' || key === 'resolutionSeconds') {
      const left = a[key]
      const right = b[key]
      if (left === null || right === null) return compareResponse(left, right)
      return (left - right) * factor
    }

    return (a[key] - b[key]) * factor
  })
}

export interface HeatmapScale {
  max: number
  total: number
  /** Volume de um par dia/hora; zero quando a API não mandou a célula. */
  at: (weekday: number, hour: number) => number
  /** Faixa 0–4 usada para escolher o degrau da rampa de cor. */
  bucketAt: (weekday: number, hour: number) => number
  peak: OverviewHeatmapCell | null
}

const BUCKETS = 5

/** Escala sequencial do heatmap: um índice por par dia/hora e o pico do período. */
export const buildHeatmapScale = (
  cells: OverviewHeatmapCell[],
  buckets = BUCKETS,
): HeatmapScale => {
  const index = new Map<number, number>()
  let max = 0
  let total = 0
  let peak: OverviewHeatmapCell | null = null

  for (const cell of cells) {
    const key = cell.weekday * 24 + cell.hour
    const value = (index.get(key) ?? 0) + cell.count
    index.set(key, value)
    total += cell.count

    if (value > max) {
      max = value
      peak = { weekday: cell.weekday, hour: cell.hour, count: value }
    }
  }

  const at = (weekday: number, hour: number) =>
    index.get(weekday * 24 + hour) ?? 0

  const bucketAt = (weekday: number, hour: number) => {
    const value = at(weekday, hour)
    if (value <= 0 || max <= 0) return 0
    return Math.min(buckets - 1, Math.ceil((value / max) * (buckets - 1)))
  }

  return { max, total, at, bucketAt, peak }
}

/** Máximo "redondo" para o topo do eixo y (10, 25, 50, 100, 250…). */
export const niceCeiling = (value: number): number => {
  if (value <= 0) return 1

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude

  const step = [1, 1.5, 2, 2.5, 5, 10].find(
    candidate => normalized <= candidate,
  )

  return Math.round((step ?? 10) * magnitude)
}
