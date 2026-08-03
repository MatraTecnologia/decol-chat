import type { WhatsAppAccount } from '@/generated/prisma/client.js'
import { env } from '@/env.js'
import { prisma } from '@/lib/prisma.js'

import {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
} from './crypto.js'

const DEFAULT_LABEL = 'Principal'
const WEBHOOK_PATH = '/webhooks/whatsapp'

export interface DecryptedAccount {
  id: string
  label: string
  accessToken: string
  appSecret: string
  phoneNumberId: string
  wabaId: string
  appId: string | null
  verifyToken: string
  webhookBaseUrl: string | null
  displayPhoneNumber: string | null
  verifiedName: string | null
  qualityRating: string | null
  lastCheckedAt: Date | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/** Nome antigo, mantido para os call sites que ainda falam em "conexão". */
export type DecryptedConnection = DecryptedAccount

export interface UpsertConnectionInput {
  accessToken: string
  appSecret: string
  phoneNumberId: string
  wabaId: string
  appId?: string | null
  verifyToken: string
  webhookBaseUrl?: string | null
}

const decrypt = (record: WhatsAppAccount): DecryptedAccount => {
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
      { cause: error },
    )
  }
}

/** A conta ativa mais antiga é a "conexão" que a página single-account enxerga. */
const findActiveAccount = () =>
  prisma.whatsAppAccount.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  })

export const getConnection = async () => {
  const record = await findActiveAccount()

  return record ? decrypt(record) : null
}

/**
 * O webhook é o único ponto que resolve a conta pelo número: a Meta manda o
 * `phone_number_id` em `entry[].changes[].value.metadata`.
 */
export const getAccountByPhoneNumberId = async (phoneNumberId: string) => {
  const record = await prisma.whatsAppAccount.findFirst({
    where: { phoneNumberId, isActive: true },
  })

  return record ? decrypt(record) : null
}

/**
 * Os eventos de coexistence não trazem `phone_number_id` — só o `entry[].id`,
 * que é o WABA. Como a instalação é single-account, a conta ativa daquela WABA
 * é sempre a certa.
 */
export const getAccountByWabaId = async (wabaId: string) => {
  const record = await prisma.whatsAppAccount.findFirst({
    where: { wabaId, isActive: true },
  })

  return record ? decrypt(record) : null
}

/**
 * O envio resolve a conta pela conversa (`Conversation.whatsAppAccountId`) —
 * responder pela conta ativa mandaria a mensagem pelo número errado assim que
 * existir mais de uma. Conta desativada não envia: `deleteConnection` só vira
 * o flag `isActive`, então o filtro precisa estar aqui.
 */
export const getAccountById = async (id: string) => {
  const record = await prisma.whatsAppAccount.findFirst({
    where: { id, isActive: true },
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
    appId: input.appId ?? null,
    verifyToken: input.verifyToken,
    webhookBaseUrl: input.webhookBaseUrl ?? null,
  }

  const active = await findActiveAccount()

  const record = active
    ? // Editar o número no formulário troca o número da mesma conta, não cria outra.
      await prisma.whatsAppAccount.update({ where: { id: active.id }, data })
    : // Sem conta ativa ainda pode existir uma desativada com este número.
      await prisma.whatsAppAccount.upsert({
        where: { phoneNumberId: input.phoneNumberId },
        create: { label: DEFAULT_LABEL, ...data },
        update: { ...data, isActive: true },
      })

  return decrypt(record)
}

export const updateConnectionMeta = async (meta: {
  displayPhoneNumber?: string | null
  verifiedName?: string | null
  qualityRating?: string | null
  lastCheckedAt?: Date
}) => {
  const active = await findActiveAccount()
  if (!active) return

  await prisma.whatsAppAccount.update({ where: { id: active.id }, data: meta })
}

/**
 * Desativa em vez de apagar: a conta é dona de contatos, conversas e regra de
 * distribuição com `onDelete: Cascade` — apagar a linha levaria o histórico
 * junto. Para a página o efeito é o mesmo, `getConnection()` devolve null.
 */
export const deleteConnection = async () => {
  const active = await findActiveAccount()
  if (!active) return

  await prisma.whatsAppAccount.update({
    where: { id: active.id },
    data: { isActive: false },
  })
}

export const maskSecret = (value: string) => `••••••${value.slice(-4)}`

export const resolveWebhookUrl = (connection: DecryptedAccount | null) => {
  const base =
    connection?.webhookBaseUrl ||
    env.PUBLIC_WEBHOOK_BASE_URL ||
    env.BETTER_AUTH_URL

  return `${base.replace(/\/+$/, '')}${WEBHOOK_PATH}`
}
