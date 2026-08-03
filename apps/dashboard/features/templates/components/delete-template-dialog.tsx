'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  deleteWhatsappTemplateDraftMutation,
  deleteWhatsappTemplateRemoteMutation,
} from '@workspace/api-client/react-query'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

import { apiErrorMessage } from './template-status-badge'

import type { TemplateTarget } from './template-table'

export type DeleteScope = 'local' | 'remote'

interface DeleteTemplateDialogProps {
  target: TemplateTarget | null
  scope: DeleteScope
  onClose: () => void
}

export const DeleteTemplateDialog = ({
  target,
  scope,
  onClose,
}: DeleteTemplateDialogProps) => {
  const queryClient = useQueryClient()
  const [confirmName, setConfirmName] = useState('')

  // O Radix mantém o conteúdo montado durante a animação de saída; sem guardar
  // o último alvo, o nome do modelo sumiria do texto enquanto o diálogo fecha.
  const [rendered, setRendered] = useState(target)

  if (target && target !== rendered) setRendered(target)

  const finish = (message: string) => {
    toast.success(message)
    invalidateByTags(queryClient, ['WhatsAppTemplates'])
    setConfirmName('')
    onClose()
  }

  const deleteDraft = useMutation({
    ...deleteWhatsappTemplateDraftMutation(),
    onSuccess: result => {
      finish(
        result.removedTemplate
          ? 'Modelo removido — ele nunca havia sido enviado à Meta.'
          : 'Rascunho local descartado. A versão publicada na Meta segue intacta.',
      )
    },
    onError: error => {
      toast.error(apiErrorMessage(error, 'Não foi possível excluir o rascunho'))
    },
  })

  // Sem update otimista: em falha a linha continua como está e a mensagem da
  // Meta aparece no toast.
  const deleteRemote = useMutation({
    ...deleteWhatsappTemplateRemoteMutation(),
    onSuccess: () => {
      finish('Modelo excluído na Meta. O histórico local foi preservado.')
    },
    onError: error => {
      toast.error(
        apiErrorMessage(error, 'A Meta recusou a exclusão do modelo'),
      )
    },
  })

  const isPending = deleteDraft.isPending || deleteRemote.isPending
  const isRemote = scope === 'remote'
  const canConfirm = !isRemote || confirmName.trim() === rendered?.name

  const handleClose = () => {
    if (isPending) return

    setConfirmName('')
    onClose()
  }

  const handleConfirm = () => {
    if (!rendered || !canConfirm) return

    if (isRemote) {
      deleteRemote.mutate({ path: { id: rendered.id } })
      return
    }

    deleteDraft.mutate({ path: { id: rendered.id } })
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
          <DialogTitle>
            {isRemote ? 'Excluir modelo na Meta?' : 'Excluir rascunho local?'}
          </DialogTitle>
          <DialogDescription>
            {isRemote
              ? `O modelo "${rendered?.name}" será apagado na Meta e deixa de poder ser enviado. O histórico de revisões continua disponível aqui.`
              : `Somente o rascunho não enviado de "${rendered?.name}" será removido. Revisões já enviadas e o espelho da Meta permanecem.`}
          </DialogDescription>
        </DialogHeader>

        {isRemote && (
          <div className="space-y-2">
            <Label htmlFor="confirm-template-name">
              Digite <span className="font-mono">{rendered?.name}</span> para
              confirmar
            </Label>
            <Input
              id="confirm-template-name"
              value={confirmName}
              onChange={event => setConfirmName(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending || !canConfirm}
          >
            {isPending ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
