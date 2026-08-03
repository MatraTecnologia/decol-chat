import type { LucideIcon } from 'lucide-react'
import { CircleAlert, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'

import { paletteCss, RP_SCOPE } from '../lib/chart-palette'

/** Injeta as cores de série como custom properties, com variante escura. */
export const ReportPalette = () => (
  <style dangerouslySetInnerHTML={{ __html: paletteCss }} />
)

interface ReportPanelProps {
  /** Sobretítulo curto que diz de onde o número vem. */
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export const ReportPanel = ({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: ReportPanelProps) => (
  <Card className={cn(RP_SCOPE, className)}>
    <ReportPalette />
    <CardHeader className="gap-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="cn-font-heading text-base leading-snug font-medium">
            {title}
          </h3>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </CardHeader>
    <CardContent className={contentClassName}>{children}</CardContent>
  </Card>
)

interface PanelStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  className?: string
}

/** Período sem movimento — some do gráfico, não da tela. */
export const PanelEmpty = ({
  icon: Icon = Inbox,
  title = 'Sem dados no período',
  description,
  className,
}: Partial<PanelStateProps>) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center',
      className,
    )}
  >
    <Icon className="text-muted-foreground size-5" aria-hidden />
    <p className="text-sm font-medium">{title}</p>
    {description ? (
      <p className="text-muted-foreground max-w-xs text-sm">{description}</p>
    ) : null}
  </div>
)

export const PanelError = ({
  title = 'Não foi possível carregar',
  description,
  className,
}: Partial<PanelStateProps>) => (
  <div
    role="alert"
    className={cn(
      'border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center gap-2 rounded-lg border px-6 py-10 text-center',
      className,
    )}
  >
    <CircleAlert className="text-destructive size-5" aria-hidden />
    <p className="text-sm font-medium">{title}</p>
    {description ? (
      <p className="text-muted-foreground max-w-xs text-sm">{description}</p>
    ) : null}
  </div>
)

export const PanelSkeleton = ({ className }: { className?: string }) => (
  <Skeleton className={cn('h-52 w-full rounded-lg', className)} />
)
