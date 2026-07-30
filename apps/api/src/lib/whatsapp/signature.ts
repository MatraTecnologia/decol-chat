import { createHmac, timingSafeEqual } from 'node:crypto'

const SIGNATURE_PREFIX = 'sha256='

/**
 * Valida o header `X-Hub-Signature-256` da Meta contra o corpo **cru** da
 * requisição — o HMAC calculado sobre o JSON reserializado nunca bate.
 */
export const verifySignature = (
  rawBody: Buffer,
  header: string | undefined,
  appSecret: string,
) => {
  if (!header?.startsWith(SIGNATURE_PREFIX)) return false

  const received = Buffer.from(header.slice(SIGNATURE_PREFIX.length), 'hex')
  const expected = createHmac('sha256', appSecret).update(rawBody).digest()

  if (received.length !== expected.length) return false

  return timingSafeEqual(received, expected)
}
