import type { FastifyRequest } from 'fastify'

import { appMessages } from '@/shared/locale.js'

const SUPPORTED_LOCALES = ['pt-BR', 'en']
const DEFAULT_LOCALE = 'pt-BR'

export const getLocale = (request: FastifyRequest): string => {
  // 1. Cookie (preferência explícita do usuário)
  const cookieLocale = request.cookies?.locale
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale))
    return cookieLocale

  // 2. Accept-Language header (preferência do browser)
  const acceptLang = request.headers['accept-language']
  if (acceptLang) {
    const candidates = acceptLang
      .split(',')
      .map(part => (part.split(';')[0] ?? part).trim())

    for (const candidate of candidates) {
      if (SUPPORTED_LOCALES.includes(candidate)) return candidate
      // match de língua base: "pt" → "pt-BR"
      const match = SUPPORTED_LOCALES.find(
        l => l.startsWith(candidate + '-') || l === candidate,
      )
      if (match) return match
    }
  }

  return DEFAULT_LOCALE
}

export const t = (locale: string, key: string, fallback?: string): string => {
  return (
    appMessages[locale]?.[key] ??
    appMessages[DEFAULT_LOCALE]?.[key] ??
    fallback ??
    key
  )
}
