'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useFieldArray } from 'react-hook-form'
import type { FieldArrayPath, UseFormReturn } from 'react-hook-form'

import { Button } from '@workspace/ui/components/button'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

import {
  ExamplesFields,
  FieldError,
  setTextAndExamples,
} from './body-editor'
import { ButtonsEditor } from './buttons-editor'
import { TemplateMediaField } from './template-media-field'

import type {
  ErrorFor,
  SetField,
  TemplateComponentValue,
  TemplateFormValues,
} from './template-editor-form'

type CarouselCard = Extract<
  TemplateComponentValue,
  { type: 'CAROUSEL' }
>['cards'][number]

type CardMediaFormat = CarouselCard['header']['format']

const formats: { value: CardMediaFormat; label: string }[] = [
  { value: 'IMAGE', label: 'Imagem' },
  { value: 'VIDEO', label: 'Vídeo' },
  { value: 'DOCUMENT', label: 'Documento' },
]

const emptyCard: CarouselCard = {
  header: { format: 'IMAGE' },
  body: { text: '', examples: [] },
  buttons: [],
}

interface CarouselEditorProps {
  form: UseFormReturn<TemplateFormValues>
  basePath: string
  cards: CarouselCard[]
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
  revisionId: string | null
}

export const CarouselEditor = ({
  form,
  basePath,
  cards,
  set,
  errorFor,
  disabled,
  revisionId,
}: CarouselEditorProps) => {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: `${basePath}.cards` as FieldArrayPath<TemplateFormValues>,
  })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => {
        const card = cards?.[index]
        if (!card) return null

        const cardSet: SetField = (suffix, value) =>
          set(`cards.${index}.${suffix}`, value)
        const cardError: ErrorFor = suffix =>
          errorFor(`cards.${index}.${suffix ?? ''}`)

        return (
          <div
            key={`${field.id}-${index}`}
            className="flex flex-col gap-3 rounded-md border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Cartão {index + 1}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, index - 1)}
                  aria-label="Mover cartão para cima"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label="Mover cartão para baixo"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  aria-label="Remover cartão"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs">Mídia do cartão</Label>
              <Select
                value={card.header.format}
                disabled={disabled}
                onValueChange={format => {
                  cardSet('header.format', format)
                  cardSet('header.assetId', undefined)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {formats.map(format => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TemplateMediaField
              format={card.header.format}
              assetId={card.header.assetId}
              revisionId={revisionId}
              disabled={disabled}
              onChange={assetId => cardSet('header.assetId', assetId)}
              error={cardError('header.assetId')}
            />

            <div className="flex flex-col gap-2">
              <Label className="text-xs">Corpo do cartão</Label>
              <Textarea
                rows={3}
                disabled={disabled}
                placeholder="Confira {{1}} com condições especiais."
                value={card.body.text ?? ''}
                onChange={event =>
                  setTextAndExamples(
                    cardSet,
                    event.target.value,
                    card.body.examples,
                    'body.',
                  )
                }
              />
              <FieldError message={cardError('body.text')} />
            </div>

            <ExamplesFields
              text={card.body.text ?? ''}
              examples={card.body.examples}
              prefix="body."
              set={cardSet}
              errorFor={cardError}
              disabled={disabled}
            />

            <ButtonsEditor
              form={form}
              basePath={`${basePath}.cards.${index}`}
              buttons={card.buttons ?? []}
              set={cardSet}
              errorFor={cardError}
              disabled={disabled}
              title="Botões do cartão"
            />
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => append(emptyCard as never)}
      >
        <Plus className="size-4" />
        Adicionar cartão
      </Button>

      <FieldError message={errorFor('cards')} />
    </div>
  )
}
