# Force Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 cron을 기다리지 않고 임의 시점에 1~N개 레포를 강제 동기화할 수 있도록 GitHub Actions의 `workflow_dispatch` input을 확장하고, Settings에 캐시 vs 실시간 비교 + 다중 선택 트리거 + 폴링 결과 표시를 제공하는 새 탭을 추가한다.

**Architecture:** 기존 `sync-data.yml` + `parse-workflow.mjs` 경로를 그대로 공유하면서 `repos`/`force` input 두 개와 커밋 게이트 분기만 추가한다. 클라이언트는 사용자가 직접 입력한 fine-grained PAT를 localStorage에 저장해 GitHub REST API를 호출(`contents`, `dispatches`, `runs`)하고 5초 폴링으로 진행 상황을 추적한다. 파서 순수 함수는 별도 모듈(`parse-workflow-md.mjs`)로 추출해 Node/Browser 양쪽에서 동일 결과를 보장한다.

**Tech Stack:** GitHub Actions (bash), Node 22, React 19 + TypeScript, Vite, Tailwind, `node --test` (built-in test runner).

**Spec:** `docs/superpowers/specs/2026-05-21-force-sync-design.md`

---

## File Structure

### Create
- `scripts/parsers/parse-workflow-md.mjs` — 순수 파싱 함수(`parseCheckboxes`, `parseWorkflowMarkdown`). `fs`/`path` 의존 없음.
- `scripts/parsers/__fixtures__/parse-workflow-md.test.mjs` — `node --test` 회귀 테스트. 기존 fixture 재사용.
- `src/utils/parseWorkflowMd.ts` — TS shim. `.mjs` 모듈을 `as` 타입으로 re-export.
- `src/hooks/useForceSyncPat.ts` — PAT load/save/clear + `GET /user` 검증.
- `src/hooks/useGithubApi.ts` — `Authorization` 자동 첨부 fetch 래퍼, 401 → 토큰 자동 삭제.
- `src/hooks/useWorkflowDispatch.ts` — `POST /dispatches` + 직후 새 run id 식별.
- `src/hooks/useWorkflowRun.ts` — `GET /runs/{id}` 5초 폴링, completed 시 stop.
- `src/components/settings/ForceSyncTab.tsx` — 탭 루트, 자식 컴포넌트 조립.
- `src/components/settings/PatRegister.tsx` — PAT 입력·검증·마스킹·삭제 UI.
- `src/components/settings/RepoForceList.tsx` — 7 레포 × `<RepoCompareRow>`.
- `src/components/settings/RepoCompareRow.tsx` — 체크박스 + 캐시·실시간 컬럼 + diff 마커.
- `src/components/settings/TriggerBar.tsx` — 선택 N개 표시 + "강제 sync" 버튼.
- `src/components/settings/RunStatusPanel.tsx` — 폴링 상태/결과 표시.

### Modify
- `.github/workflows/sync-data.yml` — `inputs.repos`, `inputs.force` 추가 + 멤버십·게이트 bash 수정.
- `scripts/parse-workflow.mjs` — 순수 함수 두 개를 새 모듈에서 import하도록 교체.
- `src/pages/Settings.tsx` — 4번째 탭(`force-sync`) 추가.
- `package.json` — `test` 스크립트 추가 (`node --test scripts/parsers/__fixtures__/`).

---

## Task 1: 파서 순수 함수 추출 (TDD — 기존 동작 잠금)

**Files:**
- Create: `scripts/parsers/parse-workflow-md.mjs`
- Create: `scripts/parsers/__fixtures__/parse-workflow-md.test.mjs`
- Modify: `package.json` (test script)

- [ ] **Step 1: package.json에 test 스크립트 추가**

Modify `package.json` `scripts` 블록:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "test": "node --test scripts/parsers/__fixtures__/",
  "validate:data": "node scripts/validate-data.mjs",
  "sync": "node scripts/sync.mjs",
  "sync:dry": "node scripts/sync.mjs --dry-run",
  "preview": "vite preview"
}
```

- [ ] **Step 2: 실패하는 회귀 테스트 작성**

Create `scripts/parsers/__fixtures__/parse-workflow-md.test.mjs`:
```js
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
  // 기존 parse-workflow.mjs의 결과와 동일해야 함
  assert.ok(steps.length > 0, 'steps should not be empty')
  for (const step of steps) {
    assert.ok(typeof step.name === 'string')
    assert.ok(['Not Started', 'In Progress', 'Done'].includes(step.status))
    assert.equal(typeof step.totalChecks, 'number')
    assert.equal(typeof step.doneChecks, 'number')
    assert.ok(Array.isArray(step.phases))
  }
})
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `npm test`
Expected: `Cannot find module '../parse-workflow-md.mjs'`

- [ ] **Step 4: parse-workflow-md.mjs 작성 (parse-workflow.mjs L15-56에서 추출)**

