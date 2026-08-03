'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Braces, LayoutTemplate } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { templateDefinitionSchema } from '@workspace/shared/whatsapp-templates'
import type { TemplateDefinition } from '@workspace/shared/whatsapp-templates'

import {
  createWhatsappTemplateDraftMutation,
  duplicateWhatsappTemplateMutation,
  updateWhatsappTemplateDraftMutation,
} from '@workspace/api-client/react-query'

import type { GetWhatsappTemplateResponse } from '@workspace/api-client/types'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/alert'

import { Button } from '@workspace/ui/components/button'
import { DialogFooter } from '@workspace/ui/components/dialog'
import { Form } from '@workspace/ui/components/form'
import { Spinner } from '@workspace/ui/components/spinner'

import { invalidateByTags } from '@/lib/invalidate-by-tags'

import {
  formatAdvancedDefinition,
  parseAdvancedDefinition,
} from '../lib/json-mode'

import type { AdvancedDefinitionError } from '../lib/json-mode'

import { ComponentEditor } from './component-editor'
import { JsonEditor } from './json-editor'
import { TemplateIdentityFields } from './template-identity-fields'
import { TemplatePreview } from './template-preview'

/** Espelha `templateNameSchema` da API — a Meta só aceita este formato. */
export const templateNameSchema = z
  .string()
  .min(1, 'Informe o nome do modelo.')
  .max(512)
  .regex(
    /^[a-z0-9_]+$/,
    'Use apenas letras minúsculas, números e underline no nome.',
  )

export const templateFormSchema = z.object({
  name: templateNameSchema,
  definition: templateDefinitionSchema,
})

export type TemplateFormValues = z.infer<typeof templateFormSchema>
export type TemplateComponentValue =
  TemplateDefinition['components'][number]
export type TemplateButtonValue = Extract<
  TemplateComponentValue,
  { type: 'BUTTONS' }
>['buttons'][number]

/** Ponte para o `setValue` do RHF: o caminho só é conhecido em runtime. */
export type SetField = (suffix: string, value: unknown) => void
export type ErrorFor = (suffix?: string) => string | undefined

export type LoadedTemplate = GetWhatsappTemplateResponse
export type TemplateEditorMode = 'create' | 'edit' | 'duplicate'

const emptyDefinition: TemplateDefinition = {
  category: 'MARKETING',
  language: 'pt_BR',
  parameterFormat: 'POSITIONAL',
  components: [{ type: 'BODY', text: '', examples: [] }],
}

const statusOf = (error: unknown) =>
  (error as { statusCode?: unknown } | null)?.statusCode

const errorText = (error: unknown, fallback: string) => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof statusOf(error) === 'number' && typeof message === 'string'
    ? message || fallback
    : fallback
}

const duplicatedName = (name: string) => `${name}_copia`.slice(0, 512)

const toFormValues = (
  template: LoadedTemplate | null,
  mode: TemplateEditorMode,
): TemplateFormValues => {
  if (!template) return { name: '', definition: emptyDefinition }

  return {
    name: mode === 'duplicate' ? duplicatedName(template.name) : template.name,
    definition: (template.definition as TemplateDefinition) ?? emptyDefinition,
  }
}

interface TemplateEditorFormProps {
  template: LoadedTemplate | null
  mode: TemplateEditorMode
  onClose: () => void
  onReload: () => Promise<LoadedTemplate | undefined>
}

