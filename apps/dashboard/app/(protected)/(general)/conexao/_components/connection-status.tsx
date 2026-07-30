'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import {
  checkWhatsappHealthOptions,
  getWhatsappConnectionOptions,
} from '@workspace/api-client/react-query'

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

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Spinner } from '@workspace/ui/components/spinner'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

const apiErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'string'
    ? error
    : ((error as { message?: string } | null)?.message ?? fallback)

const QUALITY = {
  GREEN: { label: 'Alta', className: 'bg-green-600 text-white' },
  YELLOW: { label: 'Média', className: 'bg-yellow-500 text-white' },
  RED: { label: 'Baixa', className: 'bg-destructive text-white' },
} as const

const QualityBadge = ({ rating }: { rating: string }) => {
  const quality = QUALITY[rating as keyof typeof QUALITY]

  if (!quality) {
    return <Badge variant="secondary">{rating}</Badge>
  }

  return <Badge className={quality.className}>{quality.label}</Badge>
}

const StatusRow = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
    <span className="text-muted-foreground text-sm">{label}</span>
    <div className="text-right text-sm font-medium">{children}</div>
  </div>
)

const Dash = () => <span className="text-muted-foreground font-normal">—</span>

const formatDateTime = (value: Date | string) =>
  new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })

export const ConnectionStatus = () => {
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery(getWhatsappConnectionOptions())
  const health = useQuery({
    ...checkWhatsappHealthOptions(),
    enabled: false,
    retry: false,
  })

  const connection = data?.connection ?? null

  const verifiedName = health.data?.verifiedName ?? connection?.verifiedName
  const displayPhoneNumber =
    health.data?.displayPhoneNumber ?? connection?.displayPhoneNumber
  const qualityRating = health.data?.qualityRating ?? connection?.qualityRating
  const lastCheckedAt = health.data?.checkedAt ?? connection?.lastCheckedAt

  const handleCheck = async () => {
    const result = await health.refetch()

    if (result.error) {
      toast.error(
        apiErrorMessage(result.error, 'Não foi possível consultar a Graph API'),
        { duration: 15000 },
      )
      return
    }

    toast.success('Número consultado na Graph API.')
    invalidateByTags(queryClient, ['WhatsApp'])
  }

  const renderContent = () => {
    if (isPending) {
      return (
        <div className="space-y-3">
          {[0, 1, 2, 3].map(index => (
            <Skeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      )
    }

    if (!connection) {
      return (
        <Empty className="border-muted-foreground/20 rounded-lg border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Activity />
            </EmptyMedia>
            <EmptyTitle>Nenhuma conexão configurada</EmptyTitle>
            <EmptyDescription>
              Preencha as credenciais no formulário ao lado para o número
              aparecer aqui.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-green-600 text-white">Conectado</Badge>
          {qualityRating && <QualityBadge rating={qualityRating} />}
        </div>

        <div>
          <StatusRow label="Nome verificado">
            {verifiedName ?? <Dash />}
          </StatusRow>
          <StatusRow label="Número exibido">
            {displayPhoneNumber ?? <Dash />}
          </StatusRow>
          <StatusRow label="Phone Number ID">
            <span className="font-mono text-xs">
              {connection.phoneNumberId}
            </span>
          </StatusRow>
          <StatusRow label="Tier de mensagens">
            {health.data?.messagingLimitTier ?? <Dash />}
          </StatusRow>
          <StatusRow label="Última verificação">
            {lastCheckedAt ? formatDateTime(lastCheckedAt) : <Dash />}
          </StatusRow>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleCheck}
          disabled={health.isFetching}
        >
          {health.isFetching ? (
            <>
              <Spinner className="mr-2" />
              Consultando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 size-4" />
              Testar conexão
            </>
          )}
        </Button>
      </div>
    )
  }

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Activity className="text-muted-foreground size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">Status da conexão</CardTitle>
          <CardDescription>
            Health check do número na Graph API: nome exibido, qualidade e tier
            de mensagens.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  )
}
