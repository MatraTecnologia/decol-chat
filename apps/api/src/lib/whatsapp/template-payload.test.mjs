import assert from 'node:assert/strict'
import test from 'node:test'

// A fachada `template-payload.ts` reexporta valor e por isso não é carregável
// aqui — o teste importa os módulos concretos.
import {
  extractVariables,
  toMetaTemplatePayload,
} from './template-create-payload.ts'
import { fromMetaTemplatePayload } from './template-remote-payload.ts'
import {
  TemplateParametersError,
  toMetaMessageComponents,
} from './template-send-payload.ts'

const definition = (components, overrides = {}) => ({
  category: 'UTILITY',
  language: 'pt_BR',
  parameterFormat: 'POSITIONAL',
  components,
  ...overrides,
})

const remote = (components, overrides = {}) => ({
  language: 'pt_BR',
  category: 'UTILITY',
  parameter_format: 'POSITIONAL',
  components,
  ...overrides,
})

// ── Variáveis ──────────────────────────────────────────

test('extracts variables in first occurrence order without repeating', () => {
  assert.deepEqual(extractVariables('Olá {{1}}, pedido {{2}}'), ['1', '2'])
  assert.deepEqual(extractVariables('Olá {{nome}}, tudo bem {{nome}}?'), [
    'nome',
  ])
  assert.deepEqual(extractVariables('Sem variáveis'), [])
})

// ── toMetaTemplatePayload ──────────────────────────────

test('maps identity fields to the Graph payload', () => {
  const payload = toMetaTemplatePayload(
    definition([{ type: 'BODY', text: 'Corpo' }], {
      category: 'MARKETING',
      parameterFormat: 'NAMED',
    }),
  )

  assert.equal(payload.language, 'pt_BR')
  assert.equal(payload.category, 'MARKETING')
  assert.equal(payload.parameter_format, 'NAMED')
})

test('maps positional body examples to body_text', () => {
  const payload = toMetaTemplatePayload(
    definition([
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
        ],
      },
    ]),
  )

  assert.deepEqual(payload.components[0].example.body_text, [['Ana']])
  assert.deepEqual(payload.components[1].buttons[0], {
    type: 'URL',
    text: 'Abrir',
    url: 'https://example.com/{{1}}',
    example: ['pedido-1'],
  })
})

test('maps named body examples to body_text_named_params', () => {
  const payload = toMetaTemplatePayload(
    definition([{ type: 'BODY', text: 'Olá {{nome}}', examples: ['Ana'] }], {
      parameterFormat: 'NAMED',
    }),
  )

  assert.deepEqual(payload.components[0].example.body_text_named_params, [
    { param_name: 'nome', example: 'Ana' },
  ])
})

test('pairs one named param per distinct variable', () => {
  const payload = toMetaTemplatePayload(
    definition(
      [{ type: 'BODY', text: 'Oi {{nome}}, tudo bem {{nome}}?', examples: ['Ana'] }],
      { parameterFormat: 'NAMED' },
    ),
  )

  assert.deepEqual(payload.components[0].example.body_text_named_params, [
    { param_name: 'nome', example: 'Ana' },
  ])
})

test('maps text, media and location headers', () => {
  const payload = toMetaTemplatePayload(
    definition([
      { type: 'HEADER', format: 'TEXT', text: 'Pedido {{1}}', examples: ['123'] },
      { type: 'BODY', text: 'Corpo' },
    ]),
  )

  assert.deepEqual(payload.components[0].example, { header_text: ['123'] })

  const media = toMetaTemplatePayload(
    definition([
      { type: 'HEADER', format: 'IMAGE', assetId: 'asset-1', example: 'handle-1' },
      { type: 'BODY', text: 'Corpo' },
    ]),
  )

  assert.deepEqual(media.components[0], {
    type: 'HEADER',
    format: 'IMAGE',
    example: { header_handle: ['handle-1'] },
  })
  assert.equal('assetId' in media.components[0], false)

  const location = toMetaTemplatePayload(
    definition([
      { type: 'HEADER', format: 'LOCATION' },
      { type: 'BODY', text: 'Corpo' },
    ]),
  )

  assert.deepEqual(location.components[0], { type: 'HEADER', format: 'LOCATION' })
})

