/**
 * Leitura do payload que a Meta devolve em `/message_templates`.
 *
 * Tudo que não casa exatamente com um componente conhecido volta como `CUSTOM`
 * com o objeto cru intacto, para que `toMetaTemplatePayload` consiga reenviá-lo
 * sem perder campo nenhum.
 */
import type { TemplateDefinition } from '@workspace/shared/whatsapp-templates'

import type {
  MetaRecord,
  MetaTemplateEntry,
  TemplateButton,
  TemplateComponent,
} from './template-payload.js'

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION']
const MEDIA_FORMATS = ['IMAGE', 'VIDEO', 'DOCUMENT']
const BUTTON_KINDS = [
  'QUICK_REPLY',
  'URL',
  'PHONE_NUMBER',
  'COPY_CODE',
  'OTP',
  'CATALOG',
  'FLOW',
]

const isRecord = (value: unknown): value is MetaRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter(item => typeof item === 'string') : []

const custom = (raw: MetaRecord): TemplateComponent => ({
  type: 'CUSTOM',
  raw: { ...raw },
})

/** `header_text` é lista simples, `body_text` é lista de listas e a variante
 * nomeada troca as duas por `{ param_name, example }`. */
const readExamples = (example: unknown, key: 'header_text' | 'body_text') => {
  if (!isRecord(example)) return undefined

  const named = example[`${key}_named_params`]
  if (Array.isArray(named)) {
    return named.map(item => (isRecord(item) ? (str(item.example) ?? '') : ''))
  }

  const value = example[key]
  if (key === 'body_text') {
    const first = Array.isArray(value) ? value[0] : undefined
    const parsed = strings(first)
    return parsed.length ? parsed : undefined
  }

  const parsed = strings(value)
  return parsed.length ? parsed : undefined
}

const readHandle = (example: unknown) => {
  if (!isRecord(example)) return undefined

  return strings(example.header_handle)[0]
}

const fromMetaButton = (raw: unknown): TemplateButton | null => {
  if (!isRecord(raw)) return null

  const kind = str(raw.type)
  const text = str(raw.text)
  if (!kind || !BUTTON_KINDS.includes(kind)) return null
  if (kind !== 'OTP' && !text) return null

  switch (kind) {
    case 'QUICK_REPLY':
      return { kind, text: text! }
    case 'URL': {
      const url = str(raw.url)
      if (!url) return null
      const examples = strings(raw.example)

      return {
        kind,
        text: text!,
        url,
        ...(examples.length ? { examples } : {}),
      }
    }
    case 'PHONE_NUMBER': {
      const phoneNumber = str(raw.phone_number)
      if (!phoneNumber) return null

      return { kind, text: text!, phoneNumber }
    }
    case 'COPY_CODE': {
      const example = strings(raw.example)[0] ?? str(raw.example)

      return { kind, text: text!, ...(example ? { example } : {}) }
    }
    case 'OTP': {
      const otpType = str(raw.otp_type)
      if (!otpType || !['COPY_CODE', 'ONE_TAP', 'ZERO_TAP'].includes(otpType)) {
        return null
      }

      return {
        kind,
        otpType: otpType as 'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP',
        text: text ?? otpType,
        ...(str(raw.autofill_text) ? { autofillText: str(raw.autofill_text) } : {}),
        ...(str(raw.package_name) ? { packageName: str(raw.package_name) } : {}),
        ...(str(raw.signature_hash)
          ? { signatureHash: str(raw.signature_hash) }
          : {}),
      }
    }
    case 'CATALOG':
      return {
        kind,
        text: text!,
        ...(str(raw.thumbnail_product_retailer_id)
          ? {
              thumbnailProductRetailerId: str(
                raw.thumbnail_product_retailer_id,
              ),
            }
          : {}),
      }
    default: {
      const flowId = str(raw.flow_id)
      if (!flowId) return null
      const flowAction = str(raw.flow_action)

      return {
        kind: 'FLOW',
        text: text!,
        flowId,
        ...(flowAction === 'navigate' || flowAction === 'data_exchange'
          ? { flowAction }
          : {}),
        ...(str(raw.navigate_screen)
          ? { navigateScreen: str(raw.navigate_screen) }
          : {}),
        ...(isRecord(raw.flow_action_payload)
          ? { flowData: raw.flow_action_payload }
          : {}),
      }
    }
  }
}

