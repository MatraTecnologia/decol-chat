import assert from 'node:assert/strict'
import test from 'node:test'

import {
  activityRangeFilter,
  buildContactSnippet,
  buildConversationMatch,
  buildSnippet,
  canSearchMessages,
  isInvertedRange,
  normalizeSearchTerm,
  toLikePattern,
} from './search.ts'

const contact = {
  name: 'Maria Souza',
  profileName: 'Mari',
  phoneNumber: '5543999140409',
  waId: '5543999140409',
}

test('normalizes the search term collapsing spaces and dropping LIKE wildcards', () => {
  assert.equal(normalizeSearchTerm('  passagem   aérea '), 'passagem aérea')
  assert.equal(normalizeSearchTerm(undefined), '')
  assert.equal(normalizeSearchTerm('   '), '')
  assert.equal(normalizeSearchTerm('50%'), '50')
  assert.equal(normalizeSearchTerm('a_b\\c'), 'a b c')
})

test('only searches messages for terms long enough to use the trigram index', () => {
  assert.equal(canSearchMessages('oi'), false)
  assert.equal(canSearchMessages('ola'), true)
  assert.equal(toLikePattern('ola'), '%ola%')
})

test('returns the whole text when it fits in the snippet window', () => {
  assert.equal(
    buildSnippet('Oi, tudo bem? Queria saber sobre disponibilidade.', 'queria'),
    'Oi, tudo bem? Queria saber sobre disponibilidade.',
  )
})

test('collapses line breaks so the snippet stays on a single line', () => {
  assert.equal(buildSnippet('Bom dia\n\n  tudo bem?', 'tudo'), 'Bom dia tudo bem?')
})

test('cuts around the occurrence with ellipsis on both sides', () => {
  const content = `${'a'.repeat(300)} orçamento ${'b'.repeat(300)}`
  const snippet = buildSnippet(content, 'orçamento')

  assert.ok(snippet.startsWith('…'))
  assert.ok(snippet.endsWith('…'))
  assert.ok(snippet.includes('orçamento'))
  assert.equal(snippet.replaceAll('…', '').length, 120)
})

test('anchors the window to the end when the match is on the tail', () => {
  const content = `${'a'.repeat(300)} final`
  const snippet = buildSnippet(content, 'final')

  assert.ok(snippet.startsWith('…'))
  assert.ok(snippet.endsWith('final'))
  assert.equal(snippet.replaceAll('…', '').length, 120)
})

test('truncates long text without an occurrence instead of failing', () => {
  const snippet = buildSnippet('x'.repeat(400), 'inexistente')

  assert.equal(snippet, `${'x'.repeat(120)}…`)
})

test('never splits a surrogate pair when cutting the snippet', () => {
  const content = `${'a'.repeat(119)}🤖${'b'.repeat(200)} termo`
  const snippet = buildSnippet(content, 'aaa')

  assert.ok(!snippet.includes('�'))
  assert.ok([...snippet].every(char => char !== '\ud83e'))
})

test('returns null for empty content', () => {
  assert.equal(buildSnippet('   ', 'termo'), null)
})

test('matches the contact field that contains the term', () => {
  assert.equal(buildContactSnippet(contact, 'maria'), 'Maria Souza')
  assert.equal(buildContactSnippet(contact, 'mari'), 'Maria Souza')
  assert.equal(
    buildContactSnippet({ ...contact, name: null }, 'mari'),
    'Mari',
  )
  assert.equal(buildContactSnippet(contact, '99914'), '5543999140409')
  assert.equal(buildContactSnippet(contact, '(43) 99914-0409'), '5543999140409')
  assert.equal(buildContactSnippet(contact, 'joao'), null)
})

test('prefers the message match over the contact match', () => {
  const match = buildConversationMatch(contact, 'orçamento', {
    id: 'msg-1',
    content: 'Segue o orçamento da viagem',
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    count: 3,
  })

  assert.deepEqual(match, {
    field: 'message',
    snippet: 'Segue o orçamento da viagem',
    messageId: 'msg-1',
    messageAt: new Date('2026-08-01T12:00:00.000Z'),
    count: 3,
  })
})

test('falls back to the contact match when there is no matching message', () => {
  assert.deepEqual(buildConversationMatch(contact, 'maria', undefined), {
    field: 'contact',
    snippet: 'Maria Souza',
    messageId: null,
    messageAt: null,
    count: 0,
  })
})

test('returns a null match instead of a half-filled one', () => {
  assert.equal(buildConversationMatch(contact, 'joao', undefined), null)
  assert.equal(
    buildConversationMatch(contact, 'joao', {
      id: 'msg-1',
      content: '   ',
      createdAt: new Date(),
      count: 1,
    }),
    null,
  )
})

test('detects inverted date ranges', () => {
  const from = new Date('2026-08-02T00:00:00.000Z')
  const to = new Date('2026-08-01T00:00:00.000Z')

  assert.equal(isInvertedRange(from, to), true)
  assert.equal(isInvertedRange(to, from), false)
  assert.equal(isInvertedRange(from, from), false)
  assert.equal(isInvertedRange(from, undefined), false)
  assert.equal(isInvertedRange(undefined, to), false)
  assert.equal(isInvertedRange(undefined, undefined), false)
})

test('builds the activity range filter falling back to createdAt', () => {
  const from = new Date('2026-08-01T00:00:00.000Z')
  const to = new Date('2026-08-31T00:00:00.000Z')

  assert.equal(activityRangeFilter(undefined, undefined), null)

  assert.deepEqual(activityRangeFilter(from, to), {
    OR: [
      { lastMessageAt: { gte: from, lte: to } },
      { lastMessageAt: null, createdAt: { gte: from, lte: to } },
    ],
  })

  assert.deepEqual(activityRangeFilter(undefined, to), {
    OR: [
      { lastMessageAt: { lte: to } },
      { lastMessageAt: null, createdAt: { lte: to } },
    ],
  })
})
