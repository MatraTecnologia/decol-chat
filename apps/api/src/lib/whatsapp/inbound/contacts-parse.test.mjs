import assert from 'node:assert/strict'
import test from 'node:test'

import { parseStateSync } from './contacts-parse.ts'

test('só adições de contato com número entram; o último nome vence', () => {
  const contacts = parseStateSync({
    state_sync: [
      {
        type: 'contact',
        action: 'add',
        contact: { full_name: 'Sérgio', phone_number: '554398343357' },
      },
      {
        type: 'contact',
        action: 'add',
        contact: { first_name: 'Sérgio Z.', phone_number: '+55 43 9834-3357' },
      },
      {
        type: 'contact',
        action: 'remove',
        contact: { full_name: 'Removido', phone_number: '5511999999999' },
      },
      { type: 'contact', action: 'add', contact: { full_name: 'Sem número' } },
      { type: 'other', action: 'add', contact: { phone_number: '1' } },
    ],
  })

  assert.deepEqual(contacts, [{ waId: '554398343357', name: 'Sérgio Z.' }])
})

test('payload sem state_sync devolve lista vazia', () => {
  assert.deepEqual(parseStateSync({}), [])
  assert.deepEqual(parseStateSync(undefined), [])
})
