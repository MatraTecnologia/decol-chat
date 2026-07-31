import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assigneeMatches,
  canAssignConversation,
  canChangePriority,
  canChangeStatus,
  canMarkConversationRead,
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

test('allows agents but not viewers to mark conversations as read', () => {
  assert.equal(canMarkConversationRead('admin'), true)
  assert.equal(canMarkConversationRead('manager'), true)
  assert.equal(canMarkConversationRead('agent'), true)
  assert.equal(canMarkConversationRead('viewer'), false)
})

test('accepts only active agents as assignment targets', () => {
  assert.equal(
    isEligibleAssignee({ id: 'agent-1', role: 'agent', banned: false }, 'manager-1'),
    true,
  )
  assert.equal(
    isEligibleAssignee({ id: 'agent-1', role: 'agent', banned: null }, 'manager-1'),
    true,
  )
  assert.equal(
    isEligibleAssignee({ id: 'agent-1', role: 'agent', banned: true }, 'manager-1'),
    false,
  )
  assert.equal(
    isEligibleAssignee({ id: 'manager-2', role: 'manager', banned: false }, 'manager-1'),
    false,
  )
})

test('allows an admin or manager to assume a conversation personally', () => {
  assert.equal(
    isEligibleAssignee({ id: 'manager-1', role: 'manager', banned: false }, 'manager-1'),
    true,
  )
  assert.equal(
    isEligibleAssignee({ id: 'admin-1', role: 'admin', banned: null }, 'admin-1'),
    true,
  )
})

test('matches nullable assignee ids exactly for concurrency control', () => {
  assert.equal(assigneeMatches(null, null), true)
  assert.equal(assigneeMatches('agent-1', 'agent-1'), true)
  assert.equal(assigneeMatches(null, 'agent-1'), false)
  assert.equal(assigneeMatches('agent-1', null), false)
  assert.equal(assigneeMatches('agent-1', 'agent-2'), false)
})
