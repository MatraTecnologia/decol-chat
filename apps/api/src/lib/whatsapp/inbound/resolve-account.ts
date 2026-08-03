import {
  getAccountByPhoneNumberId,
  getAccountByWabaId,
} from '../connection.js'

import type { MetaChange } from './payload.js'

/**
 * O `phone_number_id` é preferido por ser mais específico: identifica o número,
 * não a conta comercial inteira. O WABA é o fallback dos eventos que não o
 * trazem.
 */
export const resolveAccountForChange = async (change: MetaChange) => {
  const byPhone = change.phoneNumberId
    ? await getAccountByPhoneNumberId(change.phoneNumberId)
    : null

  if (byPhone) return byPhone

  return change.wabaId ? await getAccountByWabaId(change.wabaId) : null
}
