'use client'

import { Search } from 'lucide-react'

import { Input } from '@workspace/ui/components/input'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

import { useConversationFilters } from '../../hooks'
import type { ConversationPriority, ConversationStatus } from '../../types'

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Abertas' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'CLOSED', label: 'Encerradas' },
] as const

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'LOW', label: 'Baixa' },
] as const

export const ConversationFilters = () => {
  const { status, setStatus, priority, setPriority, search, setSearch } =
    useConversationFilters()

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Buscar conversa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 pl-9"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
      </div>

      <div className="flex gap-2">
        <Select
          value={status ?? 'all'}
          onValueChange={value =>
            setStatus(value === 'all' ? null : (value as ConversationStatus))
          }
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={priority ?? 'all'}
          onValueChange={value =>
            setPriority(
              value === 'all' ? null : (value as ConversationPriority),
            )
          }
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue placeholder="Todas as prioridades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {PRIORITY_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
