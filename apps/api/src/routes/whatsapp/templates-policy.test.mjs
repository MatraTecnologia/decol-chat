import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TEMPLATE_MANAGE_ROLES,
  TEMPLATE_READ_ROLES,
  getTemplateRouteCapabilities,
} from './templates-policy.ts'

const matrix = [
  ['admin', { read: true, manage: true }],
  ['manager', { read: true, manage: true }],
  ['agent', { read: true, manage: false }],
  ['viewer', { read: true, manage: false }],
  ['user', { read: false, manage: false }],
]

test('the role matrix covers every role', () => {
  for (const [role, expected] of matrix) {
    assert.deepEqual(getTemplateRouteCapabilities(role), expected, role)
  }
})

test('the legacy user role has no access to templates', () => {
  assert.deepEqual(getTemplateRouteCapabilities('user'), {
    read: false,
    manage: false,
  })
  assert.equal(TEMPLATE_READ_ROLES.includes('user'), false)
  assert.equal(TEMPLATE_MANAGE_ROLES.includes('user'), false)
})

test('an unknown role gets no access', () => {
  assert.deepEqual(getTemplateRouteCapabilities('robot'), {
    read: false,
    manage: false,
  })
})

test('reading is open to the whole team', () => {
  assert.deepEqual(TEMPLATE_READ_ROLES, ['admin', 'manager', 'agent', 'viewer'])
})

test('only admin and manager may mutate templates', () => {
  assert.deepEqual(TEMPLATE_MANAGE_ROLES, ['admin', 'manager'])
})

test('every manager role is also a reader', () => {
  for (const role of TEMPLATE_MANAGE_ROLES) {
    assert.equal(TEMPLATE_READ_ROLES.includes(role), true, role)
  }
})
