import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildHeatmapScale,
  closureRate,
  formatCompactCount,
  formatCount,
  formatPercent,
  niceCeiling,
  percentage,
  rankAgents,
  responseRate,
  sortAgents,
  statusShares,
  topAgents,
} from './report-metrics.ts'

/** O formato compacto do pt-BR separa com espaço rígido (U+00A0). */
const normalizeSpaces = value => value.split(String.fromCharCode(160)).join(' ')

const agent = (overrides = {}) => ({
  userId: 'u1',
  name: 'Ana',
  email: 'ana@decol.com',
  image: null,
  role: 'user',
  assigned: 10,
  closed: 5,
  open: 5,
  messagesSent: 100,
  firstResponseSeconds: 120,
  resolutionSeconds: 3600,
  lastActivityAt: '2026-08-03T12:00:00.000Z',
  ...overrides,
})

test('percentual não divide por zero', () => {
  assert.equal(percentage(5, 10), 50)
  assert.equal(percentage(0, 0), 0)
  assert.equal(percentage(5, 0), 0)
})

test('taxa de resposta pode passar de 100%', () => {
  assert.equal(responseRate({ messagesInbound: 100, messagesOutbound: 50 }), 50)
  assert.equal(responseRate({ messagesInbound: 40, messagesOutbound: 80 }), 200)
  assert.equal(responseRate({ messagesInbound: 0, messagesOutbound: 12 }), 0)
})

test('taxa de fechamento compara fechadas com iniciadas', () => {
  assert.equal(
    closureRate({ conversationsStarted: 80, conversationsClosed: 60 }),
    75,
  )
  assert.equal(
    closureRate({ conversationsStarted: 0, conversationsClosed: 0 }),
    0,
  )
})

test('distribuição por status mantém ordem fixa e preenche o que faltar', () => {
  const shares = statusShares([
    { status: 'CLOSED', count: 60 },
    { status: 'OPEN', count: 40 },
  ])

  assert.deepEqual(
    shares.map(share => share.status),
    ['OPEN', 'PENDING', 'CLOSED'],
  )
  assert.equal(shares[0].percent, 40)
  assert.equal(shares[1].count, 0)
  assert.equal(shares[1].percent, 0)
  assert.equal(shares[2].percent, 60)
})

test('sem conversa alguma, todo status fica em zero por cento', () => {
  const shares = statusShares([])

  assert.equal(shares.length, 3)
  assert.deepEqual(
    shares.map(share => share.percent),
    [0, 0, 0],
  )
})

test('ranking prioriza fechadas e desempata pela primeira resposta', () => {
  const ranked = rankAgents([
    agent({ userId: 'a', name: 'Ana', closed: 8, firstResponseSeconds: 300 }),
    agent({ userId: 'b', name: 'Bruno', closed: 8, firstResponseSeconds: 90 }),
    agent({ userId: 'c', name: 'Caio', closed: 12, firstResponseSeconds: 900 }),
  ])

  assert.deepEqual(
    ranked.map(row => row.userId),
    ['c', 'b', 'a'],
  )
  assert.deepEqual(
    ranked.map(row => row.position),
    [1, 2, 3],
  )
})

test('quem não tem primeira resposta medida perde o desempate', () => {
  const ranked = rankAgents([
    agent({ userId: 'a', closed: 4, firstResponseSeconds: null }),
    agent({ userId: 'b', closed: 4, firstResponseSeconds: 600 }),
  ])

  assert.deepEqual(
    ranked.map(row => row.userId),
    ['b', 'a'],
  )
})

test('ranking não altera a lista recebida', () => {
  const agents = [
    agent({ userId: 'a', closed: 1 }),
    agent({ userId: 'b', closed: 9 }),
  ]

  rankAgents(agents)

  assert.deepEqual(
    agents.map(row => row.userId),
    ['a', 'b'],
  )
})

