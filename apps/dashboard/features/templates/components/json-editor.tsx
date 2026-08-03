'use client'

import { CheckCircle2 } from 'lucide-react'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/alert'

import { Button } from '@workspace/ui/components/button'
import { Textarea } from '@workspace/ui/components/textarea'

import type { AdvancedDefinitionError } from '../lib/json-mode'

interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  error: AdvancedDefinitionError | null
  onValidate: () => boolean
}

const locationOf = (error: AdvancedDefinitionError) => {
  if (error.line !== null) return `Linha ${error.line}, coluna ${error.column}`
  return error.path ? `Campo ${error.path}` : null
}

export const JsonEditor = ({
  value,
  onChange,
  error,
  onValidate,
}: JsonEditorProps) => (
  <div className="flex flex-col gap-3">
    <Textarea
      rows={20}
      spellCheck={false}
      className="font-mono text-xs"
      value={value}
      onChange={event => onChange(event.target.value)}
    />

    {error && (
      <Alert variant="destructive">
        <AlertTitle>{locationOf(error) ?? 'JSON inválido'}</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )}

    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onValidate}>
        <CheckCircle2 className="size-4" />
        Validar e aplicar
      </Button>
      <span className="text-muted-foreground text-xs">
        O conteúdo digitado só é substituído quando o JSON é válido.
      </span>
    </div>
  </div>
)
