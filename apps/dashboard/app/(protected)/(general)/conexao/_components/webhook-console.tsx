'use client'

import {
  ChevronRight,
  Eraser,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { useMemo, useState } from 'react'

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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty'
import { Skeleton } from '@workspace/ui/components/skeleton'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@workspace/ui/components/toggle-group'
import { cn } from '@workspace/ui/lib/utils'

import {
  useWebhookLogs,
  type WebhookLogEntry,
} from '../_hooks/use-webhook-logs'

const ALL_DIRECTIONS = 'all'

interface DirectionMeta {
  label: string
  badgeClassName: string
}

const directionMeta: Record<string, DirectionMeta> = {
  inbound_verify: {
    label: 'verify',
    badgeClassName:
      'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  inbound_event: {
    label: 'evento',
    badgeClassName:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  outbound: {
    label: 'saída',
    badgeClassName:
      'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
}

const filters = [
  { value: ALL_DIRECTIONS, label: 'Todos' },
  { value: 'inbound_verify', label: 'Verificação' },
  { value: 'inbound_event', label: 'Eventos' },
  { value: 'outbound', label: 'Saída' },
]

const formatTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--:--'

  return date.toLocaleTimeString('pt-BR', { hour12: false })
}

const SignatureIndicator = ({ valid }: { valid?: boolean }) => {
  if (valid === true) {
    return (
      <span title="Assinatura válida" className="shrink-0">
        <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      </span>
    )
  }

  if (valid === false) {
    return (
      <span title="Assinatura inválida" className="shrink-0">
        <ShieldAlert className="text-destructive size-3.5" />
      </span>
    )
  }

  return null
}

const LogRow = ({ entry }: { entry: WebhookLogEntry }) => {
  const [open, setOpen] = useState(false)

  const meta = directionMeta[entry.direction]
  const hasPayload = entry.payload !== undefined && entry.payload !== null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-b last:border-b-0"
    >
      <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-start gap-2 px-3 py-2 text-left transition-colors">
        <ChevronRight
          className={cn(
            'text-muted-foreground mt-0.5 size-3.5 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
          {formatTime(entry.receivedAt)}
        </span>
        <Badge
          variant="outline"
          className={cn('shrink-0 font-mono', meta?.badgeClassName)}
        >
          {meta?.label ?? entry.direction}
        </Badge>
        <SignatureIndicator valid={entry.signatureValid} />
        <span className="min-w-0 flex-1 font-mono text-xs break-all">
          {entry.summary}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <pre
          className={cn(
            'bg-muted/60 mx-3 mb-2 overflow-x-auto rounded-md px-3 py-2 font-mono text-xs leading-relaxed',
            !hasPayload && 'text-muted-foreground',
          )}
        >
          {hasPayload ? JSON.stringify(entry.payload, null, 2) : 'sem payload'}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}

const ConsoleEmpty = ({ filtered }: { filtered: boolean }) => (
  <Empty className="border">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <Terminal />
      </EmptyMedia>
      <EmptyTitle>
        {filtered ? 'Nenhum evento neste filtro' : 'Nenhum evento ainda'}
      </EmptyTitle>
      <EmptyDescription>
        {filtered
          ? 'Nenhuma das entradas em memória tem essa direção. Escolha "Todos" para ver o log completo.'
          : 'Os eventos aparecem aqui em tempo real assim que a Meta chamar o webhook — o handshake de verificação, as mensagens recebidas e os status de entrega.'}
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
)

export const WebhookConsole = () => {
  const { logs, isLoading, clear } = useWebhookLogs()
  const [direction, setDirection] = useState<string>(ALL_DIRECTIONS)

  const visibleLogs = useMemo(
    () =>
      direction === ALL_DIRECTIONS
        ? logs
        : logs.filter(entry => entry.direction === direction),
    [logs, direction],
  )

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Terminal className="text-muted-foreground size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">Console de eventos</CardTitle>
          <CardDescription>
            Log ao vivo do handshake, dos eventos da Meta e das nossas chamadas
            à Graph API. Clique numa linha para ver o payload.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={1}
            value={direction}
            onValueChange={value => setDirection(value || ALL_DIRECTIONS)}
            className="flex-wrap"
          >
            {filters.map(filter => (
              <ToggleGroupItem
                key={filter.value}
                value={filter.value}
                aria-label={`Filtrar por ${filter.label}`}
                className="text-xs"
              >
                {filter.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">
              {visibleLogs.length}{' '}
              {visibleLogs.length === 1 ? 'evento' : 'eventos'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clear}
              disabled={logs.length === 0}
            >
              <Eraser className="size-4" />
              Limpar
            </Button>
          </div>
        </div>

        {isLoading && logs.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : visibleLogs.length === 0 ? (
          <ConsoleEmpty filtered={logs.length > 0} />
        ) : (
          <div className="max-h-[28rem] overflow-y-auto rounded-md border">
            {visibleLogs.map(entry => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
