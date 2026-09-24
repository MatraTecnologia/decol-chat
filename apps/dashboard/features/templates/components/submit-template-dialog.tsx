'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  getWhatsappTemplateOptions,
  submitWhatsappTemplateMutation,
  validateWhatsappTemplateRevisionMutation,
} from '@workspace/api-client/react-query'

import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

import {
  apiErrorMessage,
  CATEGORY_LABELS,
  languageLabel,
} from './template-status-badge'

import type { TemplateTarget } from './template-table'

interface ValidationIssue {
  path: string
  message: string
}

interface SubmitTemplateDialogProps {
  target: TemplateTarget | null
  onClose: () => void
  onEdit: (target: TemplateTarget) => void
}

/** Itens de lista: o índice seguinte vira "Botão 2". */
const ITEM_LABELS: Record<string, string> = {
  components: 'Componente',
  buttons: 'Botão',
  cards: 'Cartão',
}

const FIELD_LABELS: Record<string, string> = {
  components: 'componentes',
  buttons: 'botões',
  cards: 'cartões',
  text: 'texto',
  examples: 'exemplos',
  format: 'formato',
  url: 'URL',
  phoneNumber: 'telefone',
  language: 'idioma',
  category: 'categoria',
}

/** `components.0.buttons.1.text` → `Componente 1 › Botão 2 › texto`. */
const formatIssuePath = (path: string) => {
  const segments = path.split('.')
  const parts: string[] = []

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index] ?? ''
    const next = segments[index + 1]
    const item = ITEM_LABELS[segment]

    if (item && next !== undefined && /^\d+$/.test(next)) {
      parts.push(`${item} ${Number(next) + 1}`)
      index++
    } else {
      parts.push(FIELD_LABELS[segment] ?? segment)
    }
  }

  return parts.join(' › ')
}

const Attribute = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
    <span className="min-w-0 text-right text-xs font-medium break-words">
      {value}
    </span>
  </div>
)

export const SubmitTemplateDialog = ({
  target,
  onClose,
  onEdit,
}: SubmitTemplateDialogProps) => {
  const queryClient = useQueryClient()
  const [issues, setIssues] = useState<ValidationIssue[]>([])

  // O Radix mantém o conteúdo montado durante a animação de saída; sem guardar
  // o último alvo, o resumo piscaria vazio enquanto o diálogo fecha.
  const [rendered, setRendered] = useState(target)

  if (target && target !== rendered) setRendered(target)

  const { data: detail, isPending } = useQuery({
    ...getWhatsappTemplateOptions({ path: { id: rendered?.id ?? '' } }),
    enabled: Boolean(rendered),
    placeholderData: undefined,
  })

  const validate = useMutation(validateWhatsappTemplateRevisionMutation())

  const submit = useMutation({
    ...submitWhatsappTemplateMutation(),
    onSuccess: () => {
      toast.success('Modelo enviado. A Meta iniciou a análise.')
      invalidateByTags(queryClient, ['WhatsAppTemplates'])
      onClose()
    },
    onError: error => {
      toast.error(apiErrorMessage(error, 'Não foi possível enviar o modelo'))
    },
  })

  const isBusy = validate.isPending || submit.isPending

  const handleClose = () => {
    if (isBusy) return

    setIssues([])
    validate.reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!rendered?.draftRevisionId || !detail?.definition) return

    setIssues([])

    try {
      const result = await validate.mutateAsync({
        body: { definition: detail.definition },
      })

      if (!result.valid) {
        setIssues(result.issues)
        return
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Não foi possível validar o modelo'))
      return
    }

    submit.mutate({
      path: { id: rendered.id },
      body: { idempotencyKey: rendered.draftRevisionId },
    })
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={open => {
        if (!open) handleClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar modelo para aprovação?</DialogTitle>
          <DialogDescription>
            A revisão será congelada e enviada para análise da Meta. Enquanto o
            veredito não sai, o modelo fica em análise e não pode ser usado em
            envios.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <div className="space-y-2 rounded-lg border p-3">
            <Attribute label="Modelo" value={rendered?.name ?? '--'} />
            <Attribute
              label="Idioma"
              value={rendered ? languageLabel(rendered.language) : '--'}
            />
            <Attribute
              label="Categoria"
              value={
                rendered
                  ? (CATEGORY_LABELS[rendered.category] ?? rendered.category)
                  : '--'
              }
            />
            <Attribute
              label="Revisão"
              value={
                rendered?.draftVersion ? `v${rendered.draftVersion}` : '--'
              }
            />
          </div>
        )}

        {issues.length > 0 && (
          <div className="border-destructive/40 space-y-1.5 rounded-lg border p-3">
            <p className="text-destructive flex items-center gap-1.5 text-sm font-medium">
              <AlertTriangle className="size-4" />
              Corrija os pontos abaixo antes de enviar
            </p>
            <ul className="space-y-1">
              {issues.map(issue => (
                <li key={`${issue.path}-${issue.message}`} className="text-xs">
                  {issue.path && (
                    <span className="text-muted-foreground">
                      {formatIssuePath(issue.path)}:{' '}
                    </span>
                  )}
                  {issue.message}
                </li>
              ))}
            </ul>
            {rendered && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleClose()
                  onEdit(rendered)
                }}
              >
                Abrir no editor
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isBusy}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isBusy || isPending || !detail?.definition}
          >
            {isBusy ? 'Enviando...' : 'Validar e enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
