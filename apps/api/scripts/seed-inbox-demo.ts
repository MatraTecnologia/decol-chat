import 'dotenv/config'

import { prisma } from '../src/lib/prisma.js'
import { phoneKey } from '../src/lib/whatsapp/phone.js'

// Dados fictícios para exercitar a renderização da Inbox.
// Os contatos são marcados em `metadata.seed` — é isso que permite remover
// tudo depois sem tocar em dado real (o cascade de Contact leva conversas e
// mensagens junto). O waId NÃO pode ser sintético: ele precisa ser o número
// sem o nono dígito, que é a forma como a Meta devolve celular brasileiro.
//
//   pnpm exec tsx scripts/seed-inbox-demo.ts          semeia
//   pnpm exec tsx scripts/seed-inbox-demo.ts --clean  remove

const SEED_MARKER = 'inbox-demo'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const ago = (ms: number) => new Date(Date.now() - ms)

const seededContacts = {
  metadata: { path: ['seed'], equals: SEED_MARKER },
} as const

const clean = async () => {
  const { count } = await prisma.contact.deleteMany({ where: seededContacts })

  console.log(`Removidos ${count} contatos de demonstração (e o que dependia deles).`)
}

const seed = async () => {
  const account = await prisma.whatsAppAccount.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!account) {
    console.error('Nenhuma WhatsAppAccount ativa — configure a conexão antes.')
    process.exit(1)
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
  })

  if (!admin) {
    console.error('Nenhum usuário admin encontrado.')
    process.exit(1)
  }

  const existing = await prisma.contact.count({ where: seededContacts })

  if (existing > 0) {
    console.log(
      `Já existem ${existing} contatos de demonstração — rode com --clean antes de semear de novo.`,
    )
    return
  }

  const contacts = [
    { phone: '5543999140409', name: 'Maria Silva', profile: 'Maria' },
    { phone: '5511988887777', name: 'João Pereira', profile: 'João P.' },
    { phone: '5521977776666', name: null, profile: 'Ana Costa' },
    { phone: '5541966665555', name: 'Carlos Menezes', profile: 'Carlos' },
    { phone: '5531988884444', name: 'Beatriz Lima', profile: 'Bia' },
  ]

  const created = []

  for (const item of contacts) {
    // A Meta devolve celular brasileiro sem o nono dígito — é essa forma que
    // chega no webhook e que o waId precisa refletir para o seed ser fiel.
    const waId = phoneKey(item.phone)

    const contact = await prisma.contact.create({
      data: {
        whatsAppAccountId: account.id,
        waId,
        phoneNumber: item.phone,
        phoneKey: phoneKey(item.phone),
        name: item.name,
        profileName: item.profile,
        metadata: { seed: SEED_MARKER },
      },
    })

    created.push(contact)
  }

  // Índices dos contatos acima, para as conversas ficarem legíveis.
  const [maria, joao, ana, carlos, beatriz] = created

  const conversations = [
    {
      contact: maria!,
      status: 'OPEN' as const,
      priority: 'HIGH' as const,
      assigned: true,
      // Dentro da janela de 24h: o composer futuro aceita texto livre.
      lastInboundAt: ago(12 * MINUTE),
      unreadCount: 2,
      subject: 'Orçamento de pacote',
    },
    {
      contact: joao!,
      status: 'OPEN' as const,
      priority: 'MEDIUM' as const,
      assigned: true,
      // Fora da janela: WindowCountdown precisa mostrar o aviso de template.
      lastInboundAt: ago(30 * HOUR),
      unreadCount: 0,
      subject: null,
    },
    {
      contact: ana!,
      status: 'PENDING' as const,
      priority: 'MEDIUM' as const,
      assigned: false,
      lastInboundAt: ago(3 * HOUR),
      unreadCount: 5,
      subject: 'Sem responsável',
    },
    {
      contact: carlos!,
      status: 'CLOSED' as const,
      priority: 'LOW' as const,
      assigned: true,
      lastInboundAt: ago(9 * DAY),
      unreadCount: 0,
      subject: 'Atendimento encerrado',
    },
    {
      contact: beatriz!,
      status: 'OPEN' as const,
      priority: 'LOW' as const,
      assigned: false,
      lastInboundAt: ago(50 * MINUTE),
      unreadCount: 1,
      subject: null,
    },
  ]

  let wamid = 0
  const nextWamid = () => `wamid.${SEED_MARKER}.${(++wamid).toString().padStart(4, '0')}`

  for (const item of conversations) {
    // Mensagens de dias diferentes na conversa da Maria, para exercitar os
    // separadores de dia da thread invertida.
    const isRich = item.contact.id === maria!.id

    const messages = isRich
      ? [
          { dir: 'INBOUND', at: ago(5 * DAY), type: 'TEXT', content: 'Boa tarde, vocês fazem pacote para Gramado?' },
          { dir: 'OUTBOUND', at: ago(5 * DAY - HOUR), type: 'TEXT', content: 'Boa tarde, Maria! Fazemos sim. Para quantas pessoas?', status: 'READ' },
          { dir: 'INBOUND', at: ago(2 * DAY), type: 'TEXT', content: 'Somos 4 adultos, saindo de Londrina.' },
          { dir: 'OUTBOUND', at: ago(2 * DAY - 30 * MINUTE), type: 'DOCUMENT', content: 'Segue a proposta em PDF.', status: 'DELIVERED' },
          { dir: 'INBOUND', at: ago(DAY), type: 'IMAGE', content: 'Esse é o hotel que a gente viu' },
          { dir: 'OUTBOUND', at: ago(2 * HOUR), type: 'TEMPLATE', content: null, template: 'retorno_orcamento', status: 'SENT' },
          { dir: 'OUTBOUND', at: ago(90 * MINUTE), type: 'TEXT', content: 'Consegui uma condição melhor, posso te ligar?', status: 'FAILED', error: 'Recipient phone number not in allowed list' },
          { dir: 'INBOUND', at: ago(15 * MINUTE), type: 'TEXT', content: 'Pode ligar sim!' },
          { dir: 'INBOUND', at: ago(12 * MINUTE), type: 'STICKER', content: null },
        ]
      : [
          { dir: 'INBOUND', at: ago(3 * HOUR), type: 'TEXT', content: 'Oi, tudo bem? Queria saber sobre disponibilidade.' },
          { dir: 'OUTBOUND', at: ago(2 * HOUR), type: 'TEXT', content: 'Olá! Temos vagas sim, vou te passar os detalhes.', status: 'DELIVERED' },
          { dir: 'INBOUND', at: item.lastInboundAt, type: 'TEXT', content: 'Perfeito, obrigado!' },
        ]

    const last = messages[messages.length - 1]!

    const conversation = await prisma.conversation.create({
      data: {
        whatsAppAccountId: account.id,
        contactId: item.contact.id,
        assignedToId: item.assigned ? admin.id : null,
        assignedAt: item.assigned ? ago(4 * HOUR) : null,
        status: item.status,
        priority: item.priority,
        subject: item.subject,
        unreadCount: item.unreadCount,
        lastInboundAt: item.lastInboundAt,
        lastMessageAt: last.at,
        lastMessageText: last.content?.slice(0, 280) ?? `[${last.type.toLowerCase()}]`,
        ...(item.status === 'CLOSED' && {
          closedAt: ago(8 * DAY),
          closedById: admin.id,
        }),
      },
    })

    for (const message of messages) {
      const outbound = message.dir === 'OUTBOUND'

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: outbound ? admin.id : null,
          direction: outbound ? 'OUTBOUND' : 'INBOUND',
          type: message.type as never,
          status: outbound ? ((message.status ?? 'SENT') as never) : 'DELIVERED',
          waMessageId: nextWamid(),
          waTimestamp: message.at,
          createdAt: message.at,
          content: message.content,
          templateName: message.template ?? null,
          errorMessage: message.error ?? null,
          errorCode: message.error ? '131047' : null,
          ...(message.status === 'DELIVERED' && { deliveredAt: message.at }),
          ...(message.status === 'READ' && {
            deliveredAt: message.at,
            readAt: message.at,
          }),
          ...(message.status === 'FAILED' && { failedAt: message.at }),
        },
      })
    }

    console.log(
      `${item.contact.profileName}: ${item.status}/${item.priority}, ${messages.length} mensagens, ${item.assigned ? 'atribuída' : 'sem responsável'}`,
    )
  }

  const totals = await prisma.conversation.count({
    where: { contact: seededContacts },
  })

  console.log(`\n${created.length} contatos, ${totals} conversas, ${wamid} mensagens.`)
}

const isClean = process.argv.includes('--clean')

await (isClean ? clean() : seed())
await prisma.$disconnect()
