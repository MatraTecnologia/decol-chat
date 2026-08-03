export type RealtimeEntity =
  | 'user'
  | 'whatsappConnection'
  | 'whatsapp-template'
  | 'conversation'
  | 'message'
  | 'contact'

export type RealtimeAction = 'created' | 'updated' | 'deleted'

export interface RealtimeEvent {
  entity: RealtimeEntity
  action: RealtimeAction
  entityId: string
  invalidateTags?: string[]
  /** Corpo da entidade, quando o consumidor precisa dele sem refetch. */
  payload?: unknown
}

export const REALTIME_EVENT = 'entity:mutated' as const

export const ENTITY_INVALIDATION_TAGS: Record<RealtimeEntity, string[]> = {
  user: ['Users'],
  whatsappConnection: ['WhatsApp'],
  'whatsapp-template': ['WhatsAppTemplates'],
  // `Reports`: a dashboard de acompanhamento conta conversas e mensagens
  conversation: ['Conversations', 'Reports'],
  // toda mensagem muda o preview e a ordenação da lista de conversas
  message: ['Messages', 'Conversations', 'Reports'],
  // o nome do contato é renderizado na lista e no cabeçalho da conversa
  contact: ['Contacts', 'Conversations'],
}
