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

test('parseCheckboxes: [~] 부분완료 인식 (done=false, partial=true)', () => {
  const md = '- [ ] a\n- [x] b\n- [~] c\n'
  const result = parseCheckboxes(md)
  assert.equal(result.length, 3)
  assert.equal(result[2].done, false)
  assert.equal(result[2].partial, true)
  assert.equal(result[2].text, 'c')
  // 기존 항목 partial=false 유지
  assert.equal(result[0].partial, false)
  assert.equal(result[1].partial, false)
})

test('parseWorkflowMarkdown: 부분완료만 있으면 In Progress (done 미집계)', () => {
  const md = '## Step 1: T\n### 1.1 P\n- [~] 부분 진행 항목\n'
  const steps = parseWorkflowMarkdown(md)
  assert.equal(steps.length, 1)
  assert.equal(steps[0].status, 'In Progress')
  assert.equal(steps[0].totalChecks, 1)
  assert.equal(steps[0].doneChecks, 0)
  assert.equal(steps[0].phases[0].items[0].partial, true)
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
