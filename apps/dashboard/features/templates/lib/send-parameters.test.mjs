import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSendParameters,
  getTemplateParameterFields,
} from './send-parameters.ts'

const definition = (components, overrides = {}) => ({
  category: 'UTILITY',
  language: 'pt_BR',
  parameterFormat: 'POSITIONAL',
  components,
  ...overrides,
})

const ids = fields => fields.map(field => field.id)

const byId = (fields, id) => fields.find(field => field.id === id)

test('static templates require no parameters', () => {
  const fields = getTemplateParameterFields(
    definition([
      { type: 'HEADER', format: 'TEXT', text: 'Aviso' },
      { type: 'BODY', text: 'Pedido confirmado' },
      { type: 'FOOTER', text: 'Equipe Decol' },
      {
        type: 'BUTTONS',
        buttons: [
          { kind: 'QUICK_REPLY', text: 'Parar' },
          { kind: 'PHONE_NUMBER', text: 'Ligar', phoneNumber: '+554399140409' },
          { kind: 'URL', text: 'Abrir', url: 'https://example.com/fixo' },
        ],
      },
    ]),
  )

  assert.deepEqual(fields, [])
  assert.deepEqual(buildSendParameters(fields, {}), { success: true, data: {} })
})

test('extracts every field in a stable order', () => {
  const fields = getTemplateParameterFields(
    definition(
      [
        { type: 'FOOTER', text: 'Equipe Decol' },
        {
          type: 'BUTTONS',
          buttons: [
            { kind: 'QUICK_REPLY', text: 'Parar' },
            {
              kind: 'URL',
              text: 'Abrir',
              url: 'https://example.com/{{1}}',
              examples: ['pedido-1'],
            },
            { kind: 'OTP', otpType: 'COPY_CODE', text: 'Copiar código' },
          ],
        },
        {
          type: 'CAROUSEL',
          cards: [
            {
              header: { format: 'IMAGE', example: 'https://cdn/1.jpg' },
              body: { text: 'Pacote {{destino}}', examples: ['Maceió'] },
            },
            {
              header: { format: 'VIDEO', example: 'https://cdn/2.mp4' },
              body: { text: 'Sem variável' },
            },
          ],
        },
        {
          type: 'BODY',
          text: 'Olá {{nome}}, pedido {{pedido}}',
          examples: ['Ana', '123'],
        },
        { type: 'HEADER', format: 'IMAGE', example: 'https://cdn/capa.jpg' },
      ],
      { category: 'MARKETING', parameterFormat: 'NAMED' },
    ),
  )

  assert.deepEqual(ids(fields), [
    'header.media',
    'body.nome',
    'body.pedido',
    'buttons.1',
    'buttons.2',
    'cards.0.media',
    'cards.0.body.destino',
    'cards.1.media',
  ])
})

test('orders positional variables by index, not by appearance', () => {
  const fields = getTemplateParameterFields(
    definition([
      { type: 'BODY', text: 'Pedido {{2}} de {{1}}', examples: ['Ana', '123'] },
    ]),
  )

  assert.deepEqual(ids(fields), ['body.1', 'body.2'])
  assert.deepEqual(
    fields.map(field => field.defaultValue),
    ['Ana', '123'],
  )
})

test('falls back to example order when a positional text uses names', () => {
  const fields = getTemplateParameterFields(
    definition([
      {
        type: 'BODY',
        text: 'Olá {{nome}}, pedido {{pedido}}',
        examples: ['Ana', '123'],
      },
    ]),
  )

  assert.deepEqual(
    fields.map(field => field.defaultValue),
    ['Ana', '123'],
  )
})

test('carousel card fields stay positional even in named templates', () => {
  const fields = getTemplateParameterFields(
    definition(
      [
        { type: 'BODY', text: 'Olá {{nome}}', examples: ['Ana'] },
        {
          type: 'CAROUSEL',
          cards: [
            {
              header: { format: 'IMAGE', example: 'https://cdn/1.jpg' },
              body: { text: 'Pacote {{destino}}', examples: ['Maceió'] },
            },
          ],
        },
      ],
      { category: 'MARKETING', parameterFormat: 'NAMED' },
    ),
  )

  assert.equal(byId(fields, 'body.nome').format, 'NAMED')
  assert.equal(byId(fields, 'cards.0.body.destino').format, 'POSITIONAL')
  assert.equal(byId(fields, 'cards.0.body.destino').defaultValue, 'Maceió')
})

test('fills defaults from the definition examples', () => {
  const fields = getTemplateParameterFields(
    definition([
      { type: 'HEADER', format: 'IMAGE', example: 'https://cdn/capa.jpg' },
      { type: 'BODY', text: 'Olá {{1}}', examples: ['Ana'] },
      {
        type: 'BUTTONS',
        buttons: [
          {
            kind: 'URL',
            text: 'Abrir',
            url: 'https://example.com/{{1}}',
            examples: ['pedido-1'],
          },
          { kind: 'COPY_CODE', text: 'Copiar', example: 'DECOL10' },
        ],
      },
    ]),
  )

  assert.deepEqual(
    fields.map(field => [field.id, field.kind, field.defaultValue]),
    [
      ['header.media', 'MEDIA', 'https://cdn/capa.jpg'],
      ['body.1', 'TEXT', 'Ana'],
      ['buttons.0', 'URL_SUFFIX', 'pedido-1'],
      ['buttons.1', 'OTP', 'DECOL10'],
    ],
  )
})

