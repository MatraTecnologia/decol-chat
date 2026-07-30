'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'

import { useSocket } from '@/providers/socket-provider'

type SocketStatus = 'connected' | 'connecting' | 'disconnected'

const statusConfig = {
  connected: {
    label: 'Conectado em tempo real',
    dotClass: 'bg-emerald-500',
    animate: false,
    clickable: false,
  },
  connecting: {
    label: 'Reconectando...',
    dotClass: 'bg-yellow-500',
    animate: true,
    clickable: false,
  },
  disconnected: {
    label: 'Desconectado — clique para reconectar',
    dotClass: 'bg-red-500',
    animate: false,
    clickable: true,
  },
} as const

const useSocketStatus = (socket: ReturnType<typeof useSocket>) => {
  // Track when reconnection has given up (reconnect_failed fires after all attempts exhausted)
  const gaveUpRef = useRef(false)

  useEffect(() => {
    if (!socket) return

    const onReconnectFailed = () => {
      gaveUpRef.current = true
    }
    const onConnect = () => {
      gaveUpRef.current = false
    }

    socket.io.on('reconnect_failed', onReconnectFailed)
    socket.on('connect', onConnect)

    return () => {
      socket.io.off('reconnect_failed', onReconnectFailed)
      socket.off('connect', onConnect)
    }
  }, [socket])

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!socket) return () => {}

      socket.on('connect', callback)
      socket.on('disconnect', callback)
      socket.on('connect_error', callback)
      socket.io.on('reconnect_attempt', callback)
      socket.io.on('reconnect_failed', callback)

      return () => {
        socket.off('connect', callback)
        socket.off('disconnect', callback)
        socket.off('connect_error', callback)
        socket.io.off('reconnect_attempt', callback)
        socket.io.off('reconnect_failed', callback)
      }
    },
    [socket],
  )

  const getSnapshot = useCallback((): SocketStatus => {
    if (!socket) return 'disconnected'
    if (socket.connected) return 'connected'
    if (gaveUpRef.current) return 'disconnected'
    if (socket.active) return 'connecting'
    return 'disconnected'
  }, [socket])

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => 'disconnected' as SocketStatus,
  )
}

export const SocketStatus = () => {
  const socket = useSocket()
  const status = useSocketStatus(socket)

  const config = statusConfig[status]

  const handleClick = () => {
    if (config.clickable && socket) {
      socket.connect()
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className={cn(
              'flex size-6 items-center justify-center rounded-md transition-colors',
              config.clickable
                ? 'hover:bg-accent cursor-pointer'
                : 'cursor-default',
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                config.dotClass,
                config.animate && 'animate-pulse',
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{config.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
