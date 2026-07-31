'use client'

import { useEffect } from 'react'

import { useSocket } from '@/providers/socket-provider'

import { getMessageNotification } from './message-notification-policy'

/**
 * Mostra uma notificação nativa do browser para uma nova mensagem recebida.
 * Não dispara se a aba já está visível (document.visibilityState === 'visible')
 * para evitar spam quando o usuário está ativamente usando o app.
 */
const showMessageNotification = (
  title: string,
  body: string,
  conversationId: string,
  onClick: (conversationId: string) => void,
) => {
  if (Notification.permission !== 'granted') return

  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: `msg-${conversationId}`,
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
}

/**
 * Escuta o evento `entity:mutated` do socket e dispara notificações nativas
 * do browser para cada mensagem INBOUND recebida enquanto o app está em
 * segundo plano. A permissão é solicitada somente por ação do usuário na
 * sidebar.
 */
export const useMessageNotifications = ({
  onNavigate,
}: UseMessageNotificationsOptions) => {
  const socket = useSocket()

  useEffect(() => {
    if (!socket) return

    const handler = (event: unknown) => {
      if (!('Notification' in window)) return

      const data = getMessageNotification(
        event,
        Notification.permission,
        document.visibilityState,
      )
      if (!data) return

      showMessageNotification(
        'Nova mensagem',
        data.body,
        data.conversationId,
        onNavigate,
      )
    }

    socket.on('entity:mutated', handler)

    return () => {
      socket.off('entity:mutated', handler)
    }
  }, [socket, onNavigate])
}