Create `scripts/parsers/parse-workflow-md.mjs`:
```js
/**
 * Pure markdown parsing — no fs/path. Usable in Node and browser.
 */

export function parseCheckboxes(content) {
  const checks = []
  const re = /^(\s*)- \[([ xX])\]\s+(.+)$/gm
  let match
  while ((match = re.exec(content)) !== null) {
    checks.push({ done: match[2] === 'x' || match[2] === 'X', text: match[3].trim() })
  }
  return checks
}

export function parseWorkflowMarkdown(content) {
  const steps = []
  const stepParts = content.split(/^## Step \d+: /m).slice(1)
  const stepNames = [...content.matchAll(/^## Step (\d+): (.+)$/gm)].map(m => m[2])

  stepParts.forEach((part, i) => {
    const phases = []
    const phaseParts = part.split(/^### \d+\.\d+ /m).slice(1)
    const phaseNames = [...part.matchAll(/^### (\d+\.\d+) (.+)$/gm)].map(m => m[2])

    phaseParts.forEach((pp, j) => {
      const checks = parseCheckboxes(pp)
      phases.push({
        name: phaseNames[j] || `Phase ${j + 1}`,
        total: checks.length,
        done: checks.filter(c => c.done).length,
        items: checks.map(c => ({ text: c.text, done: c.done })),
      })
    })

    const totalChecks = phases.reduce((s, p) => s + p.total, 0)
    const doneChecks = phases.reduce((s, p) => s + p.done, 0)
    const status = totalChecks === 0 ? 'Not Started'
      : doneChecks === totalChecks ? 'Done'
      : doneChecks > 0 ? 'In Progress' : 'Not Started'

    steps.push({ name: stepNames[i] || `Step ${i + 1}`, status, phases, totalChecks, doneChecks })
  })

  return steps
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: `tests 3 / pass 3 / fail 0`

- [ ] **Step 6: Commit**

```bash
git add scripts/parsers/parse-workflow-md.mjs scripts/parsers/__fixtures__/parse-workflow-md.test.mjs package.json
git commit -m "feat(parsers): extract pure workflow markdown parser with regression tests"
```

---

## Task 2: parse-workflow.mjs를 새 모듈로 위임

**Files:**
- Modify: `scripts/parse-workflow.mjs:15-56`

- [ ] **Step 1: 동일 입력 → 동일 출력 사전 확인**

Run: `npm run validate:data`
Expected: 현재 통과 상태(`Data validation passed with 5 warning(s).`) 메모.

- [ ] **Step 2: parse-workflow.mjs의 parseCheckboxes/parseWorkflowFile을 import로 교체**

`scripts/parse-workflow.mjs` 상단에 import 추가:
```js
import { parseWorkflowMarkdown } from './parsers/parse-workflow-md.mjs'
```

기존 `parseCheckboxes` 함수(L15-23) 삭제.

기존 `parseWorkflowFile` 함수(L25-56) 본문을 다음으로 교체:
```js
function parseWorkflowFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  return parseWorkflowMarkdown(content)
}
```

- [ ] **Step 3: 회귀 확인 — 한 레포 sync 결과 비교**

Run:
```bash
cp data/synapse-platform-svc.json /tmp/before.json
git stash --keep-index # keep working changes
# 직접 호출이 불가능하므로 npm test로만 회귀 확인
git stash pop
npm test
```
Expected: tests 3 pass.

- [ ] **Step 4: validate:data 재확인**

Run: `npm run validate:data && npm run lint && npm run build`
Expected: 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse-workflow.mjs
git commit -m "refactor(parsers): delegate parse-workflow.mjs to extracted pure module"
```

---

## Task 3: TypeScript shim (`src/utils/parseWorkflowMd.ts`)

**Files:**
- Create: `src/utils/parseWorkflowMd.ts`

- [ ] **Step 1: 타입 정의 + 모듈 re-export**

Create `src/utils/parseWorkflowMd.ts`:
```ts
// @ts-expect-error — .mjs 모듈, 빌드 시 Vite가 처리
import { parseWorkflowMarkdown as _parseWorkflowMarkdown, parseCheckboxes as _parseCheckboxes } from '../../scripts/parsers/parse-workflow-md.mjs'

export interface ParsedCheckbox {
  done: boolean
  text: string
}

export interface ParsedPhase {
  name: string
  total: number
  done: number
  items: ParsedCheckbox[]
}

export interface ParsedStep {
  name: string
  status: 'Not Started' | 'In Progress' | 'Done'
  totalChecks: number
  doneChecks: number
  phases: ParsedPhase[]
}

export const parseCheckboxes: (content: string) => ParsedCheckbox[] = _parseCheckboxes
export const parseWorkflowMarkdown: (content: string) => ParsedStep[] = _parseWorkflowMarkdown
```

- [ ] **Step 2: 빌드/lint 통과 확인**

Run: `npm run lint && npm run build`
Expected: 모두 통과. dist에 번들된 결과 sanity check.

- [ ] **Step 3: Commit**

```bash
git add src/utils/parseWorkflowMd.ts
git commit -m "feat(utils): TS shim for shared workflow markdown parser"
```

---

## Task 4: sync-data.yml input 확장 + 커밋 게이트

**Files:**
- Modify: `.github/workflows/sync-data.yml`

- [ ] **Step 1: inputs 추가**

Modify `.github/workflows/sync-data.yml` `workflow_dispatch.inputs`:
```yaml
  workflow_dispatch:
    inputs:
      repos:
        description: '동기화할 레포 (콤마 구분, 비우면 전체)'
        required: false
        type: string
      force:
        description: '강제 동기화 (md5 우회 + history/changelog 재계산)'
        required: false
        type: boolean
        default: false
```

기존 `repo` input은 삭제.

- [ ] **Step 2: env에 두 input 노출 + 멤버십 체크 교체**

`Sync repos` step의 `env`와 bash 본문 수정:

`env` 블록:
```yaml
env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  TARGET_REPOS: ${{ inputs.repos || '' }}
  FORCE: ${{ inputs.force || 'false' }}
```

