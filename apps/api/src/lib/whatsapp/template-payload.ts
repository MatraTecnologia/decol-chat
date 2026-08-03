/**
 * Fachada do adaptador entre a `TemplateDefinition` compartilhada e a Graph API.
 *
 * Declara os tipos do payload da Meta e reexporta as três conversões. A
 * implementação vive nos irmãos porque o `node --test` não reescreve o `.js`
 * dos imports relativos para `.ts` — este arquivo, por reexportar valor, só é
 * carregável pelo tsx/tsc, e é ele que o resto da API deve importar.
 */
import type { TemplateDefinition } from '@workspace/shared/whatsapp-templates'

export {
  extractVariables,
  toMetaTemplatePayload,
} from './template-create-payload.js'
export { fromMetaTemplatePayload } from './template-remote-payload.js'
export {
  TemplateParametersError,
  toMetaMessageComponents,
} from './template-send-payload.js'
export type {
  MetaMessageComponent,
  MetaMessageParameter,
} from './template-send-payload.js'

export type MetaRecord = Record<string, unknown>

export interface MetaTemplatePayload {
  language: string
  category: string
  parameter_format: string
  components: MetaRecord[]
}

export interface MetaTemplateEntry {
  id?: string
  name?: string
  language?: string
  status?: string
  category?: string
  quality_score?: { score?: string } | string
  rejected_reason?: string
  parameter_format?: string
  last_updated_time?: string
  components?: unknown[]
}

export interface MetaTemplatePage {
  data?: MetaTemplateEntry[]
  paging?: { cursors?: { after?: string }; next?: string }
}

export type TemplateComponent = TemplateDefinition['components'][number]
export type TemplateButton = Extract<
  TemplateComponent,
  { type: 'BUTTONS' }
>['buttons'][number]
export type ParameterFormat = TemplateDefinition['parameterFormat']
