import assert from 'node:assert/strict'
import test from 'node:test'

import { getMessageNotification } from './message-notification-policy.ts'

const inbound = {
  entity: 'message',
  action: 'created',
  entityId: 'message-1',
  payload: {
    id: 'message-1',
    conversationId: 'conversation-1',
    direction: 'INBOUND',
    content: 'Olá',
  },
}

test('returns notification data for an inbound message in a hidden tab', () => {
  assert.deepEqual(getMessageNotification(inbound, 'granted', 'hidden'), {
    conversationId: 'conversation-1',
    body: 'Olá',
  })
})

test('uses the media fallback when content is empty', () => {
  assert.deepEqual(
    getMessageNotification(
      { ...inbound, payload: { ...inbound.payload, content: null } },
      'granted',
      'hidden',
    ),
    { conversationId: 'conversation-1', body: 'Mídia recebida' },
  )
})

test('ignores an inbound message while the tab is visible', () => {
  assert.equal(getMessageNotification(inbound, 'granted', 'visible'), null)
})

test('ignores an event without notification permission', () => {
  assert.equal(getMessageNotification(inbound, 'denied', 'hidden'), null)
  assert.equal(getMessageNotification(inbound, 'default', 'hidden'), null)
})

test('ignores outbound messages and unrelated events', () => {
  assert.equal(
    getMessageNotification(
      {
        ...inbound,
        payload: { ...inbound.payload, direction: 'OUTBOUND' },
      },
      'granted',
      'hidden',
    ),
    null,
  )
  assert.equal(
    getMessageNotification(
      { ...inbound, entity: 'conversation' },
      'granted',
      'hidden',
    ),
    null,
  )
})

test('ignores malformed payloads', () => {
  assert.equal(
    getMessageNotification(
      { ...inbound, payload: { direction: 'INBOUND' } },
      'granted',
      'hidden',
    ),
    null,
  )
  assert.equal(getMessageNotification(null, 'granted', 'hidden'), null)
})
