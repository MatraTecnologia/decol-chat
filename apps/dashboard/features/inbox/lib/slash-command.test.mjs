import assert from 'node:assert/strict'
import test from 'node:test'

import { parseSlashCommand } from './slash-command.ts'

const inactive = { active: false, query: '' }

test('activates on the bare command and captures the query', () => {
  assert.deepEqual(parseSlashCommand('/template:'), {
    active: true,
    query: '',
  })
  assert.deepEqual(parseSlashCommand('/template:hel'), {
    active: true,
    query: 'hel',
  })
  assert.deepEqual(parseSlashCommand('/template:boas-vindas_2'), {
    active: true,
    query: 'boas-vindas_2',
  })
})

test('stays inactive when text precedes the command', () => {
  assert.deepEqual(parseSlashCommand('oi /template:hel'), inactive)
  assert.deepEqual(parseSlashCommand(' /template:hel'), inactive)
})

test('a space or line break after the command closes the menu', () => {
  assert.deepEqual(parseSlashCommand('/template:hel '), inactive)
  assert.deepEqual(parseSlashCommand('/template: '), inactive)
  assert.deepEqual(parseSlashCommand('/template:hel\n'), inactive)
  assert.deepEqual(parseSlashCommand('/template:hel mundo'), inactive)
})

test('stays inactive for empty or unrelated drafts', () => {
  assert.deepEqual(parseSlashCommand(''), inactive)
  assert.deepEqual(parseSlashCommand('/'), inactive)
  assert.deepEqual(parseSlashCommand('/template'), inactive)
  assert.deepEqual(parseSlashCommand('/templates:hel'), inactive)
  assert.deepEqual(parseSlashCommand('bom dia'), inactive)
})
