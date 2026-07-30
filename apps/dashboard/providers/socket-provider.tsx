'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'

import { env } from '@/config/env'
import { authClient } from '@/lib/auth-client'

const SocketContext = createContext<Socket | null>(null)

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession()

  const [socket, setSocket] = useState<Socket | null>(null)

  const isAuthenticated = !!session?.user

  // Manage socket lifecycle based on auth status
  useEffect(() => {
    if (!isAuthenticated) return

    let s: Socket

    async function connect() {
      // Fetch session token from server (cookie is HttpOnly)
      const res = await fetch('/api/socket-token')
      const { token } = await res.json()

      s = io(env.NEXT_PUBLIC_API_URL, {
        auth: { token },
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 3,
      })

      setSocket(s)
    }

    connect()

    return () => {
      s?.disconnect()
      setSocket(null)
    }
  }, [isAuthenticated])

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  )
}
