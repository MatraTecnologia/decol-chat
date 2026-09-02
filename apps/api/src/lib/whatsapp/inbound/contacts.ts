import { prisma } from '@/lib/prisma.js'

import { phoneKey, toSendFormat } from '../phone.js'
import { parseStateSync, type ParsedContact } from './contacts-parse.js'
import type { InboundContext } from './shared.js'

/**
 * A agenda do celular preenche `Contact.name` (o nome que a empresa deu ao
 * cliente); `profileName` continua sendo o que o próprio cliente exibe.
 */
const upsertContact = async (accountId: string, parsed: ParsedContact) => {
  const key = phoneKey(parsed.waId)

  const candidates = await prisma.contact.findMany({
    where: {
      whatsAppAccountId: accountId,
      OR: [
        { waId: parsed.waId },
        { waId: toSendFormat(parsed.waId) },
        { phoneKey: key },
      ],
    },
    select: { id: true, waId: true, phoneKey: true, name: true },
  })

  const existing = candidates.find(c => c.waId === parsed.waId) ?? candidates[0]

  if (!existing) {
    await prisma.contact.create({
      data: {
        whatsAppAccountId: accountId,
        waId: parsed.waId,
        phoneNumber: toSendFormat(parsed.waId),
        phoneKey: key,
        name: parsed.name,
      },
      select: { id: true },
    })

    return true
  }

  const fillKey =
    !existing.phoneKey && !candidates.some(c => c.phoneKey === key)
  const rename = Boolean(parsed.name) && parsed.name !== existing.name

  if (!fillKey && !rename) return false

  await prisma.contact.update({
    where: { id: existing.id },
    data: {
      ...(rename ? { name: parsed.name } : {}),
      ...(fillKey ? { phoneKey: key } : {}),
    },
    select: { id: true },
  })

  return true
}

export const handleStateSync = async (
  app: InboundContext,
  accountId: string,
  value: unknown,
) => {
  const contacts = parseStateSync(value)
  let changed = 0

  for (const contact of contacts) {
    if (await upsertContact(accountId, contact)) changed += 1
  }

  app.log.info(
    { accountId, received: contacts.length, changed },
    'Agenda do app WhatsApp Business sincronizada',
  )

  // Um evento por lote, não por contato: a agenda vem com centenas de linhas.
  if (changed > 0) {
    app.emitRealtimeEvent({
      entity: 'contact',
      action: 'updated',
      entityId: accountId,
    })
  }
}
