'use client'

import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'

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

type FlowButton = Extract<TemplateButtonValue, { kind: 'FLOW' }>

const actions: { value: NonNullable<FlowButton['flowAction']>; label: string }[] =
  [
    { value: 'navigate', label: 'Navegar para uma tela' },
    { value: 'data_exchange', label: 'Troca de dados' },
  ]

interface FlowEditorProps {
  value: FlowButton
  set: SetField
  errorFor: ErrorFor
  disabled: boolean
}

export const FlowEditor = ({
  value,
  set,
  errorFor,
  disabled,
}: FlowEditorProps) => (
  <div className="flex flex-col gap-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label className="text-xs">Flow ID</Label>
        <Input
          disabled={disabled}
          placeholder="1234567890"
          value={value.flowId ?? ''}
          onChange={event => set('flowId', event.target.value)}
        />
        <FieldError message={errorFor('flowId')} />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs">Ação</Label>
        <Select
          value={value.flowAction ?? 'navigate'}
          disabled={disabled}
          onValueChange={action => set('flowAction', action)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {actions.map(action => (
              <SelectItem key={action.value} value={action.value}>
                {action.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errorFor('flowAction')} />
      </div>
    </div>

    {(value.flowAction ?? 'navigate') === 'navigate' && (
      <div className="flex flex-col gap-2">
        <Label className="text-xs">Tela inicial</Label>
        <Input
          disabled={disabled}
          placeholder="WELCOME_SCREEN"
          value={value.navigateScreen ?? ''}
          onChange={event => set('navigateScreen', event.target.value)}
        />
        <FieldError message={errorFor('navigateScreen')} />
      </div>
    )}

    <div className="flex flex-col gap-2">
      <Label className="text-xs">Dados iniciais (JSON)</Label>
      <Textarea
        rows={4}
        spellCheck={false}
        disabled={disabled}
        className="font-mono text-xs"
        defaultValue={
          value.flowData ? JSON.stringify(value.flowData, null, 2) : ''
        }
        onBlur={event => {
          const text = event.target.value.trim()
          if (!text) {
            set('flowData', undefined)
            return
          }

          try {
            set('flowData', JSON.parse(text))
          } catch {
            set('flowData', value.flowData)
          }
        }}
      />
      <FieldError message={errorFor('flowData')} />
    </div>
  </div>
)
