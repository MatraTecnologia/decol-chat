import { env } from '@/env.js'

const localhostPattern = /^https?:\/\/localhost(:\d{1,5})?$/

const staticOrigins: (string | RegExp)[] = []

if (env.NODE_ENV !== 'production') {
  staticOrigins.push(localhostPattern)
}

/** CORS origins (string | RegExp) — used by Fastify CORS + Socket.io */
export const origins: (string | RegExp)[] = staticOrigins

/** Check if an origin is allowed (matches static patterns or env TRUSTED_ORIGINS) */
export const isAllowedOrigin = (origin: string): boolean => {
  if (
    origins.some(pattern =>
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin),
    )
  ) {
    return true
  }
  return env.TRUSTED_ORIGINS.includes(origin)
}
