'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { matchesQueryTags } from '@/lib/query-tags'
import { useSocket } from '@/providers/socket-provider'

interface RealtimeEvent {
  entity: string
  action: string
  entityId: string
  invalidateTags?: string[]
  payload?: unknown
}

const REALTIME_EVENT = 'entity:mutated'

/**
 * Mensagem que chega com corpo é aplicada direto no cache da thread por
 * `useThreadRealtime`. Invalidar `Messages` aqui desfaria isso com um refetch
 * — e derrubaria a bolha otimista que ainda espera a resposta do POST.
 */
const pendingTags = (event: RealtimeEvent) => {
  const tags = event.invalidateTags ?? []

  if (event.entity !== 'message' || !event.payload) return tags

  return tags.filter(tag => tag !== 'Messages')
}

export const useRealtimeInvalidation = () => {
  const socket = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket) return

    const handler = (event: RealtimeEvent) => {
      const tags = pendingTags(event)
      if (tags.length === 0) return

      queryClient.invalidateQueries({
        predicate: query => matchesQueryTags(query.queryKey, tags),
      })
    }

    socket.on(REALTIME_EVENT, handler)

    return () => {
      socket.off(REALTIME_EVENT, handler)
    }
  }, [socket, queryClient])
}
