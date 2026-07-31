import 'dotenv/config'

import { prisma } from '../src/lib/prisma.js'
import { phoneKey } from '../src/lib/whatsapp/phone.js'

// Preenche Contact.phoneKey a partir do waId e reporta colisões ANTES de a
// constraint unique existir. Idempotente.
//
//   pnpm exec tsx scripts/backfill-phone-key.ts          relatório, sem escrever
//   pnpm exec tsx scripts/backfill-phone-key.ts --apply  grava

const apply = process.argv.includes('--apply')

const contacts = await prisma.contact.findMany({
  select: {
    id: true,
    whatsAppAccountId: true,
    waId: true,
    phoneNumber: true,
    phoneKey: true,
  },
})

// A chave sai do phoneNumber, o campo declaradamente E.164. O waId é o
// identificador da Meta e serve de fallback, mas nem sempre é um número
// discável — normalizá-lo às cegas produziria chave lixo.
const computed = contacts.map(contact => ({
  ...contact,
  next: phoneKey(contact.phoneNumber || contact.waId),
}))

const byAccountKey = new Map<string, typeof computed>()

for (const contact of computed) {
  const bucket = `${contact.whatsAppAccountId}::${contact.next}`
  byAccountKey.set(bucket, [...(byAccountKey.get(bucket) ?? []), contact])
}

const collisions = [...byAccountKey.entries()].filter(
  ([, group]) => group.length > 1,
)

console.log(`${contacts.length} contatos analisados.`)

if (collisions.length) {
  console.error(
    `\n${collisions.length} colisão(ões) — a constraint unique vai falhar até isso ser resolvido:\n`,
  )

  for (const [bucket, group] of collisions) {
    console.error(`  chave ${bucket}`)
    for (const contact of group) {
      console.error(`    ${contact.id}  waId=${contact.waId}  fone=${contact.phoneNumber}`)
    }
  }

  console.error('\nMescle ou corrija esses contatos antes de aplicar a unique.')
  await prisma.$disconnect()
  process.exit(1)
}

console.log('Nenhuma colisão — seguro adicionar @@unique([whatsAppAccountId, phoneKey]).')

const pending = computed.filter(contact => contact.phoneKey !== contact.next)

console.log(`${pending.length} linha(s) a atualizar.`)

for (const contact of pending) {
  console.log(`  ${contact.waId} → ${contact.next}${apply ? '' : '  (simulação)'}`)

  if (apply) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { phoneKey: contact.next },
    })
  }
}

if (!apply && pending.length) {
  console.log('\nNada foi gravado. Rode com --apply para aplicar.')
}

await prisma.$disconnect()
