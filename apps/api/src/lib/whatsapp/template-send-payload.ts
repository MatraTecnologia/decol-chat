/**
 * Montagem dos `components` de envio (`/messages` com `type: template`).
 *
 * Os valores chegam na forma do `templateSendParametersSchema`: lista por
 * posição ou registro por nome. O mapeamento é estrito — parâmetro faltando ou
 * sobrando vira erro antes de qualquer chamada à Meta, porque a Meta responde
 * 132000 sem dizer qual componente está errado.
 */
import type { TemplateSendParameters } from '@workspace/shared/whatsapp-templates'

import type {
  TemplateButton,
  TemplateComponent,
  ParameterFormat,
} from './template-payload.js'

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** Cópia local do extrator de `template-create-payload.ts`: importar o irmão em
 * runtime tiraria este módulo do alcance do `node --test`. */
const extractVariables = (text: string) => {
  const names: string[] = []

  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const name = match[1]
    if (name && !names.includes(name)) names.push(name)
  }

  return names
}

export interface MetaMessageParameter {
  [key: string]: unknown
}

export type MetaMessageComponent = {
  type: string
  sub_type?: string
  index?: string
  parameters?: MetaMessageParameter[]
  cards?: { card_index: number; components: MetaMessageComponent[] }[]
}

type ParameterValues = string[] | Record<string, string>

interface Definition {
  parameterFormat: ParameterFormat
  components: TemplateComponent[]
}

export class TemplateParametersError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateParametersError'
  }
}

const toList = (values?: ParameterValues) =>
  !values ? [] : Array.isArray(values) ? values : Object.values(values)

/** Casa os valores com as variáveis do texto e recusa qualquer descasamento. */
const resolve = (
  label: string,
  text: string,
  values: ParameterValues | undefined,
) => {
  const names = extractVariables(text)

  if (!names.length) {
    if (toList(values).length) {
      throw new TemplateParametersError(`${label} não aceita parâmetros.`)
    }

    return []
  }

  if (values && !Array.isArray(values)) {
    const extra = Object.keys(values).filter(name => !names.includes(name))
    if (extra.length) {
      throw new TemplateParametersError(
        `${label} não tem a variável "${extra[0]}".`,
      )
    }

    return names.map(name => {
      const value = values[name]
      if (value === undefined) {
        throw new TemplateParametersError(
          `${label} exige um valor para "${name}".`,
        )
      }

      return { name, value }
    })
  }

  const list = values ?? []
  if (list.length !== names.length) {
    throw new TemplateParametersError(
      `${label} exige ${names.length} parâmetro(s), recebeu ${list.length}.`,
    )
  }

  return names.map((name, index) => ({ name, value: list[index]! }))
}

const textParameters = (
  format: ParameterFormat,
  resolved: { name: string; value: string }[],
) =>
  resolved.map(({ name, value }) =>
    format === 'NAMED'
      ? { type: 'text', parameter_name: name, text: value }
      : { type: 'text', text: value },
  )

/** URL absoluta vira `link`; qualquer outra coisa é tratada como media id. */
const mediaParameter = (format: string, value: string): MetaMessageParameter => {
  const key = format.toLowerCase()
  const source = /^https?:\/\//i.test(value) ? { link: value } : { id: value }

  return { type: key, [key]: source }
}

const headerComponent = (
  definition: Definition,
  header: Extract<TemplateComponent, { type: 'HEADER' }>,
  values: ParameterValues | undefined,
): MetaMessageComponent | null => {
  if (header.format === 'TEXT') {
    const resolved = resolve('O cabeçalho', header.text, values)
    if (!resolved.length) return null

    return {
      type: 'header',
      parameters: textParameters(definition.parameterFormat, resolved),
    }
  }

  if (header.format === 'LOCATION') {
    if (toList(values).length) {
      throw new TemplateParametersError(
        'O cabeçalho de localização não aceita parâmetros.',
      )
    }

    return null
  }

  const list = toList(values)
  if (list.length !== 1) {
    throw new TemplateParametersError(
      'O cabeçalho de mídia exige exatamente 1 parâmetro.',
    )
  }

  return {
    type: 'header',
    parameters: [mediaParameter(header.format, list[0]!)],
  }
}

const SUB_TYPES: Record<string, string> = {
  URL: 'url',
  COPY_CODE: 'copy_code',
  QUICK_REPLY: 'quick_reply',
  FLOW: 'flow',
}

