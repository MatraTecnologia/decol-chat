'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { motion } from 'motion/react'
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'
import { useDebounce } from 'use-debounce'

import {
  blockContactMutation,
  listContactsOptions,
} from '@workspace/api-client/react-query'

import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty'

import { useUserRole } from '@/hooks'
import { invalidateByTags } from '@/lib/invalidate-by-tags'

import { ContactSheet } from './contact-sheet'
import { apiErrorMessage, getDisplayName } from './contact-utils'
import { BLOCKED_VALUES, ContactsSearch } from './contacts-search'
import { type ContactTarget, ContactsTable } from './contacts-table'
import { EditContactDialog } from './edit-contact-dialog'

const LIMIT = 20

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
  },
}

export const Client = () => {
  const queryClient = useQueryClient()
  const { hasRole } = useUserRole()

  const canManage = hasRole('admin', 'manager')

  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const [blocked, setBlocked] = useQueryState(
    'blocked',
    parseAsStringLiteral(BLOCKED_VALUES),
  )
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [contactId, setContactId] = useQueryState(
    'id',
    parseAsString.withDefault(''),
  )

  const [debouncedSearch] = useDebounce(search, 300)

  const [editTarget, setEditTarget] = useState<ContactTarget | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [blockTarget, setBlockTarget] = useState<ContactTarget | null>(null)

  const { data, isFetching, isPending } = useQuery(
    listContactsOptions({
      query: {
        q: debouncedSearch || undefined,
        isBlocked: blocked ?? undefined,
        page,
        limit: LIMIT,
      },
    }),
  )

  const block = useMutation({
    ...blockContactMutation(),
    onSuccess: contact => {
      toast.success(
        contact.isBlocked
          ? 'Contato bloqueado. Novas mensagens dele serão ignoradas.'
          : 'Contato desbloqueado.',
      )
      invalidateByTags(queryClient, ['Contacts'])
      setBlockTarget(null)
    },
    onError: error => {
      toast.error(
        apiErrorMessage(
          error,
          'Não foi possível alterar o bloqueio do contato',
        ),
      )
    },
  })

  const contacts = data?.data ?? []
  const meta = data?.meta
  const total = meta?.total ?? 0
  const totalPages = meta?.totalPages ?? 0

  // No render do servidor nada é buscado (`isFetching` é falso e `data` é
  // undefined), então só `isFetching` mandaria o estado vazio para o HTML. Já
  // com dados em mãos o skeleton não volta, senão a tabela piscaria inteira a
  // cada invalidação vinda do socket.
  const isLoading = isPending || (isFetching && !data)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleBlockedChange = (
    value: (typeof BLOCKED_VALUES)[number] | null,
  ) => {
    setBlocked(value)
    setPage(1)
  }

  const handleEdit = (contact: ContactTarget) => {
    setEditTarget(contact)
    setEditOpen(true)
  }

  const handleConfirmBlock = () => {
    if (!blockTarget) return

    block.mutate({
      path: { id: blockTarget.id },
      body: { blocked: !blockTarget.isBlocked },
    })
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        variants={containerVariants}
        initial={false}
        animate="visible"
        className="space-y-6"
      >
        <motion.div variants={itemVariants} className="flex items-center gap-3">
          <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
            <Users className="text-primary size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Contatos
            </h1>
            <p className="text-muted-foreground text-sm">
              Quem já conversou com o número da empresa no WhatsApp.
            </p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <ContactsSearch
            search={search}
            onSearchChange={handleSearchChange}
            blocked={blocked}
            onBlockedChange={handleBlockedChange}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {isLoading
                  ? 'Carregando...'
                  : `${total} contato${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
              </CardTitle>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <Empty className="border-muted-foreground/20 rounded-lg border border-dashed">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Users />
                    </EmptyMedia>
                    <EmptyTitle>Nenhum contato encontrado</EmptyTitle>
                    <EmptyDescription>
                      Os contatos aparecem aqui assim que alguém envia a
                      primeira mensagem para o número da empresa.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ContactsTable
                  contacts={contacts}
                  canManage={canManage}
                  pendingId={block.isPending ? (blockTarget?.id ?? null) : null}
                  onSelect={setContactId}
                  onEdit={handleEdit}
                  onToggleBlock={setBlockTarget}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {totalPages > 1 && (
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center gap-2"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
            >
              <ChevronLeft className="mr-1 size-4" />
              Anterior
            </Button>
            <span className="text-muted-foreground text-sm">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages || isFetching}
            >
              Próxima
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </motion.div>
        )}
      </motion.div>

      <ContactSheet
        contactId={contactId || null}
        canManage={canManage}
        pendingId={block.isPending ? (blockTarget?.id ?? null) : null}
        onClose={() => setContactId(null)}
        onEdit={handleEdit}
        onToggleBlock={setBlockTarget}
      />

      <EditContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contact={editTarget}
      />

      <AlertDialog
        open={Boolean(blockTarget)}
        onOpenChange={open => {
          if (!open) setBlockTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockTarget?.isBlocked
                ? 'Desbloquear contato?'
                : 'Bloquear contato?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockTarget?.isBlocked
                ? `${blockTarget ? getDisplayName(blockTarget) : ''} volta a poder abrir conversas com a empresa.`
                : `Mensagens de ${blockTarget ? getDisplayName(blockTarget) : ''} deixam de entrar na fila de atendimento. O histórico é mantido.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={block.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault()
                handleConfirmBlock()
              }}
              disabled={block.isPending}
            >
              {blockTarget?.isBlocked ? 'Desbloquear' : 'Bloquear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