const fromMetaButtons = (raw: MetaRecord): TemplateComponent => {
  const source = Array.isArray(raw.buttons) ? raw.buttons : []
  const buttons = source.map(fromMetaButton)

  if (!buttons.length || buttons.some(button => button === null)) {
    return custom(raw)
  }

  return { type: 'BUTTONS', buttons: buttons as TemplateButton[] }
}

const fromMetaHeader = (raw: MetaRecord): TemplateComponent => {
  const format = str(raw.format)

  if (format === 'TEXT') {
    const text = str(raw.text)
    if (!text) return custom(raw)
    const examples = readExamples(raw.example, 'header_text')

    return {
      type: 'HEADER',
      format: 'TEXT',
      text,
      ...(examples ? { examples } : {}),
    }
  }

  if (format === 'LOCATION') return { type: 'HEADER', format: 'LOCATION' }

  if (format && MEDIA_FORMATS.includes(format)) {
    const example = readHandle(raw.example)

    return {
      type: 'HEADER',
      format: format as 'IMAGE' | 'VIDEO' | 'DOCUMENT',
      ...(example ? { example } : {}),
    }
  }

  return custom(raw)
}

const fromMetaCarousel = (raw: MetaRecord): TemplateComponent => {
  const source = Array.isArray(raw.cards) ? raw.cards : []
  const cards: Extract<TemplateComponent, { type: 'CAROUSEL' }>['cards'] = []

  for (const card of source) {
    if (!isRecord(card) || !Array.isArray(card.components)) return custom(raw)

    const parts = card.components.filter(isRecord)
    const header = parts.find(part => str(part.type) === 'HEADER')
    const body = parts.find(part => str(part.type) === 'BODY')
    const buttons = parts.find(part => str(part.type) === 'BUTTONS')

    const format = header ? str(header.format) : undefined
    const text = body ? str(body.text) : undefined
    if (!format || !MEDIA_FORMATS.includes(format) || !text) return custom(raw)

    const handle = header ? readHandle(header.example) : undefined
    const examples = body ? readExamples(body.example, 'body_text') : undefined
    const parsedButtons = buttons ? fromMetaButtons(buttons) : null
    if (parsedButtons && parsedButtons.type !== 'BUTTONS') return custom(raw)

    cards.push({
      header: {
        format: format as 'IMAGE' | 'VIDEO' | 'DOCUMENT',
        ...(handle ? { example: handle } : {}),
      },
      body: { text, ...(examples ? { examples } : {}) },
      ...(parsedButtons ? { buttons: parsedButtons.buttons } : {}),
    })
  }

  return cards.length ? { type: 'CAROUSEL', cards } : custom(raw)
}

const fromMetaComponent = (raw: unknown): TemplateComponent => {
  if (!isRecord(raw)) return custom({ value: raw })

  switch (str(raw.type)) {
    case 'HEADER':
      return fromMetaHeader(raw)
    case 'BODY': {
      const text = str(raw.text)
      if (!text) return custom(raw)
      const examples = readExamples(raw.example, 'body_text')

      return { type: 'BODY', text, ...(examples ? { examples } : {}) }
    }
    case 'FOOTER': {
      const text = str(raw.text)

      return text ? { type: 'FOOTER', text } : custom(raw)
    }
    case 'BUTTONS':
      return fromMetaButtons(raw)
    case 'CAROUSEL':
      return fromMetaCarousel(raw)
    case 'LIMITED_TIME_OFFER': {
      const offer = raw.limited_time_offer
      const text = isRecord(offer) ? str(offer.text) : undefined
      if (!text) return custom(raw)
      const hasExpiration = isRecord(offer) ? offer.has_expiration : undefined

      return {
        type: 'LIMITED_TIME_OFFER',
        text,
        ...(typeof hasExpiration === 'boolean' ? { hasExpiration } : {}),
      }
    }
    default:
      return custom(raw)
  }
}

export const fromMetaTemplatePayload = (
  remote: MetaTemplateEntry,
): TemplateDefinition => {
  const category = (remote.category ?? '').toUpperCase()
  const parameterFormat = (remote.parameter_format ?? '').toUpperCase()

  return {
    category: (CATEGORIES.includes(category)
      ? category
      : 'UTILITY') as TemplateDefinition['category'],
    language: remote.language ?? '',
    parameterFormat: parameterFormat === 'NAMED' ? 'NAMED' : 'POSITIONAL',
    components: (remote.components ?? []).map(fromMetaComponent),
  }
}
