import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assigneeMatches,
  canAssignConversation,
  canChangePriority,
  canChangeStatus,
  isEligibleAssignee,
} from './action-policy.ts'

test('allows only admins and managers to assign conversations', () => {
  assert.equal(canAssignConversation('admin'), true)
  assert.equal(canAssignConversation('manager'), true)
  assert.equal(canAssignConversation('agent'), false)
  assert.equal(canAssignConversation('viewer'), false)
})

test('allows only admins and managers to change priority', () => {
  assert.equal(canChangePriority('admin'), true)
  assert.equal(canChangePriority('manager'), true)
  assert.equal(canChangePriority('agent'), false)
  assert.equal(canChangePriority('viewer'), false)
})

test('allows agents but not viewers to change conversation status', () => {
  assert.equal(canChangeStatus('admin'), true)
  assert.equal(canChangeStatus('manager'), true)
  assert.equal(canChangeStatus('agent'), true)
  assert.equal(canChangeStatus('viewer'), false)
})

test('accepts only active agents as assignment targets', () => {
  assert.equal(isEligibleAssignee({ role: 'agent', banned: false }), true)
  assert.equal(isEligibleAssignee({ role: 'agent', banned: null }), true)
  assert.equal(isEligibleAssignee({ role: 'agent', banned: true }), false)
  assert.equal(isEligibleAssignee({ role: 'manager', banned: false }), false)
})

test('matches nullable assignee ids exactly for concurrency control', () => {
  assert.equal(assigneeMatches(null, null), true)
  assert.equal(assigneeMatches('agent-1', 'agent-1'), true)
  assert.equal(assigneeMatches(null, 'agent-1'), false)
  assert.equal(assigneeMatches('agent-1', null), false)
  assert.equal(assigneeMatches('agent-1', 'agent-2'), false)
})