test('maps every button kind to snake case Graph fields', () => {
  const payload = toMetaTemplatePayload(
    definition([
      { type: 'BODY', text: 'Corpo' },
      {
        type: 'BUTTONS',
        buttons: [
          { kind: 'QUICK_REPLY', text: 'Parar' },
          { kind: 'PHONE_NUMBER', text: 'Ligar', phoneNumber: '+5543999140409' },
          { kind: 'COPY_CODE', text: 'Copiar', example: 'DECOL10' },
          {
            kind: 'OTP',
            otpType: 'ONE_TAP',
            text: 'Copiar código',
            autofillText: 'Preencher',
            packageName: 'com.decol.chat',
            signatureHash: 'K0k4tT2sQ1p',
          },
          { kind: 'CATALOG', text: 'Catálogo', thumbnailProductRetailerId: 'sku-1' },
          {
            kind: 'FLOW',
            text: 'Agendar',
            flowId: '123',
            flowAction: 'navigate',
            navigateScreen: 'WELCOME',
            flowData: { origin: 'catalog' },
          },
        ],
      },
    ]),
  )

  assert.deepEqual(payload.components[1].buttons, [
    { type: 'QUICK_REPLY', text: 'Parar' },
    { type: 'PHONE_NUMBER', text: 'Ligar', phone_number: '+5543999140409' },
    { type: 'COPY_CODE', text: 'Copiar', example: 'DECOL10' },
    {
      type: 'OTP',
      otp_type: 'ONE_TAP',
      text: 'Copiar código',
      autofill_text: 'Preencher',
      package_name: 'com.decol.chat',
      signature_hash: 'K0k4tT2sQ1p',
    },
    { type: 'CATALOG', text: 'Catálogo', thumbnail_product_retailer_id: 'sku-1' },
    {
      type: 'FLOW',
      text: 'Agendar',
      flow_id: '123',
      flow_action: 'navigate',
      navigate_screen: 'WELCOME',
      flow_action_payload: { origin: 'catalog' },
    },
  ])
})

test('maps carousel cards into nested component arrays', () => {
  const payload = toMetaTemplatePayload(
    definition([
      { type: 'BODY', text: 'Ofertas' },
      {
        type: 'CAROUSEL',
        cards: [
          {
            header: { format: 'IMAGE', example: 'handle-1' },
            body: { text: 'Pacote {{1}}', examples: ['Maceió'] },
            buttons: [{ kind: 'QUICK_REPLY', text: 'Quero' }],
          },
        ],
      },
    ]),
  )

  assert.deepEqual(payload.components[1].cards[0].components, [
    { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['handle-1'] } },
    { type: 'BODY', text: 'Pacote {{1}}', example: { body_text: [['Maceió']] } },
    { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Quero' }] },
  ])
})

test('maps a limited time offer component', () => {
  const payload = toMetaTemplatePayload(
    definition([
      { type: 'LIMITED_TIME_OFFER', text: 'Oferta', hasExpiration: true },
      { type: 'BODY', text: 'Corpo' },
    ]),
  )

  assert.deepEqual(payload.components[0], {
    type: 'LIMITED_TIME_OFFER',
    limited_time_offer: { text: 'Oferta', has_expiration: true },
  })
})

test('writes advanced raw fields straight into the payload', () => {
  const raw = {
    type: 'ORDER_DETAILS',
    order: { items: [{ retailer_id: 'sku-1', amount: { value: 1200 } }] },
  }

  const payload = toMetaTemplatePayload(
    definition([{ type: 'BODY', text: 'Corpo' }, { type: 'CUSTOM', raw }]),
  )

  assert.deepEqual(payload.components[1], raw)
})

// ── fromMetaTemplatePayload ────────────────────────────

test('reads identity fields from the remote payload', () => {
  const parsed = fromMetaTemplatePayload(
    remote([{ type: 'BODY', text: 'Corpo' }], {
      category: 'marketing',
      parameter_format: 'named',
    }),
  )

  assert.equal(parsed.category, 'MARKETING')
  assert.equal(parsed.language, 'pt_BR')
  assert.equal(parsed.parameterFormat, 'NAMED')
})

test('falls back to UTILITY for an unknown remote category', () => {
  const parsed = fromMetaTemplatePayload(
    remote([{ type: 'BODY', text: 'Corpo' }], { category: 'OTHER' }),
  )

  assert.equal(parsed.category, 'UTILITY')
})

test('reads positional and named text examples back', () => {
  const positional = fromMetaTemplatePayload(
    remote([
      { type: 'BODY', text: 'Olá {{1}}', example: { body_text: [['Ana']] } },
    ]),
  )
  assert.deepEqual(positional.components[0], {
    type: 'BODY',
    text: 'Olá {{1}}',
    examples: ['Ana'],
  })

  const named = fromMetaTemplatePayload(
    remote(
      [
        {
          type: 'BODY',
          text: 'Olá {{nome}}',
          example: {
            body_text_named_params: [{ param_name: 'nome', example: 'Ana' }],
          },
        },
      ],
      { parameter_format: 'NAMED' },
    ),
  )
  assert.deepEqual(named.components[0].examples, ['Ana'])
})

