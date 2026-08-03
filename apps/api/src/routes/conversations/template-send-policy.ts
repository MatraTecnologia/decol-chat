/**
 * Contrato de envio por template: o que a rota aceita, o que a Meta recebe e o
 * que fica gravado na mensagem.
 *
 * A resolução do modelo aprovado (escopo da conta, status `APPROVED`, revisão
 * enviada ou espelho remoto, casamento dos parâmetros) já vive em
 * `lib/whatsapp/templates/service.ts` — aqui entram só as partes puras, preview
 * legível e snapshot auditável. O lookup é injetado em vez de importado para
 * que este módulo continue carregável pelo `node --test`.
 */
import type {
  TemplateDefinition,
  TemplateSendParameters,
} from '@workspace/shared/whatsapp-templates'

import type {
  MetaMessageComponent,
  TemplateComponent,
} from '@/lib/whatsapp/template-payload.js'

import type { TemplateResult } from '@/lib/whatsapp/templates/results.js'
import type { ApprovedTemplateForSend } from '@/lib/whatsapp/templates/service.js'

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

/** Cabe numa linha da lista de conversas — é o `lastMessageText`. */
const PREVIEW_LIMIT = 280

type ParameterValues = string[] | Record<string, string>

export interface TemplateSendSnapshot {
  template: {
    id: string
    revisionId: string | null
    name: string
    language: string
    parameters: TemplateSendParameters
    components: MetaMessageComponent[]
  }
}

export interface ApprovedTemplateSend {
  templateId: string
  revisionId: string | null
  name: string
  languageCode: string
  components: MetaMessageComponent[]
  preview: string
  snapshot: TemplateSendSnapshot
}

export type ApprovedTemplateLookup = (
  accountId: string,
  templateId: string,
  parameters?: TemplateSendParameters,
) => Promise<TemplateResult<ApprovedTemplateForSend>>

const bodyComponent = (definition: Pick<TemplateDefinition, 'components'>) =>
  definition.components.find(
    (part): part is Extract<TemplateComponent, { type: 'BODY' }> =>
      part.type === 'BODY',
  ) ?? null

/**
 * Substitui na mesma ordem que o envio: nomeado casa pela chave, posicional
 * pela ordem de primeira aparição. Variável sem valor fica como está — o
 * preview nunca é a fonte da verdade do que foi enviado.
 */
const substitute = (text: string, values: ParameterValues | undefined) => {
  const names = extractVariables(text)
  if (!names.length) return text

  const list = Array.isArray(values) ? values : null
  const named = values && !Array.isArray(values) ? values : null

  return text.replace(VARIABLE_PATTERN, (match, name: string) => {
    const value = list ? list[names.indexOf(name)] : named?.[name]

    return value ?? match
  })
}

const truncate = (text: string) =>
  text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT - 1)}…` : text

export const buildTemplatePreview = (
  name: string,
  definition: Pick<TemplateDefinition, 'components'>,
  parameters: TemplateSendParameters = {},
) => {
  const body = bodyComponent(definition)
  const text = body
    ? substitute(body.text, parameters.body).replace(/\s+/g, ' ').trim()
    : ''

  return text ? truncate(text) : `Modelo: ${name}`
}

/** Só as quatro chaves do contrato entram no snapshot — nada do request cru. */
const sanitizeParameters = ({
  header,
  body,
  buttons,
  cards,
}: TemplateSendParameters): TemplateSendParameters => ({
  ...(header ? { header } : {}),
  ...(body ? { body } : {}),
  ...(buttons ? { buttons } : {}),
  ...(cards ? { cards } : {}),
})

export const buildTemplateSnapshot = (
  template: Pick<
    ApprovedTemplateForSend,
    'templateId' | 'revisionId' | 'name' | 'languageCode' | 'components'
  >,
  parameters: TemplateSendParameters = {},
): TemplateSendSnapshot => ({
  template: {
    id: template.templateId,
    revisionId: template.revisionId,
    name: template.name,
    language: template.languageCode,
    parameters: sanitizeParameters(parameters),
    components: template.components,
  },
})

/**
 * Recebe o lookup do domínio e devolve o resolvedor usado pelas rotas de envio.
 * Falha do lookup passa direto: quem chama traduz `not_found` em 404 e o resto
 * em 422, sem nunca ter tocado a Meta.
 */
export const createApprovedTemplateResolver =
  (lookup: ApprovedTemplateLookup) =>
  async (
    accountId: string,
    templateId: string,
    parameters: TemplateSendParameters = {},
  ): Promise<TemplateResult<ApprovedTemplateSend>> => {
    const result = await lookup(accountId, templateId, parameters)
    if (result.status !== 'ok') return result

    const { data } = result

    return {
      status: 'ok',
      data: {
        templateId: data.templateId,
        revisionId: data.revisionId,
        name: data.name,
        languageCode: data.languageCode,
        components: data.components,
        preview: buildTemplatePreview(data.name, data.definition, parameters),
        snapshot: buildTemplateSnapshot(data, parameters),
      },
    }
  }
