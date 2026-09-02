/**
 * Parse puro do webhook `smb_message_echoes` (coexistence): mensagens que
 * alguém mandou pelo app WhatsApp Business do celular.
 *
 * Formato observado em produção (2026-09-02):
 *
 *   value.message_echoes[] = { id, from: '<empresa>', to: '<cliente>',
 *     to_user_id, timestamp, type, text? | audio? | image? ... }
 *
 * O contato sai de `to` — `from` é sempre o número da empresa.
 */

export interface RawEcho {
  id?: string
  from?: string
  to?: string
  timestamp?: string
  type?: string
  [key: string]: unknown
}

export interface ParsedEcho {
  /** MSISDN do cliente, como a Meta manda em `to`. */
  contactWaId: string
  message: RawEcho
}

interface RawEchoValue {
  message_echoes?: RawEcho[]
}

export const parseEchoes = (value: unknown): ParsedEcho[] => {
  const echoes = (value as RawEchoValue | null)?.message_echoes

  if (!Array.isArray(echoes)) return []

  return echoes.flatMap(message =>
    message.id && message.to ? [{ contactWaId: message.to, message }] : [],
  )
}
