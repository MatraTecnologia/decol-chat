'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { SidebarMenuButton } from '@workspace/ui/components/sidebar'

export function SidebarThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <SidebarMenuButton
      tooltip="Alternar tema"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="scale-100 rotate-0 dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
      <span>Alternar tema</span>
    </SidebarMenuButton>
  )
}
