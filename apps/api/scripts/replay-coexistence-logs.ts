/**
 * Reprocessa, a partir do log do webhook no Redis, os eventos de coexistence
 * (`smb_app_state_sync`, `smb_message_echoes`, `history`) direto pelo
 * `processInboundPayload`, sem passar pela fila.
 *
 * Uso: `bun scripts/replay-coexistence-logs.ts [--limit N] [--field history]`
 *
 * Idempotente: mensagem já importada é ignorada pelo `@unique(waMessageId)`.
 */
import { prisma } from '@/lib/prisma.js'
import { processInboundPayload } from '@/lib/whatsapp/inbound/index.js'
import { extractChanges } from '@/lib/whatsapp/inbound/payload.js'
import { listWebhookLogs } from '@/lib/whatsapp/webhook-log.js'
import { redis } from '@/lib/redis.js'

const REPLAYABLE = new Set(['history', 'smb_app_state_sync', 'smb_message_echoes'])

const args = process.argv.slice(2)
const argOf = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const limit = Number(argOf('--limit') ?? Infinity)
const onlyField = argOf('--field')

const app = {
  log: {
    info: (obj: unknown, msg?: string) => console.log('[info]', msg ?? '', obj),
    warn: (obj: unknown, msg?: string) => console.warn('[warn]', msg ?? '', obj),
    error: (obj: unknown, msg?: string) =>
      console.error('[error]', msg ?? '', obj),
  },
  emitRealtimeEvent: () => {},
} as unknown as Parameters<typeof processInboundPayload>[0]

const snapshot = async () => ({
  contactsNamed: await prisma.contact.count({ where: { name: { not: null } } }),
  conversations: await prisma.conversation.count(),
  messages: await prisma.message.count(),
  fromPhone: await prisma.message.count({ where: { origin: 'WHATSAPP_APP' } }),
})

const main = async () => {
  const logs = (await listWebhookLogs()).reverse()

  const replayable = logs.filter(entry => {
    if (entry.direction !== 'inbound_event' || !entry.signatureValid) return false
    const fields = extractChanges(entry.payload).map(c => c.field ?? '')
    return fields.some(f => REPLAYABLE.has(f) && (!onlyField || f === onlyField))
  })

  console.log('antes', await snapshot())
  console.log(`reprocessando ${Math.min(limit, replayable.length)} de ${replayable.length} eventos`)

  let done = 0

  for (const entry of replayable) {
    if (done >= limit) break

    const fields = extractChanges(entry.payload).map(c => c.field)
    await processInboundPayload(app, entry.payload)
    done += 1
    console.log(`ok ${done} ${entry.receivedAt} ${fields.join(',')}`)
  }

  console.log('depois', await snapshot())
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    redis.disconnect()
  })
