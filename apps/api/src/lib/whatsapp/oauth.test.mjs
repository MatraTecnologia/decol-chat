import assert from 'node:assert/strict'
import test from 'node:test'

import { buildTokenExchangeUrl } from './oauth-url.ts'

test('monta a url de troca com os tres parametros obrigatorios', () => {
  const url = new URL(
    buildTokenExchangeUrl({
      appId: '123',
      appSecret: 'segredo',
      code: 'AQB-code',
    }),
  )

  assert.equal(url.origin, 'https://graph.facebook.com')
  assert.equal(url.pathname.endsWith('/oauth/access_token'), true)
  assert.equal(url.searchParams.get('client_id'), '123')
  assert.equal(url.searchParams.get('client_secret'), 'segredo')
  assert.equal(url.searchParams.get('code'), 'AQB-code')
})

test('escapa valores com caractere reservado', () => {
  const url = new URL(
    buildTokenExchangeUrl({
      appId: '123',
      appSecret: 'a b&c',
      code: 'x/y+z',
    }),
  )

  assert.equal(url.searchParams.get('client_secret'), 'a b&c')
  assert.equal(url.searchParams.get('code'), 'x/y+z')
})
