import assert from 'node:assert/strict'
import test from 'node:test'

import { matchesQueryTags, queryKeyTags } from './query-tags.ts'

test('usa as tags carimbadas na query key quando existem', () => {
  const key = [{ _id: 'listConversations', tags: ['Conversations'] }]

  assert.deepEqual(queryKeyTags(key), ['Conversations'])
})

test('a variante infinita nasce sem tags e cai no mapa por operação', () => {
  assert.deepEqual(queryKeyTags([{ _id: 'listConversations', _infinite: true }]), [
    'Conversations',
  ])
  assert.deepEqual(queryKeyTags([{ _id: 'listMessages', _infinite: true }]), [
    'Messages',
  ])
})

test('operação desconhecida não casa com nada', () => {
  assert.equal(queryKeyTags([{ _id: 'getWhatsappReadiness' }]), undefined)
  assert.equal(queryKeyTags(['chave-solta']), undefined)
  assert.equal(matchesQueryTags([{ _id: 'getWhatsappReadiness' }], ['WhatsApp']), false)
})

test('casa quando ao menos uma tag do evento bate', () => {
  const thread = [{ _id: 'listMessages', _infinite: true }]

  assert.equal(matchesQueryTags(thread, ['Messages', 'Conversations']), true)
  assert.equal(matchesQueryTags(thread, ['Conversations']), false)
  assert.equal(matchesQueryTags(thread, []), false)
})
