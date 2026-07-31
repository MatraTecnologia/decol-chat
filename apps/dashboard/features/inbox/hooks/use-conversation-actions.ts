'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  assignConversationMutation,
  closeConversationMutation,
  markConversationReadMutation,
  reopenConversationMutation,
  unassignConversationMutation,
  updateConversationMutation,
} from '@workspace/api-client/react-query'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

import { errorText } from '../lib/api-error'
import type { ConversationListItem, ConversationPriority } from '../types'

export const useConversationActions = (
  conversation: ConversationListItem,
) => {
  const queryClient = useQueryClient()

  const onSuccess = () => invalidateByTags(queryClient, ['Conversations'])

  const assignMutation = useMutation({
    ...assignConversationMutation(),
    onSuccess,
    onError: error =>
      toast.error(errorText(error, 'Não foi possível atribuir a conversa.')),
  })
  const unassignMutation = useMutation({
    ...unassignConversationMutation(),
    onSuccess,
    onError: error =>
      toast.error(
        errorText(error, 'Não foi possível remover a atribuição.'),
      ),
  })
  const markReadMutation = useMutation({
    ...markConversationReadMutation(),
    onSuccess,
    onError: error =>
      toast.error(errorText(error, 'Não foi possível marcar como lida.')),
  })
  const priorityMutation = useMutation({
    ...updateConversationMutation(),
    onSuccess,
    onError: error =>
      toast.error(errorText(error, 'Não foi possível alterar a prioridade.')),
  })
  const closeMutation = useMutation({
    ...closeConversationMutation(),
    onSuccess,
    onError: error =>
      toast.error(errorText(error, 'Não foi possível encerrar a conversa.')),
  })
  const reopenMutation = useMutation({
    ...reopenConversationMutation(),
    onSuccess,
    onError: error =>
      toast.error(errorText(error, 'Não foi possível reabrir a conversa.')),
  })

  const path = { id: conversation.id }

  return {
    assign: (userId: string) =>
      assignMutation.mutateAsync({
        path,
        body: {
          userId,
          expectedAssigneeId: conversation.assignedToId,
        },
      }),
    unassign: () =>
      unassignMutation.mutate({
        path,
        body: { expectedAssigneeId: conversation.assignedToId },
      }),
    markRead: () => markReadMutation.mutate({ path }),
    changePriority: (priority: ConversationPriority) =>
      priorityMutation.mutate({ path, body: { priority } }),
    close: () => closeMutation.mutate({ path }),
    reopen: () => reopenMutation.mutate({ path }),
    isPending:
      assignMutation.isPending ||
      unassignMutation.isPending ||
      markReadMutation.isPending ||
      priorityMutation.isPending ||
      closeMutation.isPending ||
      reopenMutation.isPending,
  }
}
