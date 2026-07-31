import { Prisma } from '@/generated/prisma/client.js'
import { prisma } from '@/lib/prisma.js'

import { isGlobalReader } from './guards.js'

/** Resumo barato de atividade do contato — nunca carrega mensagens. */
export interface ContactActivity {
  conversationCount: number
  openConversationCount: number
  lastInteractionAt: Date | null
}

interface ContactActivityRow extends ContactActivity {
  id: string
}

/**
 * Agregados calculados no banco, num único passo por página.
 * `FILTER (WHERE ...)` evita uma segunda varredura só para as conversas abertas,
 * e os casts `::int` são obrigatórios: `count()` volta como `bigint` e o JSON
 * do Fastify não serializa `BigInt`.
 */
const activitySelectSql = Prisma.sql`
  COUNT(cv.id)::int AS "conversationCount",
  COUNT(cv.id) FILTER (WHERE cv.status IN ('OPEN', 'PENDING'))::int AS "openConversationCount",
  MAX(cv."lastMessageAt") AS "lastInteractionAt"`

/**
 * Escopo aplicado ao JOIN: quem não é global reader só soma as conversas que
 * são dele — os números não podem revelar o volume de um colega.
 */
const joinScopeSql = (role: string, userId: string) =>
  isGlobalReader(role)
    ? Prisma.empty
    : Prisma.sql`AND cv."assignedToId" = ${userId}`

/**
 * Espelho em SQL de `scopeContacts()` (guards.ts) — necessário porque a ordenação
 * por `MAX(lastMessageAt)` não é expressável no `orderBy` do Prisma. Toda linha
 * que sai daqui é reconferida contra `scopeContacts()` antes de virar resposta.
 */
const contactScopeSql = (role: string, userId: string) =>
  isGlobalReader(role)
    ? Prisma.empty
    : Prisma.sql`AND EXISTS (
        SELECT 1 FROM "conversation" s
        WHERE s."contactId" = c.id AND s."assignedToId" = ${userId}
      )`

/** Escapa os curingas do LIKE para que o termo do usuário seja literal. */
const escapeLike = (term: string) => term.replace(/[\\%_]/gu, m => `\\${m}`)

const searchSql = (q: string | undefined) => {
  if (!q) return Prisma.empty

  const like = `%${escapeLike(q)}%`
  const digits = q.replace(/\D/gu, '')

  // `phoneNumber` está normalizado em E.164, então o termo só compara com ele
  // depois de perder a máscara: `(43) 99914-0409` → `43999140409`.
  const phone = digits
    ? Prisma.sql`OR c."phoneNumber" LIKE ${`%${digits}%`} OR c."waId" LIKE ${`%${digits}%`}`
    : Prisma.empty

  return Prisma.sql`AND (
    c."name" ILIKE ${like}
    OR c."profileName" ILIKE ${like}
    OR c."email" ILIKE ${like}
    ${phone}
  )`
}

interface ListActivityParams {
  role: string
  userId: string
  q?: string
  isBlocked?: boolean
  page: number
  limit: number
}

/**
 * Página de contatos ordenada por `lastInteractionAt` desc (nulls last), já com
 * os agregados. Devolve só os ids — a hidratação passa pelo Prisma com o
 * fragmento de escopo aplicado de novo.
 */
export const listContactActivityPage = async ({
  role,
  userId,
  q,
  isBlocked,
  page,
  limit,
}: ListActivityParams) => {
  const whereSql = Prisma.sql`
    WHERE TRUE
    ${contactScopeSql(role, userId)}
    ${isBlocked === undefined ? Prisma.empty : Prisma.sql`AND c."isBlocked" = ${isBlocked}`}
    ${searchSql(q)}`

  const [rows, [{ total }]] = await Promise.all([
    prisma.$queryRaw<ContactActivityRow[]>`
      SELECT c.id, ${activitySelectSql}
      FROM "contact" c
      LEFT JOIN "conversation" cv
        ON cv."contactId" = c.id ${joinScopeSql(role, userId)}
      ${whereSql}
      GROUP BY c.id
      ORDER BY MAX(cv."lastMessageAt") DESC NULLS LAST, c.id DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    prisma.$queryRaw<[{ total: number }]>`
      SELECT COUNT(*)::int AS total FROM "contact" c ${whereSql}`,
  ])

  return { rows, total }
}

/** Mesmos agregados para um conjunto de contatos já conhecido (rota de detalhe). */
export const findContactActivity = async (
  contactId: string,
  role: string,
  userId: string,
): Promise<ContactActivity> => {
  const rows = await prisma.$queryRaw<ContactActivityRow[]>`
    SELECT c.id, ${activitySelectSql}
    FROM "contact" c
    LEFT JOIN "conversation" cv
      ON cv."contactId" = c.id ${joinScopeSql(role, userId)}
    WHERE c.id = ${contactId}
    GROUP BY c.id`

  const row = rows[0]

  if (!row) {
    return {
      conversationCount: 0,
      openConversationCount: 0,
      lastInteractionAt: null,
    }
  }

  return {
    conversationCount: row.conversationCount,
    openConversationCount: row.openConversationCount,
    lastInteractionAt: row.lastInteractionAt,
  }
}
