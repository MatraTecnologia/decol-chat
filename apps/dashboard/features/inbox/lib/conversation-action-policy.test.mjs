import assert from 'node:assert/strict'
import test from 'node:test'

import { getConversationActions } from './conversation-action-policy.ts'

const conversation = {
  assignedToId: 'agent-1',
  unreadCount: 2,
  status: 'OPEN',
}

test('admin and manager receive every applicable action', () => {
  for (const role of ['admin', 'manager']) {
    assert.deepEqual(getConversationActions(role, 'user-1', conversation), {
      canAssign: true,
      canUnassign: true,
      canMarkRead: true,
      canChangePriority: true,
      canChangeStatus: true,
    })
  }
})

test('owner agent can read and change status but cannot manage assignment', () => {
  assert.deepEqual(
    getConversationActions('agent', 'agent-1', conversation),
    {
      canAssign: false,
      canUnassign: false,
      canMarkRead: true,
      canChangePriority: false,
      canChangeStatus: true,
    },
  )
})

test('non-owner agent and viewer receive no actions', () => {
  const none = {
    canAssign: false,
    canUnassign: false,
    canMarkRead: false,
    canChangePriority: false,
    canChangeStatus: false,
  }

  assert.deepEqual(
    getConversationActions('agent', 'agent-2', conversation),
    none,
  )
  assert.deepEqual(getConversationActions('viewer', 'viewer-1', conversation), none)
})

test('hides read and unassign when they do not apply to state', () => {
  assert.deepEqual(
    getConversationActions('manager', 'manager-1', {
      assignedToId: null,
      unreadCount: 0,
      status: 'PENDING',
    }),
    {
      canAssign: true,
      canUnassign: false,
      canMarkRead: false,
      canChangePriority: true,
      canChangeStatus: true,
    },
  )
})
