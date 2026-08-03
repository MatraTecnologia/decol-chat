import 'dotenv/config'

import { makeSignature } from 'better-auth/crypto'

import { prisma } from '@/lib/prisma.js'

import { SESSION_COOKIE } from '@workspace/shared/auth-cookie'

const BASE = 'http://localhost:3333'

const createSession = async (userId: string) => {
  const token = `probe-${Math.random().toString(36).slice(2)}`

  await prisma.session.create({
    data: {
      id: token,
      token,
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  const secret = process.env.BETTER_AUTH_SECRET!
  return `${SESSION_COOKIE}=${token}.${await makeSignature(token, secret)}`
}

const call = async (cookie: string, query: string) => {
  const response = await fetch(`${BASE}/conversations/?${query}`, {
    headers: { cookie },
  })
  const body = await response.json()
  return { status: response.status, body }
}

const summarize = (body: any) =>
  Array.isArray(body?.data)
    ? {
        total: body.meta.total,
        items: body.data.map((c: any) => ({
          contact: c.contact.name ?? c.contact.profileName,
          match: c.match,
        })),
      }
    : body

const main = async () => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
  })
  console.log('usuarios:', users)

  const admin = users.find(user => user.role === 'admin')!
  const agent = users.find(user => user.role === 'agent')

  const adminCookie = await createSession(admin.id)
  const agentCookie = agent ? await createSession(agent.id) : null

  const cases: [string, string][] = [
    ['sem filtros (contrato antigo)', 'scope=all&limit=3'],
    ['q casando mensagem', 'scope=all&q=orçamento'],
    ['q casando mensagem (outro termo)', 'scope=all&q=Perfeito'],
    ['q casando contato', 'scope=all&q=999'],
    ['q curto (<3, só contato)', 'scope=all&q=Ma'],
    ['q com curinga %', 'scope=all&q=%25'],
    ['intervalo válido', 'scope=all&from=2026-07-01&to=2026-12-31'],
    ['intervalo invertido', 'scope=all&from=2026-12-31&to=2026-07-01'],
    ['data inválida', 'scope=all&from=banana'],
    ['assignedToId=unassigned', 'scope=all&assignedToId=unassigned'],
    ['q + intervalo que exclui tudo', 'scope=all&q=Perfeito&from=2020-01-01&to=2020-02-01'],
  ]

  for (const [label, query] of cases) {
    const result = await call(adminCookie, query)
    console.log(`\n=== admin — ${label} (${query}) ===`)
    console.log(result.status, JSON.stringify(summarize(result.body), null, 1))
  }

  if (agentCookie) {
    console.log('\n=== agente — tenta ampliar escopo (scope=all + assignedToId) ===')
    const wide = await call(agentCookie, 'scope=all&assignedToId=unassigned')
    console.log(wide.status, JSON.stringify(summarize(wide.body), null, 1))

    const mine = await prisma.conversation.count({
      where: { assignedToId: agent!.id },
    })
    console.log('conversas realmente atribuídas ao agente:', mine)
  }

  await prisma.session.deleteMany({ where: { id: { startsWith: 'probe-' } } })
  await prisma.$disconnect()
}

void main()
