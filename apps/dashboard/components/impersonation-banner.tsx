'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@workspace/ui/components/button'
import { Spinner } from '@workspace/ui/components/spinner'

import { authClient } from '@/lib/auth-client'

export function ImpersonationBanner() {
  const { data: session } = authClient.useSession()
  const [isLoading, setIsLoading] = useState(false)

  const isImpersonating = session?.session?.impersonatedBy

  if (!isImpersonating) return null

  async function handleStop() {
    setIsLoading(true)
    const { error } = await authClient.admin.stopImpersonating()
    if (error) {
      setIsLoading(false)
      toast.error('Erro ao parar impersonação')
      return
    }
    window.location.href = '/admin/users'
  }

  return (
    <div className="relative z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        Você está impersonando{' '}
        <strong>{session?.user?.name || session?.user?.email}</strong>
      </span>
      <Button
        variant="outline"
        size="sm"
        className="ml-2 h-7 border-black/20 bg-transparent text-black hover:bg-black/10"
        onClick={handleStop}
        disabled={isLoading}
      >
        {isLoading ? <Spinner className="mr-1 size-3" /> : <X className="mr-1 size-3" />}
        Parar impersonação
      </Button>
    </div>
  )
}
