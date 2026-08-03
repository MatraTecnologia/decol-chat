'use client'

import { useQuery } from '@tanstack/react-query'

import { listMembersOptions } from '@workspace/api-client/react-query'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

import { ROLE_LABELS, type RoleType } from '@workspace/shared/roles'

/** O Select do Radix não aceita valor vazio — `all` representa "sem filtro". */
const ALL = 'all'

interface AssigneeFilterProps {
  value: string | null
  onChange: (assigneeId: string | null) => void
}

export const AssigneeFilter = ({ value, onChange }: AssigneeFilterProps) => {
  const { data, isPending } = useQuery(listMembersOptions())

  const members = data ?? []

  return (
    <Select
      value={value ?? ALL}
      onValueChange={next => onChange(next === ALL ? null : next)}
    >
      <SelectTrigger size="sm" className="w-full sm:w-56">
        <SelectValue placeholder="Todos os vendedores" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value={ALL}>Todos os vendedores</SelectItem>

        {isPending && members.length === 0 ? (
          <div className="text-muted-foreground px-2 py-1.5 text-sm">
            Carregando equipe...
          </div>
        ) : null}

        {members.map(member => (
          <SelectItem key={member.id} value={member.id}>
            <span className="truncate">{member.name || member.email}</span>
            {member.role ? (
              <span className="text-muted-foreground text-xs">
                {ROLE_LABELS[member.role as RoleType] ?? member.role}
              </span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