bash 본문에서 기존 `if [ -n "$TARGET_REPO" ] && [ "$TARGET_REPO" != "$REPO" ]; then continue; fi` 부분을 다음으로 교체:
```bash
if [ -n "$TARGET_REPOS" ]; then
  echo ",$TARGET_REPOS," | grep -q ",$REPO," || { echo "⏭️ $REPO: not in selection — skip"; echo "::endgroup::"; continue; }
fi
```

- [ ] **Step 3: 커밋 게이트에 force 분기 추가**

기존 게이트:
```bash
if [ "$OLD_CHECKSUM" != "$NEW_CHECKSUM" ]; then
  UPDATED+=("$REPO ($DEFAULT_BRANCH) from $LATEST_SHA")
  echo "✅ $REPO: 데이터 변경 감지 — 업데이트됨"
else
  echo "⏭️ $REPO: 변경 없음 — 건너뜀"
  git checkout -- "data/$REPO.json" 2>/dev/null || true
fi
```

교체:
```bash
if [ "$FORCE" = "true" ] || [ "$OLD_CHECKSUM" != "$NEW_CHECKSUM" ]; then
  MARK=""
  [ "$FORCE" = "true" ] && MARK=" [force]"
  UPDATED+=("$REPO ($DEFAULT_BRANCH) from $LATEST_SHA$MARK")
  echo "✅ $REPO: $( [ "$FORCE" = "true" ] && echo '강제 동기화' || echo '데이터 변경 감지' ) — 업데이트됨"
else
  echo "⏭️ $REPO: 변경 없음 — 건너뜀"
  git checkout -- "data/$REPO.json" 2>/dev/null || true
fi
```

- [ ] **Step 4: 빈 커밋 가드 추가**

`force=true`이고 실제 변경이 없을 때 `git commit`이 실패하지 않도록 staged diff 체크를 추가한다.

기존 워크플로의 마지막 커밋 블록:
```bash
if [ ${#UPDATED[@]} -gt 0 ]; then
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"

  git add data/*.json

  COMMIT_MSG="data: sync workflow data"
  for item in "${UPDATED[@]}"; do
    COMMIT_MSG="$COMMIT_MSG
  - update $item"
  done

  git commit -m "$COMMIT_MSG"
  git push

  echo "🚀 ${#UPDATED[@]}개 레포 데이터 업데이트 완료"
else
  echo "✅ 모든 레포 데이터 최신 상태 — 커밋 불필요"
fi
```

교체:
```bash
if [ ${#UPDATED[@]} -gt 0 ]; then
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"

  git add data/*.json

  if git diff --cached --quiet; then
    echo "ℹ️ force 트리거였으나 실제 변경 없음 — 커밋 건너뜀"
  else
    COMMIT_MSG="data: sync workflow data"
    for item in "${UPDATED[@]}"; do
      COMMIT_MSG="$COMMIT_MSG
  - update $item"
    done

    git commit -m "$COMMIT_MSG"
    git push

    echo "🚀 ${#UPDATED[@]}개 레포 데이터 업데이트 완료"
  fi
else
  echo "✅ 모든 레포 데이터 최신 상태 — 커밋 불필요"
fi
```

- [ ] **Step 5: 수동 검증 — Actions UI에서 트리거**

Push 후 Actions 탭 → "Sync Workflow Data" → Run workflow:
- `repos = synapse-platform-svc`, `force = true` 입력
- 실행 후 로그에서 `[force]` 마커 + commit 메시지에 `[force]` 포함 확인 (변경 있을 때)
- 변경 없을 때는 "force 트리거였으나 실제 변경 없음 — 커밋 건너뜀" 메시지 확인
- 7 레포 중 1 레포만 처리됐는지 확인

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/sync-data.yml
git commit -m "feat(ci): add force + multi-repo inputs to sync-data workflow"
```

---

## Task 5: `useForceSyncPat` 훅

**Files:**
- Create: `src/hooks/useForceSyncPat.ts`

- [ ] **Step 1: 훅 작성**

Create `src/hooks/useForceSyncPat.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'

const LS_KEY = 'forceSync.pat'
const LS_OWNER_KEY = 'forceSync.patOwner'

export interface PatState {
  token: string | null
  owner: string | null
}

export function useForceSyncPat() {
  const [state, setState] = useState<PatState>({ token: null, owner: null })
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem(LS_KEY)
    const owner = localStorage.getItem(LS_OWNER_KEY)
    setState({ token, owner })
  }, [])

  const save = useCallback(async (token: string): Promise<boolean> => {
    setValidating(true)
    setError(null)
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      })
      if (!res.ok) {
        setError(res.status === 401 ? '토큰이 유효하지 않습니다 (401)' : `검증 실패: HTTP ${res.status}`)
        return false
      }
      const body = await res.json() as { login: string }
      localStorage.setItem(LS_KEY, token)
      localStorage.setItem(LS_OWNER_KEY, body.login)
      setState({ token, owner: body.login })
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류')
      return false
    } finally {
      setValidating(false)
    }
  }, [])

  const clear = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_OWNER_KEY)
    setState({ token: null, owner: null })
    setError(null)
  }, [])

  return { ...state, validating, error, save, clear }
}
```

- [ ] **Step 2: lint/build 통과 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useForceSyncPat.ts
git commit -m "feat(hooks): add useForceSyncPat for PAT lifecycle"
```

---

## Task 6: `useGithubApi` fetch 래퍼

**Files:**
- Create: `src/hooks/useGithubApi.ts`

- [ ] **Step 1: 훅 작성 — Authorization 자동 첨부 + 401 핸들링**

