import { templateDefinitionSchema } from '@workspace/shared/whatsapp-templates'

import type { TemplateDefinition } from '@workspace/shared/whatsapp-templates'

/** Espelha `PROTECTED_KEYS` de `@workspace/shared/whatsapp-templates`. */
const PROTECTED_KEYS = [
  'accessToken',
  'whatsAppAccountId',
  'createdById',
  'updatedById',
  'remoteStatus',
  'remotePayload',
]

export interface AdvancedDefinitionError {
  message: string
  line: number | null
  column: number | null
  path: string | null
}

export type AdvancedDefinitionResult =
  | { success: true; data: TemplateDefinition }
  | { success: false; error: AdvancedDefinitionError }

const findProtectedKey = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProtectedKey(item)
      if (found) return found
    }
    return null
  }

  if (value === null || typeof value !== 'object') return null

  for (const [key, nested] of Object.entries(value)) {
    if (PROTECTED_KEYS.includes(key)) return key
    const found = findProtectedKey(nested)
    if (found) return found
  }

  return null
}

/**
 * O V8 nem sempre inclui `(line X column Y)` na mensagem — quando só há
 * `position N`, a posição é convertida no próprio texto original.
 */
const locateSyntaxError = (json: string, message: string) => {
  const explicit = /line (\d+) column (\d+)/.exec(message)
  if (explicit) {
    return { line: Number(explicit[1]), column: Number(explicit[2]) }
  }

  const position = /position (\d+)/.exec(message)
  if (!position) return { line: null, column: null }

  const lines = json.slice(0, Number(position[1])).split('\n')
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 }
}

const syntaxError = (json: string, error: unknown): AdvancedDefinitionError => {
  const message = error instanceof Error ? error.message : String(error)
  const { line, column } = locateSyntaxError(json, message)

  return {
    message:
      line === null
        ? 'JSON inválido: verifique a sintaxe do conteúdo.'
        : `JSON inválido na linha ${line}, coluna ${column}.`,
    line,
    column,
    path: null,
  }
}

export const parseAdvancedDefinition = (
  json: string,
): AdvancedDefinitionResult => {
  if (json.trim().length === 0) {
    return {
      success: false,
      error: {
        message: 'Informe o JSON do template.',
        line: null,
        column: null,
        path: null,
      },
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    return { success: false, error: syntaxError(json, error) }
  }

  const forbidden = findProtectedKey(parsed)
  if (forbidden) {
    return {
      success: false,
      error: {
        message: `O campo "${forbidden}" não pode ser definido pelo JSON avançado.`,
        line: null,
        column: null,
        path: forbidden,
      },
    }
  }

  const result = templateDefinitionSchema.safeParse(parsed)
  if (!result.success) {
    const issue = result.error.issues[0]!

    return {
      success: false,
      error: {
        message: issue.message,
        line: null,
        column: null,
        path: issue.path.join('.') || null,
      },
    }
  }

  return { success: true, data: result.data }
}

export const formatAdvancedDefinition = (definition: TemplateDefinition) =>
  JSON.stringify(definition, null, 2)
