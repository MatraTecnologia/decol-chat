'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ListChecks,
  MinusCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  getWhatsappReadinessOptions,
  listWhatsappPhoneNumbersOptions,
  registerWhatsappNumberMutation,
  subscribeWhatsappAppMutation,
} from '@workspace/api-client/react-query'
import type { GetWhatsappReadinessResponse } from '@workspace/api-client/types'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

type ReadinessCheck = GetWhatsappReadinessResponse['checks'][number]
type ReadinessAction = ReadinessCheck['action']

const apiErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'string'
    ? error
    : ((error as { message?: string } | null)?.message ?? fallback)

const STATUS = {
  ok: {
    Icon: CheckCircle2,
    className: 'text-emerald-600 dark:text-emerald-400',
  },
  pending: { Icon: Clock, className: 'text-muted-foreground' },
  error: { Icon: XCircle, className: 'text-destructive' },
  skipped: { Icon: MinusCircle, className: 'text-muted-foreground/50' },
} as const

const ACTION_LABELS = {
  register_number: 'Registrar número',
  subscribe_app: 'Inscrever app',
  select_number: 'Escolher número',
} as const

const CopyIdButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      toast.error('Erro ao copiar o Phone Number ID')
      return
    }

    toast.success('Phone Number ID copiado!')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Copiar Phone Number ID"
      className="size-8 shrink-0"
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

interface CheckRowProps {
  check: ReadinessCheck
  isBusy: boolean
  onAction: (action: ReadinessAction) => void
}

const CheckRow = ({ check, isBusy, onAction }: CheckRowProps) => {
  const { Icon, className } = STATUS[check.status]
  const action = check.action

  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className={cn('mt-0.5 size-4 shrink-0', className)} />

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{check.label}</p>
        <p className="text-muted-foreground text-xs">{check.detail}</p>
      </div>

      {action ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={isBusy}
          onClick={() => onAction(action)}
        >
          {isBusy ? <Spinner className="mr-2" /> : null}
          {ACTION_LABELS[action]}
        </Button>
      ) : null}
    </div>
  )
}

interface ActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const RegisterNumberDialog = ({ open, onOpenChange }: ActionDialogProps) => {
  const queryClient = useQueryClient()
  const [pin, setPin] = useState('123456')

  const register = useMutation({
    ...registerWhatsappNumberMutation(),
    onSuccess: () => {
      toast.success('Número registrado na Cloud API.')
      invalidateByTags(queryClient, ['WhatsApp'])
      onOpenChange(false)
    },
    onError: error => {
      toast.error(
        apiErrorMessage(error, 'Não foi possível registrar o número'),
        { duration: 15000 },
      )
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar número na Cloud API</DialogTitle>
          <DialogDescription>
            Sem este registro a Meta recusa qualquer envio com o erro{' '}
            <code className="font-mono">133010</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="whatsapp-pin">PIN de verificação em duas etapas</Label>
          <Input
            id="whatsapp-pin"
            value={pin}
            onChange={event => setPin(event.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
            className="font-mono"
            disabled={register.isPending}
          />
        </div>

        <Alert>
          <AlertTitle>Anote este PIN</AlertTitle>
          <AlertDescription>
            Se o número nunca teve verificação em duas etapas, o valor acima{' '}
            <strong>define</strong> o PIN — e a Meta vai pedi-lo de novo em
            futuros registros. Se o número já tem um PIN, informe o mesmo aqui,
            senão o registro falha.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={register.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={register.isPending || !/^\d{4,8}$/.test(pin)}
            onClick={() => register.mutate({ body: { pin } })}
          >
            {register.isPending ? (
              <>
                <Spinner className="mr-2" />
                Registrando...
              </>
            ) : (
              'Registrar número'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const PhoneNumbersDialog = ({ open, onOpenChange }: ActionDialogProps) => {
  const { data, isPending, error } = useQuery({
    ...listWhatsappPhoneNumbersOptions(),
    enabled: open,
  })

  const renderContent = () => {
    if (isPending) {
      return (
        <div className="space-y-2">
          {[0, 1].map(index => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <p className="text-muted-foreground text-sm">
          {apiErrorMessage(error, 'Não foi possível listar os números do WABA')}
        </p>
      )
    }

    if (!data?.data.length) {
      return (
        <p className="text-muted-foreground text-sm">
          Nenhum número encontrado neste WABA. Confira se o WABA ID está
          correto.
        </p>
      )
    }

    return (
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {data.data.map(number => (
          <div key={number.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {number.displayPhoneNumber ?? 'Número não informado'}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {number.verifiedName ?? 'Sem nome verificado'}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {number.platformType ?? 'Plataforma desconhecida'}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 truncate rounded px-2 py-1 font-mono text-xs">
                {number.id}
              </code>
              <CopyIdButton value={number.id} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Números do WABA</DialogTitle>
          <DialogDescription>
            Copie o ID do número desejado e cole no campo{' '}
            <strong>Phone Number ID</strong> do formulário de{' '}
            <strong>Credenciais</strong>, depois salve. A troca não acontece
            daqui porque o salvamento exige colar de novo o access token e o app
            secret, que nunca são devolvidos em texto claro.
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}

export const ReadinessPanel = () => {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<ReadinessAction | null>(null)

  const { data, isPending, isFetching, refetch } = useQuery(
    getWhatsappReadinessOptions(),
  )

  const subscribe = useMutation({
    ...subscribeWhatsappAppMutation(),
    onSuccess: () => {
      toast.success('App inscrito no WABA — os eventos passam a chegar.')
      invalidateByTags(queryClient, ['WhatsApp'])
    },
    onError: error => {
      toast.error(apiErrorMessage(error, 'Não foi possível inscrever o app'), {
        duration: 15000,
      })
    },
  })

  const handleAction = (action: ReadinessAction) => {
    if (action === 'subscribe_app') {
      subscribe.mutate({})
      return
    }

    setDialog(action)
  }

  const handleRefetch = async () => {
    const result = await refetch()

    if (result.error) {
      toast.error(
        apiErrorMessage(result.error, 'Não foi possível rodar as verificações'),
        { duration: 15000 },
      )
    }
  }

  const renderContent = () => {
    if (isPending) {
      return (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map(index => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      )
    }

    if (!data) {
      return (
        <p className="text-muted-foreground text-sm">
          Não foi possível rodar as verificações.
        </p>
      )
    }

    return (
      <div className="divide-y">
        {data.checks.map(check => (
          <CheckRow
            key={check.id}
            check={check}
            isBusy={check.action === 'subscribe_app' && subscribe.isPending}
            onAction={handleAction}
          />
        ))}
      </div>
    )
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <ListChecks className="text-muted-foreground size-5" />
        </div>
        <div className="flex-1 space-y-1">
          <CardTitle className="text-base">Prontidão</CardTitle>
          <CardDescription>
            Roda contra a Graph API e o histórico do webhook tudo que precisa
            estar de pé para o ciclo funcionar — com a correção na própria linha.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={handleRefetch}
          disabled={isFetching}
        >
          {isFetching ? (
            <>
              <Spinner className="mr-2" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 size-4" />
              Verificar novamente
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent>{renderContent()}</CardContent>

      <RegisterNumberDialog
        open={dialog === 'register_number'}
        onOpenChange={open => setDialog(open ? 'register_number' : null)}
      />
      <PhoneNumbersDialog
        open={dialog === 'select_number'}
        onOpenChange={open => setDialog(open ? 'select_number' : null)}
      />
    </Card>
  )
}
