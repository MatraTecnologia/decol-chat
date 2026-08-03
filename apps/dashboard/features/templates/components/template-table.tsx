'use client'

import {
  CloudUpload,
  Copy,
  MoreHorizontal,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react'

import type { ListWhatsappTemplatesResponse } from '@workspace/api-client/types'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

import {
  CATEGORY_LABELS,
  formatTemplateDate,
  LocalDraftBadge,
  TemplateQualityBadge,
  TemplateStatusBadge,
} from './template-status-badge'

export type TemplateRow = ListWhatsappTemplatesResponse['data'][number]

/** Recorte que dialogs de envio e exclusão precisam — linha e detalhe servem. */
export interface TemplateTarget {
  id: string
  name: string
  language: string
  category: string
  metaTemplateId: string | null
  draftRevisionId: string | null
  draftVersion: number | null
}

interface TemplateLike {
  id: string
  name: string
  language: string
  category: string
  metaTemplateId: string | null
  draftRevision: { id: string; version: number } | null
}

export const toTemplateTarget = (template: TemplateLike): TemplateTarget => ({
  id: template.id,
  name: template.name,
  language: template.language,
  category: template.category,
  metaTemplateId: template.metaTemplateId,
  draftRevisionId: template.draftRevision?.id ?? null,
  draftVersion: template.draftRevision?.version ?? null,
})

interface TemplateTableProps {
  templates: TemplateRow[]
  canManage: boolean
  onSelect: (id: string) => void
  onEdit: (target: TemplateTarget) => void
  onDuplicate: (target: TemplateTarget) => void
  onSubmit: (target: TemplateTarget) => void
  onDeleteDraft: (target: TemplateTarget) => void
  onDeleteRemote: (target: TemplateTarget) => void
}

export const TemplateTable = ({
  templates,
  canManage,
  onSelect,
  onEdit,
  onDuplicate,
  onSubmit,
  onDeleteDraft,
  onDeleteRemote,
}: TemplateTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Modelo</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Idioma</TableHead>
          <TableHead>Status na Meta</TableHead>
          <TableHead>Qualidade</TableHead>
          <TableHead>Última sincronização</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map(template => {
          const target = toTemplateTarget(template)
          const hasDraft = target.draftRevisionId !== null

          return (
            <TableRow
              key={template.id}
              onClick={() => onSelect(template.id)}
              className="cursor-pointer"
            >
              <TableCell>
                <div className="min-w-0 space-y-1">
                  <div className="truncate font-medium">{template.name}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {hasDraft && <LocalDraftBadge />}
                    {template.rejectionReason && (
                      <span className="text-destructive inline-flex items-center gap-1 text-xs">
                        <XCircle className="size-3" />
                        {template.rejectionReason}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {CATEGORY_LABELS[template.category] ?? template.category}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{template.language}</Badge>
              </TableCell>
              <TableCell>
                <TemplateStatusBadge status={template.remoteStatus} />
              </TableCell>
              <TableCell>
                <TemplateQualityBadge quality={template.remoteQuality} />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatTemplateDate(template.lastSyncAttemptAt)}
                {template.lastSyncError && (
                  <div className="text-destructive text-xs">
                    {template.lastSyncError}
                  </div>
                )}
              </TableCell>
              <TableCell onClick={event => event.stopPropagation()}>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(target)}>
                        <Pencil className="size-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicate(target)}>
                        <Copy className="size-4" />
                        Duplicar
                      </DropdownMenuItem>
                      {hasDraft && (
                        <DropdownMenuItem onClick={() => onSubmit(target)}>
                          <CloudUpload className="size-4" />
                          Enviar para aprovação
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      {hasDraft && (
                        <DropdownMenuItem
                          onClick={() => onDeleteDraft(target)}
                          className="text-destructive"
                        >
                          <Trash2 className="size-4" />
                          Excluir rascunho local
                        </DropdownMenuItem>
                      )}
                      {target.metaTemplateId && (
                        <DropdownMenuItem
                          onClick={() => onDeleteRemote(target)}
                          className="text-destructive"
                        >
                          <Trash2 className="size-4" />
                          Excluir na Meta
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