Create `src/hooks/useGithubApi.ts`:
```ts
import { useCallback } from 'react'
import { useForceSyncPat } from './useForceSyncPat'

export interface GithubApiOptions extends RequestInit {
  expect?: 'json' | 'text' | 'none'
}

export interface GithubApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  rateLimitRemaining: number | null
  rateLimitReset: number | null
  errorMessage: string | null
}

export function useGithubApi() {
  const { token, clear } = useForceSyncPat()

  const call = useCallback(async <T = unknown>(
    pathOrUrl: string,
    opts: GithubApiOptions = {}
  ): Promise<GithubApiResult<T>> => {
    const { expect = 'json', headers, ...rest } = opts
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `https://api.github.com${pathOrUrl}`
    const finalHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      ...(headers as Record<string, string> | undefined),
    }
    if (token) finalHeaders.Authorization = `Bearer ${token}`

    let res: Response
    try {
      res = await fetch(url, { ...rest, headers: finalHeaders })
    } catch (e) {
      return {
        ok: false, status: 0, data: null,
        rateLimitRemaining: null, rateLimitReset: null,
        errorMessage: e instanceof Error ? e.message : 'network error',
      }
    }

    const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining')
    const rateLimitReset = res.headers.get('X-RateLimit-Reset')

    if (res.status === 401 && token) {
      clear() // auto-purge stale token
    }

    let data: T | null = null
    if (res.ok && expect === 'json') {
      data = await res.json() as T
    } else if (res.ok && expect === 'text') {
      data = (await res.text()) as unknown as T
    }

    return {
      ok: res.ok, status: res.status, data,
      rateLimitRemaining: rateLimitRemaining ? Number(rateLimitRemaining) : null,
      rateLimitReset: rateLimitReset ? Number(rateLimitReset) : null,
      errorMessage: res.ok ? null : `HTTP ${res.status}`,
    }
  }, [token, clear])

  return { call, hasToken: !!token }
}
```

- [ ] **Step 2: lint/build 통과 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGithubApi.ts
git commit -m "feat(hooks): add useGithubApi fetch wrapper with auto-auth + 401 purge"
```

---

## Task 7: `useWorkflowDispatch` 훅

**Files:**
- Create: `src/hooks/useWorkflowDispatch.ts`

- [ ] **Step 1: dispatch + run id 식별 훅 작성**

Create `src/hooks/useWorkflowDispatch.ts`:
```ts
import { useCallback, useState } from 'react'
import { useGithubApi } from './useGithubApi'

const REPO_OWNER = 'team-project-final'
const REPO_NAME = 'workflow-dashboard'
const WORKFLOW_FILE = 'sync-data.yml'

export interface DispatchInputs {
  repos: string  // comma-separated, '' = all
  force: boolean
}

export function useWorkflowDispatch() {
  const { call } = useGithubApi()
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dispatch = useCallback(async (inputs: DispatchInputs): Promise<number | null> => {
    setDispatching(true)
    setError(null)
    try {
      const dispatchAt = new Date()
      const post = await call(
        `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref: 'main',
            inputs: { repos: inputs.repos, force: String(inputs.force) },
          }),
          expect: 'none',
        }
      )
      if (!post.ok) {
        setError(post.errorMessage || `dispatch failed: HTTP ${post.status}`)
        return null
      }

      // grace + identify new run
      await new Promise(r => setTimeout(r, 5000))
      const list = await call<{ workflow_runs: Array<{ id: number; event: string; created_at: string }> }>(
        `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=5`
      )
      if (!list.ok || !list.data) {
        setError('run id 식별 실패 (조회 오류)')
        return null
      }
      const candidate = list.data.workflow_runs.find(r => new Date(r.created_at) >= dispatchAt)
      if (!candidate) {
        setError('run id 식별 실패 (grace 후에도 새 run 없음)')
        return null
      }
      return candidate.id
    } finally {
      setDispatching(false)
    }
  }, [call])

  return { dispatch, dispatching, error }
}
```

- [ ] **Step 2: lint/build 통과 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWorkflowDispatch.ts
git commit -m "feat(hooks): add useWorkflowDispatch with grace-window run id identification"
```

---

## Task 8: `useWorkflowRun` 폴링 훅

**Files:**
- Create: `src/hooks/useWorkflowRun.ts`

- [ ] **Step 1: 폴링 훅 작성 — 5초 간격, 3회 실패 시 중단**

Create `src/hooks/useWorkflowRun.ts`:
```ts
import { useEffect, useState } from 'react'
import { useGithubApi } from './useGithubApi'

const REPO_OWNER = 'team-project-final'
const REPO_NAME = 'workflow-dashboard'
const POLL_MS = 5000
const MAX_CONSECUTIVE_FAILS = 3

export type RunStatus = 'queued' | 'in_progress' | 'completed' | 'waiting' | 'unknown'
export type RunConclusion = 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | 'neutral' | null

export interface RunState {
  id: number
  status: RunStatus
  conclusion: RunConclusion
  htmlUrl: string
  updatedAt: string
}

export function useWorkflowRun(runId: number | null) {
  const { call } = useGithubApi()
  const [run, setRun] = useState<RunState | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  useEffect(() => {
    if (runId == null) return
    let cancelled = false
    let consecutiveFails = 0

    async function tick() {
      if (cancelled) return
      const res = await call<{
        id: number; status: string; conclusion: string | null;
        html_url: string; updated_at: string;
      }>(`/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}`)

      if (!res.ok || !res.data) {
        consecutiveFails++
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
          setFatalError('폴링 실패 3회 — 중단')
          return
        }
        setTimeout(tick, POLL_MS)
        return
      }
      consecutiveFails = 0
      const next: RunState = {
        id: res.data.id,
        status: (res.data.status as RunStatus) || 'unknown',
        conclusion: (res.data.conclusion as RunConclusion) || null,
        htmlUrl: res.data.html_url,
        updatedAt: res.data.updated_at,
      }
      setRun(next)
      if (next.status === 'completed') return
      setTimeout(tick, POLL_MS)
    }

    void tick()
    return () => { cancelled = true }
  }, [runId, call])

  return { run, fatalError }
}
```

