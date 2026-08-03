import type { TemplateDefinition } from '@workspace/shared/whatsapp-templates'
import { templateDefinitionSchema } from '@workspace/shared/whatsapp-templates'

import { Prisma } from '@/generated/prisma/client.js'

import type { MetaTemplateEntry } from '../template-payload.js'
import { fromMetaTemplatePayload } from '../template-payload.js'

import type { TemplateRevision, TemplateWithRevisions } from './repository.js'

/** As revisões vêm de `repository.templateInclude` já ordenadas por versão. */
export const latestRevision = (template: TemplateWithRevisions) =>
  template.revisions[0] ?? null

export const draftRevision = (template: TemplateWithRevisions) =>
  template.revisions.find(revision => revision.state === 'DRAFT') ?? null

export const submittedRevision = (template: TemplateWithRevisions) =>
  template.revisions.find(revision => revision.state === 'SUBMITTED') ?? null

export const parseDefinition = (value: unknown) =>
  templateDefinitionSchema.safeParse(value)

export const revisionDefinition = (revision: TemplateRevision) => {
  const parsed = parseDefinition(revision.definition)

  return parsed.success ? parsed.data : null
}

const remoteDefinition = (template: TemplateWithRevisions) =>
  template.remotePayload
    ? fromMetaTemplatePayload(template.remotePayload as MetaTemplateEntry)
    : null

/**
 * Conteúdo mais recente do editor — usado para duplicar. Prefere a revisão mais
 * nova (rascunho incluído); template importado da Meta cai no espelho remoto.
 */
export const resolveDefinition = (
  template: TemplateWithRevisions,
): TemplateDefinition | null => {
  const revision = latestRevision(template)
  const fromRevision = revision ? revisionDefinition(revision) : null

  return fromRevision ?? remoteDefinition(template)
}

/**
 * Definição que a Meta realmente aprovou. Nunca cai no rascunho: um rascunho em
 * edição tem outras variáveis, e enviá-lo contra o template aprovado geraria
 * 132000 ou substituição errada. Sem revisão enviada, vale o espelho remoto —
 * é o caso do template criado direto no Business Manager.
 */
export const resolveApprovedDefinition = (template: TemplateWithRevisions) => {
  const revision = submittedRevision(template)
  const fromRevision = revision ? revisionDefinition(revision) : null

  if (fromRevision && revision) {
    return { definition: fromRevision, revisionId: revision.id }
  }

  const remote = remoteDefinition(template)

  return remote ? { definition: remote, revisionId: null } : null
}

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002'

export const firstIssueMessage = (
  error: { issues: { path: PropertyKey[]; message: string }[] },
) => {
  const issue = error.issues[0]
  if (!issue) return 'Definição inválida.'

  const path = issue.path.join('.')

  return path ? `${path}: ${issue.message}` : issue.message
}
