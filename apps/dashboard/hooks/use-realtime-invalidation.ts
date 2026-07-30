'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useSocket } from '@/providers/socket-provider'

interface RealtimeEvent {
  entity: string
  action: string
  entityId: string
  invalidateTags?: string[]
}

const REALTIME_EVENT = 'entity:mutated'

export const useRealtimeInvalidation = () => {
  const socket = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket) return

    const handler = (event: RealtimeEvent) => {
      const tags = event.invalidateTags
      if (!tags || tags.length === 0) return

      queryClient.invalidateQueries({
        predicate: query => {
          const key = query.queryKey[0]
          if (typeof key === 'object' && key !== null && 'tags' in key) {
            const queryTags = (key as { tags?: readonly string[] }).tags
            if (!queryTags) return false
            return queryTags.some(tag => tags.includes(tag))
          }
          return false
        },
      })
    }

    socket.on(REALTIME_EVENT, handler)

    return () => {
      socket.off(REALTIME_EVENT, handler)
    }
  }, [socket, queryClient])
}
