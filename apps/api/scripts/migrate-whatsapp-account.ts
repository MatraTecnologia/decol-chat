import 'dotenv/config'

import { prisma } from '../src/lib/prisma.js'
import { getConnection } from '../src/lib/whatsapp/connection.js'

// Copia a linha singleton de WhatsAppConnection para whatsapp_account.
// Os campos cifrados são copiados byte a byte — nada é decifrado nem recifrado.
// Idempotente: rodar de novo só reimprime a comparação.

const LEGACY_ID = 'singleton'
const LABEL = 'Principal'

const legacy = await prisma.whatsAppConnection.findUnique({
  where: { id: LEGACY_ID },
})

if (!legacy) {
  console.log('Nenhuma linha em WhatsAppConnection — nada a migrar.')
  await prisma.$disconnect()
  process.exit(0)
}

const conflicting = await prisma.whatsAppAccount.findFirst({
  where: { isActive: true, phoneNumberId: { not: legacy.phoneNumberId } },
})

if (conflicting) {
  console.error(
    `Já existe conta ativa com outro número (${conflicting.phoneNumberId}) — abortando para não deixar duas contas ativas.`,
  )
  await prisma.$disconnect()
  process.exit(1)
}

const existing = await prisma.whatsAppAccount.findUnique({
  where: { phoneNumberId: legacy.phoneNumberId },
})

const account =
  existing ??
  (await prisma.whatsAppAccount.create({
    data: {
      label: LABEL,
      accessToken: legacy.accessToken,
      phoneNumberId: legacy.phoneNumberId,
      wabaId: legacy.wabaId,
      appId: legacy.appId,
      webhookBaseUrl: legacy.webhookBaseUrl,
      displayPhoneNumber: legacy.displayPhoneNumber,
      verifiedName: legacy.verifiedName,
      qualityRating: legacy.qualityRating,
      lastCheckedAt: legacy.lastCheckedAt,
      isActive: true,
      createdAt: legacy.createdAt,
    },
  }))

console.log(
  existing
    ? 'Conta já existia em whatsapp_account — nada foi criado.'
    : 'Linha copiada de WhatsAppConnection para whatsapp_account.',
)

const show = (value: string | Date | null) =>
  value instanceof Date ? value.toISOString() : (value ?? '(null)')

const rows: [string, string | Date | null, string | Date | null][] = [
  ['phoneNumberId', legacy.phoneNumberId, account.phoneNumberId],
  ['wabaId', legacy.wabaId, account.wabaId],
  ['appId', legacy.appId, account.appId],
  ['webhookBaseUrl', legacy.webhookBaseUrl, account.webhookBaseUrl],
  ['displayPhoneNumber', legacy.displayPhoneNumber, account.displayPhoneNumber],
  ['verifiedName', legacy.verifiedName, account.verifiedName],
  ['qualityRating', legacy.qualityRating, account.qualityRating],
  ['lastCheckedAt', legacy.lastCheckedAt, account.lastCheckedAt],
  ['createdAt', legacy.createdAt, account.createdAt],
]

console.log('\ncampo | WhatsAppConnection | whatsapp_account | igual')
for (const [field, before, after] of rows) {
  const equal = show(before) === show(after) ? 'sim' : 'NÃO'
  console.log(`${field} | ${show(before)} | ${show(after)} | ${equal}`)
}

// Segredos nunca são impressos — só o veredito de que o ciphertext é idêntico.
console.log(
  `\ncipher accessToken idêntico: ${legacy.accessToken === account.accessToken} (${account.accessToken.length} chars)`,
)
console.log(
  `id: ${account.id} | label: ${account.label} | isActive: ${account.isActive}`,
)

const resolved = await getConnection()

console.log(
  resolved
    ? `\ngetConnection() → conta ${resolved.id} phoneNumberId=${resolved.phoneNumberId} wabaId=${resolved.wabaId} accessToken decifrado com ${resolved.accessToken.length} chars`
    : '\ngetConnection() → null (nenhuma conta ativa)',
)

await prisma.$disconnect()
