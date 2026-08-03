import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertDraftEditable,
  isSyncableEntry,
  matchesExpectedLockVersion,
  nextRevisionVersion,
  toRemoteTemplateFields,
} from './policy.ts'

test('only a draft revision is editable', () => {
  assert.equal(assertDraftEditable({ state: 'DRAFT' }), true)
  assert.equal(assertDraftEditable({ state: 'SUBMITTED' }), false)
  assert.equal(assertDraftEditable({ state: 'SUPERSEDED' }), false)
  assert.equal(assertDraftEditable(null), false)
  assert.equal(assertDraftEditable(undefined), false)
})

test('the next version comes from the highest one already used', () => {
  assert.equal(nextRevisionVersion([{ version: 1 }, { version: 3 }]), 4)
  assert.equal(nextRevisionVersion([{ version: 3 }, { version: 1 }]), 4)
  assert.equal(nextRevisionVersion([]), 1)
  assert.equal(nextRevisionVersion([{ version: 7 }]), 8)
})

test('editing a submitted template allocates a brand new version', () => {
  const history = [
    { version: 1, state: 'SUPERSEDED' },
    { version: 2, state: 'SUBMITTED' },
  ]

  assert.equal(assertDraftEditable(history[1]), false)
  assert.equal(nextRevisionVersion(history), 3)
})

test('the lock version must match exactly', () => {
  assert.equal(matchesExpectedLockVersion(4, 4), true)
  assert.equal(matchesExpectedLockVersion(4, 3), false)
  assert.equal(matchesExpectedLockVersion(4, 5), false)
  assert.equal(matchesExpectedLockVersion(4, undefined), false)
  assert.equal(matchesExpectedLockVersion(4, Number('4')), true)
  assert.equal(matchesExpectedLockVersion(4, 4.5), false)
})

test('an entry without name or language is not syncable', () => {
  assert.equal(isSyncableEntry({ name: 'boas_vindas', language: 'pt_BR' }), true)
  assert.equal(isSyncableEntry({ name: 'boas_vindas' }), false)
  assert.equal(isSyncableEntry({ language: 'pt_BR' }), false)
  assert.equal(isSyncableEntry({}), false)
})

test('remote fields never carry the local definition', () => {
  const fields = toRemoteTemplateFields({
    id: '123',
    name: 'boas_vindas',
    language: 'pt_BR',
    status: 'APPROVED',
    category: 'utility',
    quality_score: { score: 'GREEN' },
    last_updated_time: '1735689600',
    components: [{ type: 'BODY', text: 'remoto' }],
  })

  assert.deepEqual(Object.keys(fields).sort(), [
    'category',
    'metaTemplateId',
    'rejectionReason',
    'remoteQuality',
    'remoteStatus',
    'remoteUpdatedAt',
  ])
  assert.equal(fields.metaTemplateId, '123')
  assert.equal(fields.category, 'UTILITY')
  assert.equal(fields.remoteStatus, 'APPROVED')
  assert.equal(fields.remoteQuality, 'GREEN')
  assert.equal(fields.rejectionReason, null)
  assert.equal(fields.remoteUpdatedAt.toISOString(), '2025-01-01T00:00:00.000Z')
})

test('remote fields tolerate a plain quality score and an ISO date', () => {
  const fields = toRemoteTemplateFields({
    name: 'x',
    language: 'pt_BR',
    quality_score: 'YELLOW',
    rejected_reason: 'INVALID_FORMAT',
    last_updated_time: '2025-06-01T10:00:00+0000',
  })

  assert.equal(fields.metaTemplateId, null)
  assert.equal(fields.remoteQuality, 'YELLOW')
  assert.equal(fields.rejectionReason, 'INVALID_FORMAT')
  assert.equal(fields.remoteUpdatedAt.toISOString(), '2025-06-01T10:00:00.000Z')
})

test('remote fields fall back when the payload is empty', () => {
  const fields = toRemoteTemplateFields({})

  assert.equal(fields.metaTemplateId, null)
  assert.equal(fields.category, 'UTILITY')
  assert.equal(fields.remoteStatus, null)
  assert.equal(fields.remoteQuality, null)
  assert.equal(fields.remoteUpdatedAt, null)
})
