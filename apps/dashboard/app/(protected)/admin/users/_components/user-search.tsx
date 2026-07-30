'use client'

import { Search } from 'lucide-react'

import { ROLE_OPTIONS } from '@workspace/shared/roles'
import { Input } from '@workspace/ui/components/input'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

import { Card, CardContent } from '@workspace/ui/components/card'

interface UserSearchProps {
  search: string
  onSearchChange: (value: string) => void
  role: string
  onRoleChange: (value: string) => void
}

export const UserSearch = ({
  search,
  onSearchChange,
  role,
  onRoleChange,
}: UserSearchProps) => {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={role || 'all'}
          onValueChange={value => onRoleChange(value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Todos os papéis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os papéis</SelectItem>
            {ROLE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome ou email..."
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
