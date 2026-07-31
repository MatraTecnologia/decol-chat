'use client'

import { Ban, MoreHorizontal, Pencil, Unlock } from 'lucide-react'

import type { ListContactsResponse } from '@workspace/api-client/types'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

import {
  formatFullTime,
  formatPhone,
  formatRelativeTime,
  getDisplayName,
  getInitials,
} from './contact-utils'

export type ContactRow = ListContactsResponse['data'][number]

/** Forma mínima que dialog de edição e bloqueio precisam — lista e ficha servem. */
export interface ContactTarget {
  id: string
  name: string | null
  profileName: string | null
  phoneNumber: string
  email: string | null
  notes: string | null
  isBlocked: boolean
}

interface ContactsTableProps {
  contacts: ContactRow[]
  canManage: boolean
  pendingId: string | null
  onSelect: (id: string) => void
  onEdit: (contact: ContactTarget) => void
  onToggleBlock: (contact: ContactTarget) => void
}

export const ContactsTable = ({
  contacts,
  canManage,
  pendingId,
  onSelect,
  onEdit,
  onToggleBlock,
}: ContactsTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contato</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Conversas</TableHead>
          <TableHead>Última interação</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map(contact => {
          const displayName = getDisplayName(contact)
          const showProfileName =
            Boolean(contact.profileName) && contact.profileName !== displayName

          return (
            <TableRow
              key={contact.id}
              onClick={() => onSelect(contact.id)}
              className="cursor-pointer"
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{displayName}</div>
                    {showProfileName && (
                      <div className="text-muted-foreground truncate text-xs">
                        {contact.profileName}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatPhone(contact.phoneNumber)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {contact.email ?? '--'}
              </TableCell>
              <TableCell className="text-sm">
                <span className="font-medium">
                  {contact.openConversationCount}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  aberta
                  {contact.openConversationCount !== 1 ? 's' : ''} de{' '}
                  {contact.conversationCount}
                </span>
              </TableCell>
              <TableCell
                className="text-muted-foreground text-sm"
                title={formatFullTime(contact.lastInteractionAt)}
              >
                {formatRelativeTime(contact.lastInteractionAt)}
              </TableCell>
              <TableCell>
                {contact.isBlocked ? (
                  <Badge variant="destructive">Bloqueado</Badge>
                ) : (
                  <Badge variant="outline">Ativo</Badge>
                )}
              </TableCell>
              <TableCell onClick={event => event.stopPropagation()}>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pendingId === contact.id}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(contact)}>
                        <Pencil className="size-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onToggleBlock(contact)}
                        className={contact.isBlocked ? '' : 'text-destructive'}
                      >
                        {contact.isBlocked ? (
                          <Unlock className="size-4" />
                        ) : (
                          <Ban className="size-4" />
                        )}
                        {contact.isBlocked ? 'Desbloquear' : 'Bloquear'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
