import 'dotenv/config'

import { prisma } from '@/lib/prisma.js'

const ROLLBACK = 'rollback-proposital'

const main = async () => {
  try {
    await prisma.$transaction(
      async tx => {
        const [conversation] = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "conversation" LIMIT 1`,
        )

        await tx.$executeRawUnsafe(
          `INSERT INTO "message" ("id", "conversationId", "direction", "type", "status", "content", "createdAt", "updatedAt")
           SELECT 'seed' || g, $1, 'INBOUND', 'TEXT', 'SENT',
                  CASE WHEN g % 5000 = 0 THEN 'segue o orçamento da viagem para Lisboa'
                       ELSE 'mensagem sintetica numero ' || g END,
                  now(), now()
           FROM generate_series(1, 60000) g`,
          conversation!.id,
        )

        await tx.$executeRawUnsafe(`ANALYZE "message"`)

        const show = async (label: string, sql: string) => {
          console.log(`\n=== ${label} ===`)
          const rows = await tx.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
            `EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
          )
          for (const row of rows) console.log(row['QUERY PLAN'])
        }

        console.log(
          'total de mensagens dentro da transação:',
          await tx.$queryRawUnsafe(`SELECT count(*)::int FROM "message"`),
        )

        await show(
          'EXISTS (filtro da listagem)',
          `SELECT c."id" FROM "conversation" c
           WHERE EXISTS (
             SELECT 1 FROM "message" m
             WHERE m."conversationId" = c."id" AND m."content" ILIKE '%orçamento%'
           )
           ORDER BY c."lastMessageAt" DESC NULLS LAST, c."id" DESC LIMIT 20`,
        )

        await show(
          'Agregado de trechos da página',
          `SELECT sub."conversationId", sub."id", sub."createdAt", sub."content", sub."total"
           FROM (
             SELECT m."conversationId", m."id", m."content", m."createdAt",
                    COUNT(*) OVER (PARTITION BY m."conversationId")::int AS "total",
                    ROW_NUMBER() OVER (PARTITION BY m."conversationId" ORDER BY m."createdAt" DESC, m."id" DESC) AS "rn"
             FROM "message" m
             WHERE m."conversationId" IN ($1)
               AND m."content" ILIKE '%orçamento%'
           ) sub WHERE sub."rn" = 1`.replace('$1', `'${conversation!.id}'`),
        )

        await show(
          'Termo de 2 caracteres (sem trigrama — por isso o corte em 3)',
          `SELECT m."id" FROM "message" m WHERE m."content" ILIKE '%or%'`,
        )

        throw new Error(ROLLBACK)
      },
      { timeout: 120_000, maxWait: 20_000 },
    )
  } catch (error) {
    if ((error as Error).message !== ROLLBACK) throw error
    console.log('\ntransação revertida (nenhuma linha sintética permaneceu)')
  }

  console.log(
    'mensagens após rollback:',
    await prisma.$queryRawUnsafe(`SELECT count(*)::int FROM "message"`),
  )

  await prisma.$disconnect()
}

void main()
