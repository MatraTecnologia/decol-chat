import { templateSendParametersSchema } from '@workspace/shared/whatsapp-templates'

import type {
  TemplateDefinition,
  TemplateSendParameters,
} from '@workspace/shared/whatsapp-templates'

type TemplateComponent = TemplateDefinition['components'][number]
type TemplateButton = Extract<
  TemplateComponent,
  { type: 'BUTTONS' }
>['buttons'][number]
type TemplateCard = Extract<
  TemplateComponent,
  { type: 'CAROUSEL' }
>['cards'][number]

export type TemplateMediaFormat = TemplateCard['header']['format']

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

const variableKeys = (text: string) => [
  ...new Set([...text.matchAll(VARIABLE_PATTERN)].map(match => match[1]!)),
]

export type TemplateParameterKind =
  | 'TEXT'
  | 'MEDIA'
  | 'URL_SUFFIX'
  | 'OTP'
  | 'PRODUCT'
  | 'FLOW'

export type TemplateParameterGroup = 'header' | 'body' | 'buttons' | 'cards'

export interface TemplateParameterField {
  id: string
  group: TemplateParameterGroup
  kind: TemplateParameterKind
  format: TemplateDefinition['parameterFormat']
  key: string
  label: string
  required: boolean
  defaultValue: string
  buttonIndex: number | null
  cardIndex: number | null
  mediaFormat: TemplateMediaFormat | null
}

export type SendParametersResult =
  | { success: true; data: TemplateSendParameters }
  | { success: false; errors: Record<string, string> }

const MEDIA_LABELS: Record<TemplateMediaFormat, string> = {
  IMAGE: 'imagem',
  VIDEO: 'vídeo',
  DOCUMENT: 'documento',
}

const baseField = {
  buttonIndex: null,
  cardIndex: null,
  mediaFormat: null,
} satisfies Pick<
  TemplateParameterField,
  'buttonIndex' | 'cardIndex' | 'mediaFormat'
>

const orderedKeys = (
  text: string,
  format: TemplateDefinition['parameterFormat'],
) => {
  const keys = variableKeys(text)

  return format === 'NAMED'
    ? keys
    : [...keys].sort((a, b) => Number(a) - Number(b))
}

const exampleFor = (
  examples: string[] | undefined,
  key: string,
  index: number,
  format: TemplateDefinition['parameterFormat'],
) =>
  (format === 'NAMED'
    ? examples?.[index]
    : (examples?.[Number(key) - 1] ?? examples?.[index])) ?? ''

const textFields = (options: {
  group: TemplateParameterGroup
  idPrefix: string
  text: string
  examples: string[] | undefined
  format: TemplateDefinition['parameterFormat']
  valueFormat?: TemplateDefinition['parameterFormat']
  label: (key: string) => string
  cardIndex?: number
}): TemplateParameterField[] =>
  orderedKeys(options.text, options.format).map((key, index) => ({
    ...baseField,
    id: `${options.idPrefix}.${key}`,
    group: options.group,
    kind: 'TEXT',
    format: options.valueFormat ?? options.format,
    key,
    label: options.label(key),
    required: true,
    defaultValue: exampleFor(options.examples, key, index, options.format),
    cardIndex: options.cardIndex ?? null,
  }))

const buttonField = (
  button: TemplateButton,
  index: number,
): TemplateParameterField | null => {
  const common = {
    ...baseField,
    id: `buttons.${index}`,
    group: 'buttons' as const,
    format: 'POSITIONAL' as const,
    key: String(index),
    buttonIndex: index,
  }

  switch (button.kind) {
    case 'URL': {
      if (variableKeys(button.url).length === 0) return null

      return {
        ...common,
        kind: 'URL_SUFFIX',
        label: `Botão "${button.text}" — sufixo da URL`,
        required: true,
        defaultValue: button.examples?.[0] ?? '',
      }
    }
    case 'OTP':
      return {
        ...common,
        kind: 'OTP',
        label: `Botão "${button.text}" — código de verificação`,
        required: true,
        defaultValue: '',
      }
    case 'COPY_CODE':
      return {
        ...common,
        kind: 'OTP',
        label: `Botão "${button.text}" — código do cupom`,
        required: true,
        defaultValue: button.example ?? '',
      }
    case 'CATALOG':
      return {
        ...common,
        kind: 'PRODUCT',
        label: `Botão "${button.text}" — produto em destaque`,
        required: false,
        defaultValue: button.thumbnailProductRetailerId ?? '',
      }
    case 'FLOW':
      return {
        ...common,
        kind: 'FLOW',
        label: `Botão "${button.text}" — token do Flow`,
        required: false,
        defaultValue: '',
      }
    default:
      return null
  }
}