test('pódio devolve no máximo os três primeiros', () => {
  const agents = [1, 2, 3, 4, 5].map((closed, index) =>
    agent({ userId: `u${index}`, closed }),
  )

  assert.equal(topAgents(agents).length, 3)
  assert.equal(topAgents(agents)[0].closed, 5)
  assert.equal(topAgents([agent()]).length, 1)
})

test('ordenação da tabela respeita direção e joga vazios para o fim', () => {
  const agents = [
    agent({ userId: 'a', messagesSent: 10, firstResponseSeconds: null }),
    agent({ userId: 'b', messagesSent: 90, firstResponseSeconds: 400 }),
    agent({ userId: 'c', messagesSent: 50, firstResponseSeconds: 100 }),
  ]

  assert.deepEqual(
    sortAgents(agents, 'messagesSent', 'desc').map(row => row.userId),
    ['b', 'c', 'a'],
  )
  assert.deepEqual(
    sortAgents(agents, 'messagesSent', 'asc').map(row => row.userId),
    ['a', 'c', 'b'],
  )
  assert.deepEqual(
    sortAgents(agents, 'firstResponseSeconds', 'asc').map(row => row.userId),
    ['c', 'b', 'a'],
  )
  assert.deepEqual(
    sortAgents(agents, 'firstResponseSeconds', 'desc').map(row => row.userId),
    ['b', 'c', 'a'],
  )
})

test('ordenação por última atividade e por nome usa locale pt-BR', () => {
  const agents = [
    agent({ userId: 'a', name: 'Álvaro', lastActivityAt: null }),
    agent({
      userId: 'b',
      name: 'Bruno',
      lastActivityAt: '2026-08-01T10:00:00.000Z',
    }),
    agent({
      userId: 'c',
      name: 'Caio',
      lastActivityAt: '2026-08-03T10:00:00.000Z',
    }),
  ]

  assert.deepEqual(
    sortAgents(agents, 'lastActivityAt', 'desc').map(row => row.userId),
    ['c', 'b', 'a'],
  )
  assert.deepEqual(
    sortAgents(agents, 'name', 'asc').map(row => row.name),
    ['Álvaro', 'Bruno', 'Caio'],
  )
})

test('escala do heatmap soma repetições, guarda o pico e reserva a faixa zero', () => {
  const scale = buildHeatmapScale([
    { weekday: 1, hour: 9, count: 4 },
    { weekday: 1, hour: 9, count: 6 },
    { weekday: 3, hour: 14, count: 20 },
    { weekday: 5, hour: 20, count: 1 },
  ])

  assert.equal(scale.at(1, 9), 10)
  assert.equal(scale.at(0, 0), 0)
  assert.equal(scale.max, 20)
  assert.equal(scale.total, 31)
  assert.deepEqual(scale.peak, { weekday: 3, hour: 14, count: 20 })

  assert.equal(scale.bucketAt(0, 0), 0)
  assert.equal(scale.bucketAt(5, 20), 1)
  assert.equal(scale.bucketAt(3, 14), 4)
})

test('heatmap vazio não quebra a escala', () => {
  const scale = buildHeatmapScale([])

  assert.equal(scale.max, 0)
  assert.equal(scale.total, 0)
  assert.equal(scale.peak, null)
  assert.equal(scale.bucketAt(2, 2), 0)
})

test('topo do eixo y arredonda para valor redondo acima do máximo', () => {
  assert.equal(niceCeiling(0), 1)
  assert.equal(niceCeiling(7), 10)
  assert.equal(niceCeiling(12), 15)
  assert.equal(niceCeiling(87), 100)
  assert.equal(niceCeiling(230), 250)
})

test('números saem no formato pt-BR', () => {
  assert.equal(formatCount(1234), '1.234')
  assert.equal(formatPercent(42.6, 1), '42,6%')
  assert.equal(formatPercent(42.6), '43%')
  assert.equal(formatCompactCount(1234), '1.234')
  assert.equal(normalizeSpaces(formatCompactCount(12_400)), '12,4 mil')
})
