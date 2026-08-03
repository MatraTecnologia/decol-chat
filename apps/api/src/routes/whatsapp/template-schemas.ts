/**
 * Contrato HTTP do catálogo de modelos.
 *
 * Os mapeadores são a fronteira do que sai da API: `definition` só viaja depois
 * de passar pelo schema compartilhado, e a resposta da Meta vira um resumo de
 * três campos. Token, `objectKey` privado e payload cru de credencial não têm
 * lugar aqui.
 */
import { templateDefinitionSchema } from '@workspace/shared/whatsapp-templates'
import { z } from 'zod'

import { WhatsAppTemplateRevisionStateSchema } from '@/generated/zod/schemas.js'

import {
  draftRevision,
  latestRevision,
  resolveDefinition,
  revisionDefinition,
  submittedRevision,
} from '@/lib/whatsapp/templates/definitions.js'

import type {
  TemplateRevision,
  TemplateWithRevisions,
} from '@/lib/whatsapp/templates/repository.js'

// ── Schemas ────────────────────────────────────────────

/** Nome do modelo na Meta: minúsculas, números e underline. */
export const templateNameSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(
    /^[a-z0-9_]+$/,
    'Use apenas letras minúsculas, números e underline no nome.',
  )

const revisionSummarySchema = z.object({
  id: z.string(),
  version: z.number(),
  state: WhatsAppTemplateRevisionStateSchema,
  lockVersion: z.number(),
  parameterFormat: z.string(),
  submittedAt: z.date().nullable(),
  submittedById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

const submissionSummarySchema = z.object({
  status: z.string().nullable(),
  code: z.string().nullable(),
  message: z.string().nullable(),
})

export const revisionSchema = revisionSummarySchema.extend({
  definition: templateDefinitionSchema.nullable(),
  submission: submissionSummarySchema.nullable(),
})

export const templateSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  category: z.string(),
  metaTemplateId: z.string().nullable(),
  remoteStatus: z.string().nullable(),
  remoteQuality: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  remoteUpdatedAt: z.date().nullable(),
  lastSyncAttemptAt: z.date().nullable(),
  lastSyncError: z.string().nullable(),
  createdById: z.string(),
  updatedById: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  latestRevision: revisionSummarySchema.nullable(),
  draftRevision: revisionSummarySchema.nullable(),
  submittedRevision: revisionSummarySchema.nullable(),
})

export const templateDetailSchema = templateSummarySchema.extend({
  definition: templateDefinitionSchema.nullable(),
})

export const templateIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
})

// ── Mapeadores ─────────────────────────────────────────

const toRevisionSummary = (revision: TemplateRevision) => ({
  id: revision.id,
  version: revision.version,
  state: revision.state,
  lockVersion: revision.lockVersion,
  parameterFormat: revision.parameterFormat,
  submittedAt: revision.submittedAt,
  submittedById: revision.submittedById,
  createdAt: revision.createdAt,
  updatedAt: revision.updatedAt,
})

interface SubmissionSnapshot {
  response?: { id?: string; status?: string } | null
  error?: { message?: string; code?: number | null; status?: number } | null
}

/**
 * A resposta gravada guarda o payload enviado — dele só sai o desfecho, nunca
 * o corpo bruto.
 */
const toSubmissionSummary = (value: unknown) => {
  if (!value || typeof value !== 'object') return null

  const snapshot = value as SubmissionSnapshot

  if (snapshot.error) {
    return {
      status: 'ERROR',
      code: snapshot.error.code == null ? null : String(snapshot.error.code),
      message: snapshot.error.message ?? null,
    }
  }

  if (!snapshot.response) return null

  return {
    status: snapshot.response.status ?? null,
    code: null,
    message: null,
  }
}

export const toRevisionDetail = (revision: TemplateRevision) => ({
  ...toRevisionSummary(revision),
  definition: revisionDefinition(revision),
  submission: toSubmissionSummary(revision.submissionResponse),
})

export const toTemplateSummary = (template: TemplateWithRevisions) => {
  const latest = latestRevision(template)
  const draft = draftRevision(template)
  const submitted = submittedRevision(template)

  return {
    id: template.id,
    name: template.name,
    language: template.language,
    category: template.category,
    metaTemplateId: template.metaTemplateId,
    remoteStatus: template.remoteStatus,
    remoteQuality: template.remoteQuality,
    rejectionReason: template.rejectionReason,
    remoteUpdatedAt: template.remoteUpdatedAt,
    lastSyncAttemptAt: template.lastSyncAttemptAt,
    lastSyncError: template.lastSyncError,
    createdById: template.createdById,
    updatedById: template.updatedById,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    latestRevision: latest ? toRevisionSummary(latest) : null,
    draftRevision: draft ? toRevisionSummary(draft) : null,
    submittedRevision: submitted ? toRevisionSummary(submitted) : null,
  }
}

/**
 * O espelho remoto vira definição por conversão, não por validação: template
 * aprovado na Meta costuma vir sem os exemplos que o schema exige. Sai `null`
 * quando não passa — o detalhe do modelo não pode virar 500 no serializer.
 */
export const toTemplateDetail = (template: TemplateWithRevisions) => {
  const resolved = resolveDefinition(template)
  const parsed = resolved ? templateDefinitionSchema.safeParse(resolved) : null

  return {
    ...toTemplateSummary(template),
    definition: parsed?.success ? parsed.data : null,
  }
}
