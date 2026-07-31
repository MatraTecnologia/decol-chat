'use client'

import { Check, CheckCheck, Clock, TriangleAlert } from 'lucide-react'

import { cn } from '@workspace/ui/lib/utils'

import type { MessageStatus } from '../../types'

interface MessageStatusIconProps {
  status: MessageStatus
}

const statusMap = {
  PENDING: { Icon: Clock, label: 'Enviando', className: '' },
  SENT: { Icon: Check, label: 'Enviada', className: '' },
  DELIVERED: { Icon: CheckCheck, label: 'Entregue', className: '' },
  READ: { Icon: CheckCheck, label: 'Lida', className: 'text-sky-400' },
  FAILED: { Icon: TriangleAlert, label: 'Falhou', className: 'text-destructive' },
} as const satisfies Record<
  MessageStatus,
  { Icon: typeof Check; label: string; className: string }
>

export const MessageStatusIcon = ({ status }: MessageStatusIconProps) => {
  const { Icon, label, className } = statusMap[status]

  return (
    <Icon
      role="img"
      aria-label={label}
      className={cn('size-3.5 shrink-0', className)}
    />
  )
}
