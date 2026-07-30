'use client'

import { Check, Copy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
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

import { useEnableTwoFactor, useVerifyTotp } from '../api/mutations'

interface EnableTwoFactorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 'password' | 'qrcode' | 'backup'

function extractSecretFromUri(uri: string): string {
  try {
    const url = new URL(uri)
    return url.searchParams.get('secret') || ''
  } catch {
    return ''
  }
}

export function EnableTwoFactorDialog({
  open,
  onOpenChange,
  onSuccess,
}: EnableTwoFactorDialogProps) {
  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [totpURI, setTotpURI] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verifyCode, setVerifyCode] = useState('')
  const [copied, setCopied] = useState(false)

  const enableTwoFactor = useEnableTwoFactor()
  const verifyTotp = useVerifyTotp()

  function resetState() {
    setStep('password')
    setPassword('')
    setTotpURI('')
    setBackupCodes([])
    setVerifyCode('')
    setCopied(false)
  }

  function handleEnable() {
    if (!password.trim()) {
      toast.error('Digite sua senha')
      return
    }

    enableTwoFactor.mutate(
      { password },
      {
        onSuccess: data => {
          if (data?.totpURI) setTotpURI(data.totpURI)
          if (data?.backupCodes) setBackupCodes(data.backupCodes)
          setStep('qrcode')
        },
      },
    )
  }

  function handleVerify() {
    if (!verifyCode.trim()) {
      toast.error('Digite o código de verificação')
      return
    }

    verifyTotp.mutate(
      { code: verifyCode },
      {
        onSuccess: () => {
          setStep('backup')
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

  function handleDone() {
    onOpenChange(false)
    resetState()
    onSuccess()
  }

  const secret = extractSecretFromUri(totpURI)
  const isLoading = enableTwoFactor.isPending || verifyTotp.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        onOpenChange(v)
        if (!v) resetState()
      }}
    >
      <DialogContent className="sm:max-w-md">
        {step === 'password' && (
          <>
            <DialogHeader>
              <DialogTitle>Ativar autenticação em duas etapas</DialogTitle>
              <DialogDescription>
                Digite sua senha para continuar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="2fa-password">Senha</Label>
                <PasswordInput
                  id="2fa-password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleEnable()
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleEnable} disabled={isLoading}>
                {enableTwoFactor.isPending ? (
                  <>
                    <Spinner className="mr-2" />
                    Verificando...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'qrcode' && (
          <>
            <DialogHeader>
              <DialogTitle>Escaneie o QR code</DialogTitle>
              <DialogDescription>
                Use seu app autenticador (Google Authenticator, Authy, etc.) para
                escanear o código abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-center rounded-lg border p-4">
                <QRCodeSVG value={totpURI} size={200} />
              </div>

              {secret && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Ou insira a chave manualmente:
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted flex-1 break-all rounded px-3 py-2 font-mono text-xs">
                      {secret}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={async () => {
                        await navigator.clipboard.writeText(secret)
                        toast.success('Chave copiada!')
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="verify-code">
                  Código de verificação (6 dígitos)
                </Label>
                <Input
                  id="verify-code"
                  placeholder="000000"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleVerify()
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleVerify} disabled={isLoading}>
                {verifyTotp.isPending ? (
                  <>
                    <Spinner className="mr-2" />
                    Verificando...
                  </>
                ) : (
                  'Verificar e ativar'
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'backup' && (
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
              <Button onClick={handleDone}>Concluído</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
