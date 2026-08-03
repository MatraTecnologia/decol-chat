/**
 * Montagem do payload de criação/edição de template na Graph API.
 *
 * Conversão pura: sem Prisma e sem HTTP, para poder rodar em `node --test` sem
 * subir nada. Por isso este módulo só importa tipo — `template-payload.ts` é a
 * fachada para o resto da API, mas não pode ser carregado pelo runner (o
 * `node --test` não reescreve o `.js` do import relativo para `.ts`).
 */
import type { TemplateDefinition } from '@workspace/shared/whatsapp-templates'

import type {
  MetaRecord,
  MetaTemplatePayload,
  ParameterFormat,
  TemplateButton,
  TemplateComponent,
} from './template-payload.js'

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/**
 * Nomes na ordem da primeira ocorrência, sem repetir — a mesma contagem que o
 * schema compartilhado usa para exigir um exemplo por variável.
 */
export const extractVariables = (text: string) => {
  const names: string[] = []

  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const name = match[1]
    if (name && !names.includes(name)) names.push(name)
  }

  return names
}

const namedParams = (text: string, examples: string[]) =>
  extractVariables(text).map((param_name, index) => ({
    param_name,
    example: examples[index] ?? '',
  }))

const headerTextExample = (
  format: ParameterFormat,
  text: string,
  examples?: string[],
) => {
  if (!examples?.length) return undefined

  return format === 'NAMED'
    ? { example: { header_text_named_params: namedParams(text, examples) } }
    : { example: { header_text: examples } }
}

const bodyTextExample = (
  format: ParameterFormat,
  text: string,
  examples?: string[],
) => {
  if (!examples?.length) return undefined

  return format === 'NAMED'
    ? { example: { body_text_named_params: namedParams(text, examples) } }
    : { example: { body_text: [examples] } }
}

const mediaExample = (example?: string) =>
  example ? { example: { header_handle: [example] } } : undefined

const optional = <T>(key: string, value: T | undefined | null) =>
  value === undefined || value === null ? undefined : { [key]: value }

const toMetaButton = (button: TemplateButton): MetaRecord => {
  switch (button.kind) {
    case 'QUICK_REPLY':
      return { type: 'QUICK_REPLY', text: button.text }
    case 'URL':
      return {
        type: 'URL',
        text: button.text,
        url: button.url,
        ...(button.examples?.length ? { example: button.examples } : {}),
      }
    case 'PHONE_NUMBER':
      return {
        type: 'PHONE_NUMBER',
        text: button.text,
        phone_number: button.phoneNumber,
      }
    case 'COPY_CODE':
      return {
        type: 'COPY_CODE',
        text: button.text,
        ...optional('example', button.example),
      }
    case 'OTP':
      return {
        type: 'OTP',
        otp_type: button.otpType,
        text: button.text,
        ...optional('autofill_text', button.autofillText),
        ...optional('package_name', button.packageName),
        ...optional('signature_hash', button.signatureHash),
      }
    case 'CATALOG':
      return {
        type: 'CATALOG',
        text: button.text,
        ...optional(
          'thumbnail_product_retailer_id',
          button.thumbnailProductRetailerId,
        ),
      }
    case 'FLOW':
      return {
        type: 'FLOW',
        text: button.text,
        flow_id: button.flowId,
        ...optional('flow_action', button.flowAction),
        ...optional('navigate_screen', button.navigateScreen),
        ...optional('flow_action_payload', button.flowData),
      }
  }
}

const toMetaComponent = (
  format: ParameterFormat,
  component: TemplateComponent,
): MetaRecord => {
  switch (component.type) {
    case 'HEADER':
      if (component.format === 'TEXT') {
        return {
          type: 'HEADER',
          format: 'TEXT',
          text: component.text,
          ...headerTextExample(format, component.text, component.examples),
        }
      }

      if (component.format === 'LOCATION') {
        return { type: 'HEADER', format: 'LOCATION' }
      }

      return {
        type: 'HEADER',
        format: component.format,
        ...mediaExample(component.example),
      }
    case 'BODY':
      return {
        type: 'BODY',
        text: component.text,
        ...bodyTextExample(format, component.text, component.examples),
      }
    case 'FOOTER':
      return { type: 'FOOTER', text: component.text }
    case 'BUTTONS':
      return { type: 'BUTTONS', buttons: component.buttons.map(toMetaButton) }
    case 'CAROUSEL':
      return {
        type: 'CAROUSEL',
        cards: component.cards.map(card => ({
          components: [
            {
              type: 'HEADER',
              format: card.header.format,
              ...mediaExample(card.header.example),
            },
            {
              type: 'BODY',
              text: card.body.text,
              ...bodyTextExample(format, card.body.text, card.body.examples),
            },
            ...(card.buttons?.length
              ? [{ type: 'BUTTONS', buttons: card.buttons.map(toMetaButton) }]
              : []),
          ],
        })),
      }
    case 'LIMITED_TIME_OFFER':
      return {
        type: 'LIMITED_TIME_OFFER',
        limited_time_offer: {
          text: component.text,
          ...optional('has_expiration', component.hasExpiration),
        },
      }
    case 'CUSTOM':
      return { ...component.raw }
  }
}

export const toMetaTemplatePayload = (
  definition: TemplateDefinition,
): MetaTemplatePayload => ({
  language: definition.language,
  category: definition.category,
  parameter_format: definition.parameterFormat,
  components: definition.components.map(component =>
    toMetaComponent(definition.parameterFormat, component),
  ),
})
