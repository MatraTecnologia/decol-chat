'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useSocket } from '@/providers/socket-provider'

import { dedupeMessages, replaceMessage } from '../lib/merge-message-page'
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

interface ThreadRealtimeOptions {
  /** Chamado a cada mensagem recebida na conversa aberta. */
  onIncoming?: () => void
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
export const useThreadRealtime = (
  conversationId: string | null,
  options?: ThreadRealtimeOptions,
) => {
  const socket = useSocket()
  const queryClient = useQueryClient()

  // O callback muda de identidade a cada render do Thread; guardá-lo num ref
  // evita registrar e desregistrar o listener do socket junto.
  const onIncomingRef = useRef(options?.onIncoming)

  useEffect(() => {
    onIncomingRef.current = options?.onIncoming
  })

  useEffect(() => {
    if (!socket || !conversationId) return

    const updateThread = (updater: (pages: MessagesPage[]) => MessagesPage[]) =>
      queryClient.setQueriesData<InfiniteMessages>(
        { predicate: query => matchesThread(query.queryKey, conversationId) },
        current => {
          if (!current?.pages.length) return current

          return { ...current, pages: updater(current.pages) }
        },
      )

    /**
     * Thread de outra conversa não está na tela: marcar como obsoleta não gera
     * requisição nenhuma (o React Query só refaz query ativa) e garante que ela
     * não volte desatualizada quando o atendente trocar de conversa.
     */
    const invalidateThread = (id: string) =>
      queryClient.invalidateQueries({
        predicate: query => matchesThread(query.queryKey, id),
      })

    const handleCreated = (message: Message) => {
      updateThread(pages => {
        const [first, ...rest] = pages as [MessagesPage, ...MessagesPage[]]

        // A thread vem em ordem decrescente: a mais recente encabeça a
        // primeira página.
        return [
          {
            ...first,
            data: dedupeMessages([
              message,
              ...dropSupersededDraft(first.data, message),
            ]),
          },
          ...rest,
        ]
      })

      if (message.direction === 'INBOUND') onIncomingRef.current?.()
    }

    /** Mudança de status (enviada/entregue/lida/falhou) troca a bolha no lugar. */
    const handleUpdated = (message: Message) =>
      updateThread(pages =>
        pages.map(page => {
          const data = replaceMessage(page.data, message)

          return data ? { ...page, data } : page
        }),
      )

    const handler = (event: RealtimeEvent) => {
      if (event.entity !== 'message') return
      if (event.action !== 'created' && event.action !== 'updated') return

      const message = event.payload as Message | undefined

      // Sem corpo não dá para saber qual bolha mudou — recarregar só a thread
      // aberta é mais barato que invalidar a tag `Messages` inteira.
      if (!message) {
        invalidateThread(conversationId)
        return
      }

      if (message.conversationId !== conversationId) {
        invalidateThread(message.conversationId)
        return
      }

      if (event.action === 'created') handleCreated(message)
      else handleUpdated(message)
    }

    socket.on(REALTIME_EVENT, handler)

    return () => {
      socket.off(REALTIME_EVENT, handler)
    }
  }, [socket, queryClient, conversationId])
}
