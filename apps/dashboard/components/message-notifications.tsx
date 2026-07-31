'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { useMessageNotifications } from '@/hooks'

/**
 * Componente renderless que monta o hook de notificações de mensagens.
 * Deve ser filho do SocketProvider e do QueryProvider.
 *
 * `activeConversationId` não está disponível neste nível (vive dentro da
 * InboxShell via URL), então passamos `null` — o hook verifica
 * `document.visibilityState` para suprimir notificações na aba ativa.
 */
export function MessageNotifications() {
  const router = useRouter()

  const handleNavigate = useCallback(
    (conversationId: string) => {
      router.push(`/conversations?c=${conversationId}`)
    },
    [router],
  )

  useMessageNotifications({
    onNavigate: handleNavigate,
    activeConversationId: null,
  })

  return null
}
