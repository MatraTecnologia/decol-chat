import { type NextRequest, NextResponse } from 'next/server'

import {
  SECURE_SESSION_COOKIE,
  SESSION_COOKIE,
} from '@workspace/shared/auth-cookie'

const publicPaths = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/two-factor',
  '/verify-email',
  '/api/auth',
  // Rotas de recuperação — nunca podem ser barradas, são a saída de uma sessão ruim
  '/api/clear-session',
  '/not-authorized',
  // SEO / social
  '/opengraph-image',
  '/twitter-image',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  // Public static assets
  '/favicon.ico',
]

function isPublicPath(pathname: string) {
  return publicPaths.some(
    path => pathname === path || pathname.startsWith(`${path}/`),
  )
}

/**
 * A checagem de cookie aqui é OTIMISTA — presença não prova validade.
 * Esta camada só pode redirecionar tráfego aparentemente deslogado PARA o login.
 * Nunca pode redirecionar PARA FORA de uma rota pública: um cookie stale-but-present
 * brigaria com o redirect do layout para sempre (o loop de recarregamento).
 * Quem decide quem vê /sign-in é o layout de auth, que valida de fato.
 * Ver docs/better-auth-production-playbook.md §1-§2.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie =
    request.cookies.get(SESSION_COOKIE) ??
    request.cookies.get(SECURE_SESSION_COOKIE)
  const isAuthed = !!sessionCookie?.value

  // Allow public paths without auth
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Redirect root to dashboard (middleware handles auth check)
  if (pathname === '/') {
    if (isAuthed) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // Protect all other routes
  if (!isAuthed) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
