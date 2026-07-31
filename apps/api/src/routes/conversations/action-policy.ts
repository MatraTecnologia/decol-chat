type ConversationRole = 'admin' | 'manager' | 'agent' | 'viewer' | 'user'

interface AssignmentTarget {
  id: string
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

export const isEligibleAssignee = (
  { id, role, banned }: AssignmentTarget,
  actorUserId: string,
) =>
  banned !== true &&
  (role === 'agent' ||
    (id === actorUserId && (role === 'admin' || role === 'manager')))

export const assigneeMatches = (
  currentId: string | null,
  expectedId: string | null,
) => currentId === expectedId
