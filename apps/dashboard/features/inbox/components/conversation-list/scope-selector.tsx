'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

import { useConversationFilters } from '../../hooks'
import type { ConversationScope } from '../../types'

const SCOPE_OPTIONS = [
  { value: 'mine', label: 'Minhas' },
  { value: 'unassigned', label: 'Não atribuídas' },
  { value: 'all', label: 'Todas' },
] as const

export const ScopeSelector = () => {
  const { scope, setScope, canChooseScope } = useConversationFilters()

  if (!canChooseScope) return null

  return (
    <Select
      value={scope}
      onValueChange={value => setScope(value as ConversationScope)}
    >
      <SelectTrigger size="sm" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCOPE_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
