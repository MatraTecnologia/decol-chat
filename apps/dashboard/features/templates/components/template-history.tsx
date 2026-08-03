'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { listWhatsappTemplateRevisionsOptions } from '@workspace/api-client/react-query'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible'

import { TemplateRevisionDiff } from './template-revision-diff'
import {
  formatTemplateDate,
  REVISION_STATE_LABELS,
} from './template-status-badge'

interface TemplateHistoryProps {
  templateId: string
}

/** Revisões chegam da API em ordem decrescente de versão (`repository.ts`). */
export const TemplateHistory = ({ templateId }: TemplateHistoryProps) => {
  const [openPath, setOpenPath] = useState<string | null>(null)

  const { data, isPending, isError } = useQuery({
    ...listWhatsappTemplateRevisionsOptions({ path: { id: templateId } }),
    placeholderData: undefined,
  })

  if (isError) {
    return (
      <p className="text-muted-foreground text-sm">
        Não foi possível carregar o histórico de revisões.
      </p>
    )
  }

  if (isPending || !data) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  const revisions = data.data

  if (revisions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhuma revisão registrada até agora.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {revisions.map((revision, index) => {
        const previous = revisions[index + 1]

        return (
          <li key={revision.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">v{revision.version}</span>
              <Badge variant="outline">
                {REVISION_STATE_LABELS[revision.state] ?? revision.state}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {revision.parameterFormat === 'NAMED'
                  ? 'Variáveis nomeadas'
                  : 'Variáveis posicionais'}
              </span>
            </div>

            <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
              <p>Criada em {formatTemplateDate(revision.createdAt)}</p>
              {revision.submittedAt && (
                <p>
                  Enviada em {formatTemplateDate(revision.submittedAt)} por{' '}
                  {revision.submittedById ?? 'autor desconhecido'}
                </p>
              )}
            </div>

            {previous && (
              <Collapsible
                open={openPath === revision.id}
                onOpenChange={open => setOpenPath(open ? revision.id : null)}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="mt-2 -ml-2">
                    <ChevronDown className="size-4" />
                    Comparar com a v{previous.version}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <TemplateRevisionDiff
                    before={previous.definition}
                    after={revision.definition}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}
          </li>
        )
      })}
    </ul>
  )
}
