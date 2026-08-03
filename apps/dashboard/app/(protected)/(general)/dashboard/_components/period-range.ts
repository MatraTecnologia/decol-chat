import { addDays, format, isValid, parse, startOfMonth } from 'date-fns'

export type PeriodPreset = 'today' | '7d' | '30d' | 'month'

export interface DayRange {
  from: string
  to: string
}

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'month', label: 'Este mês' },
]

export const DEFAULT_PRESET: PeriodPreset = '7d'

const DAY_FORMAT = 'yyyy-MM-dd'

/**
 * O backend monta os buckets em America/Sao_Paulo. Mandar meia-noite UTC jogaria
 * o começo do intervalo para o dia anterior e abriria um dia zerado na frente da
 * série, então o offset entra literal: o Brasil não tem horário de verão desde
 * 2019 e assim o limite não depende do fuso do navegador.
 */
const REPORTS_OFFSET = '-03:00'

export const toDayKey = (date: Date) => format(date, DAY_FORMAT)

export const parseDayKey = (day: string | null | undefined) => {
  if (!day) return null

  const parsed = parse(day, DAY_FORMAT, new Date())

  return isValid(parsed) ? parsed : null
}

export const dayStartIso = (day: string) =>
  `${day}T00:00:00.000${REPORTS_OFFSET}`

export const dayEndIso = (day: string) => `${day}T23:59:59.999${REPORTS_OFFSET}`

export const presetRange = (preset: PeriodPreset, today: Date): DayRange => {
  const to = toDayKey(today)

  switch (preset) {
    case 'today':
      return { from: to, to }
    case '30d':
      return { from: toDayKey(addDays(today, -29)), to }
    case 'month':
      return { from: toDayKey(startOfMonth(today)), to }
    default:
      return { from: toDayKey(addDays(today, -6)), to }
  }
}

/** A URL guarda só `from`/`to`; o preset ativo é derivado deles. */
export const matchPreset = (range: DayRange, today: Date): PeriodPreset | null =>
  PERIOD_PRESETS.find(preset => {
    const candidate = presetRange(preset.value, today)

    return candidate.from === range.from && candidate.to === range.to
  })?.value ?? null

/** Chave de dia ordena como string — `to` menor que `from` é 400 na API. */
export const normalizeRange = (from: string, to: string): DayRange =>
  from <= to ? { from, to } : { from: to, to: from }

export const formatDayLabel = (day: string) =>
  `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`

export const formatRangeLabel = ({ from, to }: DayRange) =>
  from === to
    ? formatDayLabel(from)
    : `${formatDayLabel(from)} – ${formatDayLabel(to)}`
