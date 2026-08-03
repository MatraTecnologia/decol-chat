import type { OverviewAverages, OverviewTotals } from '@/features/reports'

/** O `KpiGrid` exige os agregados; na primeira carga eles entram zerados. */
export const EMPTY_TOTALS: OverviewTotals = {
  conversationsStarted: 0,
  conversationsOpen: 0,
  conversationsPending: 0,
  conversationsClosed: 0,
  messagesInbound: 0,
  messagesOutbound: 0,
  templatesSent: 0,
  unassigned: 0,
  outsideWindow: 0,
  failedMessages: 0,
}

export const EMPTY_AVERAGES: OverviewAverages = {
  firstResponseSeconds: null,
  resolutionSeconds: null,
  replySeconds: null,
}

export const errorText = (error: unknown) =>
  (error as { message?: string } | null)?.message ??
  'Tente novamente em instantes.'
