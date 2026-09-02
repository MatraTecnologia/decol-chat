import assert from 'node:assert/strict'
import test from 'node:test'

import { parseEchoes } from './echoes-parse.ts'

test('o contato do echo sai de `to`, nunca de `from`', () => {
  const [echo] = parseEchoes({
    messaging_product: 'whatsapp',
    message_echoes: [
      {
        id: 'wamid.1',
        from: '554396337105',
        to: '554388240667',
        timestamp: '1787595772',
        type: 'audio',
        audio: { id: 'm1', mime_type: 'audio/ogg', voice: true },
      },
    ],
  })

  assert.equal(echo.contactWaId, '554388240667')
  assert.equal(echo.message.id, 'wamid.1')
})

test('echo sem id ou sem destinatário é descartado', () => {
  assert.deepEqual(
    parseEchoes({
      message_echoes: [
        { to: '1', type: 'text' },
        { id: 'wamid.2', type: 'text' },
      ],
    }),
    [],
  )
  assert.deepEqual(parseEchoes(null), [])
})
