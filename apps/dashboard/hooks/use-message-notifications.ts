'use client'

import { useEffect, useRef } from 'react'

import { useSocket } from '@/providers/socket-provider'

interface RealtimeEvent {
  entity: string
  action: string
  entityId: string
  payload?: unknown
}

interface MessagePayload {
  id: string
  conversationId: string
  direction: 'INBOUND' | 'OUTBOUND'
  content: string | null
  type: string
  // O payload vem de `messageSelect` do inbound — inclui campos extras
  [key: string]: unknown
}

/**
 * Solicita permissão de notificação ao browser caso ainda não tenha sido
 * concedida. Retorna `true` se a permissão foi concedida (imediatamente
 * ou após a solicitação), `false` caso contrário.
 */
const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Mostra uma notificação nativa do browser para uma nova mensagem recebida.
 * Não dispara se a aba já está visível (document.visibilityState === 'visible')
 * para evitar spam quando o usuário está ativamente usando o app.
 */
const showMessageNotification = (
  senderLabel: string,
  body: string,
  conversationId: string,
  onClick: (conversationId: string) => void,
) => {
  if (Notification.permission !== 'granted') return

  const notification = new Notification(senderLabel, {
    body,
    icon: '/favicon.ico',
    tag: `msg-${conversationId}`, // agrupa notificações da mesma conversa
    renotify: true,               // toca som mesmo quando já existe uma com a mesma tag
  })

  notification.onclick = () => {
    window.focus()
    onClick(conversationId)
    notification.close()
  }
}

interface UseMessageNotificationsOptions {
  /** Callback para navegar até a conversa ao clicar na notificação. */
  onNavigate: (conversationId: string) => void
  /**
   * ID da conversa atualmente aberta. Se a mensagem for dessa conversa e a
   * janela estiver visível, a notificação não é disparada.
   */
  activeConversationId: string | null
}

/**
 * Escuta o evento `entity:mutated` do socket e dispara notificações nativas
 * do browser para cada mensagem INBOUND recebida enquanto o app está em
 * segundo plano (ou a aba não está focada na conversa correspondente).
 *
 * A permissão é solicitada na primeira montagem do componente.
 */
export const useMessageNotifications = ({
  onNavigate,
  activeConversationId,
}: UseMessageNotificationsOptions) => {
  const socket = useSocket()
  const activeConversationRef = useRef(activeConversationId)

  // Mantém a ref sempre atualizada sem re-criar o listener
  useEffect(() => {
    activeConversationRef.current = activeConversationId
  }, [activeConversationId])

  // Solicita permissão na montagem
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  useEffect(() => {
    if (!socket) return

    const handler = (event: RealtimeEvent) => {
      if (event.entity !== 'message' || event.action !== 'created') return
      if (!event.payload) return

      const msg = event.payload as MessagePayload

      // Só notifica mensagens recebidas do cliente (INBOUND)
      if (msg.direction !== 'INBOUND') return

      // Não notifica se a conversa já está aberta E a aba está visível
      const isActiveAndVisible =
        activeConversationRef.current === msg.conversationId &&
        document.visibilityState === 'visible'

      if (isActiveAndVisible) return

      const body = msg.content ?? '📎 Mídia recebida'

      // O payload não inclui o nome do contato: usamos um label genérico.
      // Se quiser o nome, o back precisa incluí-lo no payload.
      showMessageNotification(
        '💬 Nova mensagem',
        body,
        msg.conversationId,
        onNavigate,
      )
    }

    socket.on('entity:mutated', handler)

    return () => {
      socket.off('entity:mutated', handler)
    }
  }, [socket, onNavigate])
}
