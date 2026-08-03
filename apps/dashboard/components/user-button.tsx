'use client'

import { LayoutDashboard, LogOut, Shield, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { Skeleton } from '@workspace/ui/components/skeleton'
import { Spinner } from '@workspace/ui/components/spinner'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'

import { useProfileModal } from '@/features/auth'
import { authClient } from '@/lib/auth-client'

interface UserButtonProps {
  showName?: boolean
  showEmail?: boolean
  /** Lado dos textos em relação ao avatar */
  side?: 'left' | 'right'
}

export function UserButton({
  showName = false,
  showEmail = false,
  side = 'left',
}: UserButtonProps) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const { onOpen: openProfile } = useProfileModal()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  )

  const showDetails = showName || showEmail

  // Force loading state on first render to match server output
  const user = session?.user
  const isReady = mounted && !isPending && !!user

  const initials = isReady
    ? user.name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
    : '?'

  async function handleLogout() {
    setIsLoggingOut(true)
    await authClient.signOut()
    toast.success('Voce saiu da sua conta')
    router.push('/sign-in')
  }

  const avatarContent = isReady ? (
    <Avatar className="size-8 cursor-pointer transition-opacity hover:opacity-80">
      <AvatarImage
        src={user.image ?? ''}
        alt={user.name ?? 'Avatar'}
        draggable={false}
      />
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </Avatar>
  ) : (
    <Skeleton className="size-8 rounded-full" />
  )

  const detailsContent = showDetails && (
    <div
      className={`hidden flex-col sm:flex ${side === 'left' ? 'items-end' : 'items-start'}`}
    >
      {isReady ? (
        <>
          {showName && (
            <span className="text-sm leading-none font-medium">
              {user.name}
            </span>
          )}
          {showEmail && (
            <span className="text-muted-foreground text-xs leading-none">
              {user.email}
            </span>
          )}
        </>
      ) : (
        <>
          {showName && <Skeleton className="h-4 w-24" />}
          {showEmail && <Skeleton className="h-3 w-32" />}
        </>
      )}
    </div>
  )

  const triggerChildren =
    side === 'left' ? (
      <>
        {detailsContent}
        {avatarContent}
      </>
    ) : (
      <>
        {avatarContent}
        {detailsContent}
      </>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!isReady}>
        <button
          className="focus-visible:ring-ring flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label="Menu do usuario"
        >
          {triggerChildren}
        </button>
      </DropdownMenuTrigger>
      {isReady && (
        <DropdownMenuContent
          align={side === 'left' ? 'end' : 'start'}
          className="w-56"
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm leading-none font-medium">{user.name}</p>
              <p className="text-muted-foreground text-xs leading-none">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <LayoutDashboard />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openProfile} className="cursor-pointer">
            <User />
            Minha conta
          </DropdownMenuItem>
          {user.role === 'admin' && (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <Shield />
                Administração
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="cursor-pointer"
          >
            {isLoggingOut ? <Spinner /> : <LogOut />}
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}
