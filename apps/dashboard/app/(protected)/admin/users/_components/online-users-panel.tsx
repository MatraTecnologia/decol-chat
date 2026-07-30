'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { ROLE_LABELS } from '@workspace/shared/roles'
import { type UserRow } from './users-table'

interface OnlineUsersPanelProps {
  users: UserRow[]
}

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  user: 'outline',
}

const getInitials = (name: string) =>
  name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

export const OnlineUsersPanel = ({ users }: OnlineUsersPanelProps) => {
  if (users.length === 0) return null

  return (
    <Card className="border-green-200 dark:border-green-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2 animate-pulse rounded-full bg-green-500" />
          Usuários Online ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {users.map(user => (
            <div key={user.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <div className="relative">
                <Avatar className="size-7">
                  <AvatarImage src={user.image || ''} alt={user.name} />
                  <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="ring-background absolute right-0 bottom-0 size-2 rounded-full bg-green-500 ring-1" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="text-muted-foreground truncate text-xs">{user.email}</p>
              </div>
              {user.role && (
                <Badge
                  variant={roleBadgeVariant[user.role] || 'outline'}
                  className="ml-1 shrink-0 text-xs"
                >
                  {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
