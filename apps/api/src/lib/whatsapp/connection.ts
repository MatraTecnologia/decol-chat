import type { WhatsAppConnection } from '@/generated/prisma/client.js'
import { env } from '@/env.js'
import { prisma } from '@/lib/prisma.js'

import {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
} from './crypto.js'

const CONNECTION_ID = 'singleton'
const WEBHOOK_PATH = '/webhooks/whatsapp'

export interface DecryptedConnection {
  id: string
  accessToken: string
  appSecret: string
  phoneNumberId: string
  wabaId: string
  verifyToken: string
  webhookBaseUrl: string | null
  displayPhoneNumber: string | null
  verifiedName: string | null
  qualityRating: string | null
  lastCheckedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UpsertConnectionInput {
  accessToken: string
  appSecret: string
  phoneNumberId: string
  wabaId: string
  verifyToken: string
  webhookBaseUrl?: string | null
}

const decrypt = (record: WhatsAppConnection): DecryptedConnection => {
  try {
    return {
      ...record,
      accessToken: decryptSecret(record.accessToken),
      appSecret: decryptSecret(record.appSecret),
    }
  } catch (error) {
    // Env ausente já vem com mensagem própria — não mascarar como troca de chave.
    if (!isEncryptionConfigured()) throw error

    throw new Error(
      'Não foi possível decifrar as credenciais do WhatsApp. A WHATSAPP_ENCRYPTION_KEY atual não corresponde à usada para salvá-las — restaure a chave anterior ou salve a conexão novamente.',
    )
  }
}

export const getConnection = async () => {
  const record = await prisma.whatsAppConnection.findUnique({
    where: { id: CONNECTION_ID },
  })

  return record ? decrypt(record) : null
}

export const upsertConnection = async (input: UpsertConnectionInput) => {
  const secrets = {
    accessToken: encryptSecret(input.accessToken),
    appSecret: encryptSecret(input.appSecret),
  }

  const data = {
    ...secrets,
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId,
    verifyToken: input.verifyToken,
    webhookBaseUrl: input.webhookBaseUrl ?? null,
  }

  const record = await prisma.whatsAppConnection.upsert({
    where: { id: CONNECTION_ID },
    create: { id: CONNECTION_ID, ...data },
    update: data,
  })

  return decrypt(record)
}

export const updateConnectionMeta = async (meta: {
  displayPhoneNumber?: string | null
  verifiedName?: string | null
  qualityRating?: string | null
  lastCheckedAt?: Date
}) => {
  await prisma.whatsAppConnection.update({
    where: { id: CONNECTION_ID },
    data: meta,
  })
}

export const deleteConnection = async () => {
  await prisma.whatsAppConnection.deleteMany({ where: { id: CONNECTION_ID } })
}

export const maskSecret = (value: string) => `••••••${value.slice(-4)}`

export const resolveWebhookUrl = (connection: DecryptedConnection | null) => {
  const base =
    connection?.webhookBaseUrl ||
    env.PUBLIC_WEBHOOK_BASE_URL ||
    env.BETTER_AUTH_URL

  return `${base.replace(/\/+$/, '')}${WEBHOOK_PATH}`
}
