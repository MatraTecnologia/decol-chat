'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'

import {
  Contact,
  LayoutDashboard,
  LayoutTemplate,
  MessagesSquare,
  Plug,
  Users,
} from 'lucide-react'

import { TEMPLATE_READERS } from '@workspace/shared/whatsapp-templates'

import type { RoleType } from '@workspace/shared/roles'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@workspace/ui/components/sidebar'

import { Logo } from '@/components/logo'
import { NotificationStatus } from '@/components/notification-status'
import { SidebarThemeToggle } from '@/components/sidebar-theme-toggle'
import { SidebarUserButton } from '@/components/sidebar-user-button'
import { SidebarSocketStatus } from '@/components/socket-status'
import { ProfileManagementDialog } from '@/features/auth'
import { useUserRole } from '@/hooks'

interface SidebarItem {
  href: string
  label: string
  icon: React.ComponentType
  disabled?: boolean
  /** Sem `roles` o item aparece para qualquer papel com acesso ao painel. */
  roles?: RoleType[]
}

const generalItems: SidebarItem[] = [
  { href: '/conversations', label: 'Conversas', icon: MessagesSquare },
  { href: '/contacts', label: 'Contatos', icon: Contact },
  {
    href: '/templates',
    label: 'Modelos',
    icon: LayoutTemplate,
    roles: TEMPLATE_READERS,
  },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/conexao', label: 'Conexão', icon: Plug, roles: ['admin'] },
]

const adminItems: SidebarItem[] = [
  { href: '/admin/users', label: 'Usuários', icon: Users },
]

export const AppSidebar = () => {
  const pathname = usePathname()

  const { hasRole } = useUserRole()

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const isAdmin = mounted && hasRole('admin')

  const renderItem = (item: SidebarItem) => {
    if (item.disabled) {
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            disabled
            tooltip={`${item.label} (em breve)`}
            className="opacity-50"
          >
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={pathname === item.href}
          tooltip={item.label}
        >
          <Link href={item.href}>
            <item.icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const renderGroup = (label: string, items: SidebarItem[]) => {
    const visibleItems = items.filter(
      item => !item.roles || (mounted && hasRole(...item.roles)),
    )

    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>{visibleItems.map(renderItem)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <>
      <Sidebar collapsible="icon" className="group">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="Home">
                <Logo href="/dashboard" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {renderGroup('Geral', generalItems)}

          {isAdmin && renderGroup('Admin', adminItems)}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <NotificationStatus />
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarSocketStatus />
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarThemeToggle />
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarUserButton />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <ProfileManagementDialog />
    </>
  )
}
