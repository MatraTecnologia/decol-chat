import assert from 'node:assert/strict'
import test from 'node:test'

import {
  dedupeMessages,
  messageKey,
  prependMessage,
  replaceMessage,
} from './merge-message-page.ts'

const message = (overrides = {}) => ({
  id: 'local-1',
  conversationId: 'conv-1',
  direction: 'OUTBOUND',
  status: 'PENDING',
  waMessageId: null,
  content: 'Bom dia',
  ...overrides,
})

test('a chave cai para o id local enquanto não há wamid', () => {
  assert.equal(messageKey(message()), 'local-1')
  assert.equal(messageKey(message({ waMessageId: 'wamid.1' })), 'wamid.1')
})

test('dedupe mantém a primeira ocorrência de cada chave', () => {
  const persisted = message({ id: 'srv-1', waMessageId: 'wamid.1' })
  const echo = message({ id: 'srv-1', waMessageId: 'wamid.1', status: 'SENT' })

  assert.deepEqual(dedupeMessages([persisted, echo]), [persisted])
})

test('mensagem nova entra no topo da página', () => {
  const older = message({ id: 'srv-1', waMessageId: 'wamid.1' })
  const incoming = message({ id: 'srv-2', waMessageId: 'wamid.2' })

  assert.deepEqual(prependMessage([older], incoming), [incoming, older])
})

test('replaceMessage troca a bolha pela versão com status novo', () => {
  const sent = message({ id: 'srv-1', waMessageId: 'wamid.1', status: 'SENT' })
  const other = message({ id: 'srv-2', waMessageId: 'wamid.2', status: 'SENT' })
  const delivered = { ...sent, status: 'DELIVERED' }

  assert.deepEqual(replaceMessage([other, sent], delivered), [other, delivered])
})

test('replaceMessage devolve null quando a mensagem não está na página', () => {
  const other = message({ id: 'srv-2', waMessageId: 'wamid.2' })
  const delivered = message({
    id: 'srv-1',
    waMessageId: 'wamid.1',
    status: 'DELIVERED',
  })

  assert.equal(replaceMessage([other], delivered), null)
})

test('replaceMessage não confunde a bolha otimista com a mensagem real', () => {
  const optimistic = message()
  const delivered = message({
    id: 'srv-1',
    waMessageId: 'wamid.1',
    status: 'DELIVERED',
  })

  assert.equal(replaceMessage([optimistic], delivered), null)
})
