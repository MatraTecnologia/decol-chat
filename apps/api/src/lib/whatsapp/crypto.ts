import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { env } from '@/env.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY_LENGTH = 32

export const isEncryptionConfigured = () => Boolean(env.WHATSAPP_ENCRYPTION_KEY)

const getKey = () => {
  const raw = env.WHATSAPP_ENCRYPTION_KEY

  if (!raw) {
    throw new Error(
      'WHATSAPP_ENCRYPTION_KEY não configurada — defina a env para usar a integração WhatsApp.',
    )
  }

  const key = Buffer.from(raw, 'base64')

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `WHATSAPP_ENCRYPTION_KEY inválida: esperados ${KEY_LENGTH} bytes em base64, recebidos ${key.length}.`,
    )
  }

  return key
}

/** Formato do retorno: `<iv_b64>:<authTag_b64>:<data_b64>`. */
export const encryptSecret = (plain: string) => {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])

  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join(':')
}

export const decryptSecret = (cipher: string) => {
  const [ivPart, tagPart, dataPart] = cipher.split(':')

  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Ciphertext WhatsApp em formato inválido.')
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivPart, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