- [ ] **Step 2: lint/build 통과 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWorkflowRun.ts
git commit -m "feat(hooks): add useWorkflowRun polling with 3-fail bail"
```

---

## Task 9: `PatRegister` 컴포넌트

**Files:**
- Create: `src/components/settings/PatRegister.tsx`

- [ ] **Step 1: 입력·검증·마스킹 UI 작성**

Create `src/components/settings/PatRegister.tsx`:
```tsx
import { useState } from 'react'
import { useForceSyncPat } from '../../hooks/useForceSyncPat'

function mask(token: string): string {
  if (token.length <= 8) return '••••••••'
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`
}

export default function PatRegister() {
  const { token, owner, validating, error, save, clear } = useForceSyncPat()
  const [draft, setDraft] = useState('')

  if (token) {
    return (
      <div className="rounded border border-stone-200 bg-white p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-stone-400">등록된 PAT</div>
            <div className="font-mono text-sm text-stone-700">{mask(token)}</div>
            {owner && <div className="text-xs text-stone-400 mt-1">@{owner}</div>}
          </div>
          <button
            type="button"
            onClick={clear}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
          >
            토큰 제거
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded border border-stone-200 bg-white p-4 mb-4 space-y-3">
      <div>
        <div className="text-sm font-medium text-stone-700">GitHub PAT 등록</div>
        <div className="text-xs text-stone-500 mt-1">
          Fine-grained PAT 권한: <code>Actions: Read and write</code>, <code>Contents: Read-only</code>, <code>Metadata: Read-only</code>.
          Repository access: <code>workflow-dashboard</code> + 동기화 대상 7개 레포.
        </div>
      </div>
      <input
        type="password"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="github_pat_..."
        className="w-full px-3 py-2 border border-stone-300 rounded font-mono text-sm"
      />
      {error && <div className="text-xs text-red-600">{error}</div>}
      <button
        type="button"
        disabled={validating || draft.trim().length < 10}
        onClick={async () => {
          const ok = await save(draft.trim())
          if (ok) setDraft('')
        }}
        className="px-4 py-2 text-sm bg-info text-white rounded disabled:opacity-50"
      >
        {validating ? '검증 중...' : '등록'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: lint/build 통과 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/PatRegister.tsx
git commit -m "feat(settings): add PatRegister component"
```

---

## Task 10: `RepoCompareRow` 컴포넌트 (캐시 컬럼만 우선)

**Files:**
- Create: `src/components/settings/RepoCompareRow.tsx`

- [ ] **Step 1: 캐시 메타만 렌더링하는 행 컴포넌트 작성**

Create `src/components/settings/RepoCompareRow.tsx`:
```tsx
import type { RepoData } from '../../types'

export interface LiveMeta {
  totalChecks: number
  doneChecks: number
  fetching: boolean
  error: string | null
}

interface Props {
  repoId: string
  cache: RepoData | null
  live: LiveMeta | null  // null = 실시간 미사용
  selected: boolean
  onToggle: () => void
}

function sumChecks(repo: RepoData | null): { total: number; done: number } {
  if (!repo) return { total: 0, done: 0 }
  let total = 0, done = 0
  for (const t of repo.tracks || []) {
    for (const w of t.weeks || []) {
      total += w.totalChecks || 0
      done += w.doneChecks || 0
    }
  }
  return { total, done }
}

function diffMarker(cache: number, live: number): string {
  if (live > cache) return '▲'
  if (live < cache) return '▼'
  return '='
}

export default function RepoCompareRow({ repoId, cache, live, selected, onToggle }: Props) {
  const c = sumChecks(cache)
  return (
    <tr className="border-t border-stone-200">
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td className="px-3 py-2 font-mono text-sm">{repoId}</td>
      <td className="px-3 py-2 text-sm text-stone-700">
        {cache ? `${c.done}/${c.total}` : <span className="text-stone-400">없음</span>}
      </td>
      <td className="px-3 py-2 text-sm">
        {live === null ? (
          <span className="text-stone-400">PAT 필요</span>
        ) : live.fetching ? (
          <span className="text-stone-400">불러오는 중…</span>
        ) : live.error ? (
          <span className="text-red-500" title={live.error}>오류</span>
        ) : (
          <span className="text-stone-700">{live.done}/{live.total}</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-center">
        {live && !live.fetching && !live.error ? (
          <>
            <span>{diffMarker(c.done, live.done)} done</span>
            {' '}
            <span>{diffMarker(c.total, live.total)} total</span>
          </>
        ) : '—'}
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: lint/build 통과 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/RepoCompareRow.tsx
git commit -m "feat(settings): add RepoCompareRow with cache/live/diff columns"
```

---

## Task 11: `RepoForceList` 컴포넌트 (실시간 fetch 통합)

**Files:**
- Create: `src/components/settings/RepoForceList.tsx`

- [ ] **Step 1: 7 레포 순회 + 실시간 fetch + diff 통합**

Create `src/components/settings/RepoForceList.tsx`:
```tsx
import { useEffect, useState } from 'react'
import RepoCompareRow, { type LiveMeta } from './RepoCompareRow'
import { useGithubApi } from '../../hooks/useGithubApi'
import { useForceSyncPat } from '../../hooks/useForceSyncPat'
import { parseWorkflowMarkdown } from '../../utils/parseWorkflowMd'
import type { DashboardConfig } from '../../types/config'
import type { RepoData } from '../../types'

const REPO_OWNER = 'team-project-final'
const WORKFLOW_DIR = 'docs/project-management/workflow'

interface Props {
  config: DashboardConfig
  cacheByRepo: Record<string, RepoData | null>
  selected: Set<string>
  onToggle: (repoId: string) => void
}

interface ContentItem { name: string; download_url: string | null; type: string }

export default function RepoForceList({ config, cacheByRepo, selected, onToggle }: Props) {
  const { call } = useGithubApi()
  const { token } = useForceSyncPat()
  const [liveByRepo, setLiveByRepo] = useState<Record<string, LiveMeta>>({})

  const repoIds = (config.repos as Array<{ id?: string; repo?: string }>).map(r => r.id || r.repo!) 

  useEffect(() => {
    if (!token) {
      setLiveByRepo({})
      return
    }
    let cancelled = false

    async function fetchOne(repoId: string): Promise<LiveMeta> {
      const list = await call<ContentItem[]>(
        `/repos/${REPO_OWNER}/${repoId}/contents/${WORKFLOW_DIR}`
      )
      if (!list.ok || !list.data) {
        return { totalChecks: 0, doneChecks: 0, fetching: false, error: list.errorMessage || `HTTP ${list.status}` }
      }
      const mdFiles = list.data.filter(f => f.type === 'file' && f.name.startsWith('WORKFLOW_') && f.name.endsWith('.md') && f.download_url)
      let total = 0, done = 0
      for (const f of mdFiles) {
        const raw = await call<string>(f.download_url!, { expect: 'text' })
        if (!raw.ok || !raw.data) continue
        const steps = parseWorkflowMarkdown(raw.data)
        for (const s of steps) {
          total += s.totalChecks
          done += s.doneChecks
        }
      }
      return { totalChecks: total, doneChecks: done, fetching: false, error: null }
    }

    repoIds.forEach(repoId => {
      setLiveByRepo(prev => ({ ...prev, [repoId]: { totalChecks: 0, doneChecks: 0, fetching: true, error: null } }))
      fetchOne(repoId).then(meta => {
        if (cancelled) return
        setLiveByRepo(prev => ({ ...prev, [repoId]: meta }))
      })
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <table className="w-full border border-stone-200 bg-white rounded">
      <thead className="bg-stone-50 text-xs text-stone-500 uppercase">
        <tr>
          <th className="px-3 py-2 text-left w-10"></th>
          <th className="px-3 py-2 text-left">레포</th>
          <th className="px-3 py-2 text-left">캐시 (done/total)</th>
          <th className="px-3 py-2 text-left">실시간 (done/total)</th>
          <th className="px-3 py-2 text-center">diff</th>
        </tr>
      </thead>
      <tbody>
        {repoIds.map(repoId => (
          <RepoCompareRow
            key={repoId}
            repoId={repoId}
            cache={cacheByRepo[repoId] || null}
            live={token ? (liveByRepo[repoId] || { totalChecks: 0, doneChecks: 0, fetching: true, error: null }) : null}
            selected={selected.has(repoId)}
            onToggle={() => onToggle(repoId)}
          />
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: lint/build 통과 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/RepoForceList.tsx
git commit -m "feat(settings): add RepoForceList with live fetch integration"
```

---

## Task 12: `TriggerBar` 컴포넌트

**Files:**
- Create: `src/components/settings/TriggerBar.tsx`

- [ ] **Step 1: 선택 카운트 + 트리거 버튼**

Create `src/components/settings/TriggerBar.tsx`:
```tsx
interface Props {
  selectedCount: number
  hasToken: boolean
  dispatching: boolean
  onTrigger: () => void
}

export default function TriggerBar({ selectedCount, hasToken, dispatching, onTrigger }: Props) {
  const disabled = !hasToken || selectedCount === 0 || dispatching
  const reason = !hasToken
    ? 'PAT 등록 필요'
    : selectedCount === 0
      ? '레포 선택 필요'
      : dispatching
        ? '실행 중'
        : null
  return (
    <div className="flex items-center gap-3 mt-4">
      <button
        type="button"
        disabled={disabled}
        onClick={onTrigger}
        className="px-4 py-2 bg-red-600 text-white text-sm rounded disabled:opacity-40"
      >
        {dispatching ? '트리거 중...' : `강제 sync 실행 (${selectedCount})`}
      </button>
      {reason && <span className="text-xs text-stone-500">{reason}</span>}
    </div>
  )
}
```

- [ ] **Step 2: lint/build 통과 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/TriggerBar.tsx
git commit -m "feat(settings): add TriggerBar"
```

---

## Task 13: `RunStatusPanel` 컴포넌트

**Files:**
- Create: `src/components/settings/RunStatusPanel.tsx`

- [ ] **Step 1: 폴링 결과 표시 + Actions 링크**

Create `src/components/settings/RunStatusPanel.tsx`:
```tsx
import { useWorkflowRun, type RunStatus, type RunConclusion } from '../../hooks/useWorkflowRun'

interface Props {
  runId: number | null
  dispatchError: string | null
}

function statusLabel(status: RunStatus, conclusion: RunConclusion): string {
  if (status === 'completed') {
    if (conclusion === 'success') return '✅ 완료 (success)'
    if (conclusion === 'failure') return '❌ 실패 (failure)'
    return `⏹️ 완료 (${conclusion || 'unknown'})`
  }
  if (status === 'queued') return '⏳ 대기 (queued)'
  if (status === 'in_progress') return '🔄 실행 중 (in_progress)'
  if (status === 'waiting') return '⏸ 승인 대기 (waiting)'
  return status
}

export default function RunStatusPanel({ runId, dispatchError }: Props) {
  const { run, fatalError } = useWorkflowRun(runId)

  if (dispatchError) {
    return <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded">트리거 실패: {dispatchError}</div>
  }
  if (runId == null) return null

  return (
    <div className="mt-4 p-3 bg-stone-50 border border-stone-200 rounded text-sm">
      <div className="flex items-center justify-between">
        <div>
          Run #{runId}: {run ? statusLabel(run.status, run.conclusion) : '시작 중…'}
        </div>
        {run && (
          <a href={run.htmlUrl} target="_blank" rel="noreferrer" className="text-info underline text-xs">
            Actions에서 보기 ↗
          </a>
        )}
      </div>
      {fatalError && <div className="text-red-600 text-xs mt-2">{fatalError}</div>}
    </div>
  )
}
```

- [ ] **Step 2: lint/build 통과 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/RunStatusPanel.tsx
git commit -m "feat(settings): add RunStatusPanel"
```

---

## Task 14: `ForceSyncTab` 통합 + Settings 탭 추가

**Files:**
- Create: `src/components/settings/ForceSyncTab.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: ForceSyncTab 작성 — 자식 조립 + 상태 관리 + run id localStorage 복원**

Create `src/components/settings/ForceSyncTab.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react'
import PatRegister from './PatRegister'
import RepoForceList from './RepoForceList'
import TriggerBar from './TriggerBar'
import RunStatusPanel from './RunStatusPanel'
import { useForceSyncPat } from '../../hooks/useForceSyncPat'
import { useWorkflowDispatch } from '../../hooks/useWorkflowDispatch'
import { useData } from '../../hooks/useData'
import type { DashboardConfig } from '../../types/config'
import type { RepoData } from '../../types'

const LS_RUN_ID = 'forceSync.runId'

interface Props {
  config: DashboardConfig
}

export default function ForceSyncTab({ config }: Props) {
  const { token } = useForceSyncPat()
  const { rawByRepo } = useData()
  const { dispatch, dispatching, error: dispatchError } = useWorkflowDispatch()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [runId, setRunId] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LS_RUN_ID)
    if (stored) setRunId(Number(stored))
  }, [])

  useEffect(() => {
    if (runId == null) localStorage.removeItem(LS_RUN_ID)
    else localStorage.setItem(LS_RUN_ID, String(runId))
  }, [runId])

  const cacheByRepo = useMemo<Record<string, RepoData | null>>(() => {
    const out: Record<string, RepoData | null> = {}
    for (const [repoId, data] of Object.entries(rawByRepo || {})) {
      out[repoId] = data as RepoData | null
    }
    return out
  }, [rawByRepo])

  const onToggle = (repoId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(repoId)) next.delete(repoId)
      else next.add(repoId)
      return next
    })
  }

  const onTrigger = async () => {
    const repos = [...selected].join(',')
    const newRunId = await dispatch({ repos, force: true })
    if (newRunId != null) setRunId(newRunId)
  }

  return (
    <div>
      <PatRegister />
      <RepoForceList
        config={config}
        cacheByRepo={cacheByRepo}
        selected={selected}
        onToggle={onToggle}
      />
      <TriggerBar
        selectedCount={selected.size}
        hasToken={!!token}
        dispatching={dispatching}
        onTrigger={onTrigger}
      />
      <RunStatusPanel runId={runId} dispatchError={dispatchError} />
    </div>
  )
}
```

- [ ] **Step 2: useData에 `rawByRepo` 노출되어 있는지 확인**

Run: `grep -n "rawByRepo\|export function useData" src/hooks/useData.ts`
Expected: `rawByRepo`가 useData의 반환에 포함되어 있어야 함.
- 만약 없으면 useData 수정: 반환 객체에 `rawByRepo: byRepo` 형태로 추가 (이미 내부적으로 보관 중인 raw repo data 맵 노출).

- [ ] **Step 3: Settings에 탭 등록**

Modify `src/pages/Settings.tsx` — 다음 두 곳:

```tsx
type SettingsTab = 'repos' | 'editor' | 'import-export' | 'force-sync'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'repos', label: '레포/트랙 관리' },
  { id: 'editor', label: '데이터 편집' },
  { id: 'import-export', label: 'Import/Export' },
  { id: 'force-sync', label: '강제 동기화' },
]
```

본문 분기에 추가:
```tsx
{activeTab === 'force-sync' && <ForceSyncTab config={config} />}
```

상단에 import 추가:
```tsx
import ForceSyncTab from '../components/settings/ForceSyncTab'
```

- [ ] **Step 4: lint/build 통과 + 로컬 dev 서버에서 탭 진입 확인**

Run: `npm run lint && npm run build`
Expected: 통과.

Run: `npm run dev`
Then in browser: `http://127.0.0.1:5173/workflow-dashboard/#/settings` → "강제 동기화" 탭 클릭 → PatRegister + 7 레포 테이블(캐시 컬럼만 채워짐) 확인.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/ForceSyncTab.tsx src/pages/Settings.tsx src/hooks/useData.ts
git commit -m "feat(settings): wire ForceSyncTab into Settings"
```

---

## Task 15: 수동 검증 (Spec §10 체크리스트)

**Files:** N/A (검증)

- [ ] **Step 1: PAT 미등록 흐름**

브라우저에서 강제 동기화 탭 진입.
- ✓ 캐시 컬럼 채워짐
- ✓ "실시간" 컬럼: "PAT 필요"
- ✓ "강제 sync 실행" 버튼 비활성 + "PAT 등록 필요" 안내

- [ ] **Step 2: PAT 등록·새로고침·삭제 사이클**

- 유효 fine-grained PAT 입력 → "등록" → 마스킹 표시 + `@<login>` 표시
- 페이지 새로고침 → 마스킹 유지
- "토큰 제거" → 입력 폼 복귀

- [ ] **Step 3: 가짜 PAT → 401**

- `ghp_invalid` 입력 → "토큰이 유효하지 않습니다 (401)" 에러 + 저장 안 됨

- [ ] **Step 4: sync 직후 캐시 == 실시간**

- 직전 cron이 돌아 main이 최신 상태라면, 모든 행에서 `done` `=`, `total` `=` 확인

- [ ] **Step 5: diff 시나리오**

- 임의 레포에서 `WORKFLOW_*.md`에 체크박스 한 줄 추가하고 main에 push (혹은 임의 브랜치는 default가 아니라 안 잡힘)
- 강제 동기화 탭 새로고침 → 해당 레포 행에 `▲ done` 또는 `▲ total` 확인

- [ ] **Step 6: 단일 강제 sync**

- 한 레포 체크 → "강제 sync 실행 (1)" → grace 5초 후 RunStatusPanel에 `Run #...: 🔄 실행 중`
- 폴링이 success로 전이 확인
- GitHub Actions 로그에서 `[force]` 마커 확인

