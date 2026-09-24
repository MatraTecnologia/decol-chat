'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { getWhatsappTemplateOptions } from '@workspace/api-client/react-query'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'

import { Spinner } from '@workspace/ui/components/spinner'

import { TemplateEditorForm } from './template-editor-form'
import type { TemplateEditorMode } from './template-editor-form'

const titles: Record<TemplateEditorMode, string> = {
  create: 'Novo modelo',
  edit: 'Editar modelo',
  duplicate: 'Duplicar modelo',
}

const descriptions: Record<TemplateEditorMode, string> = {
  create: 'Monte os componentes e salve como rascunho antes de enviar à Meta.',
  edit: 'As alterações ficam no rascunho até um novo envio para aprovação.',
  duplicate: 'A cópia começa como rascunho, com um nome novo.',
}

interface TemplateEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string | null
  mode: TemplateEditorMode
}

export const TemplateEditorDialog = ({
  open,
  onOpenChange,
  templateId,
  mode,
}: TemplateEditorDialogProps) => {
  const query = useQuery({
    ...getWhatsappTemplateOptions({ path: { id: templateId ?? '' } }),
    enabled: open && Boolean(templateId),
    // Sem isso o `keepPreviousData` global entregaria o último modelo aberto
    // ao "Novo modelo", cuja query fica desabilitada.
    placeholderData: undefined,
  })

  const [dirty, setDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const close = () => {
    setDirty(false)
    setConfirmDiscard(false)
    onOpenChange(false)
  }

  // Esc, clique fora e "Cancelar" passam por aqui; salvar fecha direto.
  const requestClose = () => {
    if (dirty) {
      setConfirmDiscard(true)
      return
    }

    close()
  }

  // `keepPreviousData` é global: sem checar o placeholder, o editor abriria com
  // os dados do modelo anterior.
  const isLoading =
    Boolean(templateId) && (query.isPending || query.isPlaceholderData)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={next => {
          if (next) onOpenChange(true)
          else requestClose()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{titles[mode]}</DialogTitle>
            <DialogDescription>{descriptions[mode]}</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16">
              <Spinner />
              <span className="text-muted-foreground text-sm">
                Carregando modelo...
              </span>
            </div>
          ) : query.isError ? (
            <p className="text-destructive py-16 text-center text-sm">
              Não foi possível carregar o modelo.
            </p>
          ) : (
            <TemplateEditorForm
              key={templateId ?? 'create'}
              template={query.data ?? null}
              mode={mode}
              onClose={close}
              onCancel={requestClose}
              onDirtyChange={setDirty}
              onReload={async () => (await query.refetch()).data}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              O que foi editado desde o último salvamento será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={close}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
