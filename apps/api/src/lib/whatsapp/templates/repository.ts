/**
 * Único ponto que fala Prisma no domínio de templates.
 *
 * A edição de rascunho passa sempre por `updateMany` filtrando por
 * `id + state + lockVersion`: a checagem e a escrita precisam ser a mesma
 * instrução, senão duas abas salvando ao mesmo tempo sobrescrevem uma à outra.
 */
import type { Prisma } from '@/generated/prisma/client.js'

import { prisma } from '@/lib/prisma.js'
import { generateId } from '@/utils/generate-id.js'

export const templateInclude = {
  revisions: { orderBy: { version: 'desc' } },
} satisfies Prisma.WhatsAppTemplateInclude

export type TemplateWithRevisions = Prisma.WhatsAppTemplateGetPayload<{
  include: typeof templateInclude
}>

export type TemplateRevision = TemplateWithRevisions['revisions'][number]

export const findTemplate = (accountId: string, id: string) =>
  prisma.whatsAppTemplate.findFirst({
    where: { id, whatsAppAccountId: accountId },
    include: templateInclude,
  })

export const findTemplateByName = (
  accountId: string,
  name: string,
  language: string,
) =>
  prisma.whatsAppTemplate.findFirst({
    where: { whatsAppAccountId: accountId, name, language },
    include: templateInclude,
  })

export interface CreateTemplateInput {
  accountId: string
  name: string
  language: string
  category: string
  parameterFormat: string
  definition: Prisma.InputJsonValue
  actorId: string
}

export const createTemplateWithDraft = (input: CreateTemplateInput) =>
  prisma.whatsAppTemplate.create({
    data: {
      whatsAppAccountId: input.accountId,
      name: input.name,
      language: input.language,
      category: input.category,
      createdById: input.actorId,
      updatedById: input.actorId,
      revisions: {
        create: {
          version: 1,
          definition: input.definition,
          parameterFormat: input.parameterFormat,
          idempotencyKey: generateId(),
        },
      },
    },
    include: templateInclude,
  })

/** Devolve `false` quando a linha já mudou de estado ou de versão. */
export const applyDraftUpdate = async (
  revisionId: string,
  expectedLockVersion: number,
  data: { definition: Prisma.InputJsonValue; parameterFormat: string },
) => {
  const { count } = await prisma.whatsAppTemplateRevision.updateMany({
    where: { id: revisionId, state: 'DRAFT', lockVersion: expectedLockVersion },
    data: { ...data, lockVersion: { increment: 1 } },
  })

  return count === 1
}

export const createDraftRevision = (input: {
  templateId: string
  version: number
  parameterFormat: string
  definition: Prisma.InputJsonValue
}) =>
  prisma.whatsAppTemplateRevision.create({
    data: { ...input, idempotencyKey: generateId() },
  })

export const findRevisionByIdempotencyKey = (idempotencyKey: string) =>
  prisma.whatsAppTemplateRevision.findUnique({ where: { idempotencyKey } })

export const updateTemplate = (
  id: string,
  data: Prisma.WhatsAppTemplateUpdateInput,
) => prisma.whatsAppTemplate.update({ where: { id }, data })

/**
 * Sela o rascunho e aposenta as revisões enviadas anteriores na mesma
 * transação — historicamente só uma revisão pode estar em `SUBMITTED`.
 */
export const sealDraftRevision = (input: {
  revisionId: string
  templateId: string
  actorId: string
  lockVersion: number
  idempotencyKey: string
}) =>
  prisma.$transaction(async tx => {
    const { count } = await tx.whatsAppTemplateRevision.updateMany({
      where: {
        id: input.revisionId,
        state: 'DRAFT',
        lockVersion: input.lockVersion,
      },
      data: {
        state: 'SUBMITTED',
        submittedAt: new Date(),
        submittedById: input.actorId,
        idempotencyKey: input.idempotencyKey,
        lockVersion: { increment: 1 },
      },
    })

    if (count !== 1) return null

    await tx.whatsAppTemplateRevision.updateMany({
      where: {
        templateId: input.templateId,
        state: 'SUBMITTED',
        id: { not: input.revisionId },
      },
      data: { state: 'SUPERSEDED' },
    })

    return tx.whatsAppTemplateRevision.findUnique({
      where: { id: input.revisionId },
    })
  })

/** Meta recusou: o rascunho volta a ser editável, com a resposta gravada. */
export const revertSealedRevision = (
  revisionId: string,
  submissionResponse: Prisma.InputJsonValue,
) =>
  prisma.whatsAppTemplateRevision.update({
    where: { id: revisionId },
    data: { state: 'DRAFT', submittedAt: null, submissionResponse },
  })

export const recordSubmission = (input: {
  revisionId: string
  templateId: string
  actorId: string
  submissionResponse: Prisma.InputJsonValue
  metaTemplateId?: string | null
  remoteStatus?: string | null
}) =>
  prisma.$transaction(async tx => {
    await tx.whatsAppTemplateRevision.update({
      where: { id: input.revisionId },
      data: { submissionResponse: input.submissionResponse },
    })

    return tx.whatsAppTemplate.update({
      where: { id: input.templateId },
      data: {
        updatedById: input.actorId,
        lastSyncError: null,
        ...(input.metaTemplateId
          ? { metaTemplateId: input.metaTemplateId }
          : {}),
        ...(input.remoteStatus ? { remoteStatus: input.remoteStatus } : {}),
      },
      include: templateInclude,
    })
  })

export const deleteTemplate = (id: string) =>
  prisma.whatsAppTemplate.delete({ where: { id } })

export const deleteRevision = (id: string) =>
  prisma.whatsAppTemplateRevision.delete({ where: { id } })

// ── Sincronização ──────────────────────────────────────

export interface RemoteUpsertInput {
  accountId: string
  name: string
  language: string
  actorId: string
  fields: {
    metaTemplateId: string | null
    category: string
    remoteStatus: string | null
    remoteQuality: string | null
    rejectionReason: string | null
    remoteUpdatedAt: Date | null
  }
  remotePayload: Prisma.InputJsonValue
}

/**
 * Casa pela identidade `[conta, nome, idioma]`, nunca pelo `metaTemplateId`:
 * um rascunho local ainda não tem id remoto e casar pelo id criaria uma linha
 * duplicada ao lado dele. Só escreve espelho remoto — `revisions` fica intacto.
 */
export const upsertRemoteTemplate = async (input: RemoteUpsertInput) => {
  const existing = await prisma.whatsAppTemplate.findFirst({
    where: {
      whatsAppAccountId: input.accountId,
      name: input.name,
      language: input.language,
    },
    select: { id: true },
  })

  const remote = {
    ...input.fields,
    remotePayload: input.remotePayload,
    lastSyncAttemptAt: new Date(),
    lastSyncError: null,
  }

  if (existing) {
    await prisma.whatsAppTemplate.update({
      where: { id: existing.id },
      data: remote,
    })

    return 'updated' as const
  }

  await prisma.whatsAppTemplate.create({
    data: {
      whatsAppAccountId: input.accountId,
      name: input.name,
      language: input.language,
      createdById: input.actorId,
      updatedById: input.actorId,
      ...remote,
    },
  })

  return 'imported' as const
}

export const recordSyncFailure = async (
  accountId: string,
  name: string,
  language: string,
  message: string,
) => {
  await prisma.whatsAppTemplate.updateMany({
    where: { whatsAppAccountId: accountId, name, language },
    data: { lastSyncAttemptAt: new Date(), lastSyncError: message },
  })
}
