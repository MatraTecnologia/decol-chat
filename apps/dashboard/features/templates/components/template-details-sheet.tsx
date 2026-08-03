'use client'

import { useQuery } from '@tanstack/react-query'
import { CloudUpload, Copy, Pencil, SearchX, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { getWhatsappTemplateOptions } from '@workspace/api-client/react-query'

import { Button } from '@workspace/ui/components/button'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet'

import { TemplateHistory } from './template-history'
import {
  CATEGORY_LABELS,
  formatTemplateDate,
  LocalDraftBadge,
  TemplateQualityBadge,
  TemplateStatusBadge,
} from './template-status-badge'
import { type TemplateTarget, toTemplateTarget } from './template-table'

interface TemplateDetailsSheetProps {
  templateId: string | null
  canManage: boolean
  onClose: () => void
  onEdit: (target: TemplateTarget) => void
  onDuplicate: (target: TemplateTarget) => void
  onSubmit: (target: TemplateTarget) => void
  onDeleteDraft: (target: TemplateTarget) => void
  onDeleteRemote: (target: TemplateTarget) => void
}

const Attribute = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
    <div className="min-w-0 text-right text-xs font-medium break-words">
      {children}
    </div>
  </div>
)

export const TemplateDetailsSheet = ({
  templateId,
  canManage,
  onClose,
  onEdit,
  onDuplicate,
  onSubmit,
  onDeleteDraft,
  onDeleteRemote,
}: TemplateDetailsSheetProps) => {
  // O Radix mantém o conteúdo montado durante a animação de saída; sem guardar
  // o último id, o painel piscaria o skeleton enquanto desliza para fora.
  const [renderedId, setRenderedId] = useState(templateId)

  if (templateId && templateId !== renderedId) setRenderedId(templateId)

  const {
    data: template,
    isPending,
    isError,
  } = useQuery({
    ...getWhatsappTemplateOptions({ path: { id: renderedId ?? '' } }),
    enabled: Boolean(renderedId),
    // O `keepPreviousData` global mostraria o modelo anterior enquanto o novo
    // carrega.
    placeholderData: undefined,
  })

  const renderContent = () => {
    if (isError) {
      return (
        <Empty className="border-muted-foreground/20 rounded-lg border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>Modelo indisponível</EmptyTitle>
            <EmptyDescription>
              Este modelo não existe mais ou pertence a outra conta do WhatsApp.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" onClick={onClose}>
            Voltar para o catálogo
          </Button>
        </Empty>
      )
    }

    if (isPending || !template) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )
    }

    const target = toTemplateTarget(template)
    const hasDraft = target.draftRevisionId !== null

    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="font-medium break-words">{template.name}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <TemplateStatusBadge status={template.remoteStatus} />
            {hasDraft && <LocalDraftBadge />}
          </div>
        </div>

        <div className="space-y-2">
          <Attribute label="ID na Meta">
            {template.metaTemplateId ?? 'Ainda não enviado'}
          </Attribute>
          <Attribute label="Idioma">{template.language}</Attribute>
          <Attribute label="Categoria">
            {CATEGORY_LABELS[template.category] ?? template.category}
          </Attribute>
          <Attribute label="Qualidade">
            <TemplateQualityBadge quality={template.remoteQuality} />
          </Attribute>
          <Attribute label="Rascunho local">
            {target.draftVersion ? `v${target.draftVersion}` : 'Nenhum'}
          </Attribute>
          <Attribute label="Revisão enviada">
            {template.submittedRevision
              ? `v${template.submittedRevision.version}`
              : 'Nenhuma'}
          </Attribute>
          <Attribute label="Atualizado na Meta">
            {formatTemplateDate(template.remoteUpdatedAt)}
          </Attribute>
          <Attribute label="Última sincronização">
            {formatTemplateDate(template.lastSyncAttemptAt)}
          </Attribute>
        </div>

        {template.rejectionReason && (
          <div className="border-destructive/40 rounded-lg border p-3">
            <p className="text-destructive text-xs font-medium">
              Motivo da reprovação
            </p>
            <p className="mt-1 text-xs break-words">
              {template.rejectionReason}
            </p>
          </div>
        )}

        {template.lastSyncError && (
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium">
              Erro na última sincronização
            </p>
            <p className="mt-1 text-xs break-words">{template.lastSyncError}</p>
          </div>
        )}

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(target)}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDuplicate(target)}
            >
              <Copy className="size-4" />
              Duplicar
            </Button>
            {hasDraft && (
              <Button size="sm" onClick={() => onSubmit(target)}>
                <CloudUpload className="size-4" />
                Enviar
              </Button>
            )}
            {hasDraft && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeleteDraft(target)}
              >
                <Trash2 className="size-4" />
                Excluir rascunho
              </Button>
            )}
            {target.metaTemplateId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDeleteRemote(target)}
              >
                <Trash2 className="size-4" />
                Excluir na Meta
              </Button>
            )}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Histórico de revisões (imutável)
          </p>
          <TemplateHistory templateId={template.id} />
        </div>
      </div>
    )
  }

  return (
    <Sheet
      open={Boolean(templateId)}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Detalhes do modelo</SheetTitle>
          <SheetDescription>
            Estado local, espelho da Meta e histórico de revisões.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  )
}
