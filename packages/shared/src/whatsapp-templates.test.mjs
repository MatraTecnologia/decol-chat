import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TEMPLATE_MANAGERS,
  TEMPLATE_READERS,
  canManageTemplates,
  canReadTemplates,
  templateCategorySchema,
  templateDefinitionSchema,
  templateParameterFormatSchema,
  templateSendParametersSchema,
} from './whatsapp-templates.ts'

const definition = (components, overrides = {}) => ({
  category: 'UTILITY',
  language: 'pt_BR',
  parameterFormat: 'POSITIONAL',
  components,
  ...overrides,
})

test('role arrays expose readers and managers', () => {
  assert.deepEqual(TEMPLATE_READERS, ['admin', 'manager', 'agent', 'viewer'])
  assert.deepEqual(TEMPLATE_MANAGERS, ['admin', 'manager'])
})

test('only admin and manager may mutate templates', () => {
  const cases = [
    ['admin', true],
    ['manager', true],
    ['agent', false],
    ['viewer', false],
    ['user', false],
  ]

  for (const [role, expected] of cases) {
    assert.equal(canManageTemplates(role), expected, role)
  }
})

test('every staff role may read templates except the legacy user role', () => {
  const cases = [
    ['admin', true],
    ['manager', true],
    ['agent', true],
    ['viewer', true],
    ['user', false],
  ]

  for (const [role, expected] of cases) {
    assert.equal(canReadTemplates(role), expected, role)
  }
})

test('category and parameter format schemas accept only Meta values', () => {
  for (const category of ['MARKETING', 'UTILITY', 'AUTHENTICATION']) {
    assert.equal(templateCategorySchema.safeParse(category).success, true)
  }
  assert.equal(templateCategorySchema.safeParse('OTHER').success, false)

  for (const format of ['POSITIONAL', 'NAMED']) {
    assert.equal(templateParameterFormatSchema.safeParse(format).success, true)
  }
  assert.equal(templateParameterFormatSchema.safeParse('INDEXED').success, false)
})

test('accepts a minimal positional definition', () => {
  assert.equal(
    templateDefinitionSchema.safeParse({
      category: 'UTILITY',
      language: 'pt_BR',
      parameterFormat: 'POSITIONAL',
      components: [{ type: 'BODY', text: 'Olá {{1}}', examples: ['Maria'] }],
    }).success,
    true,
  )
})

test('accepts named parameters', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition(
        [{ type: 'BODY', text: 'Olá {{nome}}', examples: ['Maria'] }],
        { parameterFormat: 'NAMED' },
      ),
    ).success,
    true,
  )
})

test('requires one example per variable', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition([{ type: 'BODY', text: 'Olá {{1}}' }]),
    ).success,
    false,
  )

  assert.equal(
    templateDefinitionSchema.safeParse(
      definition([
        { type: 'BODY', text: 'Olá {{1}}, pedido {{2}}', examples: ['Maria'] },
      ]),
    ).success,
    false,
  )

  assert.equal(
    templateDefinitionSchema.safeParse(
      definition([{ type: 'BODY', text: 'Pedido confirmado' }]),
    ).success,
    true,
  )
})

test('accepts every header format', () => {
  const headers = [
    { type: 'HEADER', format: 'TEXT', text: 'Pedido {{1}}', examples: ['123'] },
    { type: 'HEADER', format: 'IMAGE', assetId: 'asset-1' },
    { type: 'HEADER', format: 'VIDEO', assetId: 'asset-2' },
    { type: 'HEADER', format: 'DOCUMENT', assetId: 'asset-3' },
    { type: 'HEADER', format: 'LOCATION' },
  ]

  for (const header of headers) {
    const result = templateDefinitionSchema.safeParse(
      definition([header, { type: 'BODY', text: 'Corpo' }]),
    )
    assert.equal(result.success, true, header.format)
  }
})

test('accepts footer, quick reply, url, phone and copy code buttons', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition(
        [
          { type: 'BODY', text: 'Olá {{1}}', examples: ['Ana'] },
          { type: 'FOOTER', text: 'Equipe Decol' },
          {
            type: 'BUTTONS',
            buttons: [
              { kind: 'QUICK_REPLY', text: 'Parar promoções' },
              {
                kind: 'URL',
                text: 'Abrir',
                url: 'https://example.com/{{1}}',
                examples: ['pedido-1'],
              },
              { kind: 'PHONE_NUMBER', text: 'Ligar', phoneNumber: '+5543999140409' },
              { kind: 'COPY_CODE', text: 'Copiar', example: 'DECOL10' },
            ],
          },
        ],
        { category: 'MARKETING' },
      ),
    ).success,
    true,
  )
})

