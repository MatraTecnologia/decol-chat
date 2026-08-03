import assert from 'node:assert/strict'
import test from 'node:test'

// `assets.ts` fala com Prisma, R2 e Graph API — o runner não o carrega. As
// regras testáveis vivem no módulo puro que ele reexporta.
import {
  TEMPLATE_ASSET_RULES,
  buildAssetObjectKey,
  findAssetRule,
  isSafeAssetSegment,
  matchesUploadedSize,
  shouldReuseMetaHandle,
  validateTemplateAsset,
} from './asset-rules.ts'

const MEGABYTE = 1024 * 1024

const ruleFor = kind => TEMPLATE_ASSET_RULES.find(rule => rule.kind === kind)

test('accepts the MIME types Meta allows for template media', () => {
  assert.equal(validateTemplateAsset({ mimeType: 'image/jpeg', byteSize: 10 }).data.kind, 'IMAGE')
  assert.equal(validateTemplateAsset({ mimeType: 'image/png', byteSize: 10 }).data.kind, 'IMAGE')
  assert.equal(validateTemplateAsset({ mimeType: 'video/mp4', byteSize: 10 }).data.kind, 'VIDEO')
  assert.equal(validateTemplateAsset({ mimeType: 'video/3gpp', byteSize: 10 }).data.kind, 'VIDEO')
  assert.equal(
    validateTemplateAsset({ mimeType: 'application/pdf', byteSize: 10 }).data.kind,
    'DOCUMENT',
  )
})

test('the MIME type match ignores casing', () => {
  assert.equal(findAssetRule('IMAGE/PNG').kind, 'IMAGE')
  assert.equal(findAssetRule('image/webp'), null)
})

test('rejects a MIME type outside the table', () => {
  const result = validateTemplateAsset({ mimeType: 'image/webp', byteSize: 10 })

  assert.equal(result.ok, false)
  assert.match(result.message, /não é aceito/)
})

test('the byte limit is exact for every kind', () => {
  for (const rule of TEMPLATE_ASSET_RULES) {
    const mimeType = rule.mimeTypes[0]

    assert.equal(
      validateTemplateAsset({ mimeType, byteSize: rule.maxBytes }).ok,
      true,
      rule.kind,
    )
    assert.equal(
      validateTemplateAsset({ mimeType, byteSize: rule.maxBytes + 1 }).ok,
      false,
      rule.kind,
    )
  }
})

test('the configured limits are 5, 16 and 100 MB', () => {
  assert.equal(ruleFor('IMAGE').maxBytes, 5 * MEGABYTE)
  assert.equal(ruleFor('VIDEO').maxBytes, 16 * MEGABYTE)
  assert.equal(ruleFor('DOCUMENT').maxBytes, 100 * MEGABYTE)
})

test('rejects an empty or fractional byte size', () => {
  assert.equal(validateTemplateAsset({ mimeType: 'image/png', byteSize: 0 }).ok, false)
  assert.equal(validateTemplateAsset({ mimeType: 'image/png', byteSize: -1 }).ok, false)
  assert.equal(validateTemplateAsset({ mimeType: 'image/png', byteSize: 1.5 }).ok, false)
})

test('the object key carries only server generated ids', () => {
  assert.equal(
    buildAssetObjectKey({
      accountId: 'acc1',
      revisionId: 'rev1',
      assetId: 'ast1',
    }),
    'whatsapp-templates/acc1/rev1/ast1',
  )
})

test('an unsafe segment never becomes a path', () => {
  assert.equal(isSafeAssetSegment('../etc'), false)
  assert.equal(isSafeAssetSegment('a/b'), false)
  assert.equal(isSafeAssetSegment(''), false)
  assert.equal(isSafeAssetSegment('foto bonita.png'), false)

  assert.equal(
    buildAssetObjectKey({ accountId: '../x', revisionId: 'rev1', assetId: 'ast1' }),
    null,
  )
  assert.equal(
    buildAssetObjectKey({ accountId: 'acc1', revisionId: 'rev/1', assetId: 'ast1' }),
    null,
  )
  assert.equal(
    buildAssetObjectKey({ accountId: 'acc1', revisionId: 'rev1', assetId: '' }),
    null,
  )
})

test('a missing object in the bucket fails the confirmation', () => {
  assert.equal(matchesUploadedSize(1024, null).ok, false)
  assert.equal(matchesUploadedSize(1024, 0).ok, false)
  assert.equal(matchesUploadedSize(1024, undefined).ok, false)
  assert.match(matchesUploadedSize(1024, null).message, /não chegou/)
})

test('a size mismatch fails the confirmation', () => {
  const result = matchesUploadedSize(1024, 2048)

  assert.equal(result.ok, false)
  assert.match(result.message, /2048 bytes/)
  assert.equal(matchesUploadedSize(1024, 1024).ok, true)
  assert.equal(matchesUploadedSize(1024, 1024).data.byteSize, 1024)
})

test('the Meta handle is reused until the asset changes', () => {
  assert.equal(shouldReuseMetaHandle({ metaHandle: '4:handle' }), true)
  assert.equal(shouldReuseMetaHandle({ metaHandle: null }), false)
  assert.equal(shouldReuseMetaHandle({ metaHandle: '' }), false)
  assert.equal(shouldReuseMetaHandle({}), false)
})
