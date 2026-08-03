'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Label } from '@workspace/ui/components/label'
import { Spinner } from '@workspace/ui/components/spinner'

import { ApprovedTemplatePicker } from '@/features/templates/components/approved-template-picker'
import {
  TemplateParameterForm,
  useTemplateParameters,
} from '@/features/templates/components/template-parameter-form'

import { errorText } from '../../lib/api-error'
import { useSendTemplateMessage } from './use-send-message'

interface SendTemplateDialogProps {
  conversationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Modelo já escolhido fora do diálogo (comando `/template:` do composer). */
  initialTemplateId?: string | null
}

export const SendTemplateDialog = ({
  conversationId,
  open,
  onOpenChange,
  initialTemplateId = null,
}: SendTemplateDialogProps) => {
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId)
  const sendTemplate = useSendTemplateMessage(conversationId)
  const parameters = useTemplateParameters(templateId)

  // O composer troca o modelo com o diálogo já montado; seguir a prop mantém a
  // escolha do comando sem um efeito que dispara render em cascata.
  const [lastInitial, setLastInitial] = useState(initialTemplateId)

  if (initialTemplateId !== lastInitial) {
    setLastInitial(initialTemplateId)
    setTemplateId(initialTemplateId)
  }

  const closeDialog = () => {
    onOpenChange(false)
    setTemplateId(null)
  }

  const handleSubmit = () => {
    if (!templateId) return

    const result = parameters.build()
    if (!result?.success) return

    sendTemplate.mutate(
      {
        path: { id: conversationId },
        body: { templateId, parameters: result.data },
      },
      {
        onSuccess: closeDialog,
        onError: error => {
          toast.error(errorText(error, 'Não foi possível enviar o template'))
        },
      },
    )
  }

  const canSend =
    Boolean(templateId) && parameters.canSubmit && !sendTemplate.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (next) return onOpenChange(true)
        if (sendTemplate.isPending) return

        closeDialog()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar template</DialogTitle>
          <DialogDescription>
            Fora da janela de 24h só um modelo aprovado pela Meta é entregue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Modelo aprovado</Label>
            <ApprovedTemplatePicker
              value={templateId}
              onChange={template => setTemplateId(template.id)}
              disabled={sendTemplate.isPending}
            />
          </div>

          {templateId && (
            <TemplateParameterForm
              state={parameters}
              disabled={sendTemplate.isPending}
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={!canSend}>
            {sendTemplate.isPending && <Spinner />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
