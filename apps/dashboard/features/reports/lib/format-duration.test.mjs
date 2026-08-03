import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatDuration,
  formatDurationCompact,
  formatElapsed,
  parseSeriesDate,
} from './format-duration.ts'

test('sem medição vira travessão, e o fallback é configurável', () => {
  assert.equal(formatDuration(null), '—')
  assert.equal(formatDuration(undefined), '—')
  assert.equal(formatDuration(Number.NaN), '—')
  assert.equal(formatDuration(null, 'sem dados'), 'sem dados')
})

test('zero é uma medição válida, não um vazio', () => {
  assert.equal(formatDuration(0), '0s')
  assert.equal(formatDurationCompact(0), '0s')
})

test('abaixo de um minuto conta em segundos', () => {
  assert.equal(formatDuration(1), '1s')
  assert.equal(formatDuration(45), '45s')
  assert.equal(formatDuration(59.4), '59s')
  assert.equal(formatDuration(59.6), '1min')
})

test('minutos mostram o resto em segundos só quando existe', () => {
  assert.equal(formatDuration(60), '1min')
  assert.equal(formatDuration(90), '1min 30s')
  assert.equal(formatDuration(600), '10min')
  assert.equal(formatDuration(3599), '59min 59s')
})

test('horas mostram o resto em minutos', () => {
  assert.equal(formatDuration(3600), '1h')
  assert.equal(formatDuration(8040), '2h 14min')
  assert.equal(formatDuration(86_399), '23h 59min')
})

test('acima de um dia para em duas unidades', () => {
  assert.equal(formatDuration(86_400), '1d')
  assert.equal(formatDuration(90_000), '1d 1h')
  assert.equal(formatDuration(295_200), '3d 10h')
})

test('duração negativa é tratada como zero', () => {
  assert.equal(formatDuration(-30), '0s')
})

test('a versão compacta usa uma unidade só', () => {
  assert.equal(formatDurationCompact(90), '1min')
  assert.equal(formatDurationCompact(8040), '2h')
  assert.equal(formatDurationCompact(295_200), '3d')
  assert.equal(formatDurationCompact(null), '—')
})

test('última atividade vira texto relativo', () => {
  const now = new Date('2026-08-03T12:00:00.000Z')

  assert.equal(formatElapsed(null, now), '—')
  assert.equal(formatElapsed('não é data', now), '—')
  assert.equal(formatElapsed('2026-08-03T11:59:30.000Z', now), 'agora')
  assert.equal(formatElapsed('2026-08-03T11:45:00.000Z', now), 'há 15min')
  assert.equal(formatElapsed('2026-08-03T09:00:00.000Z', now), 'há 3h')
  assert.equal(formatElapsed('2026-08-01T12:00:00.000Z', now), 'há 2d')
})

test('acima de sete dias a última atividade vira data curta', () => {
  const now = new Date('2026-08-03T12:00:00.000Z')

  assert.equal(formatElapsed('2026-07-01T12:00:00.000Z', now), '01/07/2026')
})

test('data só com dia é interpretada no fuso local', () => {
  const parsed = parseSeriesDate('2026-08-04')

  assert.equal(parsed.getFullYear(), 2026)
  assert.equal(parsed.getMonth(), 7)
  assert.equal(parsed.getDate(), 4)
  assert.equal(parseSeriesDate('não é data'), null)
})
