'use client'

import { useEffect, useState } from 'react'

import { AlertTriangle, Timer } from 'lucide-react'

import { cn } from '@workspace/ui/lib/utils'

import {
  formatFullTime,
  formatWindowRemaining,
} from '../../lib/format-message-time'

interface WindowCountdownProps {
  canSendFreeText: boolean
  windowExpiresAt: Date | null
}

const REFRESH_INTERVAL = 60_000

export const WindowCountdown = ({
  canSendFreeText,
  windowExpiresAt,
}: WindowCountdownProps) => {
  // Cada refetch devolve uma nova instância de data, então a chave de
  // sincronização compara o valor e não a identidade do objeto.
  const expiresAt = windowExpiresAt ? String(windowExpiresAt) : null

  const [countdown, setCountdown] = useState(() => ({
    expiresAt,
    remaining: formatWindowRemaining(expiresAt),
  }))

  if (countdown.expiresAt !== expiresAt) {
    setCountdown({ expiresAt, remaining: formatWindowRemaining(expiresAt) })
  }

  useEffect(() => {
    const interval = setInterval(
      () =>
        setCountdown({ expiresAt, remaining: formatWindowRemaining(expiresAt) }),
      REFRESH_INTERVAL,
    )

    return () => clearInterval(interval)
  }, [expiresAt])

  const { remaining } = countdown

  // Quem decide é o servidor (`canSendFreeText`); a contagem é só apresentação.
  const isOpen = canSendFreeText && Boolean(remaining)

  return (
    <div
      className={cn(
        'space-y-1 rounded-md border px-3 py-2.5',
        isOpen
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-amber-500/30 bg-amber-500/10',
      )}
    >
      <div className="flex items-center gap-2">
        {isOpen ? (
          <Timer className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
        )}
        <span className="text-xs font-medium">
          {isOpen ? 'Janela de 24h aberta' : 'Janela de 24h encerrada'}
        </span>
      </div>

      <p className="text-muted-foreground text-xs">
        {isOpen ? (
          <>
            Restam {remaining} para responder em texto livre
            {windowExpiresAt && ` · expira em ${formatFullTime(windowExpiresAt)}`}
            .
          </>
        ) : (
          'Só é possível enviar mensagens de template aprovadas.'
        )}
      </p>
    </div>
  )
}
