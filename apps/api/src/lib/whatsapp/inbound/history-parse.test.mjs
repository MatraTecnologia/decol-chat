import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyHistoryMessage,
  parseHistory,
  summarizeThread,
} from './history-parse.ts'

const BUSINESS = '554396337105'
const CUSTOMER = '554388257151'

const at = seconds => String(seconds)

test('classifica pela flag from_me antes de olhar o MSISDN', () => {
  assert.equal(
    classifyHistoryMessage(
      { from: CUSTOMER, history_context: { from_me: true } },
      BUSINESS,
    ),
    'OUTBOUND',
  )
  assert.equal(
    classifyHistoryMessage({ from: BUSINESS, history_context: {} }, BUSINESS),
    'OUTBOUND',
  )
  assert.equal(
    classifyHistoryMessage({ from: CUSTOMER, history_context: {} }, BUSINESS),
    'INBOUND',
  )
  assert.equal(classifyHistoryMessage({ from: CUSTOMER }, null), 'INBOUND')
})

test('parseHistory agrupa por contato, ignora edit e mapeia tipos', () => {
  const { progress, threads } = parseHistory({
    metadata: { display_phone_number: BUSINESS },
    history: [
      {
        metadata: { phase: 1, chunk_order: 3, progress: 42 },
        threads: [
          {
            id: CUSTOMER,
            context: { wa_id: CUSTOMER },
            messages: [
              {
                id: 'wamid.2',
                from: BUSINESS,
                timestamp: at(200),
                type: 'text',
                text: { body: 'Oi!' },
                history_context: { status: 'read', from_me: true },
              },
              {
                id: 'wamid.1',
                from: CUSTOMER,
                timestamp: at(100),
                type: 'media_placeholder',
                history_context: { status: 'pending' },
              },
              {
                id: 'wamid.3',
                from: BUSINESS,
                timestamp: at(300),
                type: 'edit',
                edit: { original_message_id: 'wamid.2' },
                history_context: { status: 'read', from_me: true },
              },
              {
                from: CUSTOMER,
                timestamp: at(400),
                type: 'text',
                text: { body: 'sem id' },
              },
            ],
          },
        ],
      },
    ],
  })

  assert.deepEqual(progress, { phase: 1, chunkOrder: 3, progress: 42 })
  assert.equal(threads.length, 1)

  const [thread] = threads
  assert.equal(thread.waId, CUSTOMER)
  assert.deepEqual(
    thread.messages.map(m => m.waMessageId),
    ['wamid.1', 'wamid.2'],
  )

  const [placeholder, text] = thread.messages
  assert.equal(placeholder.direction, 'INBOUND')
  assert.equal(placeholder.type, 'UNSUPPORTED')
  assert.equal(placeholder.status, 'DELIVERED')
  assert.ok(placeholder.content)

  assert.equal(text.direction, 'OUTBOUND')
  assert.equal(text.type, 'TEXT')
  assert.equal(text.status, 'READ')
  assert.equal(text.content, 'Oi!')
})

test('summarizeThread: OPEN nas últimas 24h, lastInboundAt ignora as enviadas', () => {
  const now = new Date('2026-09-02T20:00:00Z')
  const hoursAgo = h => new Date(now.getTime() - h * 60 * 60 * 1000)

  const recent = summarizeThread(
    [
      { direction: 'INBOUND', timestamp: hoursAgo(30), content: 'a' },
      { direction: 'OUTBOUND', timestamp: hoursAgo(2), content: 'b' },
    ],
    now,
  )

  assert.equal(recent.status, 'OPEN')
  assert.equal(recent.lastMessageText, 'b')
  assert.equal(recent.lastInboundAt.getTime(), hoursAgo(30).getTime())

  const old = summarizeThread(
    [{ direction: 'OUTBOUND', timestamp: hoursAgo(48), content: 'x' }],
    now,
  )

  assert.equal(old.status, 'CLOSED')
  assert.equal(old.lastInboundAt, null)
})
