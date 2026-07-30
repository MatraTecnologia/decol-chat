'use client'

import { motion } from 'motion/react'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Shield, UserPlus } from 'lucide-react'
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs'
import { useDebounce } from 'use-debounce'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'

import {
  listMembersOptions,
  listUsersOptions,
} from '@workspace/api-client/react-query'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import { useOnlineUsers } from '@/hooks'
import { authClient } from '@/lib/auth-client'
import { invalidateByTags } from '@/lib/invalidate-by-tags'
import { CreateUserDialog } from './create-user-dialog'
import { OnlineUsersPanel } from './online-users-panel'
import { UserSearch } from './user-search'
import { type UserRow, UsersTable } from './users-table'

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
  const { data: session } = authClient.useSession()
  const queryClient = useQueryClient()
  const onlineUserIds = useOnlineUsers()

  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault(''),
  )
  const [role, setRole] = useQueryState('role', parseAsString.withDefault(''))
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))

  const [debouncedSearch] = useDebounce(search, 300)

  const { data, isFetching } = useQuery(
    listUsersOptions({
      query: {
        search: debouncedSearch || undefined,
        role: (role as 'admin' | 'user') || undefined,
        page,
        limit: LIMIT,
      },
    }),
  )

  const { data: membersData } = useQuery({
    ...listMembersOptions(),
    enabled: onlineUserIds.size > 0,
  })

  const users = (data?.data ?? []) as unknown as UserRow[]
  const meta = data?.meta
  const total = meta?.total ?? 0
  const totalPages = meta?.totalPages ?? 0

  const onlineUsers = (membersData ?? []).filter(u =>
    onlineUserIds.has(u.id),
  ) as unknown as UserRow[]

  const onRefresh = () => invalidateByTags(queryClient, ['Users'])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleRoleChange = (value: string) => {
    setRole(value)
    setPage(1)
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        variants={containerVariants}
        initial={false}
        animate="visible"
        className="space-y-6"
      >
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <Shield className="text-primary size-5" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Time
              </h1>
              {onlineUserIds.size > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-green-200 text-green-600 dark:border-green-800 dark:text-green-400"
                >
                  <span className="size-1.5 rounded-full bg-green-500" />
                  {onlineUserIds.size} online agora
                </Badge>
              )}
            </div>
          </div>

          <CreateUserDialog onSuccess={onRefresh}>
            <Button>
              <UserPlus className="mr-2 size-4" />
              Criar usuário
            </Button>
          </CreateUserDialog>
        </motion.div>

        <motion.div variants={itemVariants}>
          <UserSearch
            search={search}
            onSearchChange={handleSearchChange}
            role={role}
            onRoleChange={handleRoleChange}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {isFetching
                  ? 'Carregando...'
                  : `${total} usuário${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
              </CardTitle>
            </CardHeader>

            <CardContent>
              {isFetching ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Nenhum usuário encontrado.
                </p>
              ) : (
                <UsersTable
                  users={users}
                  currentUserId={session?.user?.id ?? ''}
                  onlineUserIds={onlineUserIds}
                  onRefresh={onRefresh}
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

        <motion.div variants={itemVariants}>
          <OnlineUsersPanel users={onlineUsers} />
        </motion.div>
      </motion.div>
    </div>
  )
}
