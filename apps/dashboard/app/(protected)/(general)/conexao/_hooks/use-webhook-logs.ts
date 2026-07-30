'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { listWhatsappLogsOptions } from '@workspace/api-client/react-query'
import type { ListWhatsappLogsResponse } from '@workspace/api-client/types'

import { useSocket } from '@/providers/socket-provider'

export type WebhookLogEntry = ListWhatsappLogsResponse['data'][number]

const WEBHOOK_LOG_EVENT = 'whatsapp:webhook'
const MAX_LOGS = 200

const mergeLogs = (newer: WebhookLogEntry[], older: WebhookLogEntry[]) => {
  const seen = new Set<string>()
  const merged: WebhookLogEntry[] = []

  for (const entry of [...newer, ...older]) {
    if (seen.has(entry.id)) continue

    seen.add(entry.id)
    merged.push(entry)
  }

  return merged.slice(0, MAX_LOGS)
}

export const useWebhookLogs = () => {
  const socket = useSocket()

  const [logs, setLogs] = useState<WebhookLogEntry[]>([])
  const seededRef = useRef(false)

  const { data, isLoading } = useQuery(
    listWhatsappLogsOptions({ query: { limit: MAX_LOGS } }),
  )

  // O histórico do Redis serve apenas de seed inicial — depois disso a lista
  // vive do stream do socket, para que "Limpar" não seja desfeito por refetch.
  useEffect(() => {
    if (seededRef.current) return

    const seed = data?.data
    if (!seed) return

    seededRef.current = true
    setLogs(current => mergeLogs(current, seed))
  }, [data])

  useEffect(() => {
    if (!socket) return

    const handler = (entry: WebhookLogEntry) => {
      setLogs(current => mergeLogs([entry], current))
    }

    socket.on(WEBHOOK_LOG_EVENT, handler)

    return () => {
      socket.off(WEBHOOK_LOG_EVENT, handler)
    }
  }, [socket])

  const clear = useCallback(() => {
    seededRef.current = true
    setLogs([])
  }, [])

  return { logs, isLoading, clear }
}
