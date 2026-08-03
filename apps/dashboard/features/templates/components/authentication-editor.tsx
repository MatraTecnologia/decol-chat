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

import { FieldError } from './body-editor'

import type {
  ErrorFor,
  SetField,
  TemplateButtonValue,
} from './template-editor-form'

type OtpButton = Extract<TemplateButtonValue, { kind: 'OTP' }>

const otpTypes: { value: OtpButton['otpType']; label: string }[] = [
  { value: 'COPY_CODE', label: 'Copiar código' },
  { value: 'ONE_TAP', label: 'Preenchimento automático (one-tap)' },
  { value: 'ZERO_TAP', label: 'Preenchimento silencioso (zero-tap)' },
]

interface AuthenticationEditorProps {
  value: OtpButton
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
}

export const AuthenticationEditor = ({
  value,
  set,
  errorFor,
  disabled,
}: AuthenticationEditorProps) => {
  const needsApp = value.otpType !== 'COPY_CODE'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label className="text-xs">Tipo de OTP</Label>
        <Select
          value={value.otpType}
          disabled={disabled}
          onValueChange={otpType => set('otpType', otpType)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {otpTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errorFor('otpType')} />
      </div>

      {needsApp && (
        <>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Texto de preenchimento</Label>
            <Input
              disabled={disabled}
              placeholder="Preencher código"
              value={value.autofillText ?? ''}
              onChange={event => set('autofillText', event.target.value)}
            />
            <FieldError message={errorFor('autofillText')} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Pacote do app</Label>
              <Input
                disabled={disabled}
                placeholder="com.empresa.app"
                value={value.packageName ?? ''}
                onChange={event => set('packageName', event.target.value)}
              />
              <FieldError message={errorFor('packageName')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs">Hash de assinatura</Label>
              <Input
                disabled={disabled}
                placeholder="K0k1B2c3D4e"
                value={value.signatureHash ?? ''}
                onChange={event => set('signatureHash', event.target.value)}
              />
              <FieldError message={errorFor('signatureHash')} />
            </div>
          </div>
        </>
      )}

      <p className="text-muted-foreground text-xs">
        Modelos de OTP exigem a categoria Autenticação. A validade do código e a
        recomendação de segurança são definidas no corpo do modelo.
      </p>
    </div>
  )
}
