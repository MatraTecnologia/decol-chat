/**
 * Orquestração dos rascunhos: criar, editar com trava otimista, duplicar,
 * apagar e resolver a definição aprovada para envio.
 *
 * O envio à Meta e a exclusão remota vivem em `submission.ts` e são
 * reexportados aqui — para quem consome, `service.ts` é a fachada do domínio.
 */
import type {
  TemplateDefinition,
  TemplateSendParameters,
} from '@workspace/shared/whatsapp-templates'

import type { Prisma } from '@/generated/prisma/client.js'

import type { MetaMessageComponent } from '../template-payload.js'
import {
  TemplateParametersError,
  toMetaMessageComponents,
} from '../template-payload.js'

import {
  draftRevision,
  isUniqueViolation,
  latestRevision,
  resolveApprovedDefinition,
  resolveDefinition,
} from './definitions.js'
import {
  matchesExpectedLockVersion,
  nextRevisionVersion,
} from './policy.js'
import type { TemplateWithRevisions } from './repository.js'
import {
  applyDraftUpdate,
  createDraftRevision,
  createTemplateWithDraft,
  deleteRevision,
  deleteTemplate,
  findTemplate,
  findTemplateByName,
  updateTemplate,
} from './repository.js'
import type { TemplateResult } from './results.js'
import { conflict, duplicate, invalid, notFound, ok } from './results.js'

export {
  deleteRemoteTemplate,
  submitRevision,
  type SubmitRevisionInput,
  type SubmitRevisionResult,
} from './submission.js'

const asJson = (definition: TemplateDefinition) =>
  definition as unknown as Prisma.InputJsonValue

export interface CreateDraftInput {
  accountId: string
  name: string
  definition: TemplateDefinition
  actorId: string
}

export const createDraft = async (
  input: CreateDraftInput,
): Promise<TemplateResult<TemplateWithRevisions>> => {
  const { definition } = input

  const existing = await findTemplateByName(
    input.accountId,
    input.name,
    definition.language,
  )
  if (existing) {
    return duplicate('Já existe um modelo com este nome neste idioma.')
  }

  try {
    return ok(
      await createTemplateWithDraft({
        accountId: input.accountId,
        name: input.name,
        language: definition.language,
        category: definition.category,
        parameterFormat: definition.parameterFormat,
        definition: asJson(definition),
        actorId: input.actorId,
      }),
    )
  } catch (error) {
    if (!isUniqueViolation(error)) throw error

    return duplicate('Já existe um modelo com este nome neste idioma.')
  }
}

export interface UpdateDraftInput {
  accountId: string
  templateId: string
  expectedLockVersion: number
  definition: TemplateDefinition
  actorId: string
}

/**
 * Rascunho é editado no lugar; revisão já enviada é imutável, então a edição
 * abre a próxima versão. Nos dois caminhos a trava otimista tem que bater.
 */
export const updateDraft = async (
  input: UpdateDraftInput,
): Promise<TemplateResult<TemplateWithRevisions>> => {
  const template = await findTemplate(input.accountId, input.templateId)
  if (!template) return notFound()

  const latest = latestRevision(template)
  if (!latest) return conflict('O modelo não tem nenhuma revisão.')

  if (!matchesExpectedLockVersion(latest.lockVersion, input.expectedLockVersion)) {
    return conflict('O modelo mudou desde que você abriu o editor.')
  }

  const { definition } = input
  const payload = {
    definition: asJson(definition),
    parameterFormat: definition.parameterFormat,
  }

  if (latest.state === 'DRAFT') {
    const applied = await applyDraftUpdate(
      latest.id,
      input.expectedLockVersion,
      payload,
    )
    if (!applied) {
      return conflict('O modelo mudou desde que você abriu o editor.')
    }
  } else {
    try {
      await createDraftRevision({
        templateId: template.id,
        version: nextRevisionVersion(template.revisions),
        ...payload,
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error

      return conflict('Outra revisão foi criada enquanto você editava.')
    }
  }

  await updateTemplate(template.id, {
    category: definition.category,
    updatedById: input.actorId,
  })

  const refreshed = await findTemplate(input.accountId, template.id)

  return refreshed ? ok(refreshed) : notFound()
}

export interface DuplicateTemplateInput {
  accountId: string
  templateId: string
  name: string
  actorId: string
}

export const duplicateTemplate = async (
  input: DuplicateTemplateInput,
): Promise<TemplateResult<TemplateWithRevisions>> => {
  const source = await findTemplate(input.accountId, input.templateId)
  if (!source) return notFound()

  const definition = resolveDefinition(source)
  if (!definition) {
    return invalid('O modelo de origem não tem uma definição utilizável.')
  }

  return createDraft({
    accountId: input.accountId,
    name: input.name,
    definition,
    actorId: input.actorId,
  })
}

/**
 * Exclusão local apaga só o rascunho. O modelo inteiro só some quando nunca
 * chegou à Meta e não guarda revisão enviada — histórico não se apaga.
 */
export const deleteDraft = async (
  accountId: string,
  templateId: string,
  actorId: string,
): Promise<TemplateResult<{ removedTemplate: boolean }>> => {
  const template = await findTemplate(accountId, templateId)
  if (!template) return notFound()

  const draft = draftRevision(template)
  const hasHistory = template.revisions.some(
    revision => revision.state !== 'DRAFT',
  )

  if (!template.metaTemplateId && !hasHistory) {
    await deleteTemplate(template.id)

    return ok({ removedTemplate: true })
  }

  if (!draft) return conflict('Este modelo não tem rascunho para apagar.')

  await deleteRevision(draft.id)
  await updateTemplate(template.id, { updatedById: actorId })

  return ok({ removedTemplate: false })
}

export interface ApprovedTemplateForSend {
  templateId: string
  revisionId: string | null
  name: string
  languageCode: string
  definition: TemplateDefinition
  components: MetaMessageComponent[]
}

/**
 * Só modelo aprovado da própria conta pode ser enviado — a checagem fica aqui
 * para que as duas rotas de envio não precisem repeti-la.
 */
export const getApprovedTemplateForSend = async (
  accountId: string,
  templateId: string,
  parameters: TemplateSendParameters = {},
): Promise<TemplateResult<ApprovedTemplateForSend>> => {
  const template = await findTemplate(accountId, templateId)
  if (!template) return notFound()

  if (template.remoteStatus !== 'APPROVED') {
    return invalid('O modelo ainda não foi aprovado pela Meta.')
  }

  const approved = resolveApprovedDefinition(template)
  if (!approved) {
    return invalid('O modelo não tem uma definição aprovada utilizável.')
  }

  const { definition, revisionId } = approved

  try {
    return ok({
      templateId: template.id,
      revisionId,
      name: template.name,
      languageCode: template.language,
      definition,
      components: toMetaMessageComponents(definition, parameters),
    })
  } catch (error) {
    if (!(error instanceof TemplateParametersError)) throw error

    return invalid(error.message)
  }
}
