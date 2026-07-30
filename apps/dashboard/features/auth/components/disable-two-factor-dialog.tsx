'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@workspace/ui/components/button'
import { Label } from '@workspace/ui/components/label'
import { PasswordInput } from '@workspace/ui/components/password-input'
import { Spinner } from '@workspace/ui/components/spinner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'

import { useDisableTwoFactor } from '../api/mutations'

interface DisableTwoFactorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DisableTwoFactorDialog({
  open,
  onOpenChange,
  onSuccess,
}: DisableTwoFactorDialogProps) {
  const [password, setPassword] = useState('')
  const disableTwoFactor = useDisableTwoFactor()

  function handleDisable() {
    if (!password.trim()) {
      toast.error('Digite sua senha')
      return
    }

    disableTwoFactor.mutate(
      { password },
      {
        onSuccess: () => {
          setPassword('')
          onOpenChange(false)
          onSuccess()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        onOpenChange(v)
        if (!v) {
          setPassword('')
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desativar autenticação em duas etapas</DialogTitle>
          <DialogDescription>
            Digite sua senha para confirmar a desativação. Sua conta ficará
            menos protegida.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disable-2fa-password">Senha</Label>
            <PasswordInput
              id="disable-2fa-password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={disableTwoFactor.isPending}
              onKeyDown={e => {
                if (e.key === 'Enter') handleDisable()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disableTwoFactor.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisable}
            disabled={disableTwoFactor.isPending}
          >
            {disableTwoFactor.isPending ? (
              <>
                <Spinner className="mr-2" />
                Desativando...
              </>
            ) : (
              'Desativar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
