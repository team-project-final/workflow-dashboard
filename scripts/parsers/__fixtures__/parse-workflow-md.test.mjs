import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseWorkflowMarkdown, parseCheckboxes } from '../parse-workflow-md.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(__dirname, 'github-markdown', 'input')

test('parseCheckboxes: 빈 입력은 []', () => {
  assert.deepEqual(parseCheckboxes(''), [])
})

test('parseCheckboxes: done/undone 구분', () => {
  const md = '- [ ] a\n- [x] b\n- [X] c\n'
  const result = parseCheckboxes(md)
  assert.equal(result.length, 3)
  assert.equal(result[0].done, false)
  assert.equal(result[1].done, true)
  assert.equal(result[2].done, true)
})

test('parseWorkflowMarkdown: fixture 회귀', () => {
  const content = readFileSync(join(fixtureDir, 'WORKFLOW_testtrack_W1.md'), 'utf-8')
  const steps = parseWorkflowMarkdown(content)
  assert.ok(steps.length > 0, 'steps should not be empty')
  for (const step of steps) {
    assert.equal(typeof step.name, 'string')
    assert.ok(['Not Started', 'In Progress', 'Done'].includes(step.status))
    assert.equal(typeof step.totalChecks, 'number')
    assert.equal(typeof step.doneChecks, 'number')
    assert.ok(Array.isArray(step.phases))
  }
})
