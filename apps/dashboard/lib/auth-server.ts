import { headers } from 'next/headers'

import { env } from '@/config/env'

interface ServerSessionUser {
  id: string
  name: string
  email: string
  role: string
  image?: string | null
}

/**
 * `error` precisa ficar distinto de `unauthenticated`: tratar uma falha de API
 * (timeout, 500, Redis fora do ar) como "deslogado" destrói uma sessão válida e
 * pode prender o usuário num loop de redirect. Ver docs/better-auth-production-playbook.md §3.
 */
export type SessionResult =
  | { status: 'authenticated'; user: ServerSessionUser }
  | { status: 'unauthenticated' }
  | { status: 'error' }

const SESSION_TIMEOUT_MS = 5000

/**
 * Busca a sessão atual encaminhando os cookies para o endpoint do Better Auth
 * na API Fastify.
 */
export const getServerSession = async (): Promise<SessionResult> => {
  const headersList = await headers()
  const cookie = headersList.get('cookie')

  if (!cookie) return { status: 'unauthenticated' }

  let res: Response

  try {
    res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/auth/get-session`, {
      headers: { cookie },
      cache: 'no-store',
      signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    })
  } catch {
    return { status: 'error' }
  }

  if (res.status === 401) return { status: 'unauthenticated' }
  if (!res.ok) return { status: 'error' }

  try {
    const data = await res.json()
    if (!data?.user) return { status: 'unauthenticated' }
    return { status: 'authenticated', user: data.user as ServerSessionUser }
  } catch {
    return { status: 'error' }
  }
}

/**
 * Retorna `true` só quando a sessão está confirmada (nunca em caso de erro).
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const result = await getServerSession()
  return result.status === 'authenticated'
}
