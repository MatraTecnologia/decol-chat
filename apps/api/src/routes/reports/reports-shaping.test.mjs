import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_RANGE_DAYS,
  REPORT_GLOBAL_ROLES,
  REPORT_READERS,
  REPORT_STATUSES,
  buildHeatmap,
  buildSeries,
  buildStatusBreakdown,
  countStatus,
  dayKey,
  enumerateDays,
  parseReportRange,
  resolveReportScope,
} from './reports-shaping.ts'

// ── Período ────────────────────────────────────────────

test('aceita um intervalo ISO válido e devolve as datas normalizadas', () => {
  const parsed = parseReportRange(
    '2026-08-01T00:00:00.000Z',
    '2026-08-03T23:59:59.999Z',
  )

  assert.equal(parsed.ok, true)
  assert.equal(parsed.range.from.toISOString(), '2026-08-01T00:00:00.000Z')
  assert.equal(parsed.range.to.toISOString(), '2026-08-03T23:59:59.999Z')
})

test('recusa datas inválidas', () => {
  assert.equal(parseReportRange('ontem', '2026-08-03T00:00:00Z').ok, false)
  assert.equal(parseReportRange('2026-08-03T00:00:00Z', '').ok, false)
})

test('recusa intervalo invertido', () => {
  const parsed = parseReportRange(
    '2026-08-03T00:00:00Z',
    '2026-08-01T00:00:00Z',
  )

  assert.equal(parsed.ok, false)
  assert.match(parsed.error, /maior ou igual/u)
})

test('um intervalo de exatamente um dia é válido', () => {
  assert.equal(
    parseReportRange('2026-08-03T00:00:00Z', '2026-08-03T00:00:00Z').ok,
    true,
  )
})

test('recusa intervalo maior que um ano', () => {
  const day = 24 * 60 * 60 * 1000
  const from = new Date('2026-01-01T00:00:00Z')
  const limit = new Date(from.getTime() + MAX_RANGE_DAYS * day)
  const beyond = new Date(limit.getTime() + 1)

  assert.equal(
    parseReportRange(from.toISOString(), limit.toISOString()).ok,
    true,
  )
  assert.equal(
    parseReportRange(from.toISOString(), beyond.toISOString()).ok,
    false,
  )
})

// ── Escopo ─────────────────────────────────────────────

test('admin e gestor filtram por qualquer responsável', () => {
  for (const role of ['admin', 'manager']) {
    assert.equal(resolveReportScope(role, 'me', 'colega'), 'colega', role)
    assert.equal(resolveReportScope(role, 'me', undefined), null, role)
    assert.equal(resolveReportScope(role, 'me', ''), null, role)
  }
})

test('vendedor e somente-leitura são forçados ao próprio id', () => {
  for (const role of ['agent', 'viewer']) {
    assert.equal(resolveReportScope(role, 'me', 'colega'), 'me', role)
    assert.equal(resolveReportScope(role, 'me', 'me'), 'me', role)
    assert.equal(resolveReportScope(role, 'me', undefined), 'me', role)
  }
})

test('papel desconhecido nunca vira leitor global', () => {
  assert.equal(resolveReportScope('user', 'me', 'colega'), 'me')
  assert.equal(resolveReportScope('robot', 'me', 'colega'), 'me')
})

test('`user` não está entre os leitores de relatório', () => {
  assert.equal(REPORT_READERS.includes('user'), false)
  assert.deepEqual(REPORT_GLOBAL_ROLES, ['admin', 'manager'])
})

test('todo papel global também é leitor', () => {
  for (const role of REPORT_GLOBAL_ROLES) {
    assert.equal(REPORT_READERS.includes(role), true, role)
  }
})

// ── Dias ───────────────────────────────────────────────

test('a chave do dia usa o fuso do time, não UTC', () => {
  // 03:00Z do dia 04 ainda é dia 03 em São Paulo (-03).
  assert.equal(dayKey(new Date('2026-08-04T02:59:00Z')), '2026-08-03')
  assert.equal(dayKey(new Date('2026-08-04T03:00:00Z')), '2026-08-04')
})

test('enumera todos os dias do intervalo, inclusive as pontas', () => {
  const days = enumerateDays({
    from: new Date('2026-08-01T12:00:00Z'),
    to: new Date('2026-08-04T12:00:00Z'),
  })

  assert.deepEqual(days, [
    '2026-08-01',
    '2026-08-02',
    '2026-08-03',
    '2026-08-04',
  ])
})

test('um intervalo dentro do mesmo dia devolve um dia só', () => {
  const days = enumerateDays({
    from: new Date('2026-08-03T12:00:00Z'),
    to: new Date('2026-08-03T18:00:00Z'),
  })

  assert.deepEqual(days, ['2026-08-03'])
})

