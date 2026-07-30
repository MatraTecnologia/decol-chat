import { NextResponse } from 'next/server'

import {
  SECURE_SESSION_COOKIE,
  SECURE_SESSION_DATA_COOKIE,
  SESSION_COOKIE,
  SESSION_DATA_COOKIE,
} from '@workspace/shared/auth-cookie'

import { env } from '@/config/env'

const SIGN_OUT_TIMEOUT_MS = 5000

/**
 * Revoga a sessão no servidor (best-effort) E expira os cookies localmente.
 * Os dois passos são necessários: o sign-out só limpa cookies enquanto a sessão
 * ainda é válida; o caso que esta rota existe para resolver é justamente um cookie
 * cuja sessão já morreu — ali só a expiração local funciona.
 * Ver docs/better-auth-production-playbook.md §4.
 */
export const GET = async (request: Request) => {
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host')
  const baseUrl = host ? `${proto}://${host}` : env.NEXT_PUBLIC_BASE_URL

  const response = NextResponse.redirect(
    new URL('/sign-in?session_expired=1', baseUrl),
  )

  const cookie = request.headers.get('cookie')

  if (cookie) {
    await fetch(`${env.NEXT_PUBLIC_API_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(SIGN_OUT_TIMEOUT_MS),
    }).catch(() => null)
  }

  const isSecure = proto === 'https'
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

  const expireOptions = {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax' as const,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  }

  // Inclui os cookies do cookieCache (session_data) — senão sobra sessão cacheada.
  for (const name of [SESSION_COOKIE, SESSION_DATA_COOKIE]) {
    response.cookies.set(name, '', { ...expireOptions, secure: isSecure })
  }

  if (isSecure) {
    for (const name of [SECURE_SESSION_COOKIE, SECURE_SESSION_DATA_COOKIE]) {
      response.cookies.set(name, '', { ...expireOptions, secure: true })
    }
  }

  return response
}
