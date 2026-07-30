import { useCallback, useMemo, useSyncExternalStore } from 'react'

import type { RoleType } from '@workspace/shared/roles'

import { authClient } from '@/lib/auth-client'

const emptySubscribe = () => () => {}

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

interface UserRoleResult {
  role: RoleType | null
  userId: string | null
  isPending: boolean
  hasRole: (...roles: RoleType[]) => boolean
}

/**
 * Returns the current user's global role
 * and a helper to check role-based permissions.
 *
 * Uses useSyncExternalStore to prevent hydration mismatches —
 * always returns null/pending on the server,
 * then resolves to the actual role on the client.
 *
 * Usage:
 *   const { role, hasRole } = useUserRole()
 *   if (hasRole('admin')) { ... }
 */
export function useUserRole(): UserRoleResult {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession()
  const mounted = useMounted()

  const userRole = session?.user?.role
  const rawUserId = session?.user?.id
  const isPending = !mounted || isSessionPending

  const role = useMemo(() => {
    if (!mounted) return null
    return (userRole as RoleType) ?? null
  }, [userRole, mounted])

  const userId = useMemo(() => {
    if (!mounted) return null
    return rawUserId ?? null
  }, [rawUserId, mounted])

  const hasRole = useCallback(
    (...roles: RoleType[]) => !!role && roles.includes(role),
    [role],
  )

  return { role, userId, isPending, hasRole }
}
