'use client'

import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'

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
import { TemplateMediaField } from './template-media-field'

import type {
  ErrorFor,
  SetField,
  TemplateComponentValue,
} from './template-editor-form'

type HeaderValue = Extract<TemplateComponentValue, { type: 'HEADER' }>
type HeaderFormat = HeaderValue['format']

const formats: { value: HeaderFormat; label: string }[] = [
  { value: 'TEXT', label: 'Texto' },
  { value: 'IMAGE', label: 'Imagem' },
  { value: 'VIDEO', label: 'Vídeo' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'LOCATION', label: 'Localização' },
]

/** Trocar o formato troca a variante inteira — nunca só o campo `format`. */
const headerDefaults = (format: HeaderFormat): HeaderValue => {
  if (format === 'TEXT') {
    return { type: 'HEADER', format: 'TEXT', text: '', examples: [] }
  }
  if (format === 'LOCATION') return { type: 'HEADER', format: 'LOCATION' }

  return { type: 'HEADER', format }
}

interface HeaderEditorProps {
  value: HeaderValue
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
  revisionId: string | null
  onFormatChange: (next: HeaderValue) => void
}

export const HeaderEditor = ({
  value,
  set,
  errorFor,
  disabled,
  revisionId,
  onFormatChange,
}: HeaderEditorProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Formato</Label>
      <Select
        value={value.format}
        disabled={disabled}
        onValueChange={format =>
          onFormatChange(headerDefaults(format as HeaderFormat))
        }
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

    {value.format === 'TEXT' && (
      <>
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Texto</Label>
          <Input
            disabled={disabled}
            placeholder="Pedido {{1}}"
            value={value.text ?? ''}
            onChange={event =>
              setTextAndExamples(set, event.target.value, value.examples)
            }
          />
          <FieldError message={errorFor('text')} />
        </div>

        <ExamplesFields
          text={value.text ?? ''}
          examples={value.examples}
          set={set}
          errorFor={errorFor}
          disabled={disabled}
        />
      </>
    )}

    {(value.format === 'IMAGE' ||
      value.format === 'VIDEO' ||
      value.format === 'DOCUMENT') && (
      <TemplateMediaField
        format={value.format}
        assetId={value.assetId}
        revisionId={revisionId}
        disabled={disabled}
        onChange={assetId => set('assetId', assetId)}
        error={errorFor('assetId')}
      />
    )}

    {value.format === 'LOCATION' && (
      <p className="text-muted-foreground text-xs">
        A localização é informada no envio, não no modelo.
      </p>
    )}
  </div>
)
