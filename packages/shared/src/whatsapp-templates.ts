import { z } from 'zod'

import type { RoleType } from './roles.js'

export const TEMPLATE_READERS: RoleType[] = [
  'admin',
  'manager',
  'agent',
  'viewer',
]
export const TEMPLATE_MANAGERS: RoleType[] = ['admin', 'manager']

export const canReadTemplates = (role: RoleType) =>
  TEMPLATE_READERS.includes(role)
export const canManageTemplates = (role: RoleType) =>
  TEMPLATE_MANAGERS.includes(role)

export const templateCategorySchema = z.enum([
  'MARKETING',
  'UTILITY',
  'AUTHENTICATION',
])

export const templateParameterFormatSchema = z.enum(['POSITIONAL', 'NAMED'])

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

const countVariables = (text: string) => {
  const names = new Set<string>()
  for (const match of text.matchAll(VARIABLE_PATTERN)) names.add(match[1]!)
  return names.size
}

const withMatchingExamples = <T extends z.ZodType>(
  schema: T,
  read: (value: z.output<T>) => { text: string; examples?: string[] },
) =>
  schema.superRefine((value, ctx) => {
    const { text, examples = [] } = read(value as z.output<T>)
    if (countVariables(text) === examples.length) return

    ctx.addIssue({
      code: 'custom',
      path: ['examples'],
      message: 'Informe um exemplo para cada variável do texto.',
    })
  })

const quickReplyButtonSchema = z.object({
  kind: z.literal('QUICK_REPLY'),
  text: z.string().min(1),
})

const urlButtonSchema = withMatchingExamples(
  z.object({
    kind: z.literal('URL'),
    text: z.string().min(1),
    url: z.url(),
    examples: z.array(z.string()).optional(),
  }),
  value => ({ text: value.url, examples: value.examples }),
)

const phoneNumberButtonSchema = z.object({
  kind: z.literal('PHONE_NUMBER'),
  text: z.string().min(1),
  phoneNumber: z.string().min(1),
})

const copyCodeButtonSchema = z.object({
  kind: z.literal('COPY_CODE'),
  text: z.string().min(1),
  example: z.string().optional(),
})

const otpButtonSchema = z.object({
  kind: z.literal('OTP'),
  otpType: z.enum(['COPY_CODE', 'ONE_TAP', 'ZERO_TAP']),
  text: z.string().min(1),
  autofillText: z.string().optional(),
  packageName: z.string().optional(),
  signatureHash: z.string().optional(),
})

const catalogButtonSchema = z.object({
  kind: z.literal('CATALOG'),
  text: z.string().min(1),
  thumbnailProductRetailerId: z.string().optional(),
})

const flowButtonSchema = z.object({
  kind: z.literal('FLOW'),
  text: z.string().min(1),
  flowId: z.string().min(1),
  flowAction: z.enum(['navigate', 'data_exchange']).optional(),
  navigateScreen: z.string().optional(),
  flowData: z.record(z.string(), z.unknown()).optional(),
})

const templateButtonSchema = z.discriminatedUnion('kind', [
  quickReplyButtonSchema,
  urlButtonSchema,
  phoneNumberButtonSchema,
  copyCodeButtonSchema,
  otpButtonSchema,
  catalogButtonSchema,
  flowButtonSchema,
])

const textBlockSchema = withMatchingExamples(
  z.object({
    text: z.string().min(1),
    examples: z.array(z.string()).optional(),
  }),
  value => value,
)

const mediaFormatSchema = z.enum(['IMAGE', 'VIDEO', 'DOCUMENT'])

const headerComponentSchema = z.discriminatedUnion('format', [
  withMatchingExamples(
    z.object({
      type: z.literal('HEADER'),
      format: z.literal('TEXT'),
      text: z.string().min(1),
      examples: z.array(z.string()).optional(),
    }),
    value => value,
  ),
  z.object({
    type: z.literal('HEADER'),
    format: mediaFormatSchema,
    assetId: z.string().min(1).optional(),
    example: z.string().optional(),
  }),
  z.object({
    type: z.literal('HEADER'),
    format: z.literal('LOCATION'),
  }),
])

const bodyComponentSchema = withMatchingExamples(
  z.object({
    type: z.literal('BODY'),
    text: z.string().min(1),
    examples: z.array(z.string()).optional(),
  }),
  value => value,
)

const footerComponentSchema = z.object({
  type: z.literal('FOOTER'),
  text: z.string().min(1),
})

const buttonsComponentSchema = z.object({
  type: z.literal('BUTTONS'),
  buttons: z.array(templateButtonSchema).min(1),
})

const carouselComponentSchema = z.object({
  type: z.literal('CAROUSEL'),
  cards: z
    .array(
      z.object({
        header: z.object({
          format: mediaFormatSchema,
          assetId: z.string().min(1).optional(),
          example: z.string().optional(),
        }),
        body: textBlockSchema,
        buttons: z.array(templateButtonSchema).optional(),
      }),
    )
    .min(1),
})

const limitedTimeOfferComponentSchema = z.object({
  type: z.literal('LIMITED_TIME_OFFER'),
  text: z.string().min(1),
  hasExpiration: z.boolean().optional(),
})

const PROTECTED_KEYS = [
  'accessToken',
  'whatsAppAccountId',
  'createdById',
  'updatedById',
  'remoteStatus',
  'remotePayload',
]

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

const customComponentSchema = z
  .object({
    type: z.literal('CUSTOM'),
    raw: z.record(z.string(), z.unknown()),
  })
  .superRefine((value, ctx) => {
    const found = findProtectedKey(value.raw)
    if (!found) return

    ctx.addIssue({
      code: 'custom',
      path: ['raw'],
      message: `O campo "${found}" não pode ser definido pelo JSON avançado.`,
    })
  })

const templateComponentSchema = z.discriminatedUnion('type', [
  headerComponentSchema,
  bodyComponentSchema,
  footerComponentSchema,
  buttonsComponentSchema,
  carouselComponentSchema,
  limitedTimeOfferComponentSchema,
  customComponentSchema,
])

export const templateDefinitionSchema = z.object({
  category: templateCategorySchema,
  language: z.string().min(2),
  parameterFormat: templateParameterFormatSchema,
  components: z.array(templateComponentSchema).min(1),
})

const parameterValuesSchema = z.union([
  z.array(z.string()),
  z.record(z.string(), z.string()),
])

export const templateSendParametersSchema = z.object({
  header: parameterValuesSchema.optional(),
  body: parameterValuesSchema.optional(),
  buttons: z.array(parameterValuesSchema).optional(),
  cards: z.array(parameterValuesSchema).optional(),
})

export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>
export type TemplateSendParameters = z.infer<typeof templateSendParametersSchema>
