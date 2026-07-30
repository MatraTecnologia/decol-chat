'use client'

import { Separator } from '@workspace/ui/components/separator'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'

import { SocketStatus } from '@/components/socket-status'
import { UserButton } from '@/components/user-button'

export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="ml-auto flex items-center gap-2">
        <SocketStatus />
        <UserButton />
      </div>
    </header>
  )
}