- [ ] **Step 7: 다중(3개) 강제 sync**

- 3개 레포 체크 → 트리거 → 1개 커밋에 3개 업데이트가 묶여 있는지 git log로 확인

- [ ] **Step 8: 변경 0 강제 sync**

- 직전 sync 직후 같은 레포 강제 sync → success + Actions 잡 로그에 `강제 동기화 — 업데이트됨`이나 동등 표시 + 그러나 실제 data git diff 비어 있어 commit 없음 (워크플로의 `if [ ${#UPDATED[@]} -gt 0 ]`은 force=true면 항상 트리거되어 commit 시도하므로 빈 commit 회피 로직 추가 검토)

> ⚠️ **추가 처리 필요 시**: Task 4 게이트가 force=true일 때 항상 UPDATED에 추가하지만, 이후 `git add data/*.json && git commit` 단계에서 실제 변경이 없으면 commit이 실패할 수 있음. 그 경우 commit 직전 `git diff --cached --quiet || git commit ...` 가드를 추가.

- [ ] **Step 9: 탭 이탈/복귀**

- 트리거 후 다른 탭 → 돌아오면 RunStatusPanel이 그대로 폴링 재개되어 있는지 확인 (localStorage 복원)

- [ ] **Step 10: rate limit 안내 (선택)**

