interface ConversationActionInput {
  assignedToId: string | null
  unreadCount: number
  status: 'OPEN' | 'PENDING' | 'CLOSED'
}

export interface ConversationActions {
  canAssign: boolean
  canUnassign: boolean
  canMarkRead: boolean
  canChangePriority: boolean
  canChangeStatus: boolean
}

const NO_ACTIONS: ConversationActions = {
  canAssign: false,
  canUnassign: false,
  canMarkRead: false,
  canChangePriority: false,
  canChangeStatus: false,
}

export const getConversationActions = (
  role: string | null,
  userId: string | null,
  conversation: ConversationActionInput,
): ConversationActions => {
  const managesAll = role === 'admin' || role === 'manager'
  const ownsConversation =
    role === 'agent' &&
    userId !== null &&
    conversation.assignedToId === userId

  if (!managesAll && !ownsConversation) return NO_ACTIONS

  return {
    canAssign: managesAll,
    canUnassign: managesAll && conversation.assignedToId !== null,
    canMarkRead: conversation.unreadCount > 0,
    canChangePriority: managesAll,
    canChangeStatus: true,
  }
}
