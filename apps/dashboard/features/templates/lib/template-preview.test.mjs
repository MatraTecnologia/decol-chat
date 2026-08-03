import assert from 'node:assert/strict'
import test from 'node:test'

import {
  renderTemplatePreview,
  renderTemplateText,
} from './template-preview.ts'

const definition = (components, overrides = {}) => ({
  category: 'UTILITY',
  language: 'pt_BR',
  parameterFormat: 'POSITIONAL',
  components,
  ...overrides,
})

test('substitutes positional variables by index, not by appearance', () => {
  assert.equal(
    renderTemplateText('Olá {{1}}, pedido {{2}}', ['Ana', '123']),
    'Olá Ana, pedido 123',
  )

  assert.equal(
    renderTemplateText('Pedido {{2}} de {{1}}', ['Ana', '123']),
    'Pedido 123 de Ana',
  )
})

test('substitutes named variables from a record and from an ordered list', () => {
  assert.equal(
    renderTemplateText('Olá {{nome}}, pedido {{pedido}}', {
      nome: 'Ana',
      pedido: '123',
    }),
    'Olá Ana, pedido 123',
  )

  assert.equal(
    renderTemplateText('Olá {{nome}}, pedido {{pedido}}', ['Ana', '123']),
    'Olá Ana, pedido 123',
  )
})

test('tolerates padded placeholders like the shared validator', () => {
  assert.equal(renderTemplateText('Olá {{ 1 }}', ['Ana']), 'Olá Ana')
})

test('keeps the placeholder when an example is missing', () => {
  assert.equal(
    renderTemplateText('Olá {{1}}, pedido {{2}}', ['Ana']),
    'Olá Ana, pedido {{2}}',
  )
  assert.equal(renderTemplateText('Olá {{1}}'), 'Olá {{1}}')
  assert.equal(renderTemplateText('Olá {{nome}}', {}), 'Olá {{nome}}')
})

test('treats dollar signs in examples as literal text', () => {
  assert.equal(
    renderTemplateText('Total {{1}} e {{2}}', ['R$ 50', '$&']),
    'Total R$ 50 e $&',
  )
})

test('preserves line breaks', () => {
  assert.equal(
    renderTemplateText('Olá {{1}},\n\nSeu pedido {{2}}.\nObrigado!', [
      'Ana',
      '123',
    ]),
    'Olá Ana,\n\nSeu pedido 123.\nObrigado!',
  )
})

test('builds a preview with header, body, footer and buttons', () => {
  const preview = renderTemplatePreview(
    definition([
      { type: 'HEADER', format: 'TEXT', text: 'Pedido {{1}}', examples: ['123'] },
      { type: 'BODY', text: 'Olá {{1}}', examples: ['Ana'] },
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
          { kind: 'PHONE_NUMBER', text: 'Ligar', phoneNumber: '+554399140409' },
          { kind: 'COPY_CODE', text: 'Copiar', example: 'DECOL10' },
        ],
      },
    ]),
  )

  assert.deepEqual(preview.header, { format: 'TEXT', text: 'Pedido 123' })
  assert.equal(preview.body, 'Olá Ana')
  assert.equal(preview.footer, 'Equipe Decol')
  assert.deepEqual(preview.buttons, [
    { kind: 'QUICK_REPLY', text: 'Parar', detail: null },
    { kind: 'URL', text: 'Abrir', detail: 'https://example.com/pedido-1' },
    { kind: 'PHONE_NUMBER', text: 'Ligar', detail: '+554399140409' },
    { kind: 'COPY_CODE', text: 'Copiar', detail: 'DECOL10' },
  ])
  assert.deepEqual(preview.cards, [])
})

test('keys the preview by component type, not by array position', () => {
  const preview = renderTemplatePreview(
    definition(
      [
        { type: 'FOOTER', text: 'Rodapé' },
        {
          type: 'LIMITED_TIME_OFFER',
          text: 'Oferta relâmpago',
          hasExpiration: true,
        },
        { type: 'BODY', text: 'Corpo' },
        { type: 'HEADER', format: 'IMAGE', example: 'https://cdn/foto.jpg' },
      ],
      { category: 'MARKETING' },
    ),
  )

  assert.deepEqual(preview.header, {
    format: 'IMAGE',
    media: 'https://cdn/foto.jpg',
  })
  assert.equal(preview.body, 'Corpo')
  assert.equal(preview.footer, 'Rodapé')
  assert.deepEqual(preview.offer, {
    text: 'Oferta relâmpago',
    hasExpiration: true,
  })
})

test('send values override the definition examples', () => {
  const preview = renderTemplatePreview(
    definition([
      { type: 'HEADER', format: 'IMAGE', example: 'https://cdn/exemplo.jpg' },
      { type: 'BODY', text: 'Olá {{1}}', examples: ['Ana'] },
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
    ]),
    {
      header: ['https://cdn/real.jpg'],
      body: ['Bruno'],
      buttons: [[], ['pedido-9']],
    },
  )

  assert.deepEqual(preview.header, {
    format: 'IMAGE',
    media: 'https://cdn/real.jpg',
  })
  assert.equal(preview.body, 'Olá Bruno')
  assert.equal(preview.buttons[1].detail, 'https://example.com/pedido-9')
})

test('renders carousel cards with media, body and buttons', () => {
  const preview = renderTemplatePreview(
    definition(
      [
        { type: 'BODY', text: 'Ofertas' },
        {
          type: 'CAROUSEL',
          cards: [
            {
              header: { format: 'IMAGE', example: 'https://cdn/1.jpg' },
              body: { text: 'Pacote {{1}}', examples: ['Maceió'] },
              buttons: [{ kind: 'QUICK_REPLY', text: 'Quero' }],
            },
            {
              header: { format: 'VIDEO', example: 'https://cdn/2.mp4' },
              body: { text: 'Pacote fechado' },
            },
          ],
        },
      ],
      { category: 'MARKETING' },
    ),
    { cards: [['https://cdn/real.jpg', 'Recife']] },
  )

  assert.deepEqual(preview.cards, [
    {
      format: 'IMAGE',
      media: 'https://cdn/real.jpg',
      body: 'Pacote Recife',
      buttons: [{ kind: 'QUICK_REPLY', text: 'Quero', detail: null }],
    },
    {
      format: 'VIDEO',
      media: 'https://cdn/2.mp4',
      body: 'Pacote fechado',
      buttons: [],
    },
  ])
})

test('unknown advanced components never break the preview', () => {
  const preview = renderTemplatePreview(
    definition([
      { type: 'BODY', text: 'Corpo' },
      { type: 'CUSTOM', raw: { type: 'ORDER_DETAILS', order: { items: [] } } },
      { type: 'CUSTOM', raw: { sem: 'tipo' } },
    ]),
  )

  assert.equal(preview.body, 'Corpo')
  assert.deepEqual(preview.advanced, [{ label: 'ORDER_DETAILS' }, { label: 'CUSTOM' }])
})

test('location header carries neither text nor media', () => {
  const preview = renderTemplatePreview(
    definition([
      { type: 'HEADER', format: 'LOCATION' },
      { type: 'BODY', text: 'Corpo' },
    ]),
  )

  assert.deepEqual(preview.header, { format: 'LOCATION' })
})