test('a virada de mês e de ano não pula dias', () => {
  assert.deepEqual(
    enumerateDays({
      from: new Date('2026-12-30T12:00:00Z'),
      to: new Date('2027-01-02T12:00:00Z'),
    }),
    ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'],
  )
})

test('ano bissexto tem 29 de fevereiro', () => {
  assert.deepEqual(
    enumerateDays({
      from: new Date('2028-02-27T12:00:00Z'),
      to: new Date('2028-03-01T12:00:00Z'),
    }),
    ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'],
  )
})

// ── Séries ─────────────────────────────────────────────

test('a série cobre todos os dias, zerando os sem dado', () => {
  const days = ['2026-08-01', '2026-08-02', '2026-08-03']

  const series = buildSeries(
    days,
    [{ day: '2026-08-02', inbound: 5, outbound: 3 }],
    [{ day: '2026-08-03', started: 2, closed: 1 }],
  )

  assert.equal(series.length, 3)
  assert.deepEqual(series[0], {
    date: '2026-08-01',
    inbound: 0,
    outbound: 0,
    started: 0,
    closed: 0,
  })
  assert.deepEqual(series[1], {
    date: '2026-08-02',
    inbound: 5,
    outbound: 3,
    started: 0,
    closed: 0,
  })
  assert.deepEqual(series[2], {
    date: '2026-08-03',
    inbound: 0,
    outbound: 0,
    started: 2,
    closed: 1,
  })
})

test('bucket fora do intervalo não entra na série', () => {
  const series = buildSeries(
    ['2026-08-01'],
    [{ day: '2026-07-31', inbound: 9, outbound: 9 }],
    [],
  )

  assert.deepEqual(series, [
    {
      date: '2026-08-01',
      inbound: 0,
      outbound: 0,
      started: 0,
      closed: 0,
    },
  ])
})

// ── Heatmap ────────────────────────────────────────────

test('o heatmap sempre tem as 168 células', () => {
  const matrix = buildHeatmap([])

  assert.equal(matrix.length, 168)
  assert.deepEqual(matrix[0], { weekday: 0, hour: 0, count: 0 })
  assert.deepEqual(matrix[167], { weekday: 6, hour: 23, count: 0 })
  assert.equal(
    matrix.every(cell => cell.count === 0),
    true,
  )
})

test('as células do heatmap são únicas e cobrem a semana inteira', () => {
  const keys = new Set(
    buildHeatmap([]).map(cell => `${cell.weekday}:${cell.hour}`),
  )

  assert.equal(keys.size, 168)
})

test('o heatmap soma os buckets que caem na mesma célula', () => {
  const matrix = buildHeatmap([
    { weekday: 2, hour: 14, count: 3 },
    { weekday: 2, hour: 14, count: 4 },
    { weekday: 6, hour: 23, count: 1 },
  ])

  const cellOf = (weekday, hour) =>
    matrix.find(cell => cell.weekday === weekday && cell.hour === hour)

  assert.equal(cellOf(2, 14).count, 7)
  assert.equal(cellOf(6, 23).count, 1)
  assert.equal(cellOf(0, 0).count, 0)
})

// ── Status ─────────────────────────────────────────────

test('o breakdown traz os três status mesmo sem dado', () => {
  assert.deepEqual(buildStatusBreakdown([]), [
    { status: 'OPEN', count: 0 },
    { status: 'PENDING', count: 0 },
    { status: 'CLOSED', count: 0 },
  ])
})

test('o breakdown preserva a ordem e ignora status desconhecido', () => {
  const breakdown = buildStatusBreakdown([
    { status: 'CLOSED', count: 4 },
    { status: 'OPEN', count: 2 },
    { status: 'ARCHIVED', count: 9 },
  ])

  assert.deepEqual(breakdown, [
    { status: 'OPEN', count: 2 },
    { status: 'PENDING', count: 0 },
    { status: 'CLOSED', count: 4 },
  ])
  assert.deepEqual(
    breakdown.map(item => item.status),
    [...REPORT_STATUSES],
  )
})

test('a contagem por status soma linhas repetidas', () => {
  const buckets = [
    { status: 'OPEN', count: 2 },
    { status: 'OPEN', count: 3 },
    { status: 'CLOSED', count: 1 },
  ]

  assert.equal(countStatus(buckets, 'OPEN'), 5)
  assert.equal(countStatus(buckets, 'PENDING'), 0)
})

test('o total do breakdown bate com a soma dos status', () => {
  const buckets = [
    { status: 'OPEN', count: 2 },
    { status: 'PENDING', count: 3 },
    { status: 'CLOSED', count: 5 },
  ]

  const total = buildStatusBreakdown(buckets).reduce(
    (sum, item) => sum + item.count,
    0,
  )

  assert.equal(total, 10)
})
