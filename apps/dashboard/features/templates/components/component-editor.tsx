'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useWatch } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@workspace/ui/components/button'
import { Textarea } from '@workspace/ui/components/textarea'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'

import { BodyEditor, FooterEditor } from './body-editor'
import { ButtonsEditor } from './buttons-editor'
import { CarouselEditor } from './carousel-editor'
import { HeaderEditor } from './header-editor'
import { LimitedTimeOfferEditor } from './limited-time-offer-editor'

import type {
  ErrorFor,
  SetField,
  TemplateComponentValue,
  TemplateFormValues,
} from './template-editor-form'

const labels: Record<TemplateComponentValue['type'], string> = {
  HEADER: 'Cabeçalho',
  BODY: 'Corpo',
  FOOTER: 'Rodapé',
  BUTTONS: 'Botões',
  CAROUSEL: 'Carrossel',
  LIMITED_TIME_OFFER: 'Oferta por tempo limitado',
  CUSTOM: 'JSON avançado',
}

const defaultsFor = (
  type: TemplateComponentValue['type'],
): TemplateComponentValue => {
  switch (type) {
    case 'HEADER':
      return { type: 'HEADER', format: 'TEXT', text: '', examples: [] }
    case 'FOOTER':
      return { type: 'FOOTER', text: '' }
    case 'BUTTONS':
      return { type: 'BUTTONS', buttons: [{ kind: 'QUICK_REPLY', text: '' }] }
    case 'CAROUSEL':
      return {
        type: 'CAROUSEL',
        cards: [
          {
            header: { format: 'IMAGE' },
            body: { text: '', examples: [] },
            buttons: [],
          },
        ],
      }
    case 'LIMITED_TIME_OFFER':
      return { type: 'LIMITED_TIME_OFFER', text: '', hasExpiration: false }
    case 'CUSTOM':
      return { type: 'CUSTOM', raw: {} }
    default:
      return { type: 'BODY', text: '', examples: [] }
  }
}

const messageAt = (errors: unknown, path: string) => {
  let node: unknown = errors

  for (const key of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[key]
  }

  const message = (node as { message?: unknown } | null)?.message
  return typeof message === 'string' ? message : undefined
}

export const makeSetter =
  (form: UseFormReturn<TemplateFormValues>, base: string): SetField =>
  (suffix, value) =>
    form.setValue(
      (suffix ? `${base}.${suffix}` : base) as 'definition',
      value as never,
      { shouldDirty: true },
    )

export const makeErrorFor =
  (errors: unknown, base: string): ErrorFor =>
  suffix =>
    messageAt(errors, suffix ? `${base}.${suffix}` : base)

const RawComponent = ({
  raw,
  set,
  disabled,
}: {
  raw: Record<string, unknown>
  set: SetField
  disabled: boolean
}) => (
  <Textarea
    rows={6}
    spellCheck={false}
    disabled={disabled}
    className="font-mono text-xs"
    defaultValue={JSON.stringify(raw ?? {}, null, 2)}
    onBlur={event => {
      try {
        set('raw', JSON.parse(event.target.value || '{}'))
      } catch {
        set('raw', raw ?? {})
      }
    }}
  />
)

interface ComponentEditorProps {
  form: UseFormReturn<TemplateFormValues>
  revisionId: string | null
  disabled: boolean
}

export const ComponentEditor = ({
  form,
  revisionId,
  disabled,
}: ComponentEditorProps) => {
  const { fields, append, remove, move, update } = useFieldArray({
    control: form.control,
    name: 'definition.components',
  })

  const components = useWatch({
    control: form.control,
    name: 'definition.components',
  })

  const renderComponent = (
    component: TemplateComponentValue,
    index: number,
  ) => {
    const base = `definition.components.${index}`
    const set = makeSetter(form, base)
    const errorFor = makeErrorFor(form.formState.errors, base)
    const shared = { set, errorFor, disabled }

    switch (component.type) {
      case 'HEADER':
        return (
          <HeaderEditor
            {...shared}
            value={component}
            revisionId={revisionId}
            onFormatChange={next => update(index, next)}
          />
        )
      case 'BODY':
        return <BodyEditor {...shared} value={component} />
      case 'FOOTER':
        return <FooterEditor {...shared} value={component} />
      case 'BUTTONS':
        return (
          <ButtonsEditor
            {...shared}
            form={form}
            basePath={base}
            buttons={component.buttons}
          />
        )
      case 'CAROUSEL':
        return (
          <CarouselEditor
            {...shared}
            form={form}
            basePath={base}
            cards={component.cards}
            revisionId={revisionId}
          />
        )
      case 'LIMITED_TIME_OFFER':
        return <LimitedTimeOfferEditor {...shared} value={component} />
      default:
        return (
          <RawComponent raw={component.raw} set={set} disabled={disabled} />
        )
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => {
        const component = components?.[index]
        if (!component) return null

        return (
          // O índice entra na chave porque os editores aninhados registram
          // `useFieldArray` por caminho: reordenar precisa remontar.
          <div key={`${field.id}-${index}`} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {labels[component.type]}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, index - 1)}
                  aria-label="Mover para cima"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label="Mover para baixo"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  aria-label="Remover componente"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {renderComponent(component, index)}
          </div>
        )
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <Plus className="size-4" />
            Adicionar componente
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(Object.keys(labels) as TemplateComponentValue['type'][]).map(
            type => (
              <DropdownMenuItem
                key={type}
                onSelect={() => append(defaultsFor(type))}
              >
                {labels[type]}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
