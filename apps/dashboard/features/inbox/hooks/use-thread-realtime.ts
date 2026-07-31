'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useSocket } from '@/providers/socket-provider'

import { dedupeMessages } from '../lib/merge-message-page'
import type { Message } from '../types'

const REALTIME_EVENT = 'entity:mutated'

interface RealtimeEvent {
  entity: string
  action: string
  entityId: string
  payload?: unknown
}

interface MessagesPage {
  data: Message[]
  nextCursor: string | null
}

interface InfiniteMessages {
  pages: MessagesPage[]
  pageParams: unknown[]
}

/**
 * A query key gerada pelo hey-api varia com os params (`limit`), então casar a
 * chave inteira seria frágil. Filtrar por operação + id da conversa acerta
 * qualquer variação.
 */
const matchesThread = (queryKey: readonly unknown[], conversationId: string) => {
  const key = queryKey[0]
  if (typeof key !== 'object' || key === null) return false

  const { _id, path } = key as { _id?: string; path?: { id?: string } }

  return _id === 'listMessages' && path?.id === conversationId
}

/**
 * Quando o eco do socket chega antes de o POST de envio resolver, a bolha
 * otimista (id temporário, `waMessageId` null) e a mensagem real têm chaves
 * diferentes — o dedupe não as junta e as duas aparecem na tela até o POST
 * assentar. `PENDING` só existe localmente, então um OUTBOUND que chega do
 * servidor com o mesmo texto é a versão persistida daquela bolha.
 */
const dropSupersededDraft = (messages: Message[], incoming: Message) => {
  if (incoming.direction !== 'OUTBOUND') return messages

  const index = messages.findIndex(
    item =>
      item.status === 'PENDING' &&
      item.direction === 'OUTBOUND' &&
      item.content === incoming.content,
  )

  if (index === -1) return messages

  return messages.filter((_, position) => position !== index)
}

/**
 * Só a thread aberta recebe append por payload; a lista de conversas continua
 * no mecanismo de invalidação por tag (`useRealtimeInvalidation`), que roda em
 * paralelo e cuida de preview, ordenação e contador de não lidas.
 */
export const useThreadRealtime = (conversationId: string | null) => {
  const socket = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket || !conversationId) return

    const handler = (event: RealtimeEvent) => {
      if (event.entity !== 'message' || event.action !== 'created') return
      if (!event.payload) return

      const message = event.payload as Message
      if (message.conversationId !== conversationId) return

      queryClient.setQueriesData<InfiniteMessages>(
        { predicate: query => matchesThread(query.queryKey, conversationId) },
        current => {
          if (!current?.pages.length) return current

          const [first, ...rest] = current.pages as [
            MessagesPage,
            ...MessagesPage[],
          ]

          // A thread vem em ordem decrescente: a mais recente encabeça a
          // primeira página.
          return {
            ...current,
            pages: [
              {
                ...first,
                data: dedupeMessages([
                  message,
                  ...dropSupersededDraft(first.data, message),
                ]),
              },
              ...rest,
            ],
          }
        },
      )
    }

    socket.on(REALTIME_EVENT, handler)

    return () => {
      socket.off(REALTIME_EVENT, handler)
    }
  }, [socket, queryClient, conversationId])
}
