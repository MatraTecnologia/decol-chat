'use client'

import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'

import type {
  ErrorFor,
  SetField,
  TemplateComponentValue,
} from './template-editor-form'

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** Ordem de aparição, sem repetir — é o que a Meta espera nos exemplos. */
export const variablesOf = (text: string) => {
  const names: string[] = []

  for (const match of (text ?? '').matchAll(VARIABLE_PATTERN)) {
    if (!names.includes(match[1]!)) names.push(match[1]!)
  }

  return names
}

/**
 * Texto e exemplos andam juntos: apagar uma variável tem que descartar o
 * exemplo órfão, senão o contrato reprova o envio num campo já invisível.
 */
export const setTextAndExamples = (
  set: SetField,
  text: string,
  examples?: string[],
  prefix = '',
) => {
  set(`${prefix}text`, text)
  set(`${prefix}examples`, (examples ?? []).slice(0, variablesOf(text).length))
}

interface FieldErrorProps {
  message?: string
}

export const FieldError = ({ message }: FieldErrorProps) =>
  message ? <p className="text-destructive text-xs">{message}</p> : null

interface ExamplesFieldsProps {
  text: string
  examples?: string[]
  prefix?: string
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
}

/**
 * Um campo por variável do texto: a contagem bate por construção, que é o que
 * o `superRefine` do contrato compartilhado exige.
 */
export const ExamplesFields = ({
  text,
  examples,
  prefix = '',
  set,
  errorFor,
  disabled,
}: ExamplesFieldsProps) => {
  const variables = variablesOf(text)
  if (variables.length === 0) return null

  const current = examples ?? []

  const change = (index: number, value: string) => {
    const next = variables.map((_, position) =>
      position === index ? value : (current[position] ?? ''),
    )
    set(`${prefix}examples`, next)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Exemplos das variáveis</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {variables.map((variable, index) => (
          <Input
            key={variable}
            placeholder={`{{${variable}}}`}
            disabled={disabled}
            value={current[index] ?? ''}
            onChange={event => change(index, event.target.value)}
          />
        ))}
      </div>
      <FieldError message={errorFor(`${prefix}examples`)} />
    </div>
  )
}

interface BodyEditorProps {
  value: Extract<TemplateComponentValue, { type: 'BODY' }>
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
}

export const BodyEditor = ({
  value,
  set,
  errorFor,
  disabled,
}: BodyEditorProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Texto</Label>
      <Textarea
        rows={4}
        disabled={disabled}
        placeholder="Olá {{1}}, seu pedido {{2}} foi confirmado."
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
  </div>
)

interface FooterEditorProps {
  value: Extract<TemplateComponentValue, { type: 'FOOTER' }>
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
}

export const FooterEditor = ({
  value,
  set,
  errorFor,
  disabled,
}: FooterEditorProps) => (
  <div className="flex flex-col gap-2">
    <Label className="text-xs">Texto do rodapé</Label>
    <Input
      disabled={disabled}
      placeholder="Responda SAIR para cancelar"
      value={value.text ?? ''}
      onChange={event => set('text', event.target.value)}
    />
    <FieldError message={errorFor('text')} />
  </div>
)
