'use client'

import { Search } from 'lucide-react'

import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

export const BLOCKED_VALUES = ['true', 'false'] as const

export type BlockedFilter = (typeof BLOCKED_VALUES)[number]

interface ContactsSearchProps {
  search: string
  onSearchChange: (value: string) => void
  blocked: BlockedFilter | null
  onBlockedChange: (value: BlockedFilter | null) => void
}

export const ContactsSearch = ({
  search,
  onSearchChange,
  blocked,
  onBlockedChange,
}: ContactsSearchProps) => {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={blocked ?? 'all'}
          onValueChange={value =>
            onBlockedChange(value === 'all' ? null : (value as BlockedFilter))
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Todos os contatos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contatos</SelectItem>
            <SelectItem value="false">Apenas ativos</SelectItem>
            <SelectItem value="true">Apenas bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={search}
            type="search"
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
          />
        </div>
      </CardContent>
    </Card>
  )
}
