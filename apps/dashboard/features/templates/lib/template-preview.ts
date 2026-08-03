import type {
  TemplateDefinition,
  TemplateSendParameters,
} from '@workspace/shared/whatsapp-templates'

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export type TemplateExamples = string[] | Record<string, string>

type TemplateComponent = TemplateDefinition['components'][number]
type TemplateButton = Extract<
  TemplateComponent,
  { type: 'BUTTONS' }
>['buttons'][number]
type TemplateCard = Extract<
  TemplateComponent,
  { type: 'CAROUSEL' }
>['cards'][number]

export type PreviewMediaFormat = 'IMAGE' | 'VIDEO' | 'DOCUMENT'

export type PreviewHeader =
  | { format: 'TEXT'; text: string }
  | { format: PreviewMediaFormat; media: string | null }
  | { format: 'LOCATION' }

export interface PreviewButton {
  kind: TemplateButton['kind']
  text: string
  detail: string | null
}

export interface PreviewCard {
  format: PreviewMediaFormat
  media: string | null
  body: string
  buttons: PreviewButton[]
}

export interface TemplatePreview {
  header: PreviewHeader | null
  body: string | null
  footer: string | null
  buttons: PreviewButton[]
  cards: PreviewCard[]
  offer: { text: string; hasExpiration: boolean } | null
  advanced: { label: string }[]
}

const appearanceOrder = (text: string) => {
  const order = new Map<string, number>()
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const key = match[1]!
    if (!order.has(key)) order.set(key, order.size)
  }
  return order
}

export const countTemplateVariables = (text: string) =>
  appearanceOrder(text).size

/**
 * Substitui `{{1}}` (posicional) e `{{nome}}` (nomeado) pelos exemplos.
 * Variável sem exemplo permanece visível como placeholder no preview.
 */
export const renderTemplateText = (
  text: string,
  examples?: TemplateExamples,
) => {
  if (!examples) return text

  const order = Array.isArray(examples) ? appearanceOrder(text) : null

  return text.replace(VARIABLE_PATTERN, (placeholder, key: string) => {
    if (!Array.isArray(examples)) return examples[key] ?? placeholder

    const index = /^\d+$/.test(key) ? Number(key) - 1 : order!.get(key)!
    return examples[index] ?? placeholder
  })
}

/** Valor vazio equivale a ausente — o preview volta a usar os exemplos. */
const usable = (values?: TemplateExamples) => {
  if (!values) return undefined
  const size = Array.isArray(values) ? values.length : Object.keys(values).length
  return size > 0 ? values : undefined
}

const firstValue = (values?: TemplateExamples) =>
  (Array.isArray(values) ? values[0] : Object.values(values ?? {})[0]) ?? null

const asList = (values?: TemplateExamples) =>
  Array.isArray(values) ? values : undefined

const renderButton = (
  button: TemplateButton,
  values?: TemplateExamples,
): PreviewButton => {
  switch (button.kind) {
    case 'URL':
      return {
        kind: button.kind,
        text: button.text,
        detail: renderTemplateText(button.url, values ?? button.examples),
      }
    case 'PHONE_NUMBER':
      return { kind: button.kind, text: button.text, detail: button.phoneNumber }
    case 'COPY_CODE':
      return {
        kind: button.kind,
        text: button.text,
        detail: firstValue(values) ?? button.example ?? null,
      }
    case 'OTP':
      return {
        kind: button.kind,
        text: button.text,
        detail: firstValue(values),
      }
    case 'CATALOG':
      return {
        kind: button.kind,
        text: button.text,
        detail: firstValue(values) ?? button.thumbnailProductRetailerId ?? null,
      }
    case 'FLOW':
      return { kind: button.kind, text: button.text, detail: button.flowId }
    default:
      return { kind: button.kind, text: button.text, detail: null }
  }
}

/** Cada cartão recebe `[mídia, ...variáveis do corpo]` na ordem dos campos. */
const renderCard = (card: TemplateCard, values?: TemplateExamples) => {
  const list = asList(values)

  return {
    format: card.header.format,
    media: list?.[0] ?? card.header.example ?? null,
    body: renderTemplateText(
      card.body.text,
      list ? list.slice(1) : card.body.examples,
    ),
    buttons: (card.buttons ?? []).map(button => renderButton(button)),
  } satisfies PreviewCard
}

const renderHeader = (
  header: Extract<TemplateComponent, { type: 'HEADER' }>,
  values?: TemplateExamples,
): PreviewHeader => {
  if (header.format === 'LOCATION') return { format: 'LOCATION' }

  if (header.format === 'TEXT') {
    return {
      format: 'TEXT',
      text: renderTemplateText(header.text, values ?? header.examples),
    }
  }

  return {
    format: header.format,
    media: firstValue(values) ?? header.example ?? null,
  }
}

export const renderTemplatePreview = (
  definition: TemplateDefinition,
  values: TemplateSendParameters = {},
): TemplatePreview => {
  const preview: TemplatePreview = {
    header: null,
    body: null,
    footer: null,
    buttons: [],
    cards: [],
    offer: null,
    advanced: [],
  }

  for (const component of definition.components) {
    switch (component.type) {
      case 'HEADER':
        preview.header = renderHeader(component, usable(values.header))
        break
      case 'BODY':
        preview.body = renderTemplateText(
          component.text,
          usable(values.body) ?? component.examples,
        )
        break
      case 'FOOTER':
        preview.footer = component.text
        break
      case 'BUTTONS':
        preview.buttons = component.buttons.map((button, index) =>
          renderButton(button, usable(values.buttons?.[index])),
        )
        break
      case 'CAROUSEL':
        preview.cards = component.cards.map((card, index) =>
          renderCard(card, usable(values.cards?.[index])),
        )
        break
      case 'LIMITED_TIME_OFFER':
        preview.offer = {
          text: component.text,
          hasExpiration: component.hasExpiration ?? false,
        }
        break
      default:
        preview.advanced.push({
          label:
            typeof component.raw.type === 'string'
              ? component.raw.type
              : 'CUSTOM',
        })
    }
  }

  return preview
}
