const SUPPORTED = ['pt-BR', 'en']
const DEFAULT = 'pt-BR'

/**
 * Detects locale from a Web API Request object (used in Better Auth callbacks).
 * Mirrors the detection order of lib/locale.ts: cookie → Accept-Language → pt-BR.
 */
export const getEmailLocale = (request?: Request): string => {
  if (!request) return DEFAULT

  // 1. Cookie `locale`
  const cookie = request.headers.get('cookie') ?? ''
  const match = cookie.match(/(?:^|;\s*)locale=([^;]+)/)
  if (match?.[1] && SUPPORTED.includes(match[1])) return match[1]

  // 2. Accept-Language header
  const lang = request.headers.get('accept-language') ?? ''
  for (const part of lang.split(',')) {
    const tag = (part.split(';')[0] ?? '').trim()
    if (SUPPORTED.includes(tag)) return tag
    const base = (tag.split('-')[0] ?? '').trim()
    const found = SUPPORTED.find(s => s.startsWith(base))
    if (found) return found
  }

  return DEFAULT
}