const buttonParameters = (
  button: TemplateButton,
  list: string[],
): MetaMessageParameter[] => {
  const label = `O botão "${button.text}"`

  switch (button.kind) {
    case 'URL': {
      const expected = extractVariables(button.url).length
      if (list.length !== expected) {
        throw new TemplateParametersError(
          `${label} exige ${expected} parâmetro(s), recebeu ${list.length}.`,
        )
      }

      return list.map(text => ({ type: 'text', text }))
    }
    case 'COPY_CODE':
      return [{ type: 'coupon_code', coupon_code: list[0]! }]
    case 'QUICK_REPLY':
      return [{ type: 'payload', payload: list[0]! }]
    case 'FLOW':
      return [{ type: 'action', action: { flow_token: list[0]! } }]
    default:
      throw new TemplateParametersError(`${label} não aceita parâmetros.`)
  }
}

const buttonComponents = (
  buttons: TemplateButton[],
  values: ParameterValues[] | undefined,
) => {
  const entries = values ?? []
  if (entries.length > buttons.length) {
    throw new TemplateParametersError(
      `O modelo tem ${buttons.length} botão(ões), recebeu ${entries.length} conjunto(s) de parâmetros.`,
    )
  }

  const components: MetaMessageComponent[] = []

  buttons.forEach((button, index) => {
    const list = toList(entries[index])

    if (!list.length) {
      const required =
        button.kind === 'URL' && extractVariables(button.url).length > 0
      if (required) {
        throw new TemplateParametersError(
          `O botão "${button.text}" exige um parâmetro.`,
        )
      }

      return
    }

    components.push({
      type: 'button',
      sub_type: SUB_TYPES[button.kind] ?? button.kind.toLowerCase(),
      index: String(index),
      parameters: buttonParameters(button, list),
    })
  })

  return components
}

const carouselComponent = (
  definition: Definition,
  carousel: Extract<TemplateComponent, { type: 'CAROUSEL' }>,
  values: ParameterValues[] | undefined,
): MetaMessageComponent => {
  const entries = values ?? []
  if (entries.length > carousel.cards.length) {
    throw new TemplateParametersError(
      `O carrossel tem ${carousel.cards.length} cartão(ões), recebeu ${entries.length}.`,
    )
  }

  return {
    type: 'carousel',
    cards: carousel.cards.map((card, index) => {
      const resolved = resolve(
        `O cartão ${index + 1}`,
        card.body.text,
        entries[index],
      )

      return {
        card_index: index,
        components: resolved.length
          ? [
              {
                type: 'body',
                parameters: textParameters(
                  definition.parameterFormat,
                  resolved,
                ),
              },
            ]
          : [],
      }
    }),
  }
}

const findComponent = <T extends TemplateComponent['type']>(
  components: TemplateComponent[],
  type: T,
) =>
  components.find(
    (part): part is Extract<TemplateComponent, { type: T }> =>
      part.type === type,
  )

export const toMetaMessageComponents = (
  definition: Definition,
  values: TemplateSendParameters = {},
): MetaMessageComponent[] => {
  const components: MetaMessageComponent[] = []
  const header = findComponent(definition.components, 'HEADER')
  const body = findComponent(definition.components, 'BODY')
  const buttons = findComponent(definition.components, 'BUTTONS')
  const carousel = findComponent(definition.components, 'CAROUSEL')

  if (!header && toList(values.header).length) {
    throw new TemplateParametersError('O modelo não tem cabeçalho.')
  }
  if (!buttons && values.buttons?.length) {
    throw new TemplateParametersError('O modelo não tem botões.')
  }
  if (!carousel && values.cards?.length) {
    throw new TemplateParametersError('O modelo não tem carrossel.')
  }

  if (header) {
    const component = headerComponent(definition, header, values.header)
    if (component) components.push(component)
  }

  const resolvedBody = body
    ? resolve('O corpo', body.text, values.body)
    : resolve('O corpo', '', values.body)

  if (resolvedBody.length) {
    components.push({
      type: 'body',
      parameters: textParameters(definition.parameterFormat, resolvedBody),
    })
  }

  if (buttons) components.push(...buttonComponents(buttons.buttons, values.buttons))
  if (carousel) components.push(carouselComponent(definition, carousel, values.cards))

  return components
}
