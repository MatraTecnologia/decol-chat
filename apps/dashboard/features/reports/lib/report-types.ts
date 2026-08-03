export type ConversationStatus = 'OPEN' | 'PENDING' | 'CLOSED'

export interface OverviewTotals {
  conversationsStarted: number
  conversationsOpen: number
  conversationsPending: number
  conversationsClosed: number
  messagesInbound: number
  messagesOutbound: number
  templatesSent: number
  unassigned: number
  outsideWindow: number
  failedMessages: number
}

export interface OverviewAverages {
  firstResponseSeconds: number | null
  resolutionSeconds: number | null
  replySeconds: number | null
}

export interface OverviewSeriesPoint {
  date: string
  inbound: number
  outbound: number
  started: number
  closed: number
}

export interface OverviewHeatmapCell {
  weekday: number
  hour: number
  count: number
}

export interface OverviewStatusSlice {
  status: ConversationStatus
  count: number
}

export interface Overview {
  range: { from: string; to: string }
  totals: OverviewTotals
  averages: OverviewAverages
  series: OverviewSeriesPoint[]
  heatmap: OverviewHeatmapCell[]
  statusBreakdown: OverviewStatusSlice[]
}

export interface AgentRow {
  userId: string
  name: string
  email: string
  image: string | null
  role: string
  assigned: number
  closed: number
  open: number
  messagesSent: number
  firstResponseSeconds: number | null
  resolutionSeconds: number | null
  lastActivityAt: string | null
}

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  OPEN: 'Em aberto',
  PENDING: 'Aguardando',
  CLOSED: 'Fechadas',
}

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
