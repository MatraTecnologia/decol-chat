'use client'

import { useQuery } from '@tanstack/react-query'
import { Ban, ChevronRight, Pencil, SearchX, Unlock } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { getContactOptions } from '@workspace/api-client/react-query'
import type { GetContactResponse } from '@workspace/api-client/types'

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet'

import {
  formatFullTime,
  formatPhone,
  formatRelativeTime,
  getDisplayName,
  getInitials,
} from './contact-utils'

import type { ContactTarget } from './contacts-table'

type ContactConversation = GetContactResponse['conversations'][number]

const statusLabels: Record<ContactConversation['status'], string> = {
  OPEN: 'Aberta',
  PENDING: 'Pendente',
  CLOSED: 'Encerrada',
}

const priorityLabels: Record<ContactConversation['priority'], string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
}

const statusClasses: Record<ContactConversation['status'], string> = {
  OPEN: 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400',
  PENDING:
    'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
  CLOSED: 'text-muted-foreground',
}

interface ContactSheetProps {
  contactId: string | null
  canManage: boolean
  pendingId: string | null
  onClose: () => void
  onEdit: (contact: ContactTarget) => void
  onToggleBlock: (contact: ContactTarget) => void
}

const Attribute = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
    <span className="min-w-0 text-right text-xs font-medium break-words">
      {value}
    </span>
  </div>
)

export const ContactSheet = ({
  contactId,
  canManage,
  pendingId,
  onClose,
  onEdit,
  onToggleBlock,
}: ContactSheetProps) => {
  // O Radix mantém o conteúdo montado durante a animação de saída; sem guardar
  // o último id, o painel piscaria o skeleton enquanto desliza para fora.
  const [renderedId, setRenderedId] = useState(contactId)

  if (contactId && contactId !== renderedId) setRenderedId(contactId)

  const {
    data: contact,
    isPending,
    isError,
  } = useQuery({
    ...getContactOptions({ path: { id: renderedId ?? '' } }),
    enabled: Boolean(renderedId),
    // O `keepPreviousData` global mostraria os dados do contato anterior
    // enquanto o novo carrega.
    placeholderData: undefined,
  })

  const renderContent = () => {
    if (isError) {
      return (
        <Empty className="border-muted-foreground/20 rounded-lg border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>Contato indisponível</EmptyTitle>
            <EmptyDescription>
              Este contato não existe ou está fora do seu escopo de atendimento.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" onClick={onClose}>
            Voltar para a lista
          </Button>
        </Empty>
      )
    }

    if (isPending || !contact) {
      return (
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-32 w-full" />
        </div>
      )
    }

    const displayName = getDisplayName(contact)
    const showProfileName =
      Boolean(contact.profileName) && contact.profileName !== displayName

    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar className="size-16">
            <AvatarFallback className="text-base font-medium">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{displayName}</p>
            {showProfileName && (
              <p className="text-muted-foreground text-xs">
                {contact.profileName}
              </p>
            )}
          </div>
          {contact.isBlocked && <Badge variant="destructive">Bloqueado</Badge>}
        </div>

        <div className="space-y-2">
          <Attribute
            label="Telefone"
            value={formatPhone(contact.phoneNumber)}
          />
          <Attribute label="E-mail" value={contact.email ?? '--'} />
          <Attribute
            label="Conversas"
            value={`${contact.openConversationCount} aberta${
              contact.openConversationCount !== 1 ? 's' : ''
            } de ${contact.conversationCount}`}
          />
          <Attribute
            label="Última interação"
            value={formatFullTime(contact.lastInteractionAt)}
          />
          <Attribute
            label="Contato desde"
            value={formatFullTime(contact.createdAt)}
          />
        </div>

        {canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(contact)}
            >
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={pendingId === contact.id}
              onClick={() => onToggleBlock(contact)}
            >
              {contact.isBlocked ? (
                <Unlock className="size-4" />
              ) : (
                <Ban className="size-4" />
              )}
              {contact.isBlocked ? 'Desbloquear' : 'Bloquear'}
            </Button>
          </div>
        )}

        {contact.notes && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs">Notas internas</p>
              <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Histórico de conversas
          </p>

          {contact.conversations.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma conversa registrada.
            </p>
          ) : (
            <ul className="space-y-2">
              {contact.conversations.map(conversation => (
                <li key={conversation.id}>
                  <Link
                    href={`/conversations?c=${conversation.id}`}
                    className="hover:bg-accent flex items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={statusClasses[conversation.status]}
                        >
                          {statusLabels[conversation.status]}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          Prioridade {priorityLabels[conversation.priority]}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium">
                        {conversation.subject ?? 'Sem assunto'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatRelativeTime(conversation.lastMessageAt)} ·{' '}
                        {conversation.assignedTo?.name ?? 'Sem responsável'}
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <Sheet
      open={Boolean(contactId)}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ficha do contato</SheetTitle>
          <SheetDescription>
            Dados cadastrais e histórico de atendimentos.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  )
}
