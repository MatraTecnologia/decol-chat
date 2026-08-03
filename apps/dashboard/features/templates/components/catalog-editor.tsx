'use client'

import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'

import { FieldError } from './body-editor'

import type {
  ErrorFor,
  SetField,
  TemplateButtonValue,
} from './template-editor-form'

type CatalogButton = Extract<TemplateButtonValue, { kind: 'CATALOG' }>

interface CatalogEditorProps {
  value: CatalogButton
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
}

export const CatalogEditor = ({
  value,
  set,
  errorFor,
  disabled,
}: CatalogEditorProps) => (
  <div className="flex flex-col gap-2">
    <Label className="text-xs">Produto da miniatura</Label>
    <Input
      disabled={disabled}
      placeholder="SKU-1234"
      value={value.thumbnailProductRetailerId ?? ''}
      onChange={event => set('thumbnailProductRetailerId', event.target.value)}
    />
    <FieldError message={errorFor('thumbnailProductRetailerId')} />
    <p className="text-muted-foreground text-xs">
      Use o identificador do produto no catálogo conectado à conta. Sem
      miniatura, a Meta escolhe o primeiro item do catálogo.
    </p>
  </div>
)
