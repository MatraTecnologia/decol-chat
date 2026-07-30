export type RealtimeEntity = 'user' | 'whatsappConnection'

export type RealtimeAction = 'created' | 'updated' | 'deleted'

export interface RealtimeEvent {
  entity: RealtimeEntity
  action: RealtimeAction
  entityId: string
  invalidateTags?: string[]
}

export const REALTIME_EVENT = 'entity:mutated' as const

export const ENTITY_INVALIDATION_TAGS: Record<RealtimeEntity, string[]> = {
  user: ['Users'],
  whatsappConnection: ['WhatsApp'],
}
