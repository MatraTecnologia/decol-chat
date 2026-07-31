'use client'

import { ChevronUp, UserRound } from 'lucide-react'

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'

import { formatListTime } from '../../lib/format-message-time'
import type { ConversationListItem } from '../../types'
import { ConversationContextMenu } from './conversation-context-menu'

interface ConversationItemProps {
  conversation: ConversationListItem
  isActive: boolean
  onSelect: () => void
}

const getInitials = (label: string) => {
  const words = label.split(/\s+/).filter(word => /^\p{L}/u.test(word))
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''
  const initials = `${first}${last}`

  return initials ? initials.toUpperCase() : label.replace(/\D/g, '').slice(-2)
}

export const ConversationItem = ({
  conversation,
  isActive,
  onSelect,
}: ConversationItemProps) => {
  const { contact, assignedTo, unreadCount } = conversation

  const displayName =
    contact.name ?? contact.profileName ?? contact.phoneNumber
  const isClosed = conversation.status === 'CLOSED'
  const isHighPriority = conversation.priority === 'HIGH'

  return (
    <ConversationContextMenu conversation={conversation}>
      <button
      type="button"
      onClick={onSelect}
      aria-current={isActive}
      className={cn(
        'hover:bg-accent/60 focus-visible:ring-ring flex w-full items-start gap-3 border-l-2 border-transparent px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset',
        isActive && 'border-l-primary bg-accent hover:bg-accent',
        isClosed && !isActive && 'opacity-70',
      )}
    >
      <Avatar className="size-10 shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            isClosed && 'bg-muted text-muted-foreground',
          )}
        >
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          {isHighPriority && (
            <ChevronUp
              aria-label="Prioridade alta"
              className="size-4 shrink-0 text-amber-500"
            />
          )}
          <span
            className={cn(
              'truncate text-sm font-medium',
              isClosed && 'text-muted-foreground font-normal',
            )}
          >
            {displayName}
          </span>
          <span className="text-muted-foreground ml-auto shrink-0 text-xs">
            {formatListTime(conversation.lastMessageAt)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {conversation.lastMessageText ?? 'Nenhuma mensagem ainda'}
          </span>
          {unreadCount > 0 && (
            <Badge className="h-5 min-w-5 shrink-0 justify-center rounded-full px-1.5 text-[11px] tabular-nums">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isClosed && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              Encerrada
            </Badge>
          )}
          {assignedTo ? (
            <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-[11px]">
              <UserRound className="size-3 shrink-0" />
              <span className="truncate">
                {assignedTo.name.split(' ')[0] ?? assignedTo.name}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-500">
              <UserRound className="size-3 shrink-0" />
              Não atribuída
            </span>
          )}
        </div>
      </div>
      </button>
    </ConversationContextMenu>
  )
}
