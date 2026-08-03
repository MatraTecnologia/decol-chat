import assert from 'node:assert/strict'
import test from 'node:test'

import { extractChanges } from './payload.ts'

test('extrai field e phone_number_id de um evento de mensagens', () => {
  const [change] = extractChanges({
    entry: [
      {
        id: '111',
        changes: [
          {
            field: 'messages',
            value: { metadata: { phone_number_id: '999' }, messages: [] },
          },
        ],
      },
    ],
  })

  assert.equal(change.field, 'messages')
  assert.equal(change.phoneNumberId, '999')
  assert.equal(change.wabaId, '111')
})

test('evento de echo traz o waba id no entry, sem metadata', () => {
  const [change] = extractChanges({
    entry: [
      {
        id: '111',
        changes: [
          {
            field: 'smb_message_echoes',
            value: { messaging_product: 'whatsapp', message_echoes: [] },
          },
        ],
      },
    ],
  })

  assert.equal(change.field, 'smb_message_echoes')
  assert.equal(change.phoneNumberId, null)
  assert.equal(change.wabaId, '111')
})

test('achata múltiplas entries e changes na ordem recebida', () => {
  const changes = extractChanges({
    entry: [
      { id: 'a', changes: [{ field: 'messages' }, { field: 'history' }] },
      { id: 'b', changes: [{ field: 'smb_app_state_sync' }] },
    ],
  })

  assert.deepEqual(
    changes.map(c => [c.field, c.wabaId]),
    [
      ['messages', 'a'],
      ['history', 'a'],
      ['smb_app_state_sync', 'b'],
    ],
  )
})

test('payload irreconhecível devolve lista vazia em vez de estourar', () => {
  assert.deepEqual(extractChanges(null), [])
  assert.deepEqual(extractChanges(undefined), [])
  assert.deepEqual(extractChanges({}), [])
  assert.deepEqual(extractChanges({ entry: 'nope' }), [])
  assert.deepEqual(extractChanges({ entry: [{}] }), [])
})

test('field ausente vira null em vez de string vazia', () => {
  const [change] = extractChanges({
    entry: [{ id: 'a', changes: [{ value: {} }] }],
  })

  assert.equal(change.field, null)
})
