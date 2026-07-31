import type {
  GetConversationResponse,
  ListConversationsResponse,
  ListMessagesResponse,
} from '@workspace/api-client/types'

export type ConversationListItem = ListConversationsResponse['data'][number]

export type ConversationDetail = GetConversationResponse

export type Message = ListMessagesResponse['data'][number]

export type ConversationStatus = ConversationListItem['status']

export type ConversationPriority = ConversationListItem['priority']

export type MessageStatus = Message['status']

export type ConversationScope = 'mine' | 'unassigned' | 'all'
