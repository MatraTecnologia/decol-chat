/**
 * Regras do ciclo de vida das revisões — puras de propósito.
 *
 * Nada aqui toca Prisma nem Graph API: é o único ponto do domínio que dá para
 * testar sem banco, e é onde mora a garantia de que sincronizar não encosta na
 * definição local.
 */
export type RevisionState = 'DRAFT' | 'SUBMITTED' | 'SUPERSEDED'

/** Só rascunho é editável — revisão enviada é snapshot imutável. */
export const assertDraftEditable = (
  revision: { state: RevisionState } | null | undefined,
) => revision?.state === 'DRAFT'

/** A próxima versão vem do maior número já usado, nunca da contagem: apagar um
 * rascunho no meio não pode reciclar uma versão do histórico. */
export const nextRevisionVersion = (revisions: { version: number }[]) =>
  revisions.reduce((highest, revision) => {
    const version = Number.isFinite(revision.version) ? revision.version : 0

    return version > highest ? version : highest
  }, 0) + 1

/** Trava otimista: a versão precisa bater exatamente, sem tolerar ausência. */
export const matchesExpectedLockVersion = (stored: number, expected: number) =>
  Number.isInteger(stored) &&
  Number.isInteger(expected) &&
  stored === expected

export interface RemoteTemplateEntry {
  id?: string
  name?: string
  language?: string
  status?: string
  category?: string
  quality_score?: { score?: string } | string
  rejected_reason?: string
  last_updated_time?: string | number
}

export interface RemoteTemplateFields {
  metaTemplateId: string | null
  category: string
  remoteStatus: string | null
  remoteQuality: string | null
  rejectionReason: string | null
  remoteUpdatedAt: Date | null
}

const readQuality = (quality: RemoteTemplateEntry['quality_score']) => {
  if (typeof quality === 'string') return quality

  return quality?.score ?? null
}

/** A Meta manda ora epoch em segundos, ora ISO. */
const readUpdatedAt = (value: RemoteTemplateEntry['last_updated_time']) => {
  if (value === undefined || value === null || value === '') return null

  const raw = String(value)
  const timestamp = /^\d+$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw)

  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

/** Sem nome e idioma não dá para casar com a linha local — o item é ignorado. */
export const isSyncableEntry = (
  entry: RemoteTemplateEntry,
): entry is RemoteTemplateEntry & { name: string; language: string } =>
  Boolean(entry.name && entry.language)

/**
 * Recorte exato do que a sincronização pode escrever. Nunca inclui
 * `definition`, `revisions` nem os autores: um snapshot remoto não substitui o
 * rascunho local.
 */
export const toRemoteTemplateFields = (
  entry: RemoteTemplateEntry,
): RemoteTemplateFields => ({
  metaTemplateId: entry.id ?? null,
  category: (entry.category ?? 'UTILITY').toUpperCase(),
  remoteStatus: entry.status ?? null,
  remoteQuality: readQuality(entry.quality_score),
  rejectionReason: entry.rejected_reason ?? null,
  remoteUpdatedAt: readUpdatedAt(entry.last_updated_time),
})
