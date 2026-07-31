'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { useMessageNotifications } from '@/hooks'

/**
 * Componente renderless que monta o hook de notificações de mensagens.
 * Deve ser filho do SocketProvider e do QueryProvider.
 *
 * O hook verifica `document.visibilityState` e só notifica quando esta guia
 * permanece aberta em segundo plano.
 */
export const MessageNotifications = () => {
  const router = useRouter()

  const handleNavigate = useCallback(
    (conversationId: string) => {
      router.push(`/conversations?c=${conversationId}`)
    },
    [router],
  )

  useMessageNotifications({
    onNavigate: handleNavigate,
  })

  return null
}
