type ConversationRole = 'admin' | 'manager' | 'agent' | 'viewer' | 'user'

interface AssignmentTarget {
  role: string | null
  banned: boolean | null
}

const ASSIGNERS: ConversationRole[] = ['admin', 'manager']
const STATUS_MANAGERS: ConversationRole[] = ['admin', 'manager', 'agent']

export const canAssignConversation = (role: string) =>
  ASSIGNERS.includes(role as ConversationRole)

export const canChangePriority = canAssignConversation

export const canChangeStatus = (role: string) =>
  STATUS_MANAGERS.includes(role as ConversationRole)

export const isEligibleAssignee = ({ role, banned }: AssignmentTarget) =>
  role === 'agent' && banned !== true

export const assigneeMatches = (
  currentId: string | null,
  expectedId: string | null,
) => currentId === expectedId
