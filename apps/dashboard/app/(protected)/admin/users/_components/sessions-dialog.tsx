'use client'

import type { SessionWithImpersonatedBy } from 'better-auth/plugins'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UAParser } from 'ua-parser-js'

import {
  Globe,
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Spinner } from '@workspace/ui/components/spinner'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'

import { authClient } from '@/lib/auth-client'

function parseUserAgent(ua: string | null | undefined) {
  if (!ua) return null
  const { browser, os, device } = UAParser(ua)

  const browserLabel = browser.name
    ? `${browser.name}${browser.major ? ` ${browser.major}` : ''}`
    : null
  const osLabel = os.name
    ? `${os.name}${os.version ? ` ${os.version}` : ''}`
    : null

  return {
    browser: browserLabel,
    os: osLabel,
    deviceType: device.type || 'desktop',
  }
}

function getDeviceIcon(deviceType: string) {
  switch (deviceType) {
    case 'mobile':
      return Smartphone
    case 'tablet':
      return Tablet
    case 'console':
    case 'smarttv':
      return Monitor
    default:
      return Laptop
  }
}

interface SessionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string; name: string } | null
}

export function SessionsDialog({
  open,
  onOpenChange,
  user,
}: SessionsDialogProps) {
  const [sessions, setSessions] = useState<SessionWithImpersonatedBy[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [isRevokingAll, setIsRevokingAll] = useState(false)

  useEffect(() => {
    if (open && user) {
      // eslint-disable-next-line react-hooks/immutability
      fetchSessions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user])

  async function fetchSessions() {
    if (!user) return
    setIsLoading(true)
    try {
      const { data } = await authClient.admin.listUserSessions({
        userId: user.id,
      })
      setSessions(data?.sessions ?? [])
    } catch {
      toast.error('Erro ao carregar sessões')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRevoke(sessionToken: string) {
    setRevokingId(sessionToken)
    const { error } = await authClient.admin.revokeUserSession({
      sessionToken,
    })
    setRevokingId(null)

    if (error) {
      toast.error(error.message || 'Erro ao revogar sessão')
      return
    }

    toast.success('Sessão revogada')
    setSessions(prev => prev.filter(s => s.token !== sessionToken))
  }

  async function handleRevokeAll() {
    if (!user) return
    setIsRevokingAll(true)
    const { error } = await authClient.admin.revokeUserSessions({
      userId: user.id,
    })
    setIsRevokingAll(false)

    if (error) {
      toast.error(error.message || 'Erro ao revogar sessões')
      return
    }

    toast.success('Todas as sessões foram revogadas')
    setSessions([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sessões ativas</DialogTitle>
          <DialogDescription>
            Sessões de <strong>{user?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma sessão ativa
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeAll}
                disabled={isRevokingAll}
                className="w-full"
              >
                {isRevokingAll ? (
                  <>
                    <Spinner className="mr-2 size-3" />
                    Revogando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 size-3" />
                    Revogar todas ({sessions.length})
                  </>
                )}
              </Button>
            )}

            {sessions.map(session => {
              const ua = parseUserAgent(session.userAgent)
              const DeviceIcon = ua ? getDeviceIcon(ua.deviceType) : Globe

              return (
                <Card key={session.token}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <DeviceIcon className="text-muted-foreground size-4 shrink-0" />
                      <div>
                        <CardTitle className="text-sm font-medium">
                          {ua?.browser ?? 'Dispositivo desconhecido'}
                        </CardTitle>
                        {ua?.os && (
                          <p className="text-muted-foreground text-xs">
                            {ua.os}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(session.token)}
                      disabled={revokingId === session.token}
                      className="text-destructive h-7"
                    >
                      {revokingId === session.token ? (
                        <Spinner className="size-3" />
                      ) : (
                        'Revogar'
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent className="flex gap-2 text-xs">
                    {session.ipAddress && (
                      <Badge variant="outline">{session.ipAddress}</Badge>
                    )}
                    {session.expiresAt && (
                      <Badge variant="secondary">
                        Expira:{' '}
                        {new Date(session.expiresAt).toLocaleDateString(
                          'pt-BR',
                        )}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
