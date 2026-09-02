import { cache } from '@/lib/cache.js'

/**
 * Progresso do backfill de histórico (coexistence), gravado no Redis a cada
 * chunk. Sem isto um backfill de vários minutos parece travamento em /conexao.
 */
export interface HistorySyncProgress {
  phase: number | null
  progress: number | null
  chunks: number
  threads: number
  messages: number
  conversationsCreated: number
  updatedAt: string
}

const TTL_SECONDS = 7 * 24 * 60 * 60

const keyOf = (accountId: string) => `whatsapp:history-sync:${accountId}`

export const getHistorySyncProgress = (accountId: string) =>
  cache.get<HistorySyncProgress>(keyOf(accountId))

export const recordHistoryChunk = async (
  accountId: string,
  chunk: {
    phase: number | null
    progress: number | null
    threads: number
    messages: number
    conversationsCreated: number
  },
) => {
  const current = await getHistorySyncProgress(accountId)

  const next: HistorySyncProgress = {
    phase: chunk.phase ?? current?.phase ?? null,
    progress: chunk.progress ?? current?.progress ?? null,
    chunks: (current?.chunks ?? 0) + 1,
    threads: (current?.threads ?? 0) + chunk.threads,
    messages: (current?.messages ?? 0) + chunk.messages,
    conversationsCreated:
      (current?.conversationsCreated ?? 0) + chunk.conversationsCreated,
    updatedAt: new Date().toISOString(),
  }

  await cache.set(keyOf(accountId), next, TTL_SECONDS)

  return next
}

export const resetHistorySyncProgress = (accountId: string) =>
  cache.del(keyOf(accountId))
