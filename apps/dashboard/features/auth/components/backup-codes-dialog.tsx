'use client'

import { Check, Copy } from 'lucide-react'
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

import { useGenerateBackupCodes } from '../api/mutations'

interface BackupCodesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BackupCodesDialog({
  open,
  onOpenChange,
}: BackupCodesDialogProps) {
  const [password, setPassword] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const generateBackupCodes = useGenerateBackupCodes()

  function resetState() {
    setPassword('')
    setBackupCodes([])
    setCopied(false)
  }

  function handleGenerate() {
    if (!password.trim()) {
      toast.error('Digite sua senha')
      return
    }

    generateBackupCodes.mutate(
      { password },
      {
        onSuccess: data => {
          if (data?.backupCodes) {
            setBackupCodes(data.backupCodes)
            toast.success('Novos códigos de backup gerados!')
          }
        },
      },
    )
  }

  async function handleCopyBackupCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'))
      setCopied(true)
      toast.success('Códigos copiados!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar códigos')
    }
  }

  const hasBackupCodes = backupCodes.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        onOpenChange(v)
        if (!v) resetState()
      }}
    >
      <DialogContent className="sm:max-w-md">
        {!hasBackupCodes ? (
          <>
            <DialogHeader>
              <DialogTitle>Códigos de backup</DialogTitle>
              <DialogDescription>
                Gere novos códigos de backup para sua conta. Cada código pode
                ser usado uma única vez caso você perca acesso ao seu
                autenticador.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Gerar novos códigos irá invalidar todos os códigos anteriores.
              </div>
              <div className="space-y-2">
                <Label htmlFor="backup-codes-password">Senha</Label>
                <PasswordInput
                  id="backup-codes-password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={generateBackupCodes.isPending}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleGenerate()
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={generateBackupCodes.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generateBackupCodes.isPending}
              >
                {generateBackupCodes.isPending ? (
                  <>
                    <Spinner className="mr-2" />
                    Gerando...
                  </>
                ) : (
                  'Gerar novos códigos'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Códigos de backup</DialogTitle>
              <DialogDescription>
                Guarde estes códigos em um lugar seguro. Cada código pode ser
                usado uma única vez caso você perca acesso ao seu autenticador.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-4">
                {backupCodes.map((code, i) => (
                  <code
                    key={i}
                    className="bg-muted rounded px-2 py-1.5 text-center font-mono text-sm"
                  >
                    {code}
                  </code>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCopyBackupCodes}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar todos os códigos
                  </>
                )}
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                Atenção: estes códigos não serão exibidos novamente.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Concluído</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
