'use client'

import { MessagesSquare } from 'lucide-react'

import { cn } from '@workspace/ui/lib/utils'

import { ConversationList } from './conversation-list'
import { ContactPanel } from './contact-panel'
import { Thread, ThreadHeader } from './thread'

import { useInboxPanels, useSelectedConversation } from '../hooks'

const EmptyThread = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
    <div className="bg-muted flex size-12 items-center justify-center rounded-full">
      <MessagesSquare className="text-muted-foreground size-6" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium">Nenhuma conversa aberta</p>
      <p className="text-muted-foreground max-w-xs text-xs">
        Escolha uma conversa na lista para ver o histórico e o contexto do
        contato.
      </p>
    </div>
  </div>
)

export const InboxShell = () => {
  const { conversationId } = useSelectedConversation()
  const { contactPanelOpen } = useInboxPanels()

  const showContactPanel = Boolean(conversationId) && contactPanelOpen

  return (
    // h-full trava a Inbox na altura da viewport e min-h-0 libera as colunas
    // para rolar: sem os dois, o conteúdo estica e o scroll sobe para o main.
    <div className="flex h-full min-h-0 overflow-hidden">
      <aside className="flex h-full w-full min-w-0 shrink-0 flex-col border-r md:w-80 lg:w-96">
        <ConversationList />
      </aside>

      <section
        className={cn(
          'h-full min-h-0 min-w-0 flex-1 flex-col',
          // No mobile a lista ocupa a tela inteira; a thread só aparece com
          // conversa escolhida.
          conversationId ? 'flex' : 'hidden md:flex',
        )}
      >
        {conversationId ? (
          <>
            <ThreadHeader conversationId={conversationId} />
            <Thread conversationId={conversationId} />
          </>
        ) : (
          <EmptyThread />
        )}
      </section>

      {showContactPanel && conversationId ? (
        <aside className="hidden h-full min-h-0 w-80 shrink-0 flex-col border-l lg:flex">
          <ContactPanel conversationId={conversationId} />
        </aside>
      ) : null}
    </div>
  )
}
