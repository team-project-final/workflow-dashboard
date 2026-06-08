import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyDoneGuard } from '../done-guard.mjs'

// 최소 트랙 빌더 — 가드는 name/weeks/steps/doneChecks/totalChecks만 본다.
function step(name, done, total) {
  return { name, status: 'In Progress', phases: [], doneChecks: done, totalChecks: total }
}
function track(name, week, steps) {
  return {
    name,
    owner: 'tester',
    weeks: [{
      week, period: '',
      steps,
      doneChecks: steps.reduce((s, x) => s + x.doneChecks, 0),
      totalChecks: steps.reduce((s, x) => s + x.totalChecks, 0),
    }],
  }
}

test('이전 데이터 없으면 새 tracks 그대로', () => {
  const next = [track('platform', 'W1', [step('S1', 5, 10)])]
  assert.deepEqual(applyDoneGuard(null, next), next)
})

test('Step done 역행 시 이전(높은) Step 유지', () => {
  const old = [track('learning', 'W1', [step('S1', 20, 26)])]
  const next = [track('learning', 'W1', [step('S1', 14, 26)])]
  const out = applyDoneGuard(old, next)
  // S1 done은 14가 아니라 20으로 유지
  assert.equal(out[0].weeks[0].steps[0].doneChecks, 20)
  assert.equal(out[0].weeks[0].doneChecks, 20)
})

test('Step done 전진 시 새 값 사용', () => {
  const old = [track('learning', 'W1', [step('S1', 14, 26)])]
  const next = [track('learning', 'W1', [step('S1', 20, 26)])]
  const out = applyDoneGuard(old, next)
  assert.equal(out[0].weeks[0].steps[0].doneChecks, 20)
})

test('force=true면 역행도 그대로 통과', () => {
  const old = [track('learning', 'W1', [step('S1', 20, 26)])]
  const next = [track('learning', 'W1', [step('S1', 14, 26)])]
  const out = applyDoneGuard(old, next, { force: true })
  assert.equal(out[0].weeks[0].steps[0].doneChecks, 14)
})

test('주차 합계는 병합된 Step 기준으로 재계산', () => {
  const old = [track('t', 'W1', [step('S1', 20, 26), step('S2', 5, 5)])]
  const next = [track('t', 'W1', [step('S1', 14, 26), step('S2', 5, 5)])]
  const out = applyDoneGuard(old, next)
  // S1: 20 유지, S2: 5 → week done = 25, total = 31
  assert.equal(out[0].weeks[0].doneChecks, 25)
  assert.equal(out[0].weeks[0].totalChecks, 31)
})

test('이전에 없던 새 Step은 그대로 추가', () => {
  const old = [track('t', 'W1', [step('S1', 5, 5)])]
  const next = [track('t', 'W1', [step('S1', 5, 5), step('S2', 2, 8)])]
  const out = applyDoneGuard(old, next)
  assert.equal(out[0].weeks[0].steps.length, 2)
  assert.equal(out[0].weeks[0].steps[1].doneChecks, 2)
})

test('이전에 없던 트랙/주차는 그대로 통과', () => {
  const old = [track('t', 'W1', [step('S1', 5, 5)])]
  const next = [
    track('t', 'W1', [step('S1', 5, 5)]),
    track('other', 'W2', [step('S1', 1, 3)]),
  ]
  const out = applyDoneGuard(old, next)
  assert.equal(out.length, 2)
  assert.equal(out[1].weeks[0].steps[0].doneChecks, 1)
})

test('Step은 이름으로 매칭 (순서 바뀌어도 올바른 이전값 유지)', () => {
  const old = [track('t', 'W1', [step('A', 9, 10), step('B', 2, 10)])]
  const next = [track('t', 'W1', [step('B', 2, 10), step('A', 4, 10)])]
  const out = applyDoneGuard(old, next)
  const a = out[0].weeks[0].steps.find(s => s.name === 'A')
  const b = out[0].weeks[0].steps.find(s => s.name === 'B')
  assert.equal(a.doneChecks, 9) // A 역행(4<9) → 9 유지
  assert.equal(b.doneChecks, 2)
})
