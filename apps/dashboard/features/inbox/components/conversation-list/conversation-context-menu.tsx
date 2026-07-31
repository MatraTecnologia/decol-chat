'use client'

import { useState, type ReactNode } from 'react'

import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronUp,
  CircleMinus,
  MailOpen,
  UserCheck,
  UserRoundPlus,
  UserRoundX,
} from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@workspace/ui/components/context-menu'

import { useUserRole } from '@/hooks'

import { useConversationActions } from '../../hooks'
import { getConversationActions } from '../../lib/conversation-action-policy'
import type {
  ConversationListItem,
  ConversationPriority,
} from '../../types'
import { AssignConversationDialog } from './assign-conversation-dialog'

interface ConversationContextMenuProps {
  conversation: ConversationListItem
  children: ReactNode
}

const priorityItems: {
  value: ConversationPriority
  label: string
  Icon: typeof ChevronUp
}[] = [
  { value: 'LOW', label: 'Baixa', Icon: ChevronDown },
  { value: 'MEDIUM', label: 'Média', Icon: CircleMinus },
  { value: 'HIGH', label: 'Alta', Icon: ChevronUp },
]

export const ConversationContextMenu = ({
  conversation,
  children,
}: ConversationContextMenuProps) => {
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const { role, userId } = useUserRole()
  const actions = getConversationActions(role, userId, conversation)
  const mutations = useConversationActions(conversation)
  const hasActions = Object.values(actions).some(Boolean)

  if (!hasActions) return children

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {actions.canAssign && userId !== conversation.assignedToId && userId && (
            <ContextMenuItem
              disabled={mutations.isPending}
              onSelect={() => mutations.assign(userId)}
            >
              <UserCheck />
              Assumir conversa
            </ContextMenuItem>
          )}

          {actions.canAssign && (
            <ContextMenuItem
              disabled={mutations.isPending}
              onSelect={() => setIsAssignOpen(true)}
            >
              <UserRoundPlus />
              Atribuir a outro
            </ContextMenuItem>
          )}

          {actions.canUnassign && (
            <ContextMenuItem
              disabled={mutations.isPending}
              onSelect={() => mutations.unassign()}
            >
              <UserRoundX />
              Remover atribuição
            </ContextMenuItem>
          )}

          {(actions.canAssign || actions.canUnassign) &&
            (actions.canMarkRead ||
              actions.canChangePriority ||
              actions.canChangeStatus) && <ContextMenuSeparator />}

          {actions.canMarkRead && (
            <ContextMenuItem
              disabled={mutations.isPending}
              onSelect={() => mutations.markRead()}
            >
              <MailOpen />
              Marcar como lida
            </ContextMenuItem>
          )}

          {actions.canChangePriority && (
            <ContextMenuSub>
              <ContextMenuSubTrigger disabled={mutations.isPending}>
                <ChevronUp />
                Prioridade
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-40">
                <ContextMenuRadioGroup value={conversation.priority}>
                  {priorityItems.map(({ value, label, Icon }) => (
                    <ContextMenuRadioItem
                      key={value}
                      value={value}
                      disabled={value === conversation.priority}
                      onSelect={() => mutations.changePriority(value)}
                    >
                      <Icon />
                      {label}
                      {value === conversation.priority && (
                        <Check className="ml-auto" />
                      )}
                    </ContextMenuRadioItem>
                  ))}
                </ContextMenuRadioGroup>
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          {actions.canChangeStatus && (
            <>
              <ContextMenuSeparator />
              {conversation.status === 'CLOSED' ? (
                <ContextMenuItem
                  disabled={mutations.isPending}
                  onSelect={() => mutations.reopen()}
                >
                  <ArchiveRestore />
                  Reabrir conversa
                </ContextMenuItem>
              ) : (
                <ContextMenuItem
                  variant="destructive"
                  disabled={mutations.isPending}
                  onSelect={() => mutations.close()}
                >
                  <Archive />
                  Encerrar conversa
                </ContextMenuItem>
              )}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <AssignConversationDialog
        open={isAssignOpen}
        onOpenChange={setIsAssignOpen}
        currentAssigneeId={conversation.assignedToId}
        isPending={mutations.isPending}
        onAssign={mutations.assign}
      />
    </>
  )
}
