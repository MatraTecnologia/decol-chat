'use client'

import { useQuery } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'

import { listMembersOptions } from '@workspace/api-client/react-query'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@workspace/ui/components/command'

interface AssignConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAssigneeId: string | null
  isPending: boolean
  onAssign: (userId: string) => Promise<unknown>
}

export const AssignConversationDialog = ({
  open,
  onOpenChange,
  currentAssigneeId,
  isPending,
  onAssign,
}: AssignConversationDialogProps) => {
  const { data: members, isPending: isLoadingMembers } = useQuery({
    ...listMembersOptions(),
    enabled: open,
  })

  const agents =
    members?.filter(member => member.role === 'agent' && member.banned !== true) ??
    []

  const handleAssign = async (userId: string) => {
    try {
      await onAssign(userId)
      onOpenChange(false)
    } catch {
      // O hook já apresenta o erro; o diálogo fica aberto para nova tentativa.
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Atribuir conversa"
      description="Escolha o atendente responsável por esta conversa."
    >
      <CommandInput placeholder="Buscar por nome ou e-mail..." />
      <CommandList>
        {isLoadingMembers ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Carregando atendentes...
          </p>
        ) : (
          <>
            <CommandEmpty>Nenhum atendente disponível.</CommandEmpty>
            <CommandGroup heading="Atendentes">
              {agents.map(agent => {
                const isCurrent = agent.id === currentAssigneeId
                const label = agent.name ?? agent.email

                return (
                  <CommandItem
                    key={agent.id}
                    value={`${label} ${agent.email}`}
                    disabled={isCurrent || isPending}
                    onSelect={() => handleAssign(agent.id)}
                  >
                    <UserRound />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {isCurrent ? 'Responsável atual' : agent.email}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
