import 'dotenv/config'

import { prisma } from '@/lib/prisma.js'

import { findMessageMatches } from '@/routes/conversations/message-search.js'
import { buildConversationMatch } from '@/routes/conversations/search.js'

const explain = async (label: string, sql: string) => {
  console.log(`\n=== ${label} ===`)
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off')
    const rows = await tx.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
      `EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
    )
    for (const row of rows) console.log(row['QUERY PLAN'])
  })
}

const main = async () => {
  await explain(
    'EXISTS (filtro da listagem) com enable_seqscan=off',
    `SELECT c."id" FROM "conversation" c
     WHERE EXISTS (
       SELECT 1 FROM "message" m
       WHERE m."conversationId" = c."id" AND m."content" ILIKE '%orçamento%'
     )`,
  )

  await explain(
    'Agregado de trechos com enable_seqscan=off',
    `SELECT sub."conversationId", sub."id", sub."createdAt", sub."content", sub."total"
     FROM (
       SELECT m."conversationId", m."id", m."content", m."createdAt",
              COUNT(*) OVER (PARTITION BY m."conversationId")::int AS "total",
              ROW_NUMBER() OVER (PARTITION BY m."conversationId" ORDER BY m."createdAt" DESC, m."id" DESC) AS "rn"
       FROM "message" m
       WHERE m."content" ILIKE '%orçamento%'
     ) sub WHERE sub."rn" = 1`,
  )

  console.log('\n=== plano SEM forçar (planner livre, 30 linhas) ===')
  const natural = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
    `EXPLAIN (ANALYZE) SELECT m."id" FROM "message" m WHERE m."content" ILIKE '%orçamento%'`,
  )
  for (const row of natural) console.log(row['QUERY PLAN'])

  const conversations = await prisma.conversation.findMany({
    take: 20,
    include: {
      contact: {
        select: {
          name: true,
          profileName: true,
          phoneNumber: true,
          waId: true,
        },
      },
    },
  })

  const ids = conversations.map(conversation => conversation.id)

  for (const term of ['orçamento', 'Perfeito', 'zzz']) {
    const matches = await findMessageMatches(ids, term)
    console.log(`\n=== findMessageMatches('${term}') ===`)
    for (const [conversationId, match] of matches) {
      console.log(conversationId, {
        countType: typeof match.count,
        createdAtIsDate: match.createdAt instanceof Date,
        count: match.count,
      })
    }

    console.log(
      'matches montados:',
      conversations
        .map(conversation =>
          buildConversationMatch(
            conversation.contact,
            term,
            matches.get(conversation.id),
          ),
        )
        .filter(Boolean),
    )
  }

  console.log('\n=== busca por telefone (contato) ===')
  const contactHit = await prisma.conversation.findMany({
    where: { contact: { OR: [{ phoneNumber: { contains: '999' } }] } },
    select: { id: true },
  })
  console.log('conversas por telefone:', contactHit.length)

  await prisma.$disconnect()
}

void main()
