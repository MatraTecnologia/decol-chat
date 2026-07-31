interface MessagePayload {
  conversationId?: unknown
  direction?: unknown
  content?: unknown
}

interface RealtimeEvent {
  entity?: unknown
  action?: unknown
  payload?: unknown
}

export interface MessageNotificationData {
  conversationId: string
  body: string
}

export const getMessageNotification = (
  value: unknown,
  permission: NotificationPermission,
  visibility: DocumentVisibilityState,
): MessageNotificationData | null => {
  if (permission !== 'granted' || visibility === 'visible') return null
  if (typeof value !== 'object' || value === null) return null

  const event = value as RealtimeEvent
  if (event.entity !== 'message' || event.action !== 'created') return null
  if (typeof event.payload !== 'object' || event.payload === null) return null

  const payload = event.payload as MessagePayload
  if (
    payload.direction !== 'INBOUND' ||
    typeof payload.conversationId !== 'string'
  ) {
    return null
  }

  return {
    conversationId: payload.conversationId,
    body:
      typeof payload.content === 'string' && payload.content.length > 0
        ? payload.content
        : 'Mídia recebida',
  }
}
