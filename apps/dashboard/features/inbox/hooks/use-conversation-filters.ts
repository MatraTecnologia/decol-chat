'use client'

import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useDebounce } from 'use-debounce'

import { useUserRole } from '@/hooks'

import type { ConversationScope } from '../types'

const STATUS_VALUES = ['OPEN', 'PENDING', 'CLOSED'] as const
const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH'] as const
const SCOPE_VALUES = ['mine', 'unassigned', 'all'] as const

const GLOBAL_READERS = ['admin', 'manager']

export const useConversationFilters = () => {
  const { role } = useUserRole()

  const [status, setStatus] = useQueryState(
    'status',
    parseAsStringLiteral(STATUS_VALUES),
  )
  const [priority, setPriority] = useQueryState(
    'priority',
    parseAsStringLiteral(PRIORITY_VALUES),
  )
  const [scope, setScope] = useQueryState(
    'scope',
    parseAsStringLiteral(SCOPE_VALUES),
  )
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))

  const [debouncedSearch] = useDebounce(search, 300)

  const canChooseScope = GLOBAL_READERS.includes(role ?? '')

  /**
   * O servidor usa `mine` como default. Para admin/manager isso devolve lista
   * vazia — conversa vai para vendedor, não para eles —, então quem lê tudo
   * precisa mandar `all` explicitamente.
   */
  const effectiveScope: ConversationScope = canChooseScope
    ? (scope ?? 'all')
    : 'mine'

  return {
    status,
    setStatus,
    priority,
    setPriority,
    scope: canChooseScope ? (scope ?? 'all') : 'mine',
    setScope,
    search,
    setSearch,
    debouncedSearch,
    canChooseScope,
    query: {
      status: status ?? undefined,
      priority: priority ?? undefined,
      scope: effectiveScope,
      q: debouncedSearch || undefined,
    },
  }
}
