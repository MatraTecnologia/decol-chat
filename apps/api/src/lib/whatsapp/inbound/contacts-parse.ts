/**
 * Parse puro do webhook `smb_app_state_sync` (coexistence): a agenda do app
 * WhatsApp Business do celular.
 *
 * Formato observado em produção (2026-09-02):
 *
 *   value.state_sync[] = { type: 'contact', action: 'add' | 'remove',
 *     contact: { full_name?, first_name?, phone_number, user_id },
 *     metadata: { timestamp, version } }
 *
 * `phone_number` vem no mesmo formato do `wa_id` (sem o nono dígito em boa
 * parte dos celulares BR) — é o que casa com `Contact.waId`.
 */

export interface RawStateSyncItem {
  type?: string
  action?: string
  contact?: {
    full_name?: string
    first_name?: string
    phone_number?: string
  }
}

export interface ParsedContact {
  waId: string
  name: string | null
}

interface RawStateSyncValue {
  state_sync?: RawStateSyncItem[]
}

const digits = (value: string) => value.replace(/\D/g, '')

/** Só adições de contato com número; `remove` não apaga nada do inbox. */
export const parseStateSync = (value: unknown): ParsedContact[] => {
  const items = (value as RawStateSyncValue | null)?.state_sync

  if (!Array.isArray(items)) return []

  // O mesmo número pode vir mais de uma vez no lote — o último nome vence.
  const byWaId = new Map<string, ParsedContact>()

  for (const item of items) {
    if (item.type !== 'contact' || item.action !== 'add') continue

    const waId = digits(item.contact?.phone_number ?? '')

    if (!waId) continue

    const name =
      item.contact?.full_name?.trim() ||
      item.contact?.first_name?.trim() ||
      null

    byWaId.set(waId, { waId, name })
  }

  return [...byWaId.values()]
}
