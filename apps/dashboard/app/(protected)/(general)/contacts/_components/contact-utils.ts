const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const shortDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const fullDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const toDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value)

/**
 * `formatListTime` do inbox não é exportado no barrel de `features/inbox`, e a
 * coluna da tabela cabe em mais caracteres que a da fila de conversas.
 */
export const formatRelativeTime = (value: Date | string | null) => {
  if (!value) return 'Sem interação'

  const date = toDate(value)
  const elapsed = Date.now() - date.getTime()

  if (elapsed < MINUTE) return 'agora'
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR)
    return `há ${hours} hora${hours > 1 ? 's' : ''}`
  }

  if (elapsed < 7 * DAY) {
    const days = Math.floor(elapsed / DAY)
    return `há ${days} dia${days > 1 ? 's' : ''}`
  }

  return shortDate.format(date)
}

export const formatFullTime = (value: Date | string | null) =>
  value ? fullDate.format(toDate(value)) : '--'

interface ContactIdentity {
  name: string | null
  profileName: string | null
  phoneNumber: string
}

export const getDisplayName = (contact: ContactIdentity) =>
  contact.name ?? contact.profileName ?? contact.phoneNumber

export const getInitials = (label: string) => {
  const words = label.split(/\s+/).filter(word => /^\p{L}/u.test(word))
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''
  const initials = `${first}${last}`

  return initials ? initials.toUpperCase() : label.replace(/\D/g, '').slice(-2)
}

/** Números vêm da Meta só com dígitos (`5543999140409`). */
export const formatPhone = (phoneNumber: string) => {
  const digits = phoneNumber.replace(/\D/g, '')

  if (!digits.startsWith('55') || digits.length < 12) return `+${digits}`

  const area = digits.slice(2, 4)
  const rest = digits.slice(4)

  return `+55 (${area}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`
}

export const apiErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'string'
    ? error
    : ((error as { message?: string } | null)?.message ?? fallback)
