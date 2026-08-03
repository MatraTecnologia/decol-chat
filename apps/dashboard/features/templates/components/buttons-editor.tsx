'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useFieldArray } from 'react-hook-form'
import type { FieldArrayPath, UseFormReturn } from 'react-hook-form'

import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

import { AuthenticationEditor } from './authentication-editor'
import { ExamplesFields, FieldError, variablesOf } from './body-editor'
import { CatalogEditor } from './catalog-editor'
import { FlowEditor } from './flow-editor'

import type {
  ErrorFor,
  SetField,
  TemplateButtonValue,
  TemplateFormValues,
} from './template-editor-form'

type ButtonKind = TemplateButtonValue['kind']

const kinds: { value: ButtonKind; label: string }[] = [
  { value: 'QUICK_REPLY', label: 'Resposta rápida' },
  { value: 'URL', label: 'Link (URL)' },
  { value: 'PHONE_NUMBER', label: 'Telefone' },
  { value: 'COPY_CODE', label: 'Copiar código' },
  { value: 'OTP', label: 'Código de verificação (OTP)' },
  { value: 'CATALOG', label: 'Catálogo' },
  { value: 'FLOW', label: 'Flow' },
]

/** Trocar o tipo troca a variante inteira — campos antigos não sobrevivem. */
const buttonDefaults = (kind: ButtonKind): TemplateButtonValue => {
  switch (kind) {
    case 'URL':
      return { kind: 'URL', text: '', url: 'https://', examples: [] }
    case 'PHONE_NUMBER':
      return { kind: 'PHONE_NUMBER', text: '', phoneNumber: '' }
    case 'COPY_CODE':
      return { kind: 'COPY_CODE', text: '' }
    case 'OTP':
      return { kind: 'OTP', otpType: 'COPY_CODE', text: '' }
    case 'CATALOG':
      return { kind: 'CATALOG', text: '' }
    case 'FLOW':
      return { kind: 'FLOW', text: '', flowId: '', flowAction: 'navigate' }
    default:
      return { kind: 'QUICK_REPLY', text: '' }
  }
}

interface ButtonsEditorProps {
  form: UseFormReturn<TemplateFormValues>
  basePath: string
  buttons: TemplateButtonValue[]
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
  title?: string
}

export const ButtonsEditor = ({
  form,
  basePath,
  buttons,
  set,
  errorFor,
  disabled,
  title = 'Botões',
}: ButtonsEditorProps) => {
  const { fields, append, remove, move, update } = useFieldArray({
    control: form.control,
    name: `${basePath}.buttons` as FieldArrayPath<TemplateFormValues>,
  })

  const renderFields = (button: TemplateButtonValue, index: number) => {
    const scopedSet: SetField = (suffix, value) =>
      set(`buttons.${index}.${suffix}`, value)
    const scopedError: ErrorFor = suffix =>
      errorFor(`buttons.${index}.${suffix ?? ''}`)

    const shared = { set: scopedSet, errorFor: scopedError, disabled }

    switch (button.kind) {
      case 'URL':
        return (
          <>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">URL</Label>
              <Input
                disabled={disabled}
                placeholder="https://loja.com/pedido/{{1}}"
                value={button.url ?? ''}
                onChange={event => {
                  const url = event.target.value
                  scopedSet('url', url)
                  scopedSet(
                    'examples',
                    (button.examples ?? []).slice(0, variablesOf(url).length),
                  )
                }}
              />
              <FieldError message={scopedError('url')} />
            </div>
            <ExamplesFields
              text={button.url ?? ''}
              examples={button.examples}
              {...shared}
            />
          </>
        )
      case 'PHONE_NUMBER':
        return (
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Telefone</Label>
            <Input
              disabled={disabled}
              placeholder="+5543999140409"
              value={button.phoneNumber ?? ''}
              onChange={event => scopedSet('phoneNumber', event.target.value)}
            />
            <FieldError message={scopedError('phoneNumber')} />
          </div>
        )
      case 'COPY_CODE':
        return (
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Código de exemplo</Label>
            <Input
              disabled={disabled}
              placeholder="CUPOM10"
              value={button.example ?? ''}
              onChange={event => scopedSet('example', event.target.value)}
            />
            <FieldError message={scopedError('example')} />
          </div>
        )
      case 'OTP':
        return <AuthenticationEditor value={button} {...shared} />
      case 'CATALOG':
        return <CatalogEditor value={button} {...shared} />
      case 'FLOW':
        return <FlowEditor value={button} {...shared} />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium">{title}</span>

      {fields.map((field, index) => {
        const button = buttons?.[index]
        if (!button) return null

        return (
          <div key={field.id} className="bg-muted/30 flex flex-col gap-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Select
                value={button.kind}
                disabled={disabled}
                onValueChange={kind =>
                  update(index, buttonDefaults(kind as ButtonKind) as never)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map(kind => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
                aria-label="Mover botão para cima"
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || index === fields.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label="Mover botão para baixo"
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={() => remove(index)}
                aria-label="Remover botão"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs">Rótulo</Label>
              <Input
                disabled={disabled}
                placeholder="Ver pedido"
                value={button.text ?? ''}
                onChange={event =>
                  set(`buttons.${index}.text`, event.target.value)
                }
              />
              <FieldError message={errorFor(`buttons.${index}.text`)} />
            </div>

            {renderFields(button, index)}
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => append(buttonDefaults('QUICK_REPLY') as never)}
      >
        <Plus className="size-4" />
        Adicionar botão
      </Button>

      <FieldError message={errorFor('buttons')} />
    </div>
  )
}
