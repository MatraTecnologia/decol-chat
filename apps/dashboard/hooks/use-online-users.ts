'use client'

import { useSocket } from '@/providers/socket-provider'
import { useEffect, useState } from 'react'

export const useOnlineUsers = (): Set<string> => {
  const socket = useSocket()
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!socket) return

    const handler = ({ onlineUserIds }: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(onlineUserIds))
    }

    socket.on('users:presence', handler)
    socket.emit('users:presence:request')

    return () => {
      socket.off('users:presence', handler)
    }
  }, [socket])

  return onlineUserIds
}
