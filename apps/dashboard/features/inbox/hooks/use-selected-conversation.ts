'use client'

import { parseAsString, useQueryState } from 'nuqs'

/**
 * A conversa aberta vive na URL, não em estado local: é o que permite o gestor
 * mandar um link direto para o vendedor e o F5 não perder o lugar.
 */
export const useSelectedConversation = () => {
  const [conversationId, setConversationId] = useQueryState(
    'c',
    parseAsString.withDefault(''),
  )

  return {
    conversationId: conversationId || null,
    selectConversation: (id: string | null) => setConversationId(id || null),
  }
}
