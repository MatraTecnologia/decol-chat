'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { Inbox, MessageSquarePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { listConversationsInfiniteOptions } from '@workspace/api-client/react-query'
import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Spinner } from '@workspace/ui/components/spinner'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty'

import { useUserRole } from '@/hooks'

import { useConversationFilters, useSelectedConversation } from '../../hooks'
import { NewConversationDialog } from '../new-conversation'
import { ConversationFilters } from './conversation-filters'
import { ConversationItem } from './conversation-list-item'
import { ScopeSelector } from './scope-selector'

const PAGE_SIZE = 25

const ConversationListSkeleton = () => (
  <div className="space-y-1 p-3">
    {Array.from({ length: 8 }).map((_, index) => (
      <div key={index} className="flex items-start gap-3 py-2">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    ))}
  </div>
)

export const ConversationList = () => {
  const filters = useConversationFilters()
  const { conversationId, selectConversation } = useSelectedConversation()
  const { hasRole } = useUserRole()

  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false)

  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...listConversationsInfiniteOptions({
      query: { ...filters.query, limit: PAGE_SIZE },
    }),
    initialPageParam: 1,
    getNextPageParam: lastPage =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
  })

  const conversations = data?.pages.flatMap(page => page.data) ?? []

  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { root: containerRef.current, rootMargin: '200px' },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, conversations.length])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b p-3">
        <ConversationFilters />
        <ScopeSelector />

        {/* O servidor recusa o `viewer` com 403 — não faz sentido oferecer. */}
        {!hasRole('viewer') && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setIsNewConversationOpen(true)}
          >
            <MessageSquarePlus className="size-4" />
            Nova conversa
          </Button>
        )}
      </div>

      <NewConversationDialog
        open={isNewConversationOpen}
        onOpenChange={setIsNewConversationOpen}
      />

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {isPending ? (
          <ConversationListSkeleton />
        ) : isError ? (
          <p className="text-destructive p-6 text-center text-sm">
            Não foi possível carregar as conversas. Tente novamente.
          </p>
        ) : conversations.length === 0 ? (
          <Empty className="border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Nenhuma conversa</EmptyTitle>
              <EmptyDescription>
                Ajuste os filtros ou aguarde uma nova mensagem chegar.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-border/60 divide-y">
            {conversations.map(conversation => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === conversationId}
                onSelect={() => selectConversation(conversation.id)}
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} aria-hidden className="h-px" />

        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Spinner className="text-muted-foreground size-4" />
          </div>
        )}
      </div>
    </div>
  )
}
