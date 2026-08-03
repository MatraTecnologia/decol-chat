'use client'

import { useQuery } from '@tanstack/react-query'
import { Check, Copy, TriangleAlert, Webhook } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { getWhatsappConnectionOptions } from '@workspace/api-client/react-query'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/alert'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'

const TUNNEL_COMMANDS = [
  'ngrok http 3333',
  'cloudflared tunnel --url http://localhost:3333',
]

const copyToClipboard = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copiado!`)
    return true
  } catch {
    toast.error(`Erro ao copiar ${label.toLowerCase()}`)
    return false
  }
}

const CopyButton = ({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const ok = await copyToClipboard(value, label)
    if (!ok) return

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={`Copiar ${label}`}
      className={cn('shrink-0', className)}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-4" />
      )}
    </Button>
  )
}

const CopyField = ({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
}) => (
  <div className="space-y-1.5">
    <Label className="text-muted-foreground text-xs">{label}</Label>
    <div className="flex items-center gap-2">
      <Input readOnly value={value} className="font-mono text-xs" />
      <CopyButton value={value} label={label} />
    </div>
    {description ? (
      <p className="text-muted-foreground text-xs">{description}</p>
    ) : null}
  </div>
)

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
    {children}
  </code>
)

const CommandLine = ({ command }: { command: string }) => (
  <div className="flex w-full items-center gap-2">
    <pre className="bg-muted text-foreground flex-1 overflow-x-auto rounded-md px-3 py-2 font-mono text-xs">
      {command}
    </pre>
    <CopyButton value={command} label="Comando" className="size-8" />
  </div>
)

const LocalBaseAlert = ({ hasConnection }: { hasConnection: boolean }) => (
  <Alert variant="destructive">
    <TriangleAlert />
    <AlertTitle>A Meta não alcança este endereço</AlertTitle>
    <AlertDescription>
      <p>
        A base pública resolvida aponta para <Code>localhost</Code> /{' '}
        <Code>127.0.0.1</Code>. A Meta chama o webhook de fora da sua rede,
        então sem um túnel HTTPS nada funciona — nem o handshake de verificação,
        nem os eventos, nem o status de entrega.
      </p>
      <p>Suba um túnel com a API já rodando na porta 3333:</p>
      {TUNNEL_COMMANDS.map(command => (
        <CommandLine key={command} command={command} />
      ))}
      <p>
        Cole a origem HTTPS gerada (ex.:{' '}
        <Code>https://a1b2c3d4.ngrok-free.app</Code>) no campo{' '}
        <strong>Webhook Base URL</strong> do formulário de{' '}
        <strong>Credenciais</strong> e salve.{' '}
        {hasConnection
          ? 'A Callback URL desta seção passa a usar essa base — atualize-a também no App Dashboard da Meta.'
          : 'A Callback URL desta seção passa a usar essa base assim que as credenciais forem salvas.'}
      </p>
    </AlertDescription>
  </Alert>
)

export const WebhookPanel = () => {
  const { data, isLoading } = useQuery(getWhatsappConnectionOptions())

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Webhook className="text-muted-foreground size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">Webhook</CardTitle>
          <CardDescription>
            Cole a Callback URL no App Dashboard da Meta, em WhatsApp →
            Configuração → Webhook.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <>
            {data?.connection ? (
              <>
                <CopyField
                  label="Callback URL"
                  value={data.webhookUrl}
                  description="Endereço completo que recebe o handshake e os eventos da Meta."
                />
                <p className="text-muted-foreground text-xs">
                  O verify token agora é configurado direto no App Dashboard
                  da Meta, via a variável{' '}
                  <Code>META_WEBHOOK_VERIFY_TOKEN</Code> no ambiente da API —
                  não é mais gerado por conta.
                </p>
              </>
            ) : (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Webhook />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma conexão configurada</EmptyTitle>
                  <EmptyDescription>
                    Salve as credenciais para gerar a Callback URL.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {data?.webhookBaseIsLocal ? (
              <LocalBaseAlert hasConnection={!!data.connection} />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
