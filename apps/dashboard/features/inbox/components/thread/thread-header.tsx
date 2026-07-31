'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronUp, PanelRight } from 'lucide-react'

import { getConversationOptions } from '@workspace/api-client/react-query'

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'

import { useInboxPanels } from '../../hooks'
import type { ConversationPriority, ConversationStatus } from '../../types'

interface ThreadHeaderProps {
  conversationId: string
}

const statusLabels: Record<ConversationStatus, string> = {
  OPEN: 'Aberta',
  PENDING: 'Pendente',
  CLOSED: 'Encerrada',
}

const priorityLabels: Record<ConversationPriority, string> = {
  LOW: 'Prioridade baixa',
  MEDIUM: 'Prioridade média',
  HIGH: 'Prioridade alta',
}

const getInitials = (label: string) => {
  const words = label.split(/\s+/).filter(word => /^\p{L}/u.test(word))
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''
  const initials = `${first}${last}`

  return initials ? initials.toUpperCase() : label.replace(/\D/g, '').slice(-2)
}

export const ThreadHeader = ({ conversationId }: ThreadHeaderProps) => {
  const { toggleContactPanel } = useInboxPanels()

  const { data: conversation, isPending } = useQuery({
    ...getConversationOptions({ path: { id: conversationId } }),
    // O `keepPreviousData` global mostraria o contato da conversa anterior
    // enquanto a nova carrega.
    placeholderData: undefined,
  })

  const toggleButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleContactPanel}
      aria-label="Alternar painel do contato"
      className="ml-auto shrink-0"
    >
      <PanelRight className="size-4" />
    </Button>
  )

  if (isPending || !conversation) {
    return (
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        {toggleButton}
      </header>
    )
  }

  const { contact } = conversation
  const displayName =
    contact.name ?? contact.profileName ?? contact.phoneNumber
  const isHighPriority = conversation.priority === 'HIGH'

  return (
    <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="text-xs font-medium">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          {isHighPriority && (
            <ChevronUp
              aria-label={priorityLabels.HIGH}
              className="size-4 shrink-0 text-amber-500"
            />
          )}
          <span className="truncate text-sm font-medium">{displayName}</span>
        </div>
        <span className="text-muted-foreground text-xs">
          {contact.phoneNumber}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Badge
          variant={conversation.status === 'OPEN' ? 'secondary' : 'outline'}
          className="h-5 px-1.5 text-[10px]"
        >
          {statusLabels[conversation.status]}
        </Badge>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {priorityLabels[conversation.priority]}
        </Badge>
      </div>

      {toggleButton}
    </header>
  )
}
