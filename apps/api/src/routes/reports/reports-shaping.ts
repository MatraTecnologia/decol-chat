/**
 * Regras puras dos relatórios: validação de período, escopo por papel e
 * preenchimento das séries.
 *
 * Pura de propósito: o `node --test` carrega este módulo direto, então nada
 * aqui pode importar o alias `@/` nem um relativo com extensão `.js` — o runner
 * não reescreve o `.js` para `.ts`. Só `@workspace/shared`, que resolve pelo
 * `dist` do pacote.
 */
import type { RoleType } from '@workspace/shared/roles'

/** Todo bucket de data é montado no fuso do time, não em UTC. */
export const REPORTS_TIME_ZONE = 'America/Sao_Paulo'

/** Janela em que a Meta aceita texto livre — espelha `conversations/messaging-window`. */
export const REPORTS_WINDOW_MS = 24 * 60 * 60 * 1000

export const MAX_RANGE_DAYS = 366

const DAY_MS = 24 * 60 * 60 * 1000

/** Papéis com acesso a relatórios; `user` fica de fora. */
export const REPORT_READERS: RoleType[] = [
  'admin',
  'manager',
  'agent',
  'viewer',
]

/** Papéis que enxergam a equipe inteira e podem filtrar por responsável. */
export const REPORT_GLOBAL_ROLES: RoleType[] = ['admin', 'manager']

export const isReportGlobalRole = (role: string) =>
  REPORT_GLOBAL_ROLES.includes(role as RoleType)

// ── Período ────────────────────────────────────────────

export interface ReportRange {
  from: Date
  to: Date
}

export type ParsedRange =
  { ok: true; range: ReportRange } | { ok: false; error: string }

export const parseReportRange = (from: string, to: string): ParsedRange => {
  const start = new Date(from)
  const end = new Date(to)

  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: '`from` precisa ser uma data ISO válida.' }
  }

  if (Number.isNaN(end.getTime())) {
    return { ok: false, error: '`to` precisa ser uma data ISO válida.' }
  }

  if (end.getTime() < start.getTime()) {
    return { ok: false, error: '`to` precisa ser maior ou igual a `from`.' }
  }

  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    return { ok: false, error: 'O intervalo máximo do relatório é de 1 ano.' }
  }

  return { ok: true, range: { from: start, to: end } }
}

// ── Escopo ─────────────────────────────────────────────

/**
 * Responsável efetivo da consulta. Vendedor e somente-leitura são forçados ao
 * próprio id — pedir o de um colega não vaza número dele, só devolve o próprio,
 * mesma postura de `conversations` (o parâmetro é ignorado, não recusado).
 */
export const resolveReportScope = (
  role: string,
  userId: string,
  requestedAssigneeId?: string | null,
): string | null =>
  isReportGlobalRole(role) ? requestedAssigneeId || null : userId

// ── Séries ─────────────────────────────────────────────

export const REPORT_STATUSES = ['OPEN', 'PENDING', 'CLOSED'] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]

export interface StatusBucket {
  status: string
  count: number
}

export interface DailyMessageBucket {
  day: string
  inbound: number
  outbound: number
}

export interface DailyConversationBucket {
  day: string
  started: number
  closed: number
}

export interface SeriesPoint {
  date: string
  inbound: number
  outbound: number
  started: number
  closed: number
}

export interface HeatmapCell {
  weekday: number
  hour: number
  count: number
}

/** `en-CA` formata como `YYYY-MM-DD`, que é exatamente a chave do contrato. */
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORTS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const dayKey = (date: Date) => dayFormatter.format(date)

const nextDayKey = (key: string) => {
  const year = Number(key.slice(0, 4))
  const month = Number(key.slice(5, 7))
  const day = Number(key.slice(8, 10))

  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

/** Todos os dias do intervalo, inclusive os sem dado — a UI não pode ter buraco. */
export const enumerateDays = ({ from, to }: ReportRange): string[] => {
  const last = dayKey(to)
  const days: string[] = []

  let cursor = dayKey(from)

  while (cursor <= last && days.length <= MAX_RANGE_DAYS) {
    days.push(cursor)
    cursor = nextDayKey(cursor)
  }

  return days
}

export const buildSeries = (
  days: string[],
  messages: DailyMessageBucket[],
  conversations: DailyConversationBucket[],
): SeriesPoint[] => {
  const messagesByDay = new Map(messages.map(bucket => [bucket.day, bucket]))
  const conversationsByDay = new Map(
    conversations.map(bucket => [bucket.day, bucket]),
  )

  return days.map(date => ({
    date,
    inbound: messagesByDay.get(date)?.inbound ?? 0,
    outbound: messagesByDay.get(date)?.outbound ?? 0,
    started: conversationsByDay.get(date)?.started ?? 0,
    closed: conversationsByDay.get(date)?.closed ?? 0,
  }))
}

/** Matriz completa: 7 dias × 24 horas, sempre 168 células. */
export const buildHeatmap = (cells: HeatmapCell[]): HeatmapCell[] => {
  const totals = new Map<string, number>()

  for (const cell of cells) {
    const key = `${cell.weekday}:${cell.hour}`
    totals.set(key, (totals.get(key) ?? 0) + cell.count)
  }

  const matrix: HeatmapCell[] = []

  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      matrix.push({
        weekday,
        hour,
        count: totals.get(`${weekday}:${hour}`) ?? 0,
      })
    }
  }

  return matrix
}

/** Os três status sempre presentes, mesmo zerados. */
export const buildStatusBreakdown = (buckets: StatusBucket[]) =>
  REPORT_STATUSES.map(status => ({
    status,
    count: buckets
      .filter(bucket => bucket.status === status)
      .reduce((total, bucket) => total + bucket.count, 0),
  }))

export const countStatus = (buckets: StatusBucket[], status: ReportStatus) =>
  buckets
    .filter(bucket => bucket.status === status)
    .reduce((total, bucket) => total + bucket.count, 0)
