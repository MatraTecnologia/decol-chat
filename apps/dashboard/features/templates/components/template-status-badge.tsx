'use client'

import { Badge } from '@workspace/ui/components/badge'

/** Valores gravados verbatim do campo `status` da Meta (`policy.ts`). */
export const REMOTE_STATUS_VALUES = [
  'APPROVED',
  'PENDING',
  'IN_APPEAL',
  'REJECTED',
  'PAUSED',
  'DISABLED',
  'PENDING_DELETION',
  'DELETED',
  'LIMIT_EXCEEDED',
] as const

export type RemoteStatus = (typeof REMOTE_STATUS_VALUES)[number]

/** Estados em que a Meta ainda pode mudar o veredito sozinha. */
export const TRANSIENT_REMOTE_STATUSES: string[] = [
  'PENDING',
  'IN_APPEAL',
  'PENDING_DELETION',
]

export const REMOTE_STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprovado',
  PENDING: 'Em análise',
  IN_APPEAL: 'Em recurso',
  REJECTED: 'Reprovado',
  PAUSED: 'Pausado',
  DISABLED: 'Desativado',
  PENDING_DELETION: 'Exclusão pendente',
  DELETED: 'Excluído',
  LIMIT_EXCEEDED: 'Limite excedido',
}

const remoteStatusClasses: Record<string, string> = {
  APPROVED:
    'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400',
  PENDING:
    'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
  IN_APPEAL:
    'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
  PENDING_DELETION:
    'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
  REJECTED:
    'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400',
  DISABLED: 'text-muted-foreground',
  DELETED: 'text-muted-foreground',
  PAUSED:
    'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
  LIMIT_EXCEEDED:
    'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400',
}

export const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
}

export const REVISION_STATE_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Enviada',
  SUPERSEDED: 'Substituída',
}

const QUALITY_LABELS: Record<string, string> = {
  GREEN: 'Alta',
  YELLOW: 'Média',
  RED: 'Baixa',
  UNKNOWN: 'Sem dados',
}

const qualityClasses: Record<string, string> = {
  GREEN:
    'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400',
  YELLOW:
    'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
  RED: 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400',
}

/** Espelho da Meta: `null` significa que o modelo nunca foi enviado. */
export const TemplateStatusBadge = ({ status }: { status: string | null }) => {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Não enviado
      </Badge>
    )
  }

  const normalized = status.toUpperCase()

  return (
    <Badge variant="outline" className={remoteStatusClasses[normalized]}>
      {REMOTE_STATUS_LABELS[normalized] ?? status}
    </Badge>
  )
}

/** Sinaliza alterações locais ainda não enviadas — independe do status remoto. */
export const LocalDraftBadge = () => (
  <Badge variant="secondary">Rascunho local</Badge>
)

export const TemplateQualityBadge = ({
  quality,
}: {
  quality: string | null
}) => {
  if (!quality) return <span className="text-muted-foreground text-sm">--</span>

  const normalized = quality.toUpperCase()

  return (
    <Badge variant="outline" className={qualityClasses[normalized]}>
      {QUALITY_LABELS[normalized] ?? quality}
    </Badge>
  )
}

const fullDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatTemplateDate = (value: Date | string | null) =>
  value ? fullDate.format(value instanceof Date ? value : new Date(value)) : '--'

export const apiErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'string'
    ? error
    : ((error as { message?: string } | null)?.message ?? fallback)
