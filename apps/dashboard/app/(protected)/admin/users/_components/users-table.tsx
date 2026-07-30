'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import {
  Ban,
  Eye,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Shield,
  Trash2,
  Unlock,
} from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

import { authClient } from '@/lib/auth-client'
import { ROLE_LABELS } from '@workspace/shared/roles'
import { BanUserDialog } from './ban-user-dialog'
import { EditUserDialog } from './edit-user-dialog'
import { RemoveUserAlert } from './remove-user-alert'
import { ResetPasswordDialog } from './reset-password-dialog'
import { SessionsDialog } from './sessions-dialog'
import { SetRoleDialog } from './set-role-dialog'

export interface UserRow {
  id: string
  name: string
  email: string
  image?: string | null
  role?: string
  banned?: boolean
  emailVerified?: boolean
  createdAt?: Date | string
  phone?: string | null
}

interface UsersTableProps {
  users: UserRow[]
  currentUserId: string
  onlineUserIds: Set<string>
  onRefresh: () => void
}

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  user: 'outline',
}

export const UsersTable = ({
  users,
  currentUserId,
  onlineUserIds,
  onRefresh,
}: UsersTableProps) => {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [setRoleOpen, setSetRoleOpen] = useState(false)
  const [banOpen, setBanOpen] = useState(false)
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const handleImpersonate = async (user: UserRow) => {
    setLoadingId(user.id)
    const { error } = await authClient.admin.impersonateUser({
      userId: user.id,
    })
    setLoadingId(null)

    if (error) {
      toast.error(error.message || 'Erro ao impersonar usuário')
      return
    }

    // eslint-disable-next-line react-hooks/immutability
    window.location.href = '/dashboard'
  }

  const handleUnban = async (user: UserRow) => {
    setLoadingId(user.id)
    const { error } = await authClient.admin.unbanUser({
      userId: user.id,
    })
    setLoadingId(null)

    if (error) {
      toast.error(error.message || 'Erro ao desbanir usuário')
      return
    }

    toast.success('Usuário desbanido com sucesso')
    onRefresh()
  }

  const formatDate = (date?: Date | string) => {
    if (!date) return '--'
    return new Date(date).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getInitials = (name: string) => {
    return (
      name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?'
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(user => {
            const isCurrentUser = user.id === currentUserId

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="size-8">
                        <AvatarImage src={user.image || ''} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      {onlineUserIds.has(user.id) && (
                        <span className="ring-background absolute right-0 bottom-0 size-2.5 rounded-full bg-green-500 ring-2" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium">
                        {user.name}
                        {isCurrentUser && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            (você)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="text-muted-foreground flex items-center gap-1">
                      {user.email}
                      {!user.emailVerified && (
                        <Badge variant="outline" className="ml-1 text-xs">
                          Não verificado
                        </Badge>
                      )}
                    </div>
                    {user.phone && (
                      <div className="text-muted-foreground text-xs">
                        {user.phone}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={roleBadgeVariant[user.role || 'user'] || 'outline'}
                  >
                    {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ||
                      user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.banned ? (
                    <Badge variant="destructive">Banido</Badge>
                  ) : (
                    <Badge variant="outline">Ativo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={loadingId === user.id}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user)
                          setEditOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                        Editar usuário
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleImpersonate(user)}
                        disabled={isCurrentUser}
                      >
                        <Eye className="size-4" />
                        Impersonar usuário
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user)
                          setSetRoleOpen(true)
                        }}
                        disabled={isCurrentUser}
                      >
                        <Shield className="size-4" />
                        Alterar papel
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user)
                          setResetPasswordOpen(true)
                        }}
                      >
                        <KeyRound className="size-4" />
                        Redefinir senha
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user)
                          setSessionsOpen(true)
                        }}
                      >
                        <Eye className="size-4" />
                        Ver sessões
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {user.banned ? (
                        <DropdownMenuItem
                          onClick={() => handleUnban(user)}
                          disabled={isCurrentUser}
                        >
                          <Unlock className="size-4" />
                          Desbanir usuário
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user)
                            setBanOpen(true)
                          }}
                          disabled={isCurrentUser}
                        >
                          <Ban className="size-4" />
                          Banir usuário
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user)
                          setRemoveOpen(true)
                        }}
                        disabled={isCurrentUser}
                        className="text-destructive"
                      >
                        <Trash2 className="size-4" />
                        Remover usuário
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={selectedUser}
        onSuccess={onRefresh}
      />
      <SetRoleDialog
        open={setRoleOpen}
        onOpenChange={setSetRoleOpen}
        user={selectedUser}
        onSuccess={onRefresh}
      />
      <BanUserDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        user={selectedUser}
        onSuccess={onRefresh}
      />
      <ResetPasswordDialog
        open={resetPasswordOpen}
        onOpenChange={setResetPasswordOpen}
        user={selectedUser}
      />
      <SessionsDialog
        open={sessionsOpen}
        onOpenChange={setSessionsOpen}
        user={selectedUser}
      />
      <RemoveUserAlert
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        user={selectedUser}
        onSuccess={onRefresh}
      />
    </>
  )
}
