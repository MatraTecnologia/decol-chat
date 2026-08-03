/**
 * Envio da revisão para aprovação e exclusão do template na Meta.
 *
 * A revisão é selada antes da chamada HTTP: se a Meta recusar, ela volta a
 * `DRAFT` com a resposta gravada — o rascunho nunca se perde por erro remoto.
 */
import { Prisma } from '@/generated/prisma/client.js'

import { getConnection } from '../connection.js'
import {
  GraphApiError,
  createMessageTemplate,
  deleteMessageTemplate,
  updateMessageTemplate,
} from '../graph-client.js'
import { toMetaTemplatePayload } from '../template-payload.js'

import {
  draftRevision,
  firstIssueMessage,
  isUniqueViolation,
  parseDefinition,
} from './definitions.js'
import type { TemplateWithRevisions } from './repository.js'
import {
  findRevisionByIdempotencyKey,
  findTemplate,
  recordSubmission,
  revertSealedRevision,
  sealDraftRevision,
  updateTemplate,
} from './repository.js'
import type { TemplateResult } from './results.js'
import { conflict, invalid, notFound, ok, remoteError } from './results.js'

const asJson = (value: unknown) => value as Prisma.InputJsonValue

const graphErrorSnapshot = (error: GraphApiError) => ({
  status: error.status,
  message: error.message,
  code: error.code ?? null,
  type: error.type ?? null,
  fbtraceId: error.fbtraceId ?? null,
})

export interface SubmitRevisionInput {
  accountId: string
  templateId: string
  actorId: string
  idempotencyKey?: string
}

export interface SubmitRevisionResult {
  template: TemplateWithRevisions
  revisionId: string
  replayed: boolean
}

export const submitRevision = async (
  input: SubmitRevisionInput,
): Promise<TemplateResult<SubmitRevisionResult>> => {
  // Repetir a chave devolve o resultado anterior sem tocar na Meta.
  if (input.idempotencyKey) {
    const previous = await findRevisionByIdempotencyKey(input.idempotencyKey)

    if (
      previous &&
      previous.templateId === input.templateId &&
      previous.state !== 'DRAFT' &&
      previous.submissionResponse
    ) {
      const current = await findTemplate(input.accountId, input.templateId)

      return current
        ? ok({ template: current, revisionId: previous.id, replayed: true })
        : notFound()
    }
  }

  const template = await findTemplate(input.accountId, input.templateId)
  if (!template) return notFound()

  const draft = draftRevision(template)
  if (!draft) return conflict('Este modelo não tem rascunho para enviar.')

  const parsed = parseDefinition(draft.definition)
  if (!parsed.success) return invalid(firstIssueMessage(parsed.error))

  const connection = await getConnection()
  if (!connection || connection.id !== template.whatsAppAccountId) {
    return invalid('A conta do WhatsApp deste modelo não está conectada.')
  }

  let sealed: Awaited<ReturnType<typeof sealDraftRevision>>
  try {
    sealed = await sealDraftRevision({
      revisionId: draft.id,
      templateId: template.id,
      actorId: input.actorId,
      lockVersion: draft.lockVersion,
      idempotencyKey: input.idempotencyKey ?? draft.idempotencyKey,
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error

    return conflict('Esta chave de idempotência já foi usada.')
  }

  if (!sealed) return conflict('O rascunho mudou durante o envio.')

  const meta = toMetaTemplatePayload(parsed.data)
  const request = template.metaTemplateId
    ? // Nome e idioma são imutáveis na Meta — a edição só carrega o resto.
      { category: meta.category, components: meta.components }
    : { name: template.name, ...meta }

  try {
    const response = template.metaTemplateId
      ? await updateMessageTemplate(
          connection.accessToken,
          template.metaTemplateId,
          request,
        )
      : await createMessageTemplate(
          connection.accessToken,
          connection.wabaId,
          request,
        )

    const updated = await recordSubmission({
      revisionId: sealed.id,
      templateId: template.id,
      actorId: input.actorId,
      submissionResponse: asJson({ request, response }),
      metaTemplateId: response.id ?? template.metaTemplateId,
      remoteStatus: response.status ?? 'PENDING',
    })

    return ok({ template: updated, revisionId: sealed.id, replayed: false })
  } catch (error) {
    if (!(error instanceof GraphApiError)) throw error

    const snapshot = graphErrorSnapshot(error)
    await revertSealedRevision(sealed.id, asJson({ request, error: snapshot }))
    await updateTemplate(template.id, {
      lastSyncAttemptAt: new Date(),
      lastSyncError: error.message,
    })

    return remoteError(error.message, error.status)
  }
}

/**
 * Apagar na Meta não apaga a linha local: o histórico de revisões e a trilha
 * de auditoria continuam valendo. Só o espelho remoto é zerado.
 */
export const deleteRemoteTemplate = async (
  accountId: string,
  templateId: string,
  actorId: string,
): Promise<TemplateResult<TemplateWithRevisions>> => {
  const template = await findTemplate(accountId, templateId)
  if (!template) return notFound()

  if (!template.metaTemplateId) {
    return invalid('Este modelo ainda não existe na Meta.')
  }

  const connection = await getConnection()
  if (!connection || connection.id !== template.whatsAppAccountId) {
    return invalid('A conta do WhatsApp deste modelo não está conectada.')
  }

  try {
    await deleteMessageTemplate(
      connection.accessToken,
      connection.wabaId,
      template.name,
      template.metaTemplateId,
    )
  } catch (error) {
    if (!(error instanceof GraphApiError)) throw error

    await updateTemplate(template.id, {
      lastSyncAttemptAt: new Date(),
      lastSyncError: error.message,
    })

    return remoteError(error.message, error.status)
  }

  await updateTemplate(template.id, {
    metaTemplateId: null,
    remoteStatus: null,
    remoteQuality: null,
    rejectionReason: null,
    remotePayload: Prisma.JsonNull,
    remoteUpdatedAt: null,
    lastSyncError: null,
    updatedById: actorId,
  })

  const refreshed = await findTemplate(accountId, templateId)

  return refreshed ? ok(refreshed) : notFound()
}
