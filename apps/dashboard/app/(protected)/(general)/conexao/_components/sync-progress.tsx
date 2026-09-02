'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import {
  getWhatsappSyncStatusOptions,
  replayWhatsappLogsMutation,
} from '@workspace/api-client/react-query'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Progress } from '@workspace/ui/components/progress'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

const STATUS = {
  idle: { label: 'Aguardando', variant: 'secondary' },
  running: { label: 'Importando', variant: 'default' },
  done: { label: 'Concluído', variant: 'outline' },
} as const

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col">
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className="text-sm font-medium tabular-nums">{value}</span>
  </div>
)

export const SyncProgress = () => {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    ...getWhatsappSyncStatusOptions(),
    // O progresso vem do worker, não de evento realtime: enquanto o backfill
    // roda a barra precisa se mexer sozinha.
    refetchInterval: query =>
      query.state.data?.status === 'running' ? 3_000 : false,
  })

  const replay = useMutation({
    ...replayWhatsappLogsMutation(),
    onSuccess: result => {
      toast.success(
        `${result.history} chunks de histórico e ${result.other} eventos reenfileirados.`,
      )
      invalidateByTags(queryClient, ['WhatsApp', 'Conversations', 'Contacts'])
    },
    onError: () => toast.error('Não foi possível reenfileirar o log.'),
  })

  const status = data?.status ?? 'idle'
  const percent = data?.progress ?? 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
              <History className="size-4" />
            </div>
            <div>
              <CardTitle>Histórico do celular</CardTitle>
              <CardDescription>
                Importação das conversas e contatos do app WhatsApp Business. A
                Meta manda tudo uma única vez, em até 24h após a conexão.
              </CardDescription>
            </div>
          </div>
          <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Progress value={percent} />
          <p className="text-muted-foreground text-xs">
            {data?.phase != null ? `Fase ${data.phase} · ` : ''}
            {percent}%
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Chunks" value={data?.chunks ?? 0} />
          <Stat label="Conversas" value={data?.threads ?? 0} />
          <Stat label="Mensagens" value={data?.messages ?? 0} />
          <Stat label="Novas" value={data?.conversationsCreated ?? 0} />
        </div>

        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => replay.mutate({})}
            disabled={replay.isPending}
          >
            <RotateCcw className="size-3.5" />
            Reprocessar log do webhook
          </Button>
          <p className="text-muted-foreground text-xs">
            Reenfileira os eventos de coexistence guardados nas últimas 24h.
            Idempotente: mensagem já importada não duplica.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
