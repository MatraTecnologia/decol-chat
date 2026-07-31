'use client'

import { Fragment, useEffect, useMemo, useRef } from 'react'

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Lock, MessageSquareDashed } from 'lucide-react'

import {
  getConversationOptions,
  listMessagesInfiniteOptions,
  markConversationReadMutation,
} from '@workspace/api-client/react-query'

import { Button } from '@workspace/ui/components/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'

import { useUserRole } from '@/hooks'
import { invalidateByTags } from '@/lib/invalidate-by-tags'

import { useThreadRealtime } from '../../hooks'
import { formatDaySeparator } from '../../lib/format-message-time'
import { dedupeMessages, messageKey } from '../../lib/merge-message-page'
import type { Message } from '../../types'
import { Composer } from './composer'
import { MessageBubble } from './message-bubble'
import { useSendMessage } from './use-send-message'

interface ThreadProps {
  conversationId: string
}

const PAGE_SIZE = 30

const dayOf = (message: Message) =>
  formatDaySeparator(message.waTimestamp ?? message.createdAt)

const DaySeparator = ({ label }: { label: string }) => (
  <div className="flex justify-center px-4 py-3">
    <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-medium">
      {label}
    </span>
  </div>
)

const ThreadSkeleton = () => (
  <div className="flex-1 space-y-3 p-4">
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        key={index}
        className={cn('flex', index % 2 === 0 ? 'justify-start' : 'justify-end')}
      >
        <Skeleton className="h-12 w-56 rounded-lg" />
      </div>
    ))}
  </div>
)

/**
 * Sem a thread em cache o envio otimista não teria onde entrar: a bolha sumiria
 * e o atendente não saberia se a mensagem saiu.
 */
const ComposerUnavailable = () => (
  <div className="shrink-0 border-t px-4 py-3">
    <div className="text-muted-foreground bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2.5 text-xs">
      <Lock className="size-3.5 shrink-0" />
      <span>Carregue as mensagens para poder responder.</span>
    </div>
  </div>
)

/** Só texto livre é reenviável: template precisaria do nome e da linguagem. */
const canRetry = (message: Message) =>
  message.status === 'FAILED' &&
  message.type === 'TEXT' &&
  Boolean(message.content)

export const Thread = ({ conversationId }: ThreadProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const markedRef = useRef<string | null>(null)

  const queryClient = useQueryClient()
  const { hasRole } = useUserRole()

  useThreadRealtime(conversationId)

  const { data: conversation } = useQuery({
    ...getConversationOptions({ path: { id: conversationId } }),
    placeholderData: undefined,
  })

  const { mutate: markRead } = useMutation({
    ...markConversationReadMutation(),
    onSuccess: () => invalidateByTags(queryClient, ['Conversations']),
  })

  const { send } = useSendMessage(conversationId)

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useInfiniteQuery({
    ...listMessagesInfiniteOptions({
      path: { id: conversationId },
      query: { limit: PAGE_SIZE },
    }),
    initialPageParam: {
      path: { id: conversationId },
      query: { limit: PAGE_SIZE },
    },
    getNextPageParam: last => last.nextCursor ?? undefined,
    // O `keepPreviousData` global manteria as mensagens da conversa anterior
    // visíveis sob o cabeçalho da nova conversa.
    placeholderData: undefined,
  })

  const messages = useMemo(
    () => dedupeMessages(data?.pages.flatMap(page => page.data) ?? []),
    [data],
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollRef.current
    if (!sentinel || !root || !hasNextPage) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { root, rootMargin: '160px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  // Abrir a conversa zera o badge de não lidas — uma vez por conversa, não a
  // cada render.
  useEffect(() => {
    if (markedRef.current === conversationId) return

    markedRef.current = conversationId
    markRead({ path: { id: conversationId } })
  }, [conversationId, markRead])

  const isViewer = hasRole('viewer')
  const canSendFreeText = conversation?.canSendFreeText ?? true

  const composer = (
    <Composer
      conversationId={conversationId}
      canSendFreeText={canSendFreeText}
      disabled={isViewer}
    />
  )

  const handleRetry = (message: Message) => {
    void send({ text: message.content ?? '', replaces: message })
  }

  const retryHandler = isViewer || !canSendFreeText ? undefined : handleRetry

  if (isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ThreadSkeleton />
        <ComposerUnavailable />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Não foi possível carregar as mensagens</EmptyTitle>
              <EmptyDescription>
                Verifique sua conexão e tente novamente.
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </Empty>
        </div>
        <ComposerUnavailable />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquareDashed />
              </EmptyMedia>
              <EmptyTitle>Nenhuma mensagem nesta conversa ainda.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        </div>
        {composer}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        `flex-col-reverse` mantém a viewport ancorada no fim: a lista vem do mais
        recente para o mais antigo, então o índice 0 fica embaixo e o separador
        de dia é emitido DEPOIS da bolha para aparecer acima dela.
      */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto py-2"
      >
        {messages.map((message, index) => {
          const older = messages[index + 1]
          const day = dayOf(message)

          return (
            <Fragment key={messageKey(message)}>
              <MessageBubble
                message={message}
                onRetry={canRetry(message) ? retryHandler : undefined}
              />
              {(!older || dayOf(older) !== day) && <DaySeparator label={day} />}
            </Fragment>
          )
        })}

        {isFetchingNextPage && (
          <div className="flex justify-center py-3">
            <Spinner className="text-muted-foreground size-4" />
          </div>
        )}

        <div ref={sentinelRef} aria-hidden className="h-px shrink-0" />
      </div>

      {composer}
    </div>
  )
}