test('media headers and cards are always required', () => {
  const fields = getTemplateParameterFields(
    definition(
      [
        { type: 'HEADER', format: 'DOCUMENT' },
        { type: 'BODY', text: 'Corpo' },
        {
          type: 'CAROUSEL',
          cards: [
            {
              header: { format: 'IMAGE' },
              body: { text: 'Cartão' },
            },
          ],
        },
      ],
      { category: 'MARKETING' },
    ),
  )

  assert.deepEqual(ids(fields), ['header.media', 'cards.0.media'])
  for (const field of fields) {
    assert.equal(field.required, true, field.id)
    assert.equal(field.defaultValue, '')
  }
  assert.equal(byId(fields, 'header.media').mediaFormat, 'DOCUMENT')
  assert.equal(byId(fields, 'cards.0.media').cardIndex, 0)
})

test('catalog and flow buttons are optional', () => {
  const fields = getTemplateParameterFields(
    definition([
      { type: 'BODY', text: 'Corpo' },
      {
        type: 'BUTTONS',
        buttons: [
          {
            kind: 'CATALOG',
            text: 'Ver catálogo',
            thumbnailProductRetailerId: 'sku-1',
          },
          { kind: 'FLOW', text: 'Agendar', flowId: '123' },
        ],
      },
    ]),
  )

  assert.deepEqual(
    fields.map(field => [field.id, field.kind, field.required]),
    [
      ['buttons.0', 'PRODUCT', false],
      ['buttons.1', 'FLOW', false],
    ],
  )
  assert.deepEqual(buildSendParameters(fields, {}), {
    success: true,
    data: {},
  })

  assert.deepEqual(buildSendParameters(fields, { 'buttons.1': 'flow-token' }), {
    success: true,
    data: { buttons: [[], ['flow-token']] },
  })
})

test('location headers and limited time offers carry no send fields', () => {
  const fields = getTemplateParameterFields(
    definition(
      [
        { type: 'HEADER', format: 'LOCATION' },
        { type: 'LIMITED_TIME_OFFER', text: 'Oferta', hasExpiration: true },
        { type: 'BODY', text: 'Corpo' },
        { type: 'CUSTOM', raw: { type: 'ORDER_DETAILS' } },
      ],
      { category: 'MARKETING' },
    ),
  )

  assert.deepEqual(fields, [])
})

test('builds positional parameters keeping the button index aligned', () => {
  const fields = getTemplateParameterFields(
    definition(
      [
        { type: 'HEADER', format: 'IMAGE', example: 'https://cdn/capa.jpg' },
        { type: 'BODY', text: 'Olá {{1}}, pedido {{2}}', examples: ['Ana', '1'] },
        {
          type: 'BUTTONS',
          buttons: [
            { kind: 'QUICK_REPLY', text: 'Parar' },
            {
              kind: 'URL',
              text: 'Abrir',
              url: 'https://example.com/{{1}}',
              examples: ['pedido-1'],
            },
          ],
        },
        {
          type: 'CAROUSEL',
          cards: [
            {
              header: { format: 'IMAGE', example: 'https://cdn/1.jpg' },
              body: { text: 'Pacote {{1}}', examples: ['Maceió'] },
            },
          ],
        },
      ],
      { category: 'MARKETING' },
    ),
  )

  const result = buildSendParameters(fields, {
    'header.media': 'handle-capa',
    'body.1': 'Bruno',
    'body.2': '987',
    'buttons.1': 'pedido-9',
    'cards.0.media': 'handle-1',
    'cards.0.body.1': 'Recife',
  })

  assert.deepEqual(result, {
    success: true,
    data: {
      header: ['handle-capa'],
      body: ['Bruno', '987'],
      buttons: [[], ['pedido-9']],
      cards: [['handle-1', 'Recife']],
    },
  })
})

test('builds named parameters as records', () => {
  const fields = getTemplateParameterFields(
    definition(
      [
        {
          type: 'HEADER',
          format: 'TEXT',
          text: 'Pedido {{pedido}}',
          examples: ['1'],
        },
        { type: 'BODY', text: 'Olá {{nome}}', examples: ['Ana'] },
      ],
      { parameterFormat: 'NAMED' },
    ),
  )

  assert.deepEqual(
    buildSendParameters(fields, {
      'header.pedido': '987',
      'body.nome': 'Bruno',
    }),
    {
      success: true,
      data: { header: { pedido: '987' }, body: { nome: 'Bruno' } },
    },
  )
})

test('reports every missing required value by field id', () => {
  const fields = getTemplateParameterFields(
    definition([
      { type: 'HEADER', format: 'IMAGE', example: 'https://cdn/capa.jpg' },
      { type: 'BODY', text: 'Olá {{1}}, pedido {{2}}', examples: ['Ana', '1'] },
    ]),
  )

  assert.deepEqual(buildSendParameters(fields, { 'body.1': '  ' }), {
    success: false,
    errors: {
      'header.media': 'Campo obrigatório.',
      'body.1': 'Campo obrigatório.',
      'body.2': 'Campo obrigatório.',
    },
  })
})
