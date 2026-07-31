const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const time = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
})

const full = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const toDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value)

/** Coluna da lista: precisa caber em poucos caracteres. */
export const formatListTime = (value: Date | string | null) => {
  if (!value) return ''

  const date = toDate(value)
  const elapsed = Date.now() - date.getTime()

  if (elapsed < MINUTE) return 'agora'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`

  return dayMonth.format(date)
}

/** Dentro da bolha: só a hora, o dia vem do separador. */
export const formatBubbleTime = (value: Date | string | null) =>
  value ? time.format(toDate(value)) : ''

/** Tooltip e painel do contato. */
export const formatFullTime = (value: Date | string | null) =>
  value ? full.format(toDate(value)) : ''

/** Separador de dia dentro da thread. */
export const formatDaySeparator = (value: Date | string) => {
  const date = toDate(value)
  const today = new Date()
  const elapsedDays = Math.floor(
    (today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / DAY,
  )

  if (elapsedDays === 0) return 'Hoje'
  if (elapsedDays === 1) return 'Ontem'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    ...(date.getFullYear() !== today.getFullYear() && { year: 'numeric' }),
  }).format(date)
}

/** Contagem regressiva da janela de 24h da Meta. */
export const formatWindowRemaining = (expiresAt: Date | string | null) => {
  if (!expiresAt) return null

  const remaining = toDate(expiresAt).getTime() - Date.now()
  if (remaining <= 0) return null

  const hours = Math.floor(remaining / HOUR)
  const minutes = Math.floor((remaining % HOUR) / MINUTE)

  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
}
