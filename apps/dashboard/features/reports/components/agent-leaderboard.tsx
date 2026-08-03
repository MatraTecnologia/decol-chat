import { Clock3, SendHorizontal, Trophy } from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'

import { LEVEL_COLOR } from '../lib/chart-palette'
import { formatDuration } from '../lib/format-duration'
import type { RankedAgent } from '../lib/report-metrics'
import { formatCount, topAgents } from '../lib/report-metrics'
import type { AgentRow } from '../lib/report-types'
import { PanelEmpty, PanelError, ReportPanel } from './report-panel'

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')

const PODIUM_LABEL = ['Destaque do período', 'Segundo lugar', 'Terceiro lugar']

interface PodiumCardProps {
  agent: RankedAgent
  online: boolean
  lead: boolean
}

const PodiumCard = ({ agent, online, lead }: PodiumCardProps) => (
  <div
    className={cn(
      'flex flex-col gap-4 rounded-xl p-4 ring-1',
      lead ? 'bg-muted/50 ring-foreground/15' : 'bg-card ring-foreground/10',
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <span
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] uppercase',
          lead ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {lead ? <Trophy className="size-3.5" aria-hidden /> : null}
        {PODIUM_LABEL[agent.position - 1]}
      </span>
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
          lead
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {agent.position}
      </span>
    </div>

    <div className="flex items-center gap-3">
      <div className="relative">
        <Avatar size={lead ? 'lg' : 'default'}>
          <AvatarImage src={agent.image ?? undefined} alt={agent.name} />
          <AvatarFallback className="text-xs">
            {initials(agent.name)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'ring-card absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2',
            !online && 'bg-muted-foreground/40',
          )}
          style={online ? { backgroundColor: LEVEL_COLOR.good } : undefined}
        />
        <span className="sr-only">{online ? 'Online agora' : 'Offline'}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{agent.name}</p>
        <p className="text-muted-foreground truncate text-xs">{agent.email}</p>
      </div>
    </div>

    <div className="flex items-end justify-between gap-3">
      <div>
        <p
          className={cn(
            'leading-none font-semibold',
            lead ? 'text-3xl' : 'text-2xl',
          )}
        >
          {formatCount(agent.closed)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">conversas fechadas</p>
      </div>
      <dl className="space-y-1 text-right text-xs">
        <div className="flex items-center justify-end gap-1.5">
          <Clock3 className="text-muted-foreground size-3.5" aria-hidden />
          <dt className="sr-only">Primeira resposta</dt>
          <dd className="tabular-nums">
            {formatDuration(agent.firstResponseSeconds)}
          </dd>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <SendHorizontal
            className="text-muted-foreground size-3.5"
            aria-hidden
          />
          <dt className="sr-only">Mensagens enviadas</dt>
          <dd className="tabular-nums">{formatCount(agent.messagesSent)}</dd>
        </div>
      </dl>
    </div>
  </div>
)

export interface AgentLeaderboardProps {
  agents: AgentRow[]
  onlineUserIds?: ReadonlySet<string>
  isLoading?: boolean
  error?: string | null
  className?: string
}

export const AgentLeaderboard = ({
  agents,
  onlineUserIds,
  isLoading = false,
  error = null,
  className,
}: AgentLeaderboardProps) => {
  const podium = topAgents(agents)

  return (
    <ReportPanel
      eyebrow="Pódio"
      title="Quem puxou o período"
      description="Mais conversas fechadas, desempatando por quem respondeu antes."
      className={className}
    >
      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <PanelError description={error} />
      ) : podium.length === 0 ? (
        <PanelEmpty
          icon={Trophy}
          description="Ninguém fechou conversa no período selecionado."
        />
      ) : (
        <div
          className={cn(
            'grid gap-3',
            podium.length === 3 && 'lg:grid-cols-[1.2fr_1fr_1fr]',
            podium.length === 2 && 'lg:grid-cols-2',
          )}
        >
          {podium.map(agent => (
            <PodiumCard
              key={agent.userId}
              agent={agent}
              online={onlineUserIds?.has(agent.userId) ?? false}
              lead={agent.position === 1}
            />
          ))}
        </div>
      )}
    </ReportPanel>
  )
}
