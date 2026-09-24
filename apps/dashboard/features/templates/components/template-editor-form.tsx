'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Braces, LayoutTemplate } from 'lucide-react'
import { useEffect, useState } from 'react'
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

/**
 * O contrato compartilhado não traz mensagem própria nos `.min(1)`; sem isso o
 * usuário veria o texto padrão do zod, em inglês.
 */
const formErrorMap: z.core.$ZodErrorMap = issue => {
  if (issue.code !== 'too_small') return undefined
  if (issue.origin === 'string') return 'Preencha este campo.'
  if (issue.origin === 'array') return 'Adicione pelo menos um item.'
  return undefined
}

const statusOf = (error: unknown) =>
  (error as { statusCode?: unknown } | null)?.statusCode

const errorText = (error: unknown, fallback: string) => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof statusOf(error) === 'number' && typeof message === 'string'
    ? message || fallback
    : fallback
}

const MEDIA_FORMATS = ['IMAGE', 'VIDEO', 'DOCUMENT']

const needsMedia = (definition: TemplateDefinition) =>
  definition.components.some(
    component =>
      component.type === 'CAROUSEL' ||
      (component.type === 'HEADER' && MEDIA_FORMATS.includes(component.format)),
  )

const duplicatedName = (name: string) => `${name}_copia`.slice(0, 512)

const toFormValues = (
  template: LoadedTemplate | null,
  mode: TemplateEditorMode,
): TemplateFormValues => {
  if (!template) return { name: '', definition: emptyDefinition }

  return {
    name: mode === 'duplicate' ? duplicatedName(template.name) : template.name,
    // Espelho remoto que não passou no schema chega sem definição; o idioma e a
    // categoria da linha continuam valendo, já que o idioma não pode mudar.
    definition: (template.definition as TemplateDefinition) ?? {
      ...emptyDefinition,
      language: template.language,
      category: template.category as TemplateDefinition['category'],
    },
  }
}

interface TemplateEditorFormProps {
  template: LoadedTemplate | null
  mode: TemplateEditorMode
  onClose: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onReload: () => Promise<LoadedTemplate | undefined>
}

export const TemplateEditorForm = ({
  template,
  mode,
  onClose,
  onCancel,
  onDirtyChange,
  onReload,
}: TemplateEditorFormProps) => {
  const queryClient = useQueryClient()

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema, { error: formErrorMap }),
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

  // O texto do modo JSON não está no formulário: abrir o modo já conta.
  const isDirty = form.formState.isDirty || jsonMode

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  // Na duplicação o rascunho aberto é o da origem: mídia enviada ali ficaria
  // presa à revisão de outro modelo.
  const revisionId =
    mode === 'duplicate' ? null : (template?.draftRevision?.id ?? null)

  /**
   * 409 na edição é a trava otimista; na criação e na duplicação é nome já em
   * uso neste idioma, e a mensagem vai para o campo.
   */
  const onMutationError = (error: unknown, fallback: string) => {
    if (statusOf(error) !== 409) {
      toast.error(errorText(error, fallback))
      return
    }

    if (mode === 'edit') {
      setConflict(true)
      return
    }

    form.setError('name', { message: errorText(error, fallback) })
    form.setFocus('name')
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
      toast.success(
        needsMedia(values.definition)
          ? 'Rascunho criado. Abra-o em Editar para enviar a mídia de exemplo.'
          : 'Rascunho criado.',
      )
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

      toast.success(
        needsMedia(values.definition)
          ? 'Modelo duplicado. Abra a cópia em Editar para enviar a mídia de exemplo.'
          : 'Modelo duplicado.',
      )
      finish()
      return
    }

    const saved = await updateMutation.mutateAsync({
      path: { id: template.id },
      body: { expectedLockVersion: lockVersion, definition: values.definition },
    })

    // A mídia de exemplo só pode ser enviada para um rascunho: se ele acabou de
    // nascer e o modelo pede mídia, o editor continua aberto sobre ele.
    if (!revisionId && needsMedia(values.definition)) {
      const fresh = await onReload()
      if (fresh) {
        form.reset(toFormValues(fresh, mode))
        setLockVersion(fresh.latestRevision?.lockVersion ?? 0)
        invalidateByTags(queryClient, ['WhatsAppTemplates'])
        toast.success('Rascunho salvo. Agora envie a mídia de exemplo.')
        return
      }
    }

    setLockVersion(saved.latestRevision?.lockVersion ?? lockVersion)
    toast.success('Rascunho salvo.')
    finish()
  }

  const validateAndSubmit = form.handleSubmit(
    async values => {
      try {
        await submit(values)
      } catch {
        // O estado de erro já foi tratado no `onError` de cada mutation.
      }
    },
    () => {
      // Os sub-editores não usam `register`, então o RHF não sabe onde focar:
      // leva o primeiro erro para a área visível do diálogo.
      toast.error('Corrija os campos destacados antes de salvar.')
      requestAnimationFrame(() => {
        document
          .querySelector('[data-field-error], [data-slot="form-message"]')
          ?.scrollIntoView({ block: 'center' })
      })
    },
  )

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
            <AlertTitle>
              O modelo mudou desde que você abriu o editor
            </AlertTitle>
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
              languageDisabled={mode !== 'create'}
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

        <DialogFooter className="bg-background sticky bottom-0 -mx-6 -mb-6 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
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
