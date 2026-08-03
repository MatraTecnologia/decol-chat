import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatAdvancedDefinition,
  parseAdvancedDefinition,
} from './json-mode.ts'

const definition = {
  category: 'UTILITY',
  language: 'pt_BR',
  parameterFormat: 'POSITIONAL',
  components: [
    { type: 'HEADER', format: 'TEXT', text: 'Pedido {{1}}', examples: ['123'] },
    { type: 'BODY', text: 'Olá {{1}}', examples: ['Ana'] },
    { type: 'FOOTER', text: 'Equipe Decol' },
    {
      type: 'BUTTONS',
      buttons: [
        {
          kind: 'URL',
          text: 'Abrir',
          url: 'https://example.com/{{1}}',
          examples: ['pedido-1'],
        },
      ],
    },
  ],
}

test('parses a known definition', () => {
  const result = parseAdvancedDefinition(JSON.stringify(definition))

  assert.equal(result.success, true)
  assert.deepEqual(result.data, definition)
})

test('round-trips known components without losing fields', () => {
  const result = parseAdvancedDefinition(formatAdvancedDefinition(definition))

  assert.equal(result.success, true)
  assert.deepEqual(result.data, definition)
})

test('round-trips unknown Graph components without losing fields', () => {
  const advanced = {
    ...definition,
    components: [
      { type: 'BODY', text: 'Corpo' },
      {
        type: 'CUSTOM',
        raw: {
          type: 'ORDER_DETAILS',
          order: {
            items: [{ retailer_id: 'sku-1', amount: { value: 1200 } }],
            unknown_future_field: { deep: ['a', 'b'] },
          },
        },
      },
    ],
  }

  const parsed = parseAdvancedDefinition(formatAdvancedDefinition(advanced))
  assert.equal(parsed.success, true)
  assert.deepEqual(parsed.data, advanced)

  const again = parseAdvancedDefinition(formatAdvancedDefinition(parsed.data))
  assert.equal(again.success, true)
  assert.deepEqual(again.data, advanced)
})

test('formats with two-space indentation', () => {
  assert.equal(
    formatAdvancedDefinition({ category: 'UTILITY' }),
    '{\n  "category": "UTILITY"\n}',
  )
})

test('reports a readable syntax error with line and column', () => {
  const broken = '{\n  "category": "UTILITY"\n  "language": "pt_BR"\n}'
  const result = parseAdvancedDefinition(broken)

  assert.equal(result.success, false)
  assert.equal(result.error.line, 3)
  assert.equal(typeof result.error.column, 'number')
  assert.match(result.error.message, /linha 3, coluna \d+/)
})

test('reports empty content instead of a null position', () => {
  for (const empty of ['', '   \n  ']) {
    const result = parseAdvancedDefinition(empty)

    assert.equal(result.success, false)
    assert.equal(result.error.message, 'Informe o JSON do template.')
    assert.equal(result.error.line, null)
  }
})

test('rejects protected keys at the top level', () => {
  for (const key of [
    'accessToken',
    'whatsAppAccountId',
    'createdById',
    'updatedById',
    'remoteStatus',
    'remotePayload',
  ]) {
    const result = parseAdvancedDefinition(
      JSON.stringify({ ...definition, [key]: 'valor' }),
    )

    assert.equal(result.success, false, key)
    assert.equal(result.error.path, key)
    assert.match(result.error.message, new RegExp(key))
  }
})

test('rejects protected keys nested at any depth', () => {
  const result = parseAdvancedDefinition(
    JSON.stringify({
      ...definition,
      components: [
        { type: 'BODY', text: 'Corpo' },
        { type: 'CUSTOM', raw: { cards: [{ nested: [{ accessToken: 'x' }] }] } },
      ],
    }),
  )

  assert.equal(result.success, false)
  assert.equal(result.error.path, 'accessToken')
})

test('reports schema violations with the offending path', () => {
  const result = parseAdvancedDefinition(
    JSON.stringify({ ...definition, category: 'OTHER' }),
  )

  assert.equal(result.success, false)
  assert.equal(result.error.path, 'category')
  assert.equal(result.error.line, null)
})

test('reports missing examples for a variable', () => {
  const result = parseAdvancedDefinition(
    JSON.stringify({
      ...definition,
      components: [{ type: 'BODY', text: 'Olá {{1}}' }],
    }),
  )

  assert.equal(result.success, false)
  assert.equal(result.error.message, 'Informe um exemplo para cada variável do texto.')
})
