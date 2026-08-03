'use client'

import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Switch } from '@workspace/ui/components/switch'

import { FieldError } from './body-editor'

import type {
  ErrorFor,
  SetField,
  TemplateComponentValue,
} from './template-editor-form'

type OfferValue = Extract<
  TemplateComponentValue,
  { type: 'LIMITED_TIME_OFFER' }
>

interface LimitedTimeOfferEditorProps {
  value: OfferValue
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
}

export const LimitedTimeOfferEditor = ({
  value,
  set,
  errorFor,
  disabled,
}: LimitedTimeOfferEditorProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Texto da oferta</Label>
      <Input
        disabled={disabled}
        placeholder="Oferta por tempo limitado"
        value={value.text ?? ''}
        onChange={event => set('text', event.target.value)}
      />
      <FieldError message={errorFor('text')} />
    </div>

    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="space-y-1">
        <Label className="text-xs">Mostrar contagem regressiva</Label>
        <p className="text-muted-foreground text-xs">
          A data de expiração é enviada junto com a mensagem.
        </p>
      </div>
      <Switch
        disabled={disabled}
        checked={value.hasExpiration ?? false}
        onCheckedChange={checked => set('hasExpiration', checked)}
      />
    </div>

    <p className="text-muted-foreground text-xs">
      Combine com um botão de copiar código para entregar o cupom da oferta.
    </p>
  </div>
)