test('turns an unknown remote component into CUSTOM', () => {
  const raw = { type: 'ORDER_DETAILS', order: { items: [{ id: 'sku-1' }] } }
  const parsed = fromMetaTemplatePayload(remote([raw]))

  assert.deepEqual(parsed.components[0], { type: 'CUSTOM', raw })
})

test('round-trips an unknown remote component without losing fields', () => {
  const raw = {
    type: 'ORDER_DETAILS',
    minimum_expiration_time_ms: 600000,
    order: { items: [{ retailer_id: 'sku-1', amount: { value: 1200 } }] },
  }

  const parsed = fromMetaTemplatePayload(remote([raw]))
  const payload = toMetaTemplatePayload(parsed)

  assert.deepEqual(payload.components[0], raw)
})

test('keeps an unknown button kind as an advanced component', () => {
  const raw = {
    type: 'BUTTONS',
    buttons: [{ type: 'MPM', text: 'Ver produtos' }],
  }

  const parsed = fromMetaTemplatePayload(remote([raw]))

  assert.deepEqual(parsed.components[0], { type: 'CUSTOM', raw })
  assert.deepEqual(toMetaTemplatePayload(parsed).components[0], raw)
})

test('round-trips headers, buttons, carousel and offers', () => {
  const source = definition(
    [
      { type: 'HEADER', format: 'IMAGE', example: 'handle-1' },
      { type: 'BODY', text: 'Olá {{1}}', examples: ['Ana'] },
      { type: 'FOOTER', text: 'Equipe Decol' },
      { type: 'LIMITED_TIME_OFFER', text: 'Oferta', hasExpiration: true },
      {
        type: 'CAROUSEL',
        cards: [
          {
            header: { format: 'VIDEO', example: 'handle-2' },
            body: { text: 'Pacote {{1}}', examples: ['Maceió'] },
            buttons: [
              {
                kind: 'URL',
                text: 'Detalhes',
                url: 'https://example.com/{{1}}',
                examples: ['pacote-2'],
              },
            ],
          },
        ],
      },
      {
        type: 'BUTTONS',
        buttons: [
          { kind: 'QUICK_REPLY', text: 'Parar' },
          { kind: 'PHONE_NUMBER', text: 'Ligar', phoneNumber: '+5543999140409' },
          {
            kind: 'FLOW',
            text: 'Agendar',
            flowId: '123',
            flowAction: 'navigate',
            navigateScreen: 'WELCOME',
            flowData: { origin: 'catalog' },
          },
        ],
      },
    ],
    { category: 'MARKETING' },
  )

  const payload = toMetaTemplatePayload(source)
  const parsed = fromMetaTemplatePayload(remote(payload.components, {
    category: 'MARKETING',
  }))

  assert.deepEqual(parsed, source)
})

// ── toMetaMessageComponents ────────────────────────────

test('builds body parameters for positional values', () => {
  const components = toMetaMessageComponents(
    definition([{ type: 'BODY', text: 'Olá {{1}}, pedido {{2}}' }]),
    { body: ['Ana', '123'] },
  )

  assert.deepEqual(components, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'Ana' },
        { type: 'text', text: '123' },
      ],
    },
  ])
})

test('builds named body parameters with parameter_name', () => {
  const components = toMetaMessageComponents(
    definition([{ type: 'BODY', text: 'Olá {{nome}}' }], {
      parameterFormat: 'NAMED',
    }),
    { body: { nome: 'Ana' } },
  )

  assert.deepEqual(components[0].parameters, [
    { type: 'text', parameter_name: 'nome', text: 'Ana' },
  ])
})

test('returns no components for a static template', () => {
  assert.deepEqual(
    toMetaMessageComponents(
      definition([
        { type: 'BODY', text: 'Pedido confirmado' },
        { type: 'FOOTER', text: 'Equipe Decol' },
      ]),
      {},
    ),
    [],
  )
})

test('rejects missing and extra body parameters', () => {
  const model = definition([{ type: 'BODY', text: 'Olá {{1}}' }])

  assert.throws(
    () => toMetaMessageComponents(model, {}),
    TemplateParametersError,
  )
  assert.throws(
    () => toMetaMessageComponents(model, { body: ['Ana', 'extra'] }),
    TemplateParametersError,
  )
  assert.throws(
    () =>
      toMetaMessageComponents(definition([{ type: 'BODY', text: 'Fixo' }]), {
        body: ['Ana'],
      }),
    TemplateParametersError,
  )
})

