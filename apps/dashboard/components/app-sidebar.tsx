'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'

import { LayoutDashboard, Plug, Users } from 'lucide-react'

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
import { SidebarThemeToggle } from '@/components/sidebar-theme-toggle'
import { SidebarUserButton } from '@/components/sidebar-user-button'
import { ProfileManagementDialog } from '@/features/auth'
import { useUserRole } from '@/hooks'

interface SidebarItem {
  href: string
  label: string
  icon: React.ComponentType
  disabled?: boolean
  adminOnly?: boolean
}

const generalItems: SidebarItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/conexao', label: 'Conexão', icon: Plug, adminOnly: true },
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
    const visibleItems = items.filter(item => !item.adminOnly || isAdmin)

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