/** Cada cartão envia `[mídia, ...variáveis do corpo]` nesta mesma ordem. */
const cardFields = (
  card: TemplateCard,
  cardIndex: number,
  format: TemplateDefinition['parameterFormat'],
): TemplateParameterField[] => [
  {
    ...baseField,
    id: `cards.${cardIndex}.media`,
    group: 'cards',
    kind: 'MEDIA',
    format: 'POSITIONAL',
    key: 'media',
    label: `Cartão ${cardIndex + 1} — ${MEDIA_LABELS[card.header.format]}`,
    required: true,
    defaultValue: card.header.example ?? '',
    cardIndex,
    mediaFormat: card.header.format,
  },
  ...textFields({
    group: 'cards',
    idPrefix: `cards.${cardIndex}.body`,
    text: card.body.text,
    examples: card.body.examples,
    format,
    // O cartão sempre viaja posicional, mesmo em template nomeado.
    valueFormat: 'POSITIONAL',
    label: key => `Cartão ${cardIndex + 1} — variável {{${key}}}`,
    cardIndex,
  }),
]

const headerFields = (
  header: Extract<TemplateComponent, { type: 'HEADER' }>,
  format: TemplateDefinition['parameterFormat'],
): TemplateParameterField[] => {
  if (header.format === 'LOCATION') return []

  if (header.format === 'TEXT') {
    return textFields({
      group: 'header',
      idPrefix: 'header',
      text: header.text,
      examples: header.examples,
      format,
      label: key => `Cabeçalho — variável {{${key}}}`,
    })
  }

  return [
    {
      ...baseField,
      id: 'header.media',
      group: 'header',
      kind: 'MEDIA',
      format: 'POSITIONAL',
      key: 'media',
      label: `Cabeçalho — ${MEDIA_LABELS[header.format]}`,
      required: true,
      defaultValue: header.example ?? '',
      mediaFormat: header.format,
    },
  ]
}

/**
 * Campos exigidos no envio, sempre na ordem cabeçalho → corpo → botões →
 * cartões, independentemente da ordem dos componentes na definição.
 */
export const getTemplateParameterFields = (
  definition: TemplateDefinition,
): TemplateParameterField[] => {
  const header: TemplateParameterField[] = []
  const body: TemplateParameterField[] = []
  const buttons: TemplateParameterField[] = []
  const cards: TemplateParameterField[] = []

  for (const component of definition.components) {
    switch (component.type) {
      case 'HEADER':
        header.push(...headerFields(component, definition.parameterFormat))
        break
      case 'BODY':
        body.push(
          ...textFields({
            group: 'body',
            idPrefix: 'body',
            text: component.text,
            examples: component.examples,
            format: definition.parameterFormat,
            label: key => `Corpo — variável {{${key}}}`,
          }),
        )
        break
      case 'BUTTONS':
        for (const [index, button] of component.buttons.entries()) {
          const parameter = buttonField(button, index)
          if (parameter) buttons.push(parameter)
        }
        break
      case 'CAROUSEL':
        for (const [index, card] of component.cards.entries()) {
          cards.push(...cardFields(card, index, definition.parameterFormat))
        }
        break
      default:
        break
    }
  }

  return [...header, ...body, ...buttons, ...cards]
}

const collect = (fields: TemplateParameterField[], read: (id: string) => string) => {
  if (fields.length === 0) return undefined

  const named = fields.every(field => field.format === 'NAMED')
  if (!named) return fields.map(field => read(field.id))

  return Object.fromEntries(fields.map(field => [field.key, read(field.id)]))
}

const indexed = (
  fields: TemplateParameterField[],
  pick: (field: TemplateParameterField) => number,
  read: (id: string) => string,
) => {
  if (fields.length === 0) return undefined

  const size = Math.max(...fields.map(pick)) + 1
  const slots: string[][] = Array.from({ length: size }, () => [])

  for (const field of fields) slots[pick(field)]!.push(read(field.id))

  return slots
}

export const buildSendParameters = (
  fields: TemplateParameterField[],
  values: Record<string, string>,
): SendParametersResult => {
  const errors: Record<string, string> = {}
  const read = (id: string) => values[id] ?? ''

  for (const field of fields) {
    if (field.required && read(field.id).trim().length === 0) {
      errors[field.id] = 'Campo obrigatório.'
    }
  }

  if (Object.keys(errors).length > 0) return { success: false, errors }

  // Campo opcional em branco não vira parâmetro — o slot do botão fica vazio.
  const filled = fields.filter(
    field => field.required || read(field.id).trim().length > 0,
  )

  const byGroup = (group: TemplateParameterGroup) =>
    filled.filter(field => field.group === group)

  const parameters = {
    header: collect(byGroup('header'), read),
    body: collect(byGroup('body'), read),
    buttons: indexed(byGroup('buttons'), field => field.buttonIndex!, read),
    cards: indexed(byGroup('cards'), field => field.cardIndex!, read),
  }

  const result = templateSendParametersSchema.safeParse(
    Object.fromEntries(
      Object.entries(parameters).filter(([, value]) => value !== undefined),
    ),
  )

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors[issue.path.join('.') || 'parameters'] = issue.message
    }

    return { success: false, errors }
  }

  return { success: true, data: result.data }
}