test('rejects a named value that is not a template variable', () => {
  assert.throws(
    () =>
      toMetaMessageComponents(
        definition([{ type: 'BODY', text: 'Olá {{nome}}' }], {
          parameterFormat: 'NAMED',
        }),
        { body: { nome: 'Ana', sobrenome: 'Silva' } },
      ),
    TemplateParametersError,
  )
})

test('sends a media header as link or id', () => {
  const model = definition([
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: 'Corpo' },
  ])

  assert.deepEqual(
    toMetaMessageComponents(model, { header: ['https://cdn.example.com/a.jpg'] }),
    [
      {
        type: 'header',
        parameters: [
          { type: 'image', image: { link: 'https://cdn.example.com/a.jpg' } },
        ],
      },
    ],
  )

  assert.deepEqual(
    toMetaMessageComponents(model, { header: ['media-id-1'] })[0].parameters,
    [{ type: 'image', image: { id: 'media-id-1' } }],
  )

  assert.throws(
    () => toMetaMessageComponents(model, {}),
    TemplateParametersError,
  )
})

test('keeps the button index aligned with the template buttons', () => {
  const model = definition([
    { type: 'BODY', text: 'Corpo' },
    {
      type: 'BUTTONS',
      buttons: [
        { kind: 'QUICK_REPLY', text: 'Parar' },
        { kind: 'URL', text: 'Abrir', url: 'https://example.com/{{1}}' },
        { kind: 'COPY_CODE', text: 'Copiar' },
      ],
    },
  ])

  const components = toMetaMessageComponents(model, {
    buttons: [[], ['pedido-1'], ['DECOL10']],
  })

  assert.deepEqual(components, [
    {
      type: 'button',
      sub_type: 'url',
      index: '1',
      parameters: [{ type: 'text', text: 'pedido-1' }],
    },
    {
      type: 'button',
      sub_type: 'copy_code',
      index: '2',
      parameters: [{ type: 'coupon_code', coupon_code: 'DECOL10' }],
    },
  ])
})

test('rejects a url button without its parameter and extra button entries', () => {
  const model = definition([
    { type: 'BODY', text: 'Corpo' },
    {
      type: 'BUTTONS',
      buttons: [{ kind: 'URL', text: 'Abrir', url: 'https://example.com/{{1}}' }],
    },
  ])

  assert.throws(
    () => toMetaMessageComponents(model, {}),
    TemplateParametersError,
  )
  assert.throws(
    () => toMetaMessageComponents(model, { buttons: [['a'], ['b']] }),
    TemplateParametersError,
  )
})

test('builds a flow button action parameter', () => {
  const components = toMetaMessageComponents(
    definition([
      { type: 'BODY', text: 'Corpo' },
      {
        type: 'BUTTONS',
        buttons: [{ kind: 'FLOW', text: 'Agendar', flowId: '123' }],
      },
    ]),
    { buttons: [['flow-token-1']] },
  )

  assert.deepEqual(components[0], {
    type: 'button',
    sub_type: 'flow',
    index: '0',
    parameters: [{ type: 'action', action: { flow_token: 'flow-token-1' } }],
  })
})

test('builds one carousel card entry per definition card', () => {
  const components = toMetaMessageComponents(
    definition([
      { type: 'BODY', text: 'Ofertas' },
      {
        type: 'CAROUSEL',
        cards: [
          { header: { format: 'IMAGE' }, body: { text: 'Pacote {{1}}' } },
          { header: { format: 'IMAGE' }, body: { text: 'Pacote fechado' } },
        ],
      },
    ]),
    { cards: [['Maceió']] },
  )

  assert.deepEqual(components[0], {
    type: 'carousel',
    cards: [
      {
        card_index: 0,
        components: [
          { type: 'body', parameters: [{ type: 'text', text: 'Maceió' }] },
        ],
      },
      { card_index: 1, components: [] },
    ],
  })
})

test('rejects parameters for components the template does not have', () => {
  const model = definition([{ type: 'BODY', text: 'Corpo' }])

  assert.throws(
    () => toMetaMessageComponents(model, { header: ['x'] }),
    TemplateParametersError,
  )
  assert.throws(
    () => toMetaMessageComponents(model, { buttons: [['x']] }),
    TemplateParametersError,
  )
  assert.throws(
    () => toMetaMessageComponents(model, { cards: [['x']] }),
    TemplateParametersError,
  )
})