export const TemplateEditorForm = ({
  template,
  mode,
  onClose,
  onReload,
}: TemplateEditorFormProps) => {
  const queryClient = useQueryClient()

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: toFormValues(template, mode),
  })

  const [lockVersion, setLockVersion] = useState(
    template?.latestRevision?.lockVersion ?? 0,
  )
  const [conflict, setConflict] = useState(false)
  const [jsonMode, setJsonMode] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<AdvancedDefinitionError | null>(
    null,
  )

  const definition = useWatch({ control: form.control, name: 'definition' })
  const revisionId = template?.draftRevision?.id ?? null

  const onMutationError = (error: unknown, fallback: string) => {
    if (statusOf(error) === 409) {
      setConflict(true)
      return
    }
    toast.error(errorText(error, fallback))
  }

  const createMutation = useMutation({
    ...createWhatsappTemplateDraftMutation(),
    onError: error =>
      onMutationError(error, 'Não foi possível criar o modelo.'),
  })
  const updateMutation = useMutation({
    ...updateWhatsappTemplateDraftMutation(),
    onError: error =>
      onMutationError(error, 'Não foi possível salvar o rascunho.'),
  })
  const duplicateMutation = useMutation({
    ...duplicateWhatsappTemplateMutation(),
    onError: error =>
      onMutationError(error, 'Não foi possível duplicar o modelo.'),
  })

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    duplicateMutation.isPending

  const openJsonMode = () => {
    setJsonText(formatAdvancedDefinition(form.getValues('definition')))
    setJsonError(null)
    setJsonMode(true)
  }

  /** Só volta ao visual com JSON válido — o conteúdo digitado nunca é jogado fora. */
  const applyJsonMode = () => {
    const result = parseAdvancedDefinition(jsonText)
    if (!result.success) {
      setJsonError(result.error)
      return false
    }

    form.setValue('definition', result.data, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setJsonError(null)
    setJsonMode(false)
    return true
  }

  const handleReload = async () => {
    const fresh = await onReload()
    if (!fresh) return

    form.reset(toFormValues(fresh, mode))
    setLockVersion(fresh.latestRevision?.lockVersion ?? 0)
    setJsonMode(false)
    setConflict(false)
    toast.success('Última revisão carregada.')
  }

  const finish = () => {
    invalidateByTags(queryClient, ['WhatsAppTemplates'])
    onClose()
  }

  const submit = async (values: TemplateFormValues) => {
    setConflict(false)

    if (mode === 'create') {
      await createMutation.mutateAsync({ body: values })
      toast.success('Rascunho criado.')
      finish()
      return
    }

    if (!template) return

    if (mode === 'duplicate') {
      const copy = await duplicateMutation.mutateAsync({
        path: { id: template.id },
        body: { name: values.name },
      })

      const changed =
        JSON.stringify(values.definition) !== JSON.stringify(template.definition)

      if (changed) {
        await updateMutation.mutateAsync({
          path: { id: copy.id },
          body: {
            expectedLockVersion: copy.latestRevision?.lockVersion ?? 0,
            definition: values.definition,
          },
        })
      }

      toast.success('Modelo duplicado.')
      finish()
      return
    }

    const saved = await updateMutation.mutateAsync({
      path: { id: template.id },
      body: { expectedLockVersion: lockVersion, definition: values.definition },
    })

    setLockVersion(saved.latestRevision?.lockVersion ?? lockVersion)
    toast.success('Rascunho salvo.')
    finish()
  }

  const validateAndSubmit = form.handleSubmit(async values => {
    try {
      await submit(values)
    } catch {
      // O estado de erro já foi tratado no `onError` de cada mutation.
    }
  })

  /**
   * No modo JSON o formulário ainda guarda a versão anterior: aplicar antes de
   * validar evita salvar conteúdo velho — e o JSON inválido barra o envio.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (jsonMode && !applyJsonMode()) return

    void validateAndSubmit()
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {conflict && (
          <Alert variant="destructive">
            <AlertTitle>O modelo mudou desde que você abriu o editor</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>
                Suas alterações continuam aqui. Recarregue a última revisão para
                partir do conteúdo atual — isso substitui o formulário.
              </span>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleReload}>
                  Recarregar última revisão
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConflict(false)}
                >
                  Manter minhas alterações
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <TemplateIdentityFields
              control={form.control}
              nameDisabled={mode === 'edit'}
              disabled={isPending}
            />

            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Componentes</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (jsonMode ? applyJsonMode() : openJsonMode())}
              >
                {jsonMode ? (
                  <>
                    <LayoutTemplate className="size-4" />
                    Editor visual
                  </>
                ) : (
                  <>
                    <Braces className="size-4" />
                    JSON avançado
                  </>
                )}
              </Button>
            </div>

            {jsonMode ? (
              <JsonEditor
                value={jsonText}
                onChange={value => {
                  setJsonText(value)
                  setJsonError(null)
                }}
                error={jsonError}
                onValidate={applyJsonMode}
              />
            ) : (
              <ComponentEditor
                form={form}
                revisionId={revisionId}
                disabled={isPending}
              />
            )}
          </div>

          <TemplatePreview definition={definition} />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner className="mr-2" />}
            {mode === 'duplicate' ? 'Duplicar modelo' : 'Salvar rascunho'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
