/**
 * Leitura do envelope do webhook da Meta — puro, sem I/O.
 *
 * Tipagem mínima e toda opcional pelo mesmo motivo do resto da ingestão: a
 * Meta acrescenta campos sem aviso e o parsing precisa sobreviver a um
 * formato que não reconhece.
 */

export interface MetaChange {
  field: string | null
  phoneNumberId: string | null
  wabaId: string | null
  value: unknown
}

interface RawChange {
  field?: string
  value?: { metadata?: { phone_number_id?: string } }
}

interface RawEntry {
  id?: string
  changes?: RawChange[]
}

interface RawPayload {
  entry?: RawEntry[]
}

/**
 * Achata `entry[].changes[]` numa lista única.
 *
 * O `wabaId` sai de `entry[].id` porque os eventos de coexistence
 * (`smb_message_echoes`, `smb_app_state_sync`) não trazem `metadata` dentro de
 * `value` — só o `messages` traz. Ler apenas o `phone_number_id` descartaria
 * esses eventos em silêncio.
 */
export const extractChanges = (payload: unknown): MetaChange[] => {
  const entries = (payload as RawPayload | null)?.entry

  if (!Array.isArray(entries)) return []

  return entries.flatMap(entry => {
    const changes = entry?.changes

    if (!Array.isArray(changes)) return []

    return changes.map(change => ({
      field: change?.field ?? null,
      phoneNumberId: change?.value?.metadata?.phone_number_id ?? null,
      wabaId: entry?.id ?? null,
      value: change?.value,
    }))
  })
}
