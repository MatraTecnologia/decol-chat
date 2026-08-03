import assert from 'node:assert/strict'
import test from 'node:test'

import { getTemplateCapabilities } from './template-capabilities.ts'

test('admin and manager read, manage and send templates', () => {
  for (const role of ['admin', 'manager']) {
    assert.deepEqual(
      getTemplateCapabilities(role),
      { canRead: true, canManage: true, canSend: true },
      role,
    )
  }
})

test('agent reads and sends but does not manage', () => {
  assert.deepEqual(getTemplateCapabilities('agent'), {
    canRead: true,
    canManage: false,
    canSend: true,
  })
})

test('viewer only reads', () => {
  assert.deepEqual(getTemplateCapabilities('viewer'), {
    canRead: true,
    canManage: false,
    canSend: false,
  })
})

test('legacy user role and null session receive nothing', () => {
  const none = { canRead: false, canManage: false, canSend: false }

  assert.deepEqual(getTemplateCapabilities('user'), none)
  assert.deepEqual(getTemplateCapabilities(null), none)
})

test('unknown roles receive nothing', () => {
  assert.deepEqual(getTemplateCapabilities('owner'), {
    canRead: false,
    canManage: false,
    canSend: false,
  })
})
