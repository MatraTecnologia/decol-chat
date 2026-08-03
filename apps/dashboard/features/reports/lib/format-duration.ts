const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const EMPTY_VALUE = '—'

const shortDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Duração em segundos → texto pt-BR com no máximo duas unidades
 * (`45s`, `12min 30s`, `2h 14min`, `3d 4h`).
 */
export const formatDuration = (
  seconds: number | null | undefined,
  fallback = EMPTY_VALUE,
): string => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return fallback
  }

  const total = Math.max(0, Math.round(seconds))

  if (total < MINUTE) return `${total}s`

  if (total < HOUR) {
    const minutes = Math.floor(total / MINUTE)
    const rest = total % MINUTE
    return rest > 0 ? `${minutes}min ${rest}s` : `${minutes}min`
  }

  if (total < DAY) {
    const hours = Math.floor(total / HOUR)
    const rest = Math.floor((total % HOUR) / MINUTE)
    return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`
  }

  const days = Math.floor(total / DAY)
  const rest = Math.floor((total % DAY) / HOUR)
  return rest > 0 ? `${days}d ${rest}h` : `${days}d`
}

/** Versão de uma unidade só, para colunas estreitas de tabela. */
export const formatDurationCompact = (
  seconds: number | null | undefined,
  fallback = EMPTY_VALUE,
): string => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return fallback
  }

  const total = Math.max(0, Math.round(seconds))

  if (total < MINUTE) return `${total}s`
  if (total < HOUR) return `${Math.floor(total / MINUTE)}min`
  if (total < DAY) return `${Math.floor(total / HOUR)}h`
  return `${Math.floor(total / DAY)}d`
}

/** Última atividade → texto relativo pt-BR; cai para data curta acima de 7 dias. */
export const formatElapsed = (
  value: string | null | undefined,
  now: Date = new Date(),
  fallback = EMPTY_VALUE,
): string => {
  if (!value) return fallback

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback

  const elapsed = Math.round((now.getTime() - date.getTime()) / 1000)

  if (elapsed < MINUTE) return 'agora'
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)}min`
  if (elapsed < DAY) return `há ${Math.floor(elapsed / HOUR)}h`
  if (elapsed < 7 * DAY) return `há ${Math.floor(elapsed / DAY)}d`

  return shortDate.format(date)
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
})

const longDate = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * `YYYY-MM-DD` vira meia-noite local — `new Date()` interpretaria como UTC
 * e o rótulo do eixo apareceria um dia atrás em fusos negativos.
 */
export const parseSeriesDate = (value: string): Date | null => {
  const parts = DATE_ONLY.exec(value)

  if (parts) {
    return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Rótulo curto de eixo x (`04/08`). */
export const formatAxisDate = (value: string): string => {
  const date = parseSeriesDate(value)
  return date ? dayMonth.format(date) : value
}

/** Rótulo de tooltip (`qua., 04 de ago.`). */
export const formatTooltipDate = (value: string): string => {
  const date = parseSeriesDate(value)
  return date ? longDate.format(date) : value
}
