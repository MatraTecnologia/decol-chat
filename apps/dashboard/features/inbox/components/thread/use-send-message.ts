'use client'

import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  sendMessageMutation,
  sendTemplateMessageMutation,
} from '@workspace/api-client/react-query'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

import { errorText } from '../../lib/api-error'
import { dedupeMessages } from '../../lib/merge-message-page'
import type { Message } from '../../types'

interface MessagesPage {
  data: Message[]
  nextCursor: string | null
}

interface InfiniteMessages {
  pages: MessagesPage[]
  pageParams: unknown[]
}

interface SendMessageInput {
  text: string
  /** Bolha falhada que sai do cache no reenvio, para a thread não empilhar erros. */
  replaces?: Message
}

/**
 * Mesmo predicate do `use-thread-realtime`: a query key do hey-api varia com o
 * `limit`, então casar a chave inteira seria frágil.
 */
const matchesThread = (
  queryKey: readonly unknown[],
  conversationId: string,
) => {
  const key = queryKey[0]
  if (typeof key !== 'object' || key === null) return false

  const { _id, path } = key as { _id?: string; path?: { id?: string } }

  return _id === 'listMessages' && path?.id === conversationId
}

const updateThread = (
  queryClient: QueryClient,
  conversationId: string,
  updater: (pages: MessagesPage[]) => MessagesPage[],
) => {
  queryClient.setQueriesData<InfiniteMessages>(
    { predicate: query => matchesThread(query.queryKey, conversationId) },
    current => {
      if (!current?.pages.length) return current

      return { ...current, pages: updater(current.pages) }
    },
  )
}

const prependToThread = (pages: MessagesPage[], incoming: Message) => {
  const [first, ...rest] = pages as [MessagesPage, ...MessagesPage[]]

  return [
    { ...first, data: dedupeMessages([incoming, ...first.data]) },
    ...rest,
  ]
}

const removeMessage = (pages: MessagesPage[], messageId: string) =>
  pages.map(page => ({
    ...page,
    data: page.data.filter(message => message.id !== messageId),
  }))

/**
 * O eco do socket pode chegar antes da resposta do POST. Quando isso acontece
 * a temporária já foi embora, então a real entra pelo topo e o dedupe por
 * `waMessageId` colapsa a cópia deixada pelo eco.
 */
const replaceMessage = (
  pages: MessagesPage[],
  tempId: string,
  real: Message,
) => {
  const found = pages.some(page =>
    page.data.some(message => message.id === tempId),
  )

  if (!found) return prependToThread(pages, real)

  return pages.map(page => ({
    ...page,
    data: dedupeMessages(
      page.data.map(message => (message.id === tempId ? real : message)),
    ),
  }))
}

const failMessage = (
  pages: MessagesPage[],
  messageId: string,
  errorMessage: string,
) =>
  pages.map(page => ({
    ...page,
    data: page.data.map((message): Message =>
      message.id === messageId
        ? { ...message, status: 'FAILED', errorMessage, failedAt: new Date() }
        : message,
    ),
  }))

const createOptimisticMessage = (
  conversationId: string,
  content: string,
): Message => ({
  id: crypto.randomUUID(),
  conversationId,
  senderId: null,
  direction: 'OUTBOUND',
  type: 'TEXT',
  status: 'PENDING',
  waMessageId: null,
  waTimestamp: null,
  content,
  mediaId: null,
  mediaUrl: null,
  mediaMimeType: null,
  templateName: null,
  errorCode: null,
  errorMessage: null,
  deliveredAt: null,
  readAt: null,
  failedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  sender: null,
})

export const useSendMessage = (conversationId: string) => {
  const queryClient = useQueryClient()
  const mutation = useMutation(sendMessageMutation())

  const send = async ({ text, replaces }: SendMessageInput) => {
    const optimistic = createOptimisticMessage(conversationId, text)

    updateThread(queryClient, conversationId, pages =>
      prependToThread(
        replaces ? removeMessage(pages, replaces.id) : pages,
        optimistic,
      ),
    )

    invalidateByTags(queryClient, ['Conversations'])

    try {
      // A rota responde 200 com `status: 'FAILED'` quando a Meta recusa — a
      // mensagem existe no banco e entra na thread como falha, não como erro.
      const sent = await mutation.mutateAsync({
        path: { id: conversationId },
        body: { text },
      })

      updateThread(queryClient, conversationId, pages =>
        replaceMessage(pages, optimistic.id, sent),
      )
    } catch (error) {
      updateThread(queryClient, conversationId, pages =>
        failMessage(
          pages,
          optimistic.id,
          errorText(error, 'Não foi possível enviar a mensagem'),
        ),
      )
    } finally {
      invalidateByTags(queryClient, ['Conversations'])
    }
  }

  return { send, isPending: mutation.isPending }
}

export const useSendTemplateMessage = (conversationId: string) => {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    ...sendTemplateMessageMutation(),
    onSuccess: sent => {
      updateThread(queryClient, conversationId, pages =>
        prependToThread(pages, sent),
      )
      invalidateByTags(queryClient, ['Conversations'])
    },
  })

  return mutation
}
