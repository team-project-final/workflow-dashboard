#!/usr/bin/env node
/**
 * Parser test runner — verifies parsers against fixture data.
 * Usage: node scripts/parsers/__fixtures__/test-parsers.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let passed = 0
let failed = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`)
    failed++
  } else {
    passed++
  }
}

async function testGitHubMarkdown() {
  console.log('Testing github-markdown parser...')
  const { default: parser } = await import('../github-markdown.mjs')

  // Test validate
  const validResult = parser.validate({ repo: 'org/repo', path: 'docs/workflow' })
  assert(validResult.valid === true, 'validate: valid config should pass')

  const invalidResult = parser.validate({ repo: '', path: '' })
  assert(invalidResult.valid === false, 'validate: empty repo should fail')

  const noPathResult = parser.validate({ repo: 'org/repo' })
  assert(noPathResult.valid === false, 'validate: missing path should fail')

  // Test transform with fixture
  const inputDir = join(__dirname, 'github-markdown', 'input')
  const rawFixture = {
    workflowFiles: [
      { name: 'WORKFLOW_testtrack_W1.md', path: join(inputDir, 'WORKFLOW_testtrack_W1.md') }
    ],
    prdFiles: [],
    taskFiles: [],
  }
  const result = parser.transform(rawFixture)
  const expected = JSON.parse(readFileSync(join(__dirname, 'github-markdown', 'expected.json'), 'utf-8'))

  // Compare tracks
  assert(result.tracks.length === expected.tracks.length, `tracks count: got ${result.tracks.length}, expected ${expected.tracks.length}`)

  const track = result.tracks[0]
  const expTrack = expected.tracks[0]
  assert(track.name === expTrack.name, `track name: got "${track.name}", expected "${expTrack.name}"`)
  assert(track.weeks.length === expTrack.weeks.length, `weeks count: got ${track.weeks.length}, expected ${expTrack.weeks.length}`)

  const week = track.weeks[0]
  const expWeek = expTrack.weeks[0]
  assert(week.totalChecks === expWeek.totalChecks, `totalChecks: got ${week.totalChecks}, expected ${expWeek.totalChecks}`)
  assert(week.doneChecks === expWeek.doneChecks, `doneChecks: got ${week.doneChecks}, expected ${expWeek.doneChecks}`)
  assert(week.steps.length === expWeek.steps.length, `steps count: got ${week.steps.length}, expected ${expWeek.steps.length}`)

  // Verify step details
  for (let i = 0; i < week.steps.length; i++) {
    const step = week.steps[i]
    const expStep = expWeek.steps[i]
    assert(step.name === expStep.name, `step[${i}] name: got "${step.name}", expected "${expStep.name}"`)
    assert(step.status === expStep.status, `step[${i}] status: got "${step.status}", expected "${expStep.status}"`)
    assert(step.totalChecks === expStep.totalChecks, `step[${i}] totalChecks: got ${step.totalChecks}, expected ${expStep.totalChecks}`)
    assert(step.doneChecks === expStep.doneChecks, `step[${i}] doneChecks: got ${step.doneChecks}, expected ${expStep.doneChecks}`)
    assert(step.phases.length === expStep.phases.length, `step[${i}] phases count: got ${step.phases.length}, expected ${expStep.phases.length}`)
  }

  // Verify PRD is empty
  assert(result.prd.length === 0, `prd should be empty, got ${result.prd.length}`)

  console.log('✅ github-markdown parser: all assertions checked')
}

console.log('Running parser tests...\n')
await testGitHubMarkdown()

console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
