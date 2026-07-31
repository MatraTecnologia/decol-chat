'use client'

import { useQuery } from '@tanstack/react-query'

import { getConversationOptions } from '@workspace/api-client/react-query'

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'

import { formatFullTime } from '../../lib/format-message-time'
import type { ConversationPriority, ConversationStatus } from '../../types'
import { WindowCountdown } from './window-countdown'

interface ContactPanelProps {
  conversationId: string
}

const statusLabels: Record<ConversationStatus, string> = {
  OPEN: 'Aberta',
  PENDING: 'Pendente',
  CLOSED: 'Encerrada',
}

const priorityLabels: Record<ConversationPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
}

const getInitials = (label: string) => {
  const words = label.split(/\s+/).filter(word => /^\p{L}/u.test(word))
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''
  const initials = `${first}${last}`

  return initials ? initials.toUpperCase() : label.replace(/\D/g, '').slice(-2)
}

const Attribute = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
    <span className="min-w-0 text-right text-xs font-medium break-words">
      {value}
    </span>
  </div>
)

export const ContactPanel = ({ conversationId }: ContactPanelProps) => {
  const { data: conversation, isPending } = useQuery({
    ...getConversationOptions({ path: { id: conversationId } }),
    // O `keepPreviousData` global mostraria os dados da conversa anterior
    // enquanto a nova carrega.
    placeholderData: undefined,
  })

  if (isPending || !conversation) {
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-24 w-full" />
      </div>
    )
  }

  const { contact } = conversation
  const displayName =
    contact.name ?? contact.profileName ?? contact.phoneNumber
  const showProfileName =
    Boolean(contact.profileName) && contact.profileName !== displayName

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar className="size-16">
          <AvatarFallback className="text-base font-medium">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {showProfileName && (
            <p className="text-muted-foreground truncate text-xs">
              Perfil no WhatsApp: {contact.profileName}
            </p>
          )}
          <p className="text-muted-foreground text-xs">{contact.phoneNumber}</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Attribute label="Status" value={statusLabels[conversation.status]} />
        <Attribute
          label="Prioridade"
          value={priorityLabels[conversation.priority]}
        />
        <Attribute
          label="Responsável"
          value={conversation.assignedTo?.name ?? 'Sem responsável'}
        />
        <Attribute
          label="Criada em"
          value={formatFullTime(conversation.createdAt)}
        />
        <Attribute
          label="Última interação"
          value={formatFullTime(conversation.lastMessageAt) || '—'}
        />
      </div>

      <Separator />

      <WindowCountdown
        canSendFreeText={conversation.canSendFreeText}
        windowExpiresAt={conversation.windowExpiresAt}
      />
    </div>
  )
}