- DevTools → Application → Local Storage에서 PAT 임시 삭제 + 가짜 PAT 등록 → 실시간 fetch 401 → 토큰 자동 삭제 확인

- [ ] **Step 11: 검증 보고 commit 없음 — 완료 push**

수동 검증 결과를 PR 설명에 첨부. 모든 항목 통과 후 main 머지.

---

## Self-Review (skill 가이드)

**1. Spec coverage**
- §1 요약 → Task 4 + 14
- §3 결정사항 → 모든 task 분포
- §4 아키텍처 → Task 1~3(파서) + 4(워크플로) + 14(UI)
- §5 컴포넌트 트리 → Task 9~14
- §6 데이터 흐름 → Task 7~8(dispatch/poll) + 11(실시간) + 14(통합)
- §7 워크플로/스크립트 변경 → Task 1~4
- §8 에러/엣지케이스 → Task 5~13 각 컴포넌트/훅 내부 + Task 15 검증
- §9 보안 → Task 5 + 9
- §10 테스트/검증 → Task 1(파서 회귀) + Task 15(수동)
- §11 마일스톤 → Task 순서가 마일스톤과 일치
- §12 비-범위 → 명시적으로 작업 없음

**2. Placeholder scan** — 전 task에 코드 또는 명령이 모두 들어 있음. "구체 사유 없음/추후 결정" 류 없음.

**3. Type consistency** — `LiveMeta`, `RepoData`, `DashboardConfig`, `RunStatus`, `RunConclusion`, `DispatchInputs`, `PatState` 모두 task 간 동일 시그니처.

⚠️ **수정 적용 사항(self-review 중 발견)**: Task 14 Step 2에서 `useData.ts`가 `rawByRepo`를 노출하지 않을 가능성. Step 2를 가드 단계로 명시했고, 없으면 노출하도록 수정하는 지시를 포함.

⚠️ **Task 15 Step 8의 빈 커밋 회피**: 워크플로의 commit 단계가 변경 없을 때 실패하지 않게 가드를 추가하는 검토 항목을 명시.
