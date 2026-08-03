import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTemplatePreview,
  buildTemplateSnapshot,
  createApprovedTemplateResolver,
} from './template-send-policy.ts'

const definition = {
  category: 'MARKETING',
  language: 'pt_BR',
  parameterFormat: 'POSITIONAL',
  components: [
    { type: 'HEADER', format: 'TEXT', text: 'Olá {{1}}' },
    { type: 'BODY', text: 'Seu pedido {{1}} chega em {{2}} dias.' },
  ],
}

const approved = {
  templateId: 'tpl-1',
  revisionId: 'rev-1',
  name: 'order_update',
  languageCode: 'pt_BR',
  definition,
  components: [
    { type: 'body', parameters: [{ type: 'text', text: '1234' }] },
  ],
}

const lookupOk = () => Promise.resolve({ status: 'ok', data: approved })

test('substitui parâmetros posicionais na ordem de aparição', () => {
  assert.equal(
    buildTemplatePreview('order_update', definition, {
      body: ['1234', '3'],
    }),
    'Seu pedido 1234 chega em 3 dias.',
  )
})

test('substitui parâmetros nomeados pela chave', () => {
  const named = {
    components: [
      { type: 'BODY', text: 'Oi {{nome}}, seu código é {{codigo}}.' },
    ],
  }

  assert.equal(
    buildTemplatePreview('otp', named, {
      body: { codigo: '9090', nome: 'Ryan' },
    }),
    'Oi Ryan, seu código é 9090.',
  )
})

test('mantém a variável quando o valor não foi informado', () => {
  assert.equal(
    buildTemplatePreview('order_update', definition, { body: ['1234'] }),
    'Seu pedido 1234 chega em {{2}} dias.',
  )
})

test('normaliza espaços e corta preview longo', () => {
  const long = {
    components: [{ type: 'BODY', text: `Aviso\n  {{1}}` }],
  }

  const preview = buildTemplatePreview('aviso', long, {
    body: ['x'.repeat(400)],
  })

  assert.equal(preview.length, 280)
  assert.ok(preview.startsWith('Aviso x'))
  assert.ok(preview.endsWith('…'))
})

test('cai no nome do modelo quando o corpo é estático ou ausente', () => {
  const staticBody = { components: [{ type: 'BODY', text: 'Obrigado!' }] }
  const headerOnly = {
    components: [{ type: 'HEADER', format: 'IMAGE', assetId: 'a1' }],
  }

  assert.equal(buildTemplatePreview('thanks', staticBody), 'Obrigado!')
  assert.equal(buildTemplatePreview('promo', headerOnly), 'Modelo: promo')
})

test('snapshot guarda identificação, componentes e só os parâmetros do contrato', () => {
  const snapshot = buildTemplateSnapshot(approved, {
    body: ['1234', '3'],
    accessToken: 'segredo',
  })

  assert.deepEqual(snapshot, {
    template: {
      id: 'tpl-1',
      revisionId: 'rev-1',
      name: 'order_update',
      language: 'pt_BR',
      parameters: { body: ['1234', '3'] },
      components: approved.components,
    },
  })
})

test('resolve o modelo aprovado com preview e snapshot prontos', async () => {
  const calls = []
  const resolve = createApprovedTemplateResolver((...args) => {
    calls.push(args)

    return lookupOk()
  })

  const result = await resolve('acc-1', 'tpl-1', { body: ['1234', '3'] })

  assert.deepEqual(calls, [['acc-1', 'tpl-1', { body: ['1234', '3'] }]])
  assert.equal(result.status, 'ok')
  assert.equal(result.data.preview, 'Seu pedido 1234 chega em 3 dias.')
  assert.equal(result.data.templateId, 'tpl-1')
  assert.equal(result.data.revisionId, 'rev-1')
  assert.equal(result.data.languageCode, 'pt_BR')
  assert.deepEqual(result.data.components, approved.components)
  assert.deepEqual(result.data.snapshot.template.parameters, {
    body: ['1234', '3'],
  })
})

test('repassa modelo inexistente ou de outra conta sem montar envio', async () => {
  const resolve = createApprovedTemplateResolver(() =>
    Promise.resolve({ status: 'not_found' }),
  )

  assert.deepEqual(await resolve('acc-2', 'tpl-1'), { status: 'not_found' })
})

test('repassa modelo não aprovado e parâmetros incompletos', async () => {
  const notApproved = createApprovedTemplateResolver(() =>
    Promise.resolve({
      status: 'invalid',
      message: 'O modelo ainda não foi aprovado pela Meta.',
    }),
  )

  const missingParameters = createApprovedTemplateResolver(() =>
    Promise.resolve({
      status: 'invalid',
      message: 'O corpo exige 2 parâmetro(s), recebeu 1.',
    }),
  )

  assert.deepEqual(await notApproved('acc-1', 'tpl-1'), {
    status: 'invalid',
    message: 'O modelo ainda não foi aprovado pela Meta.',
  })

  assert.deepEqual(await missingParameters('acc-1', 'tpl-1', { body: ['1'] }), {
    status: 'invalid',
    message: 'O corpo exige 2 parâmetro(s), recebeu 1.',
  })
})
