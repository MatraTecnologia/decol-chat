'use client'

import { useSyncExternalStore } from 'react'

import { Bell, BellOff, BellRing } from 'lucide-react'

import { SidebarMenuButton } from '@workspace/ui/components/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'

type PermissionState = NotificationPermission | 'unsupported'

const PERMISSION_CHANGE_EVENT = 'decol:notification-permission-change'

const subscribe = (callback: () => void) => {
  window.addEventListener(PERMISSION_CHANGE_EVENT, callback)
  document.addEventListener('visibilitychange', callback)

  return () => {
    window.removeEventListener(PERMISSION_CHANGE_EVENT, callback)
    document.removeEventListener('visibilitychange', callback)
  }
}

const getSnapshot = (): PermissionState =>
  'Notification' in window ? Notification.permission : 'unsupported'

const getServerSnapshot = (): PermissionState => 'unsupported'

const permissionConfig = {
  default: {
    Icon: Bell,
    label: 'Ativar notificações',
    tooltip: 'Clique para permitir notificações de novas mensagens',
  },
  granted: {
    Icon: BellRing,
    label: 'Notificações ativas',
    tooltip: 'Novas mensagens notificam quando esta guia estiver oculta',
  },
  denied: {
    Icon: BellOff,
    label: 'Notificações bloqueadas',
    tooltip: 'Libere as notificações nas configurações do navegador',
  },
  unsupported: {
    Icon: BellOff,
    label: 'Notificações indisponíveis',
    tooltip: 'Este navegador não oferece notificações nativas',
  },
} as const

export const NotificationStatus = () => {
  const permission = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )
  const { Icon, label, tooltip } = permissionConfig[permission]

  const handleClick = async () => {
    if (permission !== 'default') return

    try {
      await Notification.requestPermission()
    } finally {
      window.dispatchEvent(new Event(PERMISSION_CHANGE_EVENT))
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton
            onClick={handleClick}
            tooltip={tooltip}
            className={permission === 'default' ? 'cursor-pointer' : undefined}
          >
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        </TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
