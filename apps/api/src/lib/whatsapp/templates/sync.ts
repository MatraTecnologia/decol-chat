/**
 * Espelhamento do catálogo da Meta para o catálogo local.
 *
 * Consome todos os cursores antes de responder — devolver um `nextCursor` faria
 * a página ter que paginar a sincronização, e um item que ficou para trás
 * apareceria como "sumiu da Meta". Escreve só identidade e estado remoto: as
 * revisões locais nunca são tocadas.
 */
import type { Prisma } from '@/generated/prisma/client.js'

import type { DecryptedAccount } from '../connection.js'
import { getConnection } from '../connection.js'
import { GraphApiError, listMessageTemplates } from '../graph-client.js'

import { isSyncableEntry, toRemoteTemplateFields } from './policy.js'
import { recordSyncFailure, upsertRemoteTemplate } from './repository.js'
import type { TemplateResult } from './results.js'
import { invalid, ok, remoteError } from './results.js'

export interface SyncTemplatesInput {
  actorId: string
  account?: DecryptedAccount | null
}

export interface SyncTemplatesResult {
  imported: number
  updated: number
  failed: number
  nextCursor: null
}

const failureMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Falha ao sincronizar o modelo.'

export const syncTemplates = async (
  input: SyncTemplatesInput,
): Promise<TemplateResult<SyncTemplatesResult>> => {
  const account = input.account ?? (await getConnection())
  if (!account) return invalid('Nenhuma conta do WhatsApp está conectada.')

  const visited = new Set<string>()
  let after: string | undefined
  let imported = 0
  let updated = 0
  let failed = 0

  for (;;) {
    let page: Awaited<ReturnType<typeof listMessageTemplates>>
    try {
      page = await listMessageTemplates(
        account.accessToken,
        account.wabaId,
        after,
      )
    } catch (error) {
      if (!(error instanceof GraphApiError)) throw error

      return remoteError(error.message, error.status)
    }

    for (const entry of page.data ?? []) {
      if (!isSyncableEntry(entry)) {
        failed += 1
        continue
      }

      try {
        const outcome = await upsertRemoteTemplate({
          accountId: account.id,
          name: entry.name,
          language: entry.language,
          actorId: input.actorId,
          fields: toRemoteTemplateFields(entry),
          remotePayload: entry as unknown as Prisma.InputJsonValue,
        })

        if (outcome === 'imported') imported += 1
        else updated += 1
      } catch (error) {
        // Um item quebrado não pode abortar a página inteira.
        failed += 1
        await recordSyncFailure(
          account.id,
          entry.name,
          entry.language,
          failureMessage(error),
        )
      }
    }

    // A Meta manda `cursors.after` até na última página — só `paging.next`
    // sinaliza que existe mais coisa.
    const next = page.paging?.cursors?.after
    if (!next || !page.paging?.next || visited.has(next)) break

    visited.add(next)
    after = next
  }

  return ok({ imported, updated, failed, nextCursor: null })
}