test('rejects a url button without an example for its variable', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition([
        { type: 'BODY', text: 'Corpo' },
        {
          type: 'BUTTONS',
          buttons: [
            { kind: 'URL', text: 'Abrir', url: 'https://example.com/{{1}}' },
          ],
        },
      ]),
    ).success,
    false,
  )
})

test('accepts an authentication template with an OTP button', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition(
        [
          { type: 'BODY', text: 'Seu código é {{1}}', examples: ['123456'] },
          {
            type: 'BUTTONS',
            buttons: [
              {
                kind: 'OTP',
                otpType: 'ONE_TAP',
                text: 'Copiar código',
                autofillText: 'Preencher',
                packageName: 'com.decol.chat',
                signatureHash: 'K0k4tT2sQ1p',
              },
            ],
          },
        ],
        { category: 'AUTHENTICATION' },
      ),
    ).success,
    true,
  )
})

test('rejects an unknown OTP type', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition(
        [
          { type: 'BODY', text: 'Código' },
          {
            type: 'BUTTONS',
            buttons: [{ kind: 'OTP', otpType: 'MAGIC_LINK', text: 'Copiar' }],
          },
        ],
        { category: 'AUTHENTICATION' },
      ),
    ).success,
    false,
  )
})

test('accepts flow and catalog buttons', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition([
        { type: 'BODY', text: 'Agende seu atendimento' },
        {
          type: 'BUTTONS',
          buttons: [
            {
              kind: 'FLOW',
              text: 'Agendar',
              flowId: '1234567890',
              flowAction: 'navigate',
              navigateScreen: 'WELCOME',
              flowData: { origin: 'catalog' },
            },
            { kind: 'CATALOG', text: 'Ver catálogo' },
          ],
        },
      ]),
    ).success,
    true,
  )
})

test('accepts a carousel with card media, body and buttons', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition(
        [
          { type: 'BODY', text: 'Ofertas da semana' },
          {
            type: 'CAROUSEL',
            cards: [
              {
                header: { format: 'IMAGE', assetId: 'asset-1' },
                body: { text: 'Pacote {{1}}', examples: ['Maceió'] },
                buttons: [{ kind: 'QUICK_REPLY', text: 'Quero' }],
              },
              {
                header: { format: 'VIDEO', assetId: 'asset-2' },
                body: { text: 'Pacote fechado' },
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
        ],
        { category: 'MARKETING' },
      ),
    ).success,
    true,
  )
})

test('accepts a limited time offer component', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition(
        [
          {
            type: 'LIMITED_TIME_OFFER',
            text: 'Oferta relâmpago',
            hasExpiration: true,
          },
          { type: 'BODY', text: 'Aproveite' },
        ],
        { category: 'MARKETING' },
      ),
    ).success,
    true,
  )
})

test('accepts an advanced component preserving unknown Graph fields', () => {
  const result = templateDefinitionSchema.safeParse(
    definition([
      { type: 'BODY', text: 'Corpo' },
      {
        type: 'CUSTOM',
        raw: {
          type: 'ORDER_DETAILS',
          order: { items: [{ retailer_id: 'sku-1', amount: { value: 1200 } }] },
        },
      },
    ]),
  )

  assert.equal(result.success, true)
  assert.deepEqual(result.data.components[1].raw.order.items[0], {
    retailer_id: 'sku-1',
    amount: { value: 1200 },
  })
})

test('rejects every protected key in an advanced component', () => {
  const protectedKeys = [
    'accessToken',
    'whatsAppAccountId',
    'createdById',
    'updatedById',
    'remoteStatus',
    'remotePayload',
  ]

  for (const key of protectedKeys) {
    assert.equal(
      templateDefinitionSchema.safeParse(
        definition([
          { type: 'BODY', text: 'Corpo' },
          { type: 'CUSTOM', raw: { [key]: 'valor' } },
        ]),
      ).success,
      false,
      key,
    )
  }
})

test('rejects protected keys nested inside arrays at any depth', () => {
  assert.equal(
    templateDefinitionSchema.safeParse(
      definition([
        { type: 'BODY', text: 'Corpo' },
        {
          type: 'CUSTOM',
          raw: { cards: [{ nested: [{ accessToken: 'secreto' }] }] },
        },
      ]),
    ).success,
    false,
  )
})

test('rejects definitions without components', () => {
  assert.equal(templateDefinitionSchema.safeParse(definition([])).success, false)
})

test('send parameters accept positional lists and named records', () => {
  assert.equal(
    templateSendParametersSchema.safeParse({
      body: ['Ana', '123'],
      header: ['asset-1'],
      buttons: [['pedido-1']],
    }).success,
    true,
  )

  assert.equal(
    templateSendParametersSchema.safeParse({
      body: { nome: 'Ana', pedido: '123' },
    }).success,
    true,
  )

  assert.equal(
    templateSendParametersSchema.safeParse({ body: { nome: 10 } }).success,
    false,
  )
})
